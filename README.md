
# 🌍 WorldTrip

### Discover the World. Plan Your Journey. Manage Your Budget.

**Created by BANDI RITHIN REDDY**

WorldTrip is a responsive travel-planning website designed to help travellers explore destinations, discover places on an interactive map, estimate trip expenses, and save their travel plans.

## ✨ Features

### 🌎 Explore Destinations
- Discover destinations across India and around the world.
- Explore cities, countries, beaches, mountains, temples, waterfalls, and historical places.
- Search for destinations and locations.
- View locations on an interactive map.

### 🗺️ Interactive World Map
- OpenStreetMap-powered map using Leaflet.
- Search for cities, landmarks, and other places.
- View matching locations on the map.
- Explore geographical locations worldwide.

### 💰 Trip Budget Calculator
Estimate your trip expenses, including:
- Flights and other transportation.
- Hotels and accommodation.
- Number of rooms and nights.
- Food expenses.
- Local transportation.
- Activities and sightseeing.
- Visa expenses.
- Other expenses and emergency reserve.
- Total estimated cost and average cost per traveller in INR.

### 🔐 User Authentication
- Register using email and password.
- Log in and log out securely through Supabase Auth.
- Request password-reset emails.
- Maintain user-specific saved trips.

### 💾 Saved Trips
- Save planned journeys to your account.
- View previously saved trips.
- Load a saved plan into the planner.
- Delete saved trips.

### 📱 Responsive Design
- Mobile-friendly interface.
- Desktop and tablet support.
- Premium travel-inspired design.
- Responsive navigation and destination cards.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Website structure |
| CSS3 | Responsive styling |
| JavaScript | Website functionality |
| Supabase | Authentication and database |
| Leaflet | Interactive maps |
| OpenStreetMap | Map data and tiles |
| Nominatim | Place search |
| Vercel | Website deployment |
| GitHub | Source-code hosting |

## 📁 Project Structure

```text
WorldTrip/
├── index.html
├── style.css
├── script.js
└── README.md
```

Keep these files in the same directory unless you update the file paths in `index.html`.

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the project

Open `index.html` in a code editor.

For local development, use a local development server when possible.

### 3. Configure Supabase

Create or open your Supabase project.

Copy the following values from your Supabase project settings:

- Project URL
- Publishable key or legacy anon/public key

Add these values to `script.js`:

```javascript
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY";
```

**Security:** Never expose a Supabase service-role key or secret key in frontend JavaScript.

### 4. Configure the database

Create the required database tables in Supabase.

The saved-trip functionality expects a `saved_trips` table with these columns:

| Column | Suggested type |
|---|---|
| `id` | UUID or compatible primary key |
| `user_id` | UUID referencing the authenticated user |
| `title` | Text |
| `destination` | Text |
| `budget` | Numeric |
| `trip_data` | JSONB |
| `created_at` | Timestamp with time zone |

Use appropriate defaults for the primary key and timestamp.

Enable Row Level Security (RLS) and create policies that allow authenticated users to select, insert, and delete only their own records. Ensure inserts require `user_id` to match the authenticated user.

Configure Supabase Auth email confirmation and password-reset redirect URLs for your deployed domain.

### 5. Deploy using Vercel

1. Push your files to GitHub.
2. Sign in to Vercel.
3. Import your GitHub repository, or open your existing WorldTrip project.
4. For a plain HTML, CSS, and JavaScript frontend, configure the project as a static site if appropriate for your repository.
5. Set the output directory to the folder containing `index.html`, commonly `.` for a root-level static project.
6. Deploy and open the generated website URL.

If your repository uses a framework or build process, configure its actual build command and output directory instead.

## 🔧 Troubleshooting

### Supabase is not connecting
- Verify the project URL and public key.
- Check browser console errors.
- Confirm the Supabase JavaScript library loads.
- Verify that your database tables and RLS policies exist.

### Map is not displaying
- Check that Leaflet CSS and JavaScript are loaded.
- Confirm that the map container has a defined height.
- Check your internet connection and browser console.

### Saved trips are not working
- Verify the `saved_trips` column names.
- Confirm that the user is logged in.
- Check database permissions and RLS policies.
- Review errors in the browser console.

### Vercel deployment fails
- Verify the repository contains `index.html` at the expected path.
- Check the Vercel build logs.
- Confirm the output directory matches the project structure.

## ⚠️ Important Notes

- Trip budgets are estimates based on user-entered values; they are not live flight or hotel prices.
- Availability, bookings, visa fees, taxes, and exchange rates require separate provider integrations or verification.
- Public OpenStreetMap and Nominatim services have usage policies and availability limitations.
- Actual booking functionality requires authorized travel-provider integrations.
- Authentication and database access depend on correct Supabase configuration and security policies.

## 🔮 Future Enhancements

- Live flight and hotel price integrations.
- Real booking and enquiry workflows.
- More destination records and detailed travel guides.
- Route distance and travel-time calculations.
- Weather and currency conversion tools.
- Multi-day itinerary generation.
- Email confirmations and booking management.
- International travel planning with INR and local-currency budgets.

## 👨‍💻 Creator

**Created by BANDI RITHIN REDDY**

WorldTrip — Explore More. Travel Better. 🌍

---

© 2026 WorldTrip. All rights reserved.
