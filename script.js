
"use strict";

/*
 * WorldTrip
 * Created by BANDI RITHIN REDDY
 *
 * IMPORTANT:
 * Use your Supabase Project URL and publishable/anon key.
 * Never put a Supabase service_role or secret key in frontend code.
 */

const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY";

const $ = (id) => document.getElementById(id);

const byAnyId = (...ids) => {
  for (const id of ids) {
    const element = $(id);
    if (element) return element;
  }
  return null;
};

const moneyINR = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

function showMessage(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.className = `status-message ${type}`.trim();
  element.hidden = false;
}

function setText(element, message) {
  if (element) element.textContent = message;
}

function getSupabaseClient() {
  if (
    !SUPABASE_URL.startsWith("https://") ||
    SUPABASE_URL.includes("YOUR_SUPABASE") ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")
  ) {
    console.warn(
      "WorldTrip: Add your Supabase Project URL and publishable/anon key."
    );
    return null;
  }

  if (!window.supabase?.createClient) {
    console.error("Supabase JavaScript library was not loaded.");
    return null;
  }

  return window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}

const supabaseClient = getSupabaseClient();

let currentUser = null;
let authMode = "signup";
let worldMap = null;
let mapMarkers = [];
let lastCalculation = null;
let lastPlaces = [];

/* --------------------------------
   STATUS / GENERAL HELPERS
--------------------------------- */

function getStatusElement() {
  return byAnyId("appMessage", "statusMessage", "generalMessage");
}

function notify(message, type = "") {
  const element = getStatusElement();

  if (element) {
    showMessage(element, message, type);
  } else {
    console.info("WorldTrip:", message);
  }
}

/* --------------------------------
   MOBILE NAVIGATION
--------------------------------- */

function initializeNavigation() {
  const menuButton = byAnyId(
    "mobileMenuBtn",
    "menuToggle",
    "mobile-menu-btn"
  );

  const nav = byAnyId("navLinks", "navMenu");

  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });
  }

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      nav?.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
    });
  });
}

/* --------------------------------
   DESTINATION SEARCH
--------------------------------- */

function initializeDestinationSearch() {
  const form = byAnyId(
    "destinationSearchForm",
    "searchForm",
    "travelSearchForm"
  );

  const input = byAnyId(
    "destinationSearch",
    "searchDestination",
    "destinationInput",
    "searchInput"
  );

  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = input.value.trim();
    if (!query) {
      input.focus();
      return;
    }

    const placeInput = byAnyId("placeSearch", "mapSearchInput");
    if (placeInput) placeInput.value = query;

    $("worldtrip-tools")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    searchWorldPlaces(query);
  });
}

/* --------------------------------
   WORLD MAP
--------------------------------- */

function initializeMap() {
  const mapElement = $("worldMap");

  if (!mapElement || !window.L) {
    console.warn(
      "WorldTrip map unavailable. Check that Leaflet is included in index.html."
    );
    return;
  }

  if (worldMap) return;

  worldMap = L.map(mapElement).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(worldMap);

  setTimeout(() => worldMap?.invalidateSize(), 200);
}

function clearMapMarkers() {
  mapMarkers.forEach((marker) => marker.remove());
  mapMarkers = [];
}

function addPlaceMarker(place) {
  if (!worldMap || !window.L) return;

  const marker = L.marker([place.lat, place.lon]).addTo(worldMap);

  marker.bindPopup(
    `<strong>${escapeHTML(place.name)}</strong><br>` +
    `${escapeHTML(place.address || "Location")}`
  );

  mapMarkers.push(marker);
}

function renderPlaceResults(places) {
  const resultsElement = byAnyId(
    "placeResults",
    "worldPlaceResults",
    "mapResults"
  );

  if (!resultsElement) return;

  if (!places.length) {
    resultsElement.innerHTML =
      '<p class="empty-state">No places found. Try another city, landmark, or country.</p>';
    return;
  }

  resultsElement.innerHTML = places.map((place, index) => `
    <article class="place-result">
      <div>
        <h4>${escapeHTML(place.name)}</h4>
        <p>${escapeHTML(place.address || "Address unavailable")}</p>
      </div>
      <button class="btn btn-outline btn-small"
        type="button" data-place-index="${index}">
        View
      </button>
    </article>
  `).join("");

  resultsElement.querySelectorAll("[data-place-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const place = places[Number(button.dataset.placeIndex)];
      if (!place || !worldMap) return;

      worldMap.setView([place.lat, place.lon], 13);
      addPlaceMarker(place);
    });
  });
}

async function searchWorldPlaces(query) {
  const resultsElement = byAnyId(
    "placeResults",
    "worldPlaceResults",
    "mapResults"
  );

  if (!query?.trim()) {
    notify("Enter a place, city, or country to search.");
    return;
  }

  initializeMap();

  if (resultsElement) {
    resultsElement.innerHTML =
      '<p class="empty-state">Searching for places…</p>';
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query.trim());
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "8");

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("The map search service is temporarily unavailable.");
    }

    const data = await response.json();

    lastPlaces = data.map((item) => ({
      name:
        item.name ||
        item.display_name?.split(",")[0] ||
        "Unnamed place",
      address: item.display_name || "",
      lat: Number(item.lat),
      lon: Number(item.lon)
    })).filter((place) =>
      Number.isFinite(place.lat) && Number.isFinite(place.lon)
    );

    clearMapMarkers();
    renderPlaceResults(lastPlaces);

    if (!lastPlaces.length) {
      notify("No matching places found. Try a more specific search.");
      return;
    }

    lastPlaces.forEach(addPlaceMarker);

    if (worldMap) {
      const bounds = L.latLngBounds(
        lastPlaces.map((place) => [place.lat, place.lon])
      );

      if (lastPlaces.length === 1) {
        worldMap.setView(
          [lastPlaces[0].lat, lastPlaces[0].lon],
          12
        );
      } else {
        worldMap.fitBounds(bounds, { padding: [25, 25], maxZoom: 12 });
      }
    }
  } catch (error) {
    console.error("Place search error:", error);
    if (resultsElement) {
      resultsElement.innerHTML =
        '<p class="empty-state">Search failed. Please try again later.</p>';
    }
    notify(error.message || "Unable to search for places.");
  }
}

function initializePlaceSearch() {
  const form = byAnyId("placeSearchForm", "mapSearchForm");
  const input = byAnyId("placeSearch", "mapSearchInput");
  const button = byAnyId("placeSearchBtn", "mapSearchBtn");

  if (form && input) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      searchWorldPlaces(input.value);
    });
  } else if (button && input) {
    button.addEventListener("click", () => {
      searchWorldPlaces(input.value);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchWorldPlaces(input.value);
      }
    });
  }
}

/* --------------------------------
   TRIP COST CALCULATOR
--------------------------------- */

function readNumber(id, fallback = 0) {
  const element = $(id);
  if (!element || element.value.trim() === "") return fallback;

  const value = Number(element.value);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getTripCosts() {
  const transport = readNumber("costTransport");
  const hotelPerRoomPerNight = readNumber("costHotel");
  const rooms = Math.max(1, Math.floor(readNumber("costRooms", 1)));
  const foodPerPersonPerDay = readNumber("costFood");
  const localTransport = readNumber("costLocal");
  const activities = readNumber("costActivities");
  const visa = readNumber("costVisa");
  const other = readNumber("costOther");
  const reservePercent = Math.min(
    100,
    readNumber("costReserve", 10)
  );

  const days = Math.max(
    1,
    Math.floor(readNumber("tripDays", 1))
  );

  const travellers = Math.max(
    1,
    Math.floor(readNumber("travellers", 1))
  );

  const hotel = hotelPerRoomPerNight * rooms * days;
  const food = foodPerPersonPerDay * travellers * days;
  const base = transport + hotel + food +
    localTransport + activities + visa + other;

  const reserve = base * reservePercent / 100;
  const total = base + reserve;

  return {
    transport,
    hotel,
    food,
    localTransport,
    activities,
    visa,
    other,
    reserve,
    reservePercent,
    days,
    travellers,
    rooms,
    base,
    total,
    perPerson: total / travellers
  };
}

function renderCostResult(costs) {
  const resultElement = byAnyId(
    "costResult",
    "moneyResult",
    "calculatorResult",
    "budgetResult"
  );

  if (!resultElement) {
    notify(`Estimated trip cost: ${moneyINR(costs.total)}`);
    return;
  }

  resultElement.innerHTML = `
    <h4>Estimated Trip Budget</h4>
    <span class="result-total">${moneyINR(costs.total)}</span>
    <p>For ${costs.travellers} traveller(s) · ${costs.days} day(s)</p>
    <div class="cost-breakdown">
      <div class="cost-row"><span>Travel / flights</span><strong>${moneyINR(costs.transport)}</strong></div>
      <div class="cost-row"><span>Accommodation</span><strong>${moneyINR(costs.hotel)}</strong></div>
      <div class="cost-row"><span>Food</span><strong>${moneyINR(costs.food)}</strong></div>
      <div class="cost-row"><span>Local transport</span><strong>${moneyINR(costs.localTransport)}</strong></div>
      <div class="cost-row"><span>Activities</span><strong>${moneyINR(costs.activities)}</strong></div>
      <div class="cost-row"><span>Visa</span><strong>${moneyINR(costs.visa)}</strong></div>
      <div class="cost-row"><span>Other expenses</span><strong>${moneyINR(costs.other)}</strong></div>
      <div class="cost-row"><span>Reserve (${costs.reservePercent}%)</span><strong>${moneyINR(costs.reserve)}</strong></div>
      <div class="cost-row"><span>Per person</span><strong>${moneyINR(costs.perPerson)}</strong></div>
    </div>
    <p class="result-note">
      Planning estimate only. Prices, taxes, availability, and exchange rates
      are not live quotes.
    </p>
  `;

  resultElement.hidden = false;
}

function initializeCostCalculator() {
  const form = $("moneyForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const costs = getTripCosts();
    lastCalculation = costs;
    renderCostResult(costs);
  });

  form.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => {
      // Recalculate only after a previous calculation was requested.
      if (lastCalculation) {
        lastCalculation = getTripCosts();
        renderCostResult(lastCalculation);
      }
    });
  });
}

/* --------------------------------
   AUTHENTICATION MODAL
--------------------------------- */

function openAuthModal(mode = "signup") {
  authMode = mode;

  const backdrop = $("authBackdrop");
  if (!backdrop) {
    notify("Authentication modal was not found in index.html.");
    return;
  }

  backdrop.classList.add("active");
  backdrop.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  updateAuthMode();

  setTimeout(() => $("authEmail")?.focus(), 50);
}

function closeAuthModal() {
  const backdrop = $("authBackdrop");
  if (!backdrop) return;

  backdrop.classList.remove("active");
  backdrop.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function updateAuthMode() {
  const title = byAnyId("authTitle", "authHeading");
  const description = byAnyId("authDescription", "authSubtitle");
  const nameField = $("authName");
  const submitButton = byAnyId("authSubmitBtn", "authSubmit");
  const message = byAnyId("authMessage", "authStatus");

  if (title) {
    title.textContent = authMode === "login"
      ? "Welcome Back"
      : "Create Your Account";
  }

  if (description) {
    description.textContent = authMode === "login"
      ? "Log in to continue planning your trips."
      : "Join WorldTrip to save your travel plans.";
  }

  if (nameField) {
    const wrapper = nameField.closest(".field");
    if (wrapper) {
      wrapper.classList.toggle("hidden", authMode !== "signup");
    }
    nameField.required = authMode === "signup";
  }

  if (submitButton) {
    submitButton.textContent = authMode === "login"
      ? "Log In"
      : "Create Account";
  }

  if (message) {
    message.textContent = "";
    message.className = "auth-message";
  }
}

function setAuthMessage(message, type = "") {
  const element = byAnyId("authMessage", "authStatus");
  if (!element) {
    notify(message, type);
    return;
  }

  element.textContent = message;
  element.className = `auth-message ${type}`.trim();
}

function initializeAuthModal() {
  byAnyId("loginBtn", "loginButton", "openLogin")
    ?.addEventListener("click", () => openAuthModal("login"));

  byAnyId("registerBtn", "signupBtn", "registerButton", "openRegister")
    ?.addEventListener("click", () => openAuthModal("signup"));

  byAnyId("authClose", "closeAuth", "authCloseBtn")
    ?.addEventListener("click", closeAuthModal);

  const backdrop = $("authBackdrop");

  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) closeAuthModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAuthModal();
  });

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      openAuthModal(button.dataset.authMode === "login" ? "login" : "signup");
    });
  });

  const form = $("authForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      setAuthMessage(
        "Add your Supabase Project URL and publishable/anon key in script.js.",
        "error"
      );
      return;
    }

    const email = $("authEmail")?.value.trim();
    const password = $("authPassword")?.value;
    const name = $("authName")?.value.trim() || "";

    if (!email || !password) {
      setAuthMessage("Enter your email and password.", "error");
      return;
    }

    const submitButton = byAnyId("authSubmitBtn", "authSubmit");
    if (submitButton) submitButton.disabled = true;

    try {
      let result;

      if (authMode === "login") {
        result = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
      } else {
        result = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name }
          }
        });
      }

      if (result.error) throw result.error;

      if (authMode === "signup" && !result.data.session) {
        setAuthMessage(
          "Account created. Check your email to confirm your account before logging in.",
          "success"
        );
      } else {
        currentUser = result.data.user || null;
        setAuthMessage(
          authMode === "login"
            ? "Login successful!"
            : "Account created successfully!",
          "success"
        );

        await refreshAuthUI();

        setTimeout(closeAuthModal, 700);
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setAuthMessage(
        error.message || "Authentication failed. Please try again.",
        "error"
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  byAnyId("resetPasswordBtn", "forgotPasswordBtn", "resetPassword")
    ?.addEventListener("click", async () => {
      if (!supabaseClient) {
        setAuthMessage("Configure Supabase first.", "error");
        return;
      }

      const email = $("authEmail")?.value.trim();

      if (!email) {
        setAuthMessage("Enter your email first.", "error");
        $("authEmail")?.focus();
        return;
      }

      try {
        const redirectTo = window.location.origin +
          window.location.pathname;

        const { error } = await supabaseClient.auth.resetPasswordForEmail(
          email,
          { redirectTo }
        );

        if (error) throw error;

        setAuthMessage(
          "If the email is registered, password-reset instructions will be sent.",
          "success"
        );
      } catch (error) {
        setAuthMessage(error.message || "Unable to send reset email.", "error");
      }
    });

  byAnyId("logoutBtn", "logoutButton", "signOutBtn")
    ?.addEventListener("click", signOut);
}

async function signOut() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    notify(error.message, "error");
    return;
  }

  currentUser = null;
  await refreshAuthUI();
  notify("You have logged out.", "success");
}

async function refreshAuthUI() {
  const loginButton = byAnyId("loginBtn", "loginButton", "openLogin");
  const registerButton = byAnyId(
    "registerBtn",
    "signupBtn",
    "registerButton",
    "openRegister"
  );

  const logoutButton = byAnyId("logoutBtn", "logoutButton", "signOutBtn");
  const userLabel = byAnyId("userLabel", "currentUser", "userEmail");

  if (loginButton) loginButton.classList.toggle("hidden", Boolean(currentUser));
  if (registerButton) {
    registerButton.classList.toggle("hidden", Boolean(currentUser));
  }
  if (logoutButton) logoutButton.classList.toggle("hidden", !currentUser);

  if (userLabel) {
    userLabel.textContent = currentUser
      ? (currentUser.email || "Signed in")
      : "";
  }

  const saveButton = byAnyId("saveTripBtn", "saveCurrentTripBtn");
  if (saveButton) saveButton.disabled = !currentUser;

  await loadSavedTrips();
}

async function initializeAuthSession() {
  if (!supabaseClient) {
    await refreshAuthUI();
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) console.error("Session error:", error);

  currentUser = data?.session?.user || null;
  await refreshAuthUI();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;

    // Avoid making further Supabase calls inside the auth callback.
    setTimeout(() => refreshAuthUI(), 0);
  });
}

/* --------------------------------
   SAVE / LOAD TRIPS
--------------------------------- */

/*
 * Expected saved_trips columns:
 * id, user_id, title, destination, budget, trip_data, created_at
 *
 * The table must have Row Level Security enabled and policies that
 * allow users to manage only their own rows.
 */

function getTripFormData() {
  const destination = (
    byAnyId("tripDestination", "destination", "destinationInput")?.value ||
    $("placeSearch")?.value ||
    $("mapSearchInput")?.value ||
    ""
  ).trim();

  const origin = (
    byAnyId("tripOrigin", "origin", "startLocation")?.value || ""
  ).trim();

  const title = (
    byAnyId("tripTitle", "planName")?.value ||
    (destination ? `Trip to ${destination}` : "My WorldTrip")
  ).trim();

  const costs = lastCalculation || getTripCosts();

  return {
    title,
    origin,
    destination,
    budget: Math.round(costs.total),
    trip_data: {
      origin,
      destination,
      days: costs.days,
      travellers: costs.travellers,
      rooms: costs.rooms,
      costs,
      createdAt: new Date().toISOString()
    }
  };
}

async function saveTrip() {
  if (!supabaseClient) {
    notify("Configure Supabase before saving trips.", "error");
    return;
  }

  if (!currentUser) {
    openAuthModal("login");
    setAuthMessage("Log in to save your trips.", "error");
    return;
  }

  const trip = getTripFormData();

  if (!trip.destination) {
    notify("Enter a destination before saving your trip.", "error");
    return;
  }

  const saveButton = byAnyId("saveTripBtn", "saveCurrentTripBtn");
  if (saveButton) saveButton.disabled = true;

  try {
    const { error } = await supabaseClient
      .from("saved_trips")
      .insert({
        user_id: currentUser.id,
        title: trip.title,
        destination: trip.destination,
        budget: trip.budget,
        trip_data: trip.trip_data
      });

    if (error) throw error;

    notify("Trip saved successfully!", "success");
    await loadSavedTrips();
  } catch (error) {
    console.error("Save trip error:", error);
    notify(
      error.message ||
      "Unable to save trip. Check your saved_trips table and RLS policies.",
      "error"
    );
  } finally {
    if (saveButton) saveButton.disabled = !currentUser;
  }
}

function renderSavedTrips(trips) {
  const container = byAnyId("savedTrips", "savedTripsList");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML =
      '<p class="empty-state">Log in to view your saved trips.</p>';
    return;
  }

  if (!trips.length) {
    container.innerHTML =
      '<p class="empty-state">No saved trips yet. Plan a journey and save it here.</p>';
    return;
  }

  container.innerHTML = trips.map((trip) => `
    <article class="saved-trip-card">
      <h4>${escapeHTML(trip.title || "My WorldTrip")}</h4>
      <p>Destination: ${escapeHTML(trip.destination || "Not specified")}</p>
      <p>Estimated budget: ${moneyINR(trip.budget)}</p>
      <p>Saved: ${escapeHTML(
        trip.created_at
          ? new Date(trip.created_at).toLocaleDateString("en-IN")
          : "Recently"
      )}</p>
      <div class="saved-trip-actions">
        <button type="button" class="btn btn-outline btn-small"
          data-load-trip="${escapeHTML(trip.id)}">
          Load
        </button>
        <button type="button" class="btn btn-outline btn-small"
          data-delete-trip="${escapeHTML(trip.id)}">
          Delete
        </button>
      </div>
    </article>
  `).join("");

  container.querySelectorAll("[data-load-trip]").forEach((button) => {
    button.addEventListener("click", () => {
      const trip = trips.find(
        (item) => String(item.id) === button.dataset.loadTrip
      );

      if (trip) loadTripIntoForm(trip);
    });
  });

  container.querySelectorAll("[data-delete-trip]").forEach((button) => {
    button.addEventListener("click", async () => {
      const tripId = button.dataset.deleteTrip;

      if (!window.confirm("Delete this saved trip?")) return;

      try {
        const { error } = await supabaseClient
          .from("saved_trips")
          .delete()
          .eq("id", tripId)
          .eq("user_id", currentUser.id);

        if (error) throw error;

        notify("Saved trip deleted.", "success");
        await loadSavedTrips();
      } catch (error) {
        console.error("Delete trip error:", error);
        notify(error.message || "Unable to delete this trip.", "error");
      }
    });
  });
}

function loadTripIntoForm(trip) {
  const data = trip.trip_data || {};

  const titleInput = byAnyId("tripTitle", "planName");
  const destinationInput = byAnyId(
    "tripDestination",
    "destination",
    "destinationInput"
  );
  const originInput = byAnyId(
    "tripOrigin",
    "origin",
    "startLocation"
  );

  if (titleInput) titleInput.value = trip.title || "";
  if (destinationInput) {
    destinationInput.value = trip.destination || data.destination || "";
  }
  if (originInput) originInput.value = data.origin || "";

  if (data.costs) {
    const costs = data.costs;
    const values = {
      costTransport: costs.transport,
      costHotel: costs.rooms && costs.days
        ? costs.hotel / (costs.rooms * costs.days)
        : 0,
      costRooms: costs.rooms,
      costFood: costs.travellers && costs.days
        ? costs.food / (costs.travellers * costs.days)
        : 0,
      costLocal: costs.localTransport,
      costActivities: costs.activities,
      costVisa: costs.visa,
      costOther: costs.other,
      costReserve: costs.reservePercent,
      tripDays: costs.days,
      travellers: costs.travellers
    };

    Object.entries(values).forEach(([id, value]) => {
      const input = $(id);
      if (input && value !== undefined) input.value = value;
    });

    lastCalculation = getTripCosts();
    renderCostResult(lastCalculation);
  }

  $("moneyForm")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  notify("Trip loaded into the planner.", "success");
}

async function loadSavedTrips() {
  const container = byAnyId("savedTrips", "savedTripsList");

  if (!container) return;

  if (!currentUser || !supabaseClient) {
    renderSavedTrips([]);
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("saved_trips")
      .select("id,user_id,title,destination,budget,trip_data,created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    renderSavedTrips(data || []);
  } catch (error) {
    console.error("Load saved trips error:", error);
    container.innerHTML =
      '<p class="empty-state">Could not load trips. Check your saved_trips table columns and database policies.</p>';
  }
}

function initializeTripSaving() {
  byAnyId("saveTripBtn", "saveCurrentTripBtn")
    ?.addEventListener("click", saveTrip);
}

/* --------------------------------
   FOOTER YEAR
--------------------------------- */

function initializeFooter() {
  const yearElement = byAnyId("currentYear", "footerYear");
  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }
}

/* --------------------------------
   START WORLDTRIP
--------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  initializeNavigation();
  initializeDestinationSearch();
  initializeMap();
  initializePlaceSearch();
  initializeCostCalculator();
  initializeAuthModal();
  initializeTripSaving();
  initializeFooter();

  await initializeAuthSession();

  console.info("WorldTrip initialized.");
});
