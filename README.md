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
- **Change demo listings / map centre / CO₂ factors:** `js/data.js`, then click **Reset demo data** in the footer.

## Deploy free on GitHub Pages (for the submission link)

1. Create a new public repo on GitHub, e.g. `recircle`.
2. In VS Code terminal, inside the folder:
   ```bash
   git init
   git add .
   git commit -m "ReCircle - TERRACODE 2026"
   git branch -M main
   git remote add origin https://github.com/<your-username>/recircle.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
4. After a minute your site is live at `https://<your-username>.github.io/recircle/`.

Submit both the **GitHub repo link** and the **Pages link**.

## Notes on the demo

- Data is stored in the browser (`localStorage`), so each visitor has their own copy. No server or sign-up needed.
- The other person in chat is simulated with friendly auto-replies so judges can try the full flow:
  **List waste → Messages → Mark as exchanged → see it on History & Impact.**
- CO₂e numbers are indicative estimates (weight × per-material factor in `js/data.js`).
- To make it truly multi-user later, keep the function names in `js/store.js` and swap their insides
  for an open-source backend such as Supabase or PocketBase.
