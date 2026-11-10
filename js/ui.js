/* =========================================================
   ReCircle — shared UI: header, footer, helpers
   ---------------------------------------------------------
   The navigation is built here once and inserted on every
   page, so you only edit the menu in one place (NAV_LINKS).
   ========================================================= */

const NAV_LINKS = [
  { href: "index.html",       label: "Home" },
  { href: "marketplace.html", label: "Marketplace" },
  { href: "post.html",        label: "List waste" },
  { href: "messages.html",    label: "Messages", badge: true },
  { href: "history.html",     label: "History" },
  { href: "impact.html",      label: "Impact" }
];

/* ---------- small helpers ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Distance between two lat/lng points in km (Haversine formula) */
function distanceKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtKm = km => km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(km < 10 ? 1 : 0) + " km";
const fmtNum = n => Math.round(n).toLocaleString("en-IN");
const fmtDate = ts => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = ts => new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 86400 * 30) return Math.floor(s / 86400) + " d ago";
  return fmtDate(ts);
}

function priceLabel(l) {
  if (!Number(l.price)) return l.kind === "wanted" ? "Free / donation" : "Free";
  const per = /kg/.test(l.unit) ? "/kg" : "";
  return "₹" + l.price + per;
}

function catBadge(cat) {
  const c = CATEGORIES[cat] || CATEGORIES.other;
  return `<span class="cat" style="--cat:${c.color}"><span aria-hidden="true">${c.icon}</span>${esc(c.label)}</span>`;
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}
function avatar(user, size = "") {
  return `<span class="avatar ${size}" data-role="${esc(user.role)}" title="${esc(user.name)}">${esc(initials(user.name))}</span>`;
}

/* ---------- toast ---------- */
function toast(msg) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- location ---------- */
function myLocation() {
  const u = Store.me();
  return { lat: u.lat, lng: u.lng, place: u.place };
}
function detectLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      p => {
        const loc = { lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), place: "My location" };
        Store.saveMe(loc); resolve(loc);
      },
      err => reject(err),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}

/* ---------- theme (light / dark) ---------- */
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
try { applyTheme(localStorage.getItem("recircle_theme")); } catch (e) {}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("recircle_theme", next); } catch (e) {}
  document.dispatchEvent(new CustomEvent("themechange"));
}

/* ---------- header & footer ---------- */
function renderChrome() {
  const page = location.pathname.split("/").pop() || "index.html";
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap header-inner">
      <a class="brand" href="index.html" aria-label="ReCircle home">
        ${logoSVG()}<span>Re<em>Circle</em></span>
      </a>
      <button class="nav-toggle" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <nav class="site-nav" aria-label="Main">
        ${NAV_LINKS.map(n => `
          <a href="${n.href}" class="${n.href === page ? "active" : ""}">
            ${n.label}${n.badge ? `<span class="nav-badge" hidden></span>` : ""}
          </a>`).join("")}
      </nav>
      <div class="header-actions">
        <button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode" title="Toggle dark mode">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        </button>
        <button class="profile-btn" id="profileBtn" aria-label="Edit profile"></button>
      </div>
    </div>`;
  document.body.prepend(header);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="wrap footer-inner">
      <div>
        <div class="brand small">${logoSVG()}<span>Re<em>Circle</em></span></div>
        <p class="muted">One person's waste is another's raw material.<br>Built for TERRACODE 2026 · Theme: Green Tomorrow</p>
      </div>
      <div class="footer-links">
        ${NAV_LINKS.map(n => `<a href="${n.href}">${n.label}</a>`).join("")}
      </div>
      <div class="footer-meta">
        <p class="muted">Made with open-source tools: Leaflet, OpenStreetMap, Chart.js, Fraunces &amp; DM Sans.</p>
        <button class="link-btn" id="resetDemo">Reset demo data</button>
      </div>
    </div>`;
  document.body.appendChild(footer);

  /* mobile menu */
  const tgl = $(".nav-toggle", header);
  tgl.addEventListener("click", () => {
    const open = header.classList.toggle("nav-open");
    tgl.setAttribute("aria-expanded", open);
  });

  $("#themeBtn").addEventListener("click", toggleTheme);
  $("#profileBtn").addEventListener("click", openProfile);
  $("#resetDemo").addEventListener("click", () => {
    if (confirm("Reset all demo data? Your listings, chats and exchanges will be cleared.")) {
      Store.reset(); location.reload();
    }
  });

  refreshChrome();
}

function refreshChrome() {
  const me = Store.me();
  const btn = $("#profileBtn");
  if (btn) btn.innerHTML = Auth.isSignedIn()
    ? avatar(me) + `<span class="profile-name">${esc(me.name)}</span>`
    : `<span class="profile-name">Sign in</span>`;
  const n = Store.unreadCount();
  $$(".nav-badge").forEach(b => { b.hidden = !n; b.textContent = n; });
}

/* ---------- modal ---------- */
function openModal(html, { onOpen, wide } = {}) {
  closeModal();
  const m = document.createElement("div");
  m.className = "modal-backdrop";
  m.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="Close">×</button>${html}</div>`;
  document.body.appendChild(m);
  document.body.classList.add("no-scroll");
  m.addEventListener("click", e => { if (e.target === m || e.target.closest(".modal-close")) closeModal(); });
  document.addEventListener("keydown", escClose);
  requestAnimationFrame(() => m.classList.add("open"));
  if (onOpen) onOpen(m);
  return m;
}
function closeModal() {
  const m = $(".modal-backdrop");
  if (m) m.remove();
  document.body.classList.remove("no-scroll");
  document.removeEventListener("keydown", escClose);
}
function escClose(e) { if (e.key === "Escape") closeModal(); }

/* ---------- profile ---------- */
function openProfile() {
  if (!Auth.isSignedIn()) return openAuth();
  const me = Store.me();
  openModal(`
    <h2>Your profile</h2>
    <p class="muted">This name is shown on your listings and messages.</p>
    <form id="profileForm" class="form">
      <label>Name<input name="name" required maxlength="40" value="${esc(me.name)}"></label>
      <label>I am a
        <select name="role">
          ${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === me.role ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </label>
      <label>Area / town<input name="place" maxlength="40" value="${esc(me.place)}"></label>
      <div class="form-actions">
        <button type="button" class="btn ghost" id="geoBtn">📍 Use my location</button>
        <button class="btn primary">Save</button>
      </div>
      <button type="button" class="link-btn" id="signOutBtn">Sign out</button>
    </form>`, {
    onOpen(m) {
      $("#geoBtn", m).addEventListener("click", async () => {
        try { await detectLocation(); toast("Location updated"); $("[name=place]", m).value = "My location"; }
        catch (e) { toast("Couldn't get your location — allow location access and try again"); }
      });
      $("#profileForm", m).addEventListener("submit", e => {
        e.preventDefault();
        const f = new FormData(e.target);
        Auth.saveProfile({ name: f.get("name"), role: f.get("role"), place: f.get("place") })
          .then(() => { closeModal(); refreshChrome(); toast("Profile saved"); })
          .catch(err => toast(err.message || "Couldn't save profile"));
      });
      $("#signOutBtn", m).addEventListener("click", async () => {
        try { await Auth.signOut(); }
        catch (err) { toast(err.message || "Couldn't sign out"); }
      });
    }
  });
}

function openAuth() {
  openModal(`
    <h2 id="authTitle">Welcome to ReCircle</h2>
    <p class="muted" id="authIntro">Sign in to save your profile and connect with the community.</p>
    <form id="authForm" class="form">
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Password<input name="password" type="password" required minlength="6" autocomplete="current-password"></label>
      <label id="authNameWrap" hidden>Name<input name="name" maxlength="40" autocomplete="name"></label>
      <div class="form-actions">
        <button class="btn primary" id="authSubmit">Sign in</button>
        <button class="btn ghost" type="button" id="authToggle">Create account</button>
      </div>
      <p class="muted small" id="authError" role="alert"></p>
    </form>`, {
    onOpen(m) {
      let signup = false;
      const title = $("#authTitle", m), intro = $("#authIntro", m), name = $("#authNameWrap", m);
      const submit = $("#authSubmit", m), toggle = $("#authToggle", m), error = $("#authError", m);
      toggle.addEventListener("click", () => {
        signup = !signup;
        title.textContent = signup ? "Create your ReCircle account" : "Welcome to ReCircle";
        intro.textContent = signup ? "Join the local circular-economy community." : "Sign in to save your profile and connect with the community.";
        name.hidden = !signup;
        submit.textContent = signup ? "Create account" : "Sign in";
        toggle.textContent = signup ? "I already have an account" : "Create account";
      });
      $("#authForm", m).addEventListener("submit", async e => {
        e.preventDefault(); error.textContent = "";
        const f = new FormData(e.target);
        submit.disabled = true;
        try {
          if (signup) {
            const session = await Auth.signUp(f.get("email"), f.get("password"), f.get("name"));
            if (!session) { error.textContent = "Check your email to confirm your account, then sign in."; return; }
          } else await Auth.signIn(f.get("email"), f.get("password"));
          closeModal(); refreshChrome(); toast("Signed in");
        } catch (err) {
          error.textContent = err.message || "Authentication failed";
        } finally { submit.disabled = false; }
      });
    }
  });
}

/* ---------- listing card (used on Home + Marketplace) ---------- */
function listingCard(l, from) {
  const owner = Store.userById(l.ownerId);
  const cat = CATEGORIES[l.category] || CATEGORIES.other;
  const dist = from ? fmtKm(distanceKm(from, l)) : "";
  const media = l.image
    ? `<img src="${l.image}" alt="" loading="lazy">`
    : `<span class="card-glyph" aria-hidden="true">${cat.icon}</span>`;
  return `
    <article class="card listing ${l.kind} ${l.status}" data-id="${l.id}" tabindex="0">
      <div class="card-media" style="--cat:${cat.color}">
        ${media}
        <span class="kind-stamp">${l.kind === "wanted" ? "Wanted" : "Available"}</span>
        ${l.status === "exchanged" ? `<span class="done-stamp">Exchanged</span>` : ""}
      </div>
      <div class="card-body">
        ${catBadge(l.category)}
        <h3>${esc(l.title)}</h3>
        <p class="meta">${esc(l.qty)} ${esc(l.unit)} · ~${esc(l.weightKg)} kg</p>
        <div class="card-foot">
          <span class="price ${Number(l.price) ? "" : "free"}">${priceLabel(l)}</span>
          <span class="muted small">${dist ? "📍 " + dist + " · " : ""}${timeAgo(l.createdAt)}</span>
        </div>
        <p class="owner small">${avatar(owner, "xs")} ${esc(owner.name)}${l.ownerId === ME ? " (you)" : ""}</p>
      </div>
    </article>`;
}

/* ---------- logo ---------- */
function logoSVG() {
  return `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="19" fill="var(--brand)"/>
    <path d="M20 8a12 12 0 0 1 11.3 8" fill="none" stroke="var(--on-brand)" stroke-width="3" stroke-linecap="round"/>
    <path d="M31.8 22.5A12 12 0 0 1 21 32" fill="none" stroke="var(--on-brand)" stroke-width="3" stroke-linecap="round"/>
    <path d="M15.5 31A12 12 0 0 1 8.2 17.5" fill="none" stroke="var(--on-brand)" stroke-width="3" stroke-linecap="round"/>
    <path d="M28 13.5l3.6 2.8.6-4.4M24.5 31.3l-4-1.9 1.7 4.1M7 21l1.2-4.3 3.4 2.8" fill="none" stroke="var(--on-brand)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  try { await Auth.init(); }
  catch (err) { console.error("Supabase authentication could not initialize", err); }
  try { await Store.sync(); }
  catch (err) { console.error("Shared data could not be loaded", err); toast("Shared listings are temporarily unavailable"); }
  renderChrome();
});
