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

  const image = safeImageUrl(l.image);
  const media = image
    ? `<img src="${esc(image)}" alt="${esc(l.title)}">`
    : `<span aria-hidden="true">${cat.icon}</span>`;

  const actions = mine
    ? (l.status === "exchanged"
      ? `<span class="muted small">Exchanged listings can't be edited or reopened.</span>
         <button class="btn ghost" data-act="delete">Delete</button>
         <a class="btn primary" href="messages.html">View messages</a>`
      : `<button class="btn ghost" data-act="edit">Edit listing</button>
         <button class="btn ghost" data-act="toggle">${l.status === "reserved" ? "Mark available" : "Mark reserved"}</button>
         <button class="btn ghost" data-act="delete">Delete</button>
         <a class="btn primary" href="messages.html">View messages</a>`)
    : l.status === "exchanged"
      ? `<span class="muted">This item has already found a new home ♻️</span>`
      : `<button class="btn primary" data-act="chat">💬 ${l.kind === "wanted" ? "I have this" : "Message " + esc(owner.name.split(" ")[0])}</button>
         <button class="btn ghost" data-act="report">⚑ Report</button>`;

  openModal(`
    <div class="card-media detail-media" style="--cat:${cat.color}">
      ${media}
      <span class="kind-stamp" style="${l.kind === "wanted" ? "color:var(--accent)" : ""}">${l.kind === "wanted" ? "Wanted" : "Available"}</span>
    </div>
    <div class="detail-body">
      ${catBadge(l.category)}
      <h2>${esc(l.title)}</h2>
      <p class="muted">📍 ${esc(l.place || "Area not given")}${hasMyLocation() ? ` · ${fmtKm(distanceKm(here, l))} away` : ""} · posted ${timeAgo(l.createdAt)}</p>
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
        if (act === "edit") {
          openModal(`
            <h2>Edit listing</h2>
            <form id="editListingForm" class="form">
              <label>Post type
                <select name="kind">
                  <option value="offer" ${l.kind === "offer" ? "selected" : ""}>Give away / sell</option>
                  <option value="wanted" ${l.kind === "wanted" ? "selected" : ""}>Find / request</option>
                </select>
              </label>
              <label>Category
                <select name="category">${Object.entries(CATEGORIES).map(([key, value]) =>
                  `<option value="${key}" ${l.category === key ? "selected" : ""}>${value.icon} ${esc(value.label)}</option>`).join("")}</select>
              </label>
              <label>Title<input name="title" required minlength="3" maxlength="70" value="${esc(l.title)}"></label>
              <label>Description<textarea name="description" maxlength="500">${esc(l.desc)}</textarea></label>
              <div class="row-3">
                <label>Quantity<input name="qty" type="number" min="1" step="any" required value="${esc(l.qty)}"></label>
                <label>Unit
                  <select name="unit">${["pieces", "kg", "bags", "items", "sacks", "kg/day"].map(unit =>
                    `<option ${l.unit === unit ? "selected" : ""}>${unit}</option>`).join("")}</select>
                </label>
                <label>Approx. weight (kg)<input name="weightKg" type="number" min="0.1" step="0.1" required value="${esc(l.weightKg)}"></label>
              </div>
              <div class="row-2">
                <label>Condition<input name="condition" maxlength="40" value="${esc(l.condition || "")}"></label>
                <label>Price in ₹<input name="price" type="number" min="0" step="1" value="${esc(l.price)}"></label>
              </div>
              <label>Pickup area<input name="place" maxlength="40" value="${esc(l.place || "")}"></label>
              <p class="muted small">To change the map pin, create a new listing. The current approximate location will be kept.</p>
              <p class="muted small">Changing the type, category, title, quantity, unit or weight clears any pending exchange confirmations, so both people confirm the new details.</p>
              <div class="form-actions"><button type="button" class="btn ghost" data-act="cancel-edit">Cancel</button><button class="btn primary">Save changes</button></div>
            </form>`, {
              wide: true,
              onOpen(editModal) {
                $("[data-act=cancel-edit]", editModal).addEventListener("click", closeModal);
                $("#editListingForm", editModal).addEventListener("submit", async ev => {
                  ev.preventDefault();
                  const f = new FormData(ev.target);
                  const title = String(f.get("title") || "").trim();
                  const weightKg = Number(f.get("weightKg"));
                  if (title.length < 3 || !(weightKg > 0)) { toast("Enter a title and a weight greater than zero"); return; }
                  const button = ev.submitter;
                  button.disabled = true; button.textContent = "Saving…";
                  try {
                    await Store.updateListing(l.id, {
                      kind: f.get("kind"), category: f.get("category"), title,
                      desc: String(f.get("description") || "").trim(), qty: Number(f.get("qty")),
                      unit: f.get("unit"), weightKg, condition: String(f.get("condition") || "").trim(),
                      price: Number(f.get("price")) || 0, place: String(f.get("place") || "").trim()
                    });
                    closeModal(); toast("Listing updated"); document.dispatchEvent(new CustomEvent("listingschange"));
                  } catch (err) {
                    toast(err.message || "Couldn't update listing");
                    button.disabled = false; button.textContent = "Save changes";
                  }
                });
              }
            });
          return;
        }
        if (act === "cancel-edit") { closeModal(); return; }
        if (act === "chat") {
          if (!Auth.isSignedIn()) { closeModal(); openAuth(); return; }
          const btn = e.target.closest("[data-act]"); btn.disabled = true;
          Store.openConversation(l.id).then(c => { location.href = "messages.html?c=" + c.id; })
            .catch(err => { toast(err.message || "Couldn't start the chat"); btn.disabled = false; });
        }
        if (act === "report") {
          if (!Auth.isSignedIn()) { closeModal(); openAuth(); return; }
          openModal(`<h2>Report this listing</h2><form id="reportForm" class="form">
            <label>What's wrong?<textarea name="reason" required minlength="3" maxlength="300"></textarea></label>
            <div class="form-actions"><button class="btn primary">Send report</button></div></form>`, {
            onOpen(m2) {
              $("#reportForm", m2).addEventListener("submit", async ev => {
                ev.preventDefault();
                const reason = new FormData(ev.target).get("reason").trim();
                const result = await supabaseClient.from("reports").insert({ listing_id: l.id, reason });
                toast(result.error ? (result.error.code === "23505" ? "You already reported this" : result.error.message) : "Thanks — we'll review it");
                if (!result.error) closeModal();
              });
            }
          });
        }
        if (act === "toggle") {
          Store.updateListing(l.id, { status: l.status === "reserved" ? "available" : "reserved" })
            .then(() => { toast("Status updated"); closeModal(); document.dispatchEvent(new CustomEvent("listingschange")); })
            .catch(err => toast(err.message || "Couldn't update"));
        }
        if (act === "delete" && confirm(l.status === "exchanged"
            ? "Delete this listing? The exchange stays in history and your chats are kept."
            : "Delete this listing? Chats about it are kept but become read-only.")) {
          Store.deleteListing(l.id).then(() => {
            toast("Listing deleted"); closeModal(); document.dispatchEvent(new CustomEvent("listingschange"));
          }).catch(err => toast(err.message || "Couldn't delete"));
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
