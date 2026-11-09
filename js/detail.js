/* =========================================================
   ReCircle — listing detail popup + "Circular matches"
   Used by Home and Marketplace.
   ========================================================= */

/* Find the other side of the loop: offers for a "wanted" post,
   and wanted posts (people who need it) for an "offer". */
function findMatches(l, limit = 4) {
  const want = l.kind === "offer" ? "wanted" : "offer";
  return Store.listings()
    .filter(x => x.id !== l.id && x.kind === want && x.category === l.category && x.status !== "exchanged")
    .map(x => ({ ...x, d: distanceKm(l, x) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
}

function openListing(id) {
  const l = Store.listing(id);
  if (!l) return;
  const owner = Store.userById(l.ownerId);
  const cat = CATEGORIES[l.category] || CATEGORIES.other;
  const mine = l.ownerId === ME;
  const here = myLocation();
  const matches = findMatches(l);
  const co2 = co2For(l.category, l.weightKg);

  const media = l.image
    ? `<img src="${l.image}" alt="${esc(l.title)}">`
    : `<span aria-hidden="true">${cat.icon}</span>`;

  const actions = mine
    ? `<button class="btn ghost" data-act="toggle">${l.status === "reserved" ? "Mark available" : "Mark reserved"}</button>
       <button class="btn ghost" data-act="delete">Delete</button>
       <a class="btn primary" href="messages.html">View messages</a>`
    : l.status === "exchanged"
      ? `<span class="muted">This item has already found a new home ♻️</span>`
      : `<button class="btn primary" data-act="chat">💬 ${l.kind === "wanted" ? "I have this" : "Message " + esc(owner.name.split(" ")[0])}</button>`;

  openModal(`
    <div class="card-media detail-media" style="--cat:${cat.color}">
      ${media}
      <span class="kind-stamp" style="${l.kind === "wanted" ? "color:var(--accent)" : ""}">${l.kind === "wanted" ? "Wanted" : "Available"}</span>
    </div>
    <div class="detail-body">
      ${catBadge(l.category)}
      <h2>${esc(l.title)}</h2>
      <p class="muted">📍 ${esc(l.place || "")} · ${fmtKm(distanceKm(here, l))} away · posted ${timeAgo(l.createdAt)}</p>
      <p>${esc(l.desc)}</p>
      <dl class="facts">
        <div><dt>Quantity</dt><dd>${esc(l.qty)} ${esc(l.unit)}</dd></div>
        <div><dt>Approx. weight</dt><dd>${esc(l.weightKg)} kg</dd></div>
        <div><dt>Condition</dt><dd>${esc(l.condition || "—")}</dd></div>
        <div><dt>${l.kind === "wanted" ? "Offering" : "Price"}</dt><dd>${priceLabel(l)}</dd></div>
        <div><dt>CO₂e saved</dt><dd>~${co2.toFixed(1)} kg</dd></div>
        <div><dt>Status</dt><dd style="text-transform:capitalize">${esc(l.status)}</dd></div>
      </dl>
      <div class="owner-row">
        ${avatar(owner, "lg")}
        <div><strong>${esc(owner.name)}${mine ? " (you)" : ""}</strong><span class="muted small">${ROLES[owner.role] || ""} · ${esc(owner.place || "")}</span></div>
      </div>
      <div class="form-actions" style="justify-content:flex-start">${actions}</div>
      ${matches.length ? `
        <div class="matches">
          <h3>🔄 Circular matches nearby</h3>
          <p class="muted small">${l.kind === "offer" ? "People who are looking for this kind of material:" : "Offers that could fill this need:"}</p>
          ${matches.map(m => {
            const o = Store.userById(m.ownerId);
            return `<div class="match" data-open="${m.id}" tabindex="0">${avatar(o, "xs")}
              <span class="t">${esc(m.title)}<br><span class="muted small">${esc(o.name)}</span></span>
              <span class="small muted">${fmtKm(m.d)}</span></div>`;
          }).join("")}
        </div>` : ""}
    </div>`, {
    wide: true,
    onOpen(m) {
      m.addEventListener("click", e => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        const open = e.target.closest("[data-open]")?.dataset.open;
        if (open) return openListing(open);
        if (act === "chat") {
          const c = Store.openConversation(l.id);
          location.href = "messages.html?c=" + c.id;
        }
        if (act === "toggle") {
          Store.updateListing(l.id, { status: l.status === "reserved" ? "available" : "reserved" });
          toast("Status updated"); closeModal(); document.dispatchEvent(new CustomEvent("listingschange"));
        }
        if (act === "delete" && confirm("Delete this listing?")) {
          Store.deleteListing(l.id); toast("Listing deleted"); closeModal();
          document.dispatchEvent(new CustomEvent("listingschange"));
        }
      });
      m.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.dataset.open) openListing(e.target.dataset.open);
      });
    }
  });
}

/* Make any grid of .listing cards clickable */
function bindCards(root) {
  root.addEventListener("click", e => {
    const card = e.target.closest(".listing");
    if (card) openListing(card.dataset.id);
  });
  root.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.classList.contains("listing")) openListing(e.target.dataset.id);
  });
}
