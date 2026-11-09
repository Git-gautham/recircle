/* ReCircle — Marketplace: search, filters, map (Leaflet + OpenStreetMap) */

const params = new URLSearchParams(location.search);
const filters = {
  q: params.get("q") || "",
  kind: params.get("kind") || "all",
  cat: params.get("cat") || "all",
  radius: 51,            /* 51 = any distance */
  sort: "near",
  showDone: false
};

let map, markerLayer, meMarker, radiusCircle;

/* ---------- map ---------- */
function initMap() {
  const here = myLocation();
  map = L.map("map", { scrollWheelZoom: true }).setView([here.lat, here.lng], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  meMarker = L.marker([here.lat, here.lng], {
    icon: L.divIcon({ className: "", html: '<div class="me-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
    zIndexOffset: 1000, title: "You are here"
  }).addTo(map).bindTooltip("You are here");
}

function pinIcon(l) {
  const c = CATEGORIES[l.category] || CATEGORIES.other;
  return L.divIcon({
    className: "",
    html: `<div class="pin ${l.kind}" style="--c:${c.color}"><span>${c.icon}</span></div>`,
    iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30]
  });
}

function drawMap(items) {
  if (!map) return;
  const here = myLocation();
  markerLayer.clearLayers();
  meMarker.setLatLng([here.lat, here.lng]);
  if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
  if (filters.radius <= 50) {
    radiusCircle = L.circle([here.lat, here.lng], {
      radius: filters.radius * 1000, color: "#2f7a52", weight: 1.5, fillOpacity: .06, dashArray: "6 6"
    }).addTo(map);
  }
  items.forEach(l => {
    const m = L.marker([l.lat, l.lng], { icon: pinIcon(l), title: l.title });
    m.bindPopup(`
      ${catBadge(l.category)}
      <h4>${esc(l.title)}</h4>
      <div class="small muted">${l.kind === "wanted" ? "Wanted" : "Available"} · ${priceLabel(l)} · ${fmtKm(l.d)}</div>
      <button class="btn primary sm" style="margin-top:8px" onclick="openListing('${l.id}')">View details</button>`);
    markerLayer.addLayer(m);
  });
  const pts = items.map(l => [l.lat, l.lng]).concat([[here.lat, here.lng]]);
  if (radiusCircle) map.fitBounds(radiusCircle.getBounds(), { padding: [20, 20] });
  else if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
}

/* ---------- filtering ---------- */
function filtered() {
  const here = myLocation();
  const q = filters.q.trim().toLowerCase();
  let items = Store.listings().map(l => ({ ...l, d: distanceKm(here, l) }));
  items = items.filter(l => {
    if (!filters.showDone && l.status === "exchanged") return false;
    if (filters.kind !== "all" && l.kind !== filters.kind) return false;
    if (filters.cat !== "all" && l.category !== filters.cat) return false;
    if (filters.radius <= 50 && l.d > filters.radius) return false;
    if (q) {
      const owner = Store.userById(l.ownerId).name;
      const hay = [l.title, l.desc, l.place, owner, CATEGORIES[l.category]?.label].join(" ").toLowerCase();
      if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  });
  const by = {
    near: (a, b) => a.d - b.d,
    new: (a, b) => b.createdAt - a.createdAt,
    free: (a, b) => (Number(a.price) > 0) - (Number(b.price) > 0) || a.d - b.d,
    heavy: (a, b) => b.weightKg - a.weightKg
  };
  return items.sort(by[filters.sort]);
}

function render() {
  const here = myLocation();
  const items = filtered();
  $("#count").textContent = `${items.length} listing${items.length === 1 ? "" : "s"}`;
  $("#results").innerHTML = items.length
    ? items.map(l => listingCard(l, here)).join("")
    : `<div class="empty" style="grid-column:1/-1"><span class="big">🔍</span>
         Nothing matches yet.<br>Try a wider distance — or <a href="post.html?kind=wanted${filters.cat !== "all" ? "&cat=" + filters.cat : ""}">post a Wanted request</a> so people can find you.</div>`;
  $("#locLabel").textContent = "Centred on: " + (here.place || "your location");
  drawMap(items);
}

/* ---------- controls ---------- */
function renderChips() {
  const chips = [["all", "All materials", "✨"], ...Object.entries(CATEGORIES).map(([k, c]) => [k, c.label, c.icon])];
  $("#catChips").innerHTML = chips.map(([k, label, icon]) =>
    `<button class="chip ${filters.cat === k ? "on" : ""}" data-cat="${k}"><span aria-hidden="true">${icon}</span>${label}</button>`).join("");
}

function setRadiusLabel() {
  $("#radiusLabel").textContent = filters.radius > 50 ? "any distance" : filters.radius + " km";
}

document.addEventListener("DOMContentLoaded", () => {
  $("#q").value = filters.q;
  $$("#kindSeg button").forEach(b => b.classList.toggle("on", b.dataset.kind === filters.kind));
  renderChips();
  setRadiusLabel();

  try { initMap(); }
  catch (e) { console.warn("Map failed to load", e); $("#map").innerHTML = '<p class="empty">Map unavailable offline.</p>'; }

  render();
  bindCards($("#results"));

  let t;
  $("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { filters.q = e.target.value; render(); }, 150); });
  $("#kindSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    filters.kind = b.dataset.kind;
    $$("#kindSeg button").forEach(x => x.classList.toggle("on", x === b));
    render();
  });
  $("#catChips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    filters.cat = b.dataset.cat; renderChips(); render();
  });
  $("#radius").addEventListener("input", e => { filters.radius = +e.target.value; setRadiusLabel(); render(); });
  $("#sort").addEventListener("change", e => { filters.sort = e.target.value; render(); });
  $("#showDone").addEventListener("change", e => { filters.showDone = e.target.checked; render(); });

  $("#locBtn").addEventListener("click", async () => {
    $("#locBtn").textContent = "Locating…";
    try { await detectLocation(); toast("Showing listings near you"); render(); }
    catch (e) { toast("Couldn't get location — using " + myLocation().place); }
    $("#locBtn").textContent = "📍 Use my location";
  });

  $("#viewSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#viewSeg button").forEach(x => x.classList.toggle("on", x === b));
    $("#layout").classList.toggle("show-map", b.dataset.view === "map");
    if (map) setTimeout(() => { map.invalidateSize(); render(); }, 50);
  });

  document.addEventListener("listingschange", render);
  document.addEventListener("profilechange", render);
});
