/* ReCircle — exchange history timeline */

const view = { scope: new URLSearchParams(location.search).get("scope") || "all", cat: "all" };

function records() {
  return Store.history().filter(h =>
    (view.scope === "all" || h.fromId === ME || h.toId === ME) &&
    (view.cat === "all" || h.category === view.cat));
}

function renderTimeline() {
  const rows = records();
  const kg = rows.reduce((s, h) => s + h.weightKg, 0);
  const co2 = rows.reduce((s, h) => s + co2For(h.category, h.weightKg), 0);
  $("#summary").textContent = `${rows.length} exchanges · ${fmtNum(kg)} kg · ~${fmtNum(co2)} kg CO₂e`;

  if (!rows.length) {
    $("#timeline").innerHTML = `<li class="empty">
      <span class="big">🌱</span>${view.scope === "me"
        ? `You haven't completed an exchange yet.<br>Find something in the <a href="marketplace.html">marketplace</a>, chat, then both participants can confirm the hand-off.`
        : "No exchanges in this category yet."}</li>`;
    return;
  }

  let month = "", html = "";
  rows.forEach(h => {
    const m = new Date(h.date).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (m !== month) { month = m; html += `<li class="tl-month">${m}</li>`; }
    const c = CATEGORIES[h.category] || CATEGORIES.other;
    const from = Store.userById(h.fromId), to = Store.userById(h.toId);
    const mine = h.fromId === ME || h.toId === ME;
    html += `
      <li class="tl-item ${mine ? "mine" : ""}">
        <span class="tl-dot" style="--cat:${c.color}" aria-hidden="true">${c.icon}</span>
        <div class="card tl-card">
          <strong>${esc(h.title)}${mine ? `<span class="you-tag">${h.fromId === ME ? "You gave" : "You got"}</span>` : ""}</strong>
          <span class="flow">${avatar(from, "xs")} ${esc(from.name)} <span aria-label="to">→</span> ${avatar(to, "xs")} ${esc(to.name)}</span>
          <span class="small muted">${fmtDate(h.date)} · ${c.label}</span>
        </div>
        <div class="tl-kg">${fmtNum(h.weightKg)} kg<small>−${co2For(h.category, h.weightKg).toFixed(1)} kg CO₂e</small></div>
      </li>`;
  });
  $("#timeline").innerHTML = html;
}

function renderMine() {
  const mine = Store.listings().filter(l => l.ownerId === ME);
  $("#myListings").innerHTML = mine.length
    ? mine.map(l => listingCard(l, myLocation())).join("")
    : `<div class="empty" style="grid-column:1/-1">You haven't listed anything yet. <a href="post.html">List your first item →</a></div>`;
}

function exportCSV() {
  const rows = records();
  const head = ["Date", "Item", "Category", "Weight (kg)", "CO2e avoided (kg)", "From", "To"];
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [head.map(q).join(",")].concat(rows.map(h => [
    new Date(h.date).toISOString().slice(0, 10), h.title, (CATEGORIES[h.category] || CATEGORIES.other).label, h.weightKg,
    co2For(h.category, h.weightKg).toFixed(2), Store.userById(h.fromId).name, Store.userById(h.toId).name
  ].map(q).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "recircle-exchanges.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  $("#catFilter").innerHTML = `<option value="all">All categories</option>` +
    Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.icon} ${c.label}</option>`).join("");
  $$("#scopeSeg button").forEach(b => b.classList.toggle("on", b.dataset.scope === view.scope));

  renderTimeline(); renderMine();
  bindCards($("#myListings"));

  $("#scopeSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    view.scope = b.dataset.scope;
    $$("#scopeSeg button").forEach(x => x.classList.toggle("on", x === b));
    renderTimeline();
  });
  $("#catFilter").addEventListener("change", e => { view.cat = e.target.value; renderTimeline(); });
  $("#csvBtn").addEventListener("click", exportCSV);
  document.addEventListener("listingschange", () => { renderTimeline(); renderMine(); });
  document.addEventListener("profilechange", renderTimeline);
});
