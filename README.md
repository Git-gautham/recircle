# ♻️ ReCircle — Waste Exchange Platform

> One person's waste is another's raw material.

ReCircle is a circular-economy marketplace that connects people who **generate** waste
(restaurants, shops, households) with people who can **reuse** it (students, makers, recyclers).
Built for **TERRACODE 2026** — theme *Green Tomorrow: Building a Sustainable Future*.

## Features

| Feature | Where |
|---|---|
| Waste listing & categorisation (10 material types, photo upload, "Available" vs "Wanted" posts) | `post.html` |
| Location-based discovery (map, distance filter, "Use my location", nearest-first sort) | `marketplace.html` |
| Buyer / seller messaging with quick replies | `messages.html` |
| Waste exchange history (timeline, filter, CSV export) | `history.html` |
| Recycling impact dashboard (kg diverted, CO₂e avoided, charts, leaderboard) | `impact.html` |
| **Unique:** *Circular matches* — every listing shows nearby people on the other side of the loop (offers ↔ wanted) | listing popup |

Also: dark mode, mobile layout, editable profile, reset-demo button.

## 100% free & open source

| Tool | License | Used for |
|---|---|---|
| Plain HTML, CSS, JavaScript | — | the whole site, no build step |
| [Leaflet](https://leafletjs.com) 1.9.4 | BSD-2 | maps |
| [OpenStreetMap](https://www.openstreetmap.org) tiles | ODbL | map data |
| [Chart.js](https://www.chartjs.org) 4 | MIT | dashboard charts |
| Fraunces & DM Sans fonts | SIL OFL | typography |

All libraries and fonts are bundled in `vendor/` and `assets/fonts/` — only the map tiles need internet.

## Run it in VS Code

1. Open the `recircle` folder in VS Code (**File → Open Folder**).
2. Install the free **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` → **Open with Live Server**.

(Double-clicking `index.html` also works, but Live Server reloads the page every time you save.)

## Project structure

```
recircle/
├── index.html          Home
├── marketplace.html    Browse + map
├── post.html           Create a listing
├── messages.html       Chat
├── history.html        Exchange history
├── impact.html         Impact dashboard
├── css/style.css       All styles (colours at the top in :root)
├── js/
│   ├── data.js         Seed data, categories, CO₂ factors  ← edit demo content here
│   ├── store.js        Saves everything in localStorage
│   ├── ui.js           Navbar, footer, shared helpers
│   ├── detail.js       Listing popup + circular matches
│   └── home.js, marketplace.js, post.js, messages.js, history.js, impact.js
├── vendor/             Leaflet + Chart.js (local copies)
└── assets/             Favicon + fonts
```

### Common edits
- **Change colours:** `css/style.css` → `:root { --brand: … }`
- **Change menu links:** `js/ui.js` → `NAV_LINKS`
- **Change the map centre / CO₂ factors:** `js/data.js`.

## Published links

- **GitHub repository:** <https://github.com/Git-gautham/recircle>
- **Live GitHub Pages site:** <https://git-gautham.github.io/recircle/>

GitHub Pages is configured to deploy the `main` branch from the repository root.

## User management

The site now uses Supabase Authentication for account creation, sign-in, profiles,
roles and sign-out. To enable it in a new Supabase project:

1. Open the Supabase SQL Editor.
2. If you already ran the original schema, run
   [`supabase/shared-data.sql`](supabase/shared-data.sql). For a new project,
   [`supabase/schema.sql`](supabase/schema.sql) includes the complete schema.
3. In **Authentication → Providers**, enable Email.
4. In **Authentication → URL Configuration**, set the **Site URL** to
   `https://git-gautham.github.io/recircle/` and add that same URL under
   **Redirect URLs**.
5. To brand verification emails, open **Authentication → Emails → Confirm signup**,
   paste [`supabase/confirm-signup-email.html`](supabase/confirm-signup-email.html)
   into the email body, and save.
6. Visit the live site and click **Sign in** in the header.

The frontend contains only the Supabase publishable key. Never expose a
`service_role` key in the site. Authenticated listings, conversations and
messages created after the shared-data migration are stored in Supabase and
visible according to the RLS policies. The original seed demo data remains
browser-local.

## Notes on the demo

- New users start with an empty marketplace; authenticated listings and
  messages are shared through Supabase.
- Messages are sent between real authenticated accounts.
- CO₂e numbers are indicative estimates (weight × per-material factor in `js/data.js`).
- To make it truly multi-user later, keep the function names in `js/store.js` and swap their insides
  for an open-source backend such as Supabase or PocketBase.
