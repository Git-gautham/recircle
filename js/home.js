/* ReCircle — Home page */

function renderHome() {
  const listings = Store.listings();
  const history = Store.history();
  const here = myLocation();

  /* hero stats */
  const kg = history.reduce((s, h) => s + h.weightKg, 0);
  const co2 = history.reduce((s, h) => s + co2For(h.category, h.weightKg), 0);
  const active = listings.filter(l => l.status !== "exchanged").length;
  $("#heroStats").innerHTML = `
    <div><strong>${fmtNum(kg)} kg</strong><span>kept out of landfill</span></div>
    <div><strong>${fmtNum(co2)} kg</strong><span>CO₂e avoided (est.)</span></div>
    <div><strong>${active}</strong><span>active listings</span></div>`;

  /* category tiles with counts */
  const counts = {};
  listings.forEach(l => { if (l.status !== "exchanged") counts[l.category] = (counts[l.category] || 0) + 1; });
  $("#catStrip").innerHTML = Object.entries(CATEGORIES).map(([k, c]) => `
    <a class="cat-tile" style="--cat:${c.color}" href="marketplace.html?cat=${k}">
      <span aria-hidden="true">${c.icon}</span><span>${c.label}<br><small>${counts[k] || 0} listings</small></span>
    </a>`).join("");

  /* six newest, nearest-first among the newest */
  const recent = listings.filter(l => l.status !== "exchanged").slice(0, 6);
  $("#recentGrid").innerHTML = recent.map(l => listingCard(l, here)).join("");

  /* a real exchange from history as the quote */
  const h = history[0];
  if (h) {
    const from = Store.userById(h.fromId), to = Store.userById(h.toId);
    $("#bandQuote").innerHTML = `${(CATEGORIES[h.category] || CATEGORIES.other).icon} ${esc(h.weightKg)} kg of ${esc(h.title.toLowerCase())} went from
      <strong>${esc(from.name)}</strong> to <strong>${esc(to.name)}</strong> instead of a landfill.
      <footer class="small" style="font-family:var(--font-body);font-style:normal;opacity:.7;margin-top:10px">Latest exchange · ${fmtDate(h.date)}</footer>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderHome();
  bindCards($("#recentGrid"));
  document.addEventListener("listingschange", renderHome);
  document.addEventListener("profilechange", renderHome);
});
