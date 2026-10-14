 
/* =====================================================
   WORLDTRIP — APPLICATION LOGIC
   Created by BANDI RITHIN REDDY
   Version 1.0
   ===================================================== */

"use strict";

/* 01. CONFIGURATION
   Use your own Supabase project URL and public client key.
   Never use a service_role or secret key here.
*/

const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY";

const TABLE_TRIPS = "saved_trips";

const hasSupabaseConfig =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_SUPABASE") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

let db = null;
let currentUser = null;
let authMode = "login";
let worldMap = null;
let mapMarker = null;
let lastBudget = null;

/* 02. DOM HELPERS */

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

function showMessage(element, message, type = "") {
  if (!element) return;

  element.textContent = message;
  element.classList.remove("notice-success", "notice-error");

  if (type === "success") {
    element.classList.add("notice-success");
  } else if (type === "error") {
    element.classList.add("notice-error");
  }
}

function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function validNumber(input, minimum = 0, maximum = 1000000000) {
  const value = Number(input?.value);

  if (
    !input ||
    input.value.trim() === "" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    return null;
  }

  return value;
}

function setBusy(button, busy, busyText = "Please wait...") {
  if (!button) return;

  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;
    button.disabled = false;
    delete button.dataset.originalText;
  }
}

/* 03. SUPABASE INITIALIZATION */

function initializeSupabase() {
  if (!hasSupabaseConfig) {
    console.info(
      "WorldTrip: Add your Supabase URL and public key to enable accounts and cloud-saved trips."
    );
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("Supabase client library did not load.");
    return;
  }

  try {
    db = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    startAuthListener();
  } catch (error) {
    console.error("Supabase initialization failed:", error);
  }
}

/* 04. MOBILE NAVIGATION */

function initializeNavigation() {
  const menuButton = $("#mobileMenuBtn");
  const navLinks = $("#navLinks");

  if (!menuButton || !navLinks) return;

  menuButton.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");

    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu"
    );

    menuButton.textContent = isOpen ? "✕" : "☰";
  });

  $$("a", navLinks).forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation menu");
      menuButton.textContent = "☰";
    });
  });
}

/* 05. DESTINATION SEARCH AND FILTERS */

function initializeDestinationSearch() {
  const searchInput = $("#destinationSearch");
  const searchButton = $("#searchDestinations");
  const searchMessage = $("#searchMessage");
  const cards = $$(".destination-card");
  const filterButtons = $$(".filter-chip");

  let activeCategory = "all";

  function applyFilters() {
    const query = (searchInput?.value || "")
      .trim()
      .toLowerCase();

    let visibleCount = 0;

    cards.forEach((card) => {
      const category = card.dataset.category || "";
      const searchableText = [
        card.dataset.search || "",
        card.textContent || ""
      ].join(" ").toLowerCase();

      const matchesCategory =
        activeCategory === "all" ||
        category === activeCategory;

      const matchesQuery =
        !query || searchableText.includes(query);

      const visible = matchesCategory && matchesQuery;

      card.hidden = !visible;

      if (visible) visibleCount++;
    });

    if (query && visibleCount === 0) {
      showMessage(
        searchMessage,
        "No featured card matches this search. Try the map search below to find other places."
      );
    } else if (query) {
      showMessage(
        searchMessage,
        `${visibleCount} featured destination${visibleCount === 1 ? "" : "s"} found.`
      );
    } else {
      showMessage(searchMessage, "");
    }
  }

  searchButton?.addEventListener("click", () => {
    applyFilters();

    $("#destinations")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFilters();

      $("#destinations")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });

  searchInput?.addEventListener("input", applyFilters);

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category || "all";

      filterButtons.forEach((item) => {
        const selected = item === button;

        item.classList.toggle("active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });

      applyFilters();
    });
  });

  $$(".destination-plan").forEach((link) => {
    link.addEventListener("click", () => {
      const destination = link.dataset.place;
      const destinationInput = $("#tripDestination");

      if (destinationInput && destination) {
        destinationInput.value = destination;
      }
    });
  });
}

/* 06. INR TRIP BUDGET CALCULATOR */

function initializeBudgetCalculator() {
  const form = $("#moneyForm");
  const result = $("#costResult");

  if (!form || !result) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const transport = validNumber($("#costTransport"));
    const hotelRate = validNumber($("#costHotel"));
    const rooms = validNumber($("#costRooms"), 1, 100);
    const nights = validNumber($("#tripDays"), 0, 365);
    const foodPerPersonDay = validNumber($("#costFood"));
    const travellers = validNumber($("#travellers"), 1, 100);
    const localTransport = validNumber($("#costLocal"));
    const activities = validNumber($("#costActivities"));
    const visa = validNumber($("#costVisa"));
    const other = validNumber($("#costOther"));
    const reservePercent = validNumber($("#costReserve"), 0, 100);

    const values = [
      transport,
      hotelRate,
      rooms,
      nights,
      foodPerPersonDay,
      travellers,
      localTransport,
      activities,
      visa,
      other,
      reservePercent
    ];

    if (values.some((value) => value === null)) {
      result.hidden = false;
      showMessage(
        result,
        "Please check all fields. Enter valid non-negative amounts, at least one room and one traveller.",
        "error"
      );
      return;
    }

    /*
      Hotel cost = room rate × rooms × nights.
      Food cost = daily food rate × travellers × trip days.
      Trip days = nights + 1.
      Transport, local transport, activities, visa and other
      expenses are entered as TOTAL trip amounts.
    */

    const tripDays = nights + 1;
    const hotelTotal = hotelRate * rooms * nights;
    const foodTotal = foodPerPersonDay * travellers * tripDays;

    const baseCosts = {
      transport,
      accommodation: hotelTotal,
      food: foodTotal,
      localTransport,
      activities,
      visa,
      other
    };

    const subtotal = Object.values(baseCosts).reduce(
      (sum, value) => sum + value,
      0
    );

    const reserve = subtotal * reservePercent / 100;
    const total = subtotal + reserve;
    const perTraveller = total / travellers;
    const perDay = total / tripDays;

    if (
      !Number.isFinite(total) ||
      total > Number.MAX_SAFE_INTEGER
    ) {
      result.hidden = false;
      showMessage(
        result,
        "The calculated amount is too large. Please check your inputs.",
        "error"
      );
      return;
    }

    lastBudget = {
      currency: "INR",
      subtotal,
      reserve,
      reservePercent,
      total,
      travellers,
      tripDays,
      perTraveller,
      perDay,
      breakdown: {
        ...baseCosts,
        emergencyReserve: reserve
      }
    };

    result.hidden = false;
    result.classList.remove("notice-error");

    result.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "eyebrow";
    heading.textContent = "Your estimated trip budget";

    const totalHeading = document.createElement("div");
    totalHeading.className = "cost-total";
    totalHeading.textContent = formatINR(total);

    const note = document.createElement("p");
    note.className = "cost-note";
    note.textContent =
      `${tripDays} day${tripDays === 1 ? "" : "s"} · ` +
      `${travellers} traveller${travellers === 1 ? "" : "s"} · ` +
      `${reservePercent}% emergency reserve`;

    const breakdownHeading = document.createElement("h3");
    breakdownHeading.textContent = "Cost breakdown";
    breakdownHeading.style.marginTop = "24px";

    const breakdown = document.createElement("div");
    breakdown.className = "cost-breakdown";

    const labels = [
      ["Transport & flights", transport],
      ["Accommodation", hotelTotal],
      ["Food", foodTotal],
      ["Local transport", localTransport],
      ["Activities", activities],
      ["Visa & insurance", visa],
      ["Other expenses", other],
      [`Emergency reserve (${reservePercent}%)`, reserve]
    ];

    labels.forEach(([label, amount]) => {
      const row = document.createElement("div");
      row.className = "cost-row";

      const name = document.createElement("span");
      name.textContent = label;

      const value = document.createElement("strong");
      value.textContent = formatINR(amount);

      row.append(name, value);
      breakdown.append(row);
    });

    const perTravellerRow = document.createElement("div");
    perTravellerRow.className = "cost-row";

    const perTravellerLabel = document.createElement("strong");
    perTravellerLabel.textContent = "Estimated cost per traveller";

    const perTravellerValue = document.createElement("strong");
    perTravellerValue.textContent = formatINR(perTraveller);

    perTravellerRow.append(
      perTravellerLabel,
      perTravellerValue
    );

    const perDayRow = document.createElement("div");
    perDayRow.className = "cost-row";

    const perDayLabel = document.createElement("span");
    perDayLabel.textContent = "Estimated total per day";

    const perDayValue = document.createElement("strong");
    perDayValue.textContent = formatINR(perDay);

    perDayRow.append(perDayLabel, perDayValue);

    const disclaimer = document.createElement("p");
    disclaimer.className = "cost-note";
    disclaimer.style.marginTop = "20px";
    disclaimer.textContent =
      "Estimate only. Prices are based on your inputs, not live booking rates. " +
      "Food is calculated for nights + 1 day. Transport and other trip amounts " +
      "are treated as totals for the entire group.";

    breakdown.append(perTravellerRow, perDayRow);

    result.append(
      heading,
      totalHeading,
      note,
      breakdownHeading,
      breakdown,
      disclaimer
    );

    result.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  });
}

/* 07. TRIP FORM AND VALIDATION */

function initializeTripForm() {
  const form = $("#tripForm");
  const message = $("#tripMessage");

  if (!form) return;

  const startInput = $("#tripStart");
  const endInput = $("#tripEnd");

  function updateReturnDateMinimum() {
    if (startInput?.value && endInput) {
      endInput.min = startInput.value;

      if (
        endInput.value &&
        endInput.value < startInput.value
      ) {
        endInput.value = "";
      }
    }
  }

  startInput?.addEventListener("change", updateReturnDateMinimum);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const origin = $("#tripOrigin")?.value.trim();
    const destination = $("#tripDestination")?.value.trim();
    const startDate = startInput?.value;
    const endDate = endInput?.value;
    const travellers = Number($("#tripTravellers")?.value);
    const style = $("#tripStyle")?.value;

    if (!origin || !destination || !startDate || !endDate) {
      showMessage(message, "Complete all trip details.", "error");
      return;
    }

    if (endDate < startDate) {
      showMessage(
        message,
        "Your return date must be the same as or later than your departure date.",
        "error"
      );
      return;
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const days = Math.round((end - start) / 86400000) + 1;
    const nights = days - 1;

    const trip = {
      origin,
      destination,
      startDate,
      endDate,
      days,
      nights,
      travellers,
      style
    };

    if (!db || !currentUser) {
      showMessage(
        message,
        "Trip details are valid. Sign in after Supabase is configured to save this trip to your account.",
        "success"
      );

      openAuth("login");
      return;
    }

    const button = $('button[type="submit"]', form);
    setBusy(button, true, "Saving trip...");

    try {
      const { error } = await db
        .from(TABLE_TRIPS)
        .insert({
          user_id: currentUser.id,
          title: `${origin} to ${destination}`,
          destination,
          budget: lastBudget?.total ?? null,
          trip_data: trip
        });

      if (error) throw error;

      showMessage(
        message,
        "Your trip has been saved to your WorldTrip account.",
        "success"
      );

      await loadSavedTrips();
    } catch (error) {
      console.error("Could not save trip:", error);

      showMessage(
        message,
        "Unable to save this trip. Check your saved_trips table and its Row Level Security policies.",
        "error"
      );
    } finally {
      setBusy(button, false);
    }
  });
}

/* 08. MAP INITIALIZATION */

function initializeMap() {
  const mapElement = $("#worldMap");

  if (!mapElement) return;

  if (!window.L) {
    showMessage(
      $("#mapSearchResults"),
      "The map library did not load. Check your internet connection."
    );
    return;
  }

  try {
    worldMap = window.L.map(mapElement).setView([20, 0], 2);

    window.L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    ).addTo(worldMap);
  } catch (error) {
    console.error("Map initialization failed:", error);
  }
}

/* 09. PLACE SEARCH */

function initializeMapSearch() {
  const form = $("#mapSearchForm");
  const input = $("#mapSearchInput");
  const results = $("#mapSearchResults");

  if (!form || !input || !results) return;

  let searchInProgress = false;
  let lastSearchTime = 0;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const query = input.value.trim();

    if (query.length < 2) {
      showMessage(results, "Enter a place name to search.");
      return;
    }

    if (searchInProgress) return;

    /*
      Nominatim is a public geocoding service.
      Keep searches user-initiated and avoid repeated requests.
      For production-scale use, review its usage policy or use
      a suitable commercial geocoding provider.
    */

    const waitTime = Date.now() - lastSearchTime;

    if (waitTime < 1100) {
      showMessage(
        results,
        "Please wait a moment before searching again."
      );
      return;
    }

    searchInProgress = true;
    lastSearchTime = Date.now();

    results.replaceChildren();

    const loading = document.createElement("p");
    loading.textContent = "Searching for places...";
    results.append(loading);

    try {
      const url = new URL(
        "https://nominatim.openstreetmap.org/search"
      );

      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      url.searchParams.set("addressdetails", "1");

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Place search returned ${response.status}`);
      }

      const places = await response.json();

      results.replaceChildren();

      if (!Array.isArray(places) || places.length === 0) {
        showMessage(
          results,
          "No places found. Try a more specific name or nearby city."
        );
        return;
      }

      places.forEach((place) => {
        const card = document.createElement("article");
        card.className = "trip-card";

        const title = document.createElement("h3");
        title.textContent = place.display_name || query;

        const detail = document.createElement("p");
        detail.className = "text-muted text-small";
        detail.textContent =
          `${Number(place.lat).toFixed(5)}, ` +
          `${Number(place.lon).toFixed(5)}`;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-secondary";
        button.textContent = "View on map";

        button.addEventListener("click", () => {
          const lat = Number(place.lat);
          const lon = Number(place.lon);

          if (
            !worldMap ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
          ) {
            return;
          }

          worldMap.setView([lat, lon], 13);

          if (mapMarker) {
            worldMap.removeLayer(mapMarker);
          }

          mapMarker = window.L.marker([lat, lon])
            .addTo(worldMap)
            .bindPopup(
              window.L.DomUtil.create("div", "").textContent =
                place.display_name || query
            );

          mapMarker.openPopup();

          $("#worldMap")?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        });

        card.append(title, detail, button);
        results.append(card);
      });
    } catch (error) {
      console.error("Place search failed:", error);

      showMessage(
        results,
        "Place search is temporarily unavailable. Please try again later."
      );
    } finally {
      searchInProgress = false;
    }
  });
}

/* 10. AUTHENTICATION MODAL */

function openAuth(mode = "login") {
  const backdrop = $("#authBackdrop");

  if (!backdrop) return;

  backdrop.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setAuthMode(mode);

  $("#authEmail")?.focus();
}

function closeAuth() {
  $("#authBackdrop")?.classList.add("hidden");
  document.body.style.overflow = "";
}

function setAuthMode(mode) {
  authMode = mode;

  const isRegister = mode === "register";
  const isReset = mode === "reset";

  const title = $("#authTitle");
  const description = $("#authDescription");
  const nameGroup = $("#authNameGroup");
  const nameInput = $("#authName");
  const passwordInput = $("#authPassword");
  const submitButton = $("#authSubmit");
  const forgotButton = $("#forgotPassword");
  const googleButton = $("#googleLogin");

  if (title) {
    title.textContent = isRegister
      ? "Create your travel account."
      : isReset
        ? "Reset your password."
        : "Your next journey awaits.";
  }

  if (description) {
    description.textContent = isRegister
      ? "Create an account to save your travel plans."
      : isReset
        ? "Enter your email to receive a reset link."
        : "Sign in to manage your travel plans.";
  }

  if (nameGroup) {
    nameGroup.classList.toggle("hidden", !isRegister);
  }

  if (nameInput) {
    nameInput.required = isRegister;
  }

  if (passwordInput) {
    passwordInput.classList.toggle("hidden", isReset);
    passwordInput.required = !isReset;
    passwordInput.autocomplete = isRegister
      ? "new-password"
      : "current-password";
  }

  if (submitButton) {
    submitButton.textContent = isRegister
      ? "Create account"
      : isReset
        ? "Send reset link"
        : "Log in";
  }

  if (forgotButton) {
    forgotButton.classList.toggle("hidden", isRegister || isReset);
  }

  if (googleButton) {
    googleButton.classList.toggle("hidden", isRegister || isReset);
  }

  showMessage($("#authMessage"), "");
}

function initializeAuthUI() {
  $("#loginButton")?.addEventListener("click", () => openAuth("login"));
  $("#savedTripsLogin")?.addEventListener("click", () => openAuth("login"));
  $("#closeAuth")?.addEventListener("click", closeAuth);

  $("#showLogin")?.addEventListener("click", () => setAuthMode("login"));
  $("#showRegister")?.addEventListener("click", () => setAuthMode("register"));

  $("#authBackdrop")?.addEventListener("click", (event) => {
    if (event.target === $("#authBackdrop")) {
      closeAuth();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !$("#authBackdrop")?.classList.contains("hidden")
    ) {
      closeAuth();
    }
  });

  $("#forgotPassword")?.addEventListener("click", () => {
    setAuthMode("reset");
  });

  $("#googleLogin")?.addEventListener("click", async () => {
    if (!db) {
      showMessage(
        $("#authMessage"),
        "Configure your Supabase project URL and public key first.",
        "error"
      );
      return;
    }

    try {
      const { error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error("Google sign-in failed:", error);

      showMessage(
        $("#authMessage"),
        "Google sign-in failed. Verify that Google OAuth is enabled and configured in Supabase.",
        "error"
      );
    }
  });

  $("#authForm")?.addEventListener("submit", handleAuthSubmit);
}

/* 11. SIGN IN, REGISTER AND RESET */

async function handleAuthSubmit(event) {
  event.preventDefault();

  const message = $("#authMessage");
  const email = $("#authEmail")?.value.trim();
  const password = $("#authPassword")?.value || "";
  const name = $("#authName")?.value.trim();
  const submitButton = $("#authSubmit");

  if (!db) {
    showMessage(
      message,
      "Supabase is not configured. Add your project URL and public client key in script.js.",
      "error"
    );
    return;
  }

  if (!email) {
    showMessage(message, "Enter a valid email address.", "error");
    return;
  }

  if (authMode !== "reset" && password.length < 8) {
    showMessage(
      message,
      "Your password must contain at least 8 characters.",
      "error"
    );
    return;
  }

  setBusy(submitButton, true);

  try {
    let result;

    if (authMode === "register") {
      result = await db.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (result.error) throw result.error;

      showMessage(
        message,
        "Account request submitted. If email verification is enabled, check your inbox to confirm your account.",
        "success"
      );

      return;
    }

    if (authMode === "reset") {
      result = await db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });

      if (result.error) throw result.error;

      showMessage(
        message,
        "If this email belongs to an account, a password reset link will be sent.",
        "success"
      );

      return;
    }

    result = await db.auth.signInWithPassword({
      email,
      password
    });

    if (result.error) throw result.error;

    currentUser = result.data.user;

    showMessage(message, "Signed in successfully.", "success");

    await loadSavedTrips();

    window.setTimeout(closeAuth, 500);
  } catch (error) {
    console.error("Authentication error:", error);

    showMessage(
      message,
      error.message || "Authentication failed. Please try again.",
      "error"
    );
  } finally {
    setBusy(submitButton, false);
  }
}

/* 12. SESSION MANAGEMENT */

function startAuthListener() {
  if (!db) return;

  db.auth.getSession().then(async ({ data, error }) => {
    if (error) {
      console.error("Could not retrieve session:", error);
      return;
    }

    currentUser = data.session?.user || null;

    await loadSavedTrips();
  });

  db.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;

    if (event === "SIGNED_OUT") {
      renderSignedOutTrips();
    }

    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      /*
        Defer database work until after the auth callback,
        avoiding unnecessary work inside the auth event.
      */
      Promise.resolve().then(() => loadSavedTrips());
    }
  });
}

/* 13. SAVED TRIPS */

function renderSignedOutTrips() {
  const container = $("#savedTrips");
  if (!container) return;

  container.replaceChildren();

  const empty = document.createElement("div");
  empty.className = "empty-state";

  const heading = document.createElement("h3");
  heading.textContent = "Your next adventure belongs here.";

  const description = document.createElement("p");
  description.textContent =
    "Sign in to see the trips saved to your account.";

  const button = document.createElement("button");
  button.className = "btn btn-secondary";
  button.type = "button";
  button.textContent = "Sign in to continue";
  button.addEventListener("click", () => openAuth("login"));

  empty.append(heading, description, button);
  container.append(empty);
}

async function loadSavedTrips() {
  const container = $("#savedTrips");

  if (!container) return;

  if (!db || !currentUser) {
    renderSignedOutTrips();
    return;
  }

  try {
    const { data, error } = await db
      .from(TABLE_TRIPS)
      .select("id,title,destination,budget,trip_data,created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    container.replaceChildren();

    if (!data || data.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";

      const heading = document.createElement("h3");
      heading.textContent = "Your travel collection starts here.";

      const description = document.createElement("p");
      description.textContent =
        "Create and save your first trip using the trip planner.";

      empty.append(heading, description);
      container.append(empty);
      return;
    }

    data.forEach((trip) => {
      const card = document.createElement("article");
      card.className = "trip-card";

      const heading = document.createElement("h3");
      heading.textContent = trip.title || trip.destination || "My trip";

      const destination = document.createElement("p");
      destination.textContent = trip.destination || "Destination not specified";

      const details = document.createElement("div");
      details.className = "trip-details";

      const budget = document.createElement("span");
      budget.textContent =
        trip.budget == null
          ? "Budget not calculated"
          : `Estimated budget: ${formatINR(Number(trip.budget))}`;

      details.append(budget);

      const actions = document.createElement("div");
      actions.className = "trip-actions";

      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "btn btn-secondary";
      openButton.textContent = "Edit trip details";

      openButton.addEventListener("click", () => {
        const tripData = trip.trip_data || {};

        $("#tripOrigin").value = tripData.origin || "";
        $("#tripDestination").value =
          tripData.destination || trip.destination || "";
        $("#tripStart").value = tripData.startDate || "";
        $("#tripEnd").value = tripData.endDate || "";

        if (tripData.travellers) {
          $("#tripTravellers").value = String(tripData.travellers);
        }

        if (tripData.style) {
          $("#tripStyle").value = tripData.style;
        }

        $("#planner")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn btn-ghost";
      deleteButton.textContent = "Delete";

      deleteButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
          "Delete this saved trip? This cannot be undone."
        );

        if (!confirmed) return;

        deleteButton.disabled = true;

        try {
          const { error: deleteError } = await db
            .from(TABLE_TRIPS)
            .delete()
            .eq("id", trip.id)
            .eq("user_id", currentUser.id);

          if (deleteError) throw deleteError;

          await loadSavedTrips();
        } catch (error) {
          console.error("Trip deletion failed:", error);

          window.alert(
            "Could not delete the trip. Check your Supabase table and security policies."
          );

          deleteButton.disabled = false;
        }
      });

      actions.append(openButton, deleteButton);
      card.append(heading, destination, details, actions);
      container.append(card);
    });
  } catch (error) {
    console.error("Could not load saved trips:", error);

    container.replaceChildren();

    const notice = document.createElement("div");
    notice.className = "notice notice-error";
    notice.textContent =
      "Saved trips could not be loaded. Verify your saved_trips table and Row Level Security policies.";

    container.append(notice);
  }
}

/* 14. FOOTER YEAR */

function initializeFooter() {
  const year = $("#currentYear");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
}

/* 15. APPLICATION STARTUP */

function initializeWorldTrip() {
  initializeNavigation();
  initializeDestinationSearch();
  initializeBudgetCalculator();
  initializeTripForm();
  initializeMap();
  initializeMapSearch();
  initializeAuthUI();
  initializeFooter();
  initializeSupabase();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeWorldTrip,
    { once: true }
  );
} else {
  initializeWorldTrip();
}
