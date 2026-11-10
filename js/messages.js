/* ReCircle — buyer/seller messaging */

const QUICK = ["Is it still available?", "When can I pick it up?", "Can you share the exact location?", "Thank you! 🙏"];
let activeId = new URLSearchParams(location.search).get("c");

function renderList() {
  const convos = Store.conversations();
  if (!convos.length) {
    $("#convoList").innerHTML = `<p class="muted small" style="padding:0 16px">No conversations yet.</p>`;
    return;
  }
  $("#convoList").innerHTML = convos.map(c => {
    const other = Store.userById(c.otherId);
    const l = Store.listing(c.listingId);
    const last = c.messages[c.messages.length - 1];
    return `<button class="convo ${c.id === activeId ? "active" : ""}" data-id="${c.id}">
      ${avatar(other)}
      <span class="info">
        <span class="name"><span>${esc(other.name)}</span>${last ? `<time>${timeAgo(last.ts)}</time>` : ""}</span>
        <span class="sub" style="display:block">${l ? (CATEGORIES[l.category] || CATEGORIES.other).icon + " " + esc(l.title) : "Listing removed"}</span>
        <span class="last" style="display:block">${last ? (last.from === ME ? "You: " : "") + esc(last.text) : "Say hello 👋"}</span>
      </span>
      ${c.unread ? `<span class="unread">${c.unread}</span>` : ""}
    </button>`;
  }).join("");
}

function renderChat() {
  const c = activeId && Store.conversation(activeId);
  const box = $("#chat");
  if (!c) {
    box.innerHTML = `<div class="chat-empty"><div><span style="font-size:2.6rem">💬</span>
      <p>${Store.conversations().length ? "Pick a conversation to continue." : "No messages yet."}</p>
      <a class="btn primary" href="marketplace.html">Browse the marketplace</a></div></div>`;
    $("#chatLayout").classList.remove("in-chat");
    return;
  }
  Store.markRead(c.id);
  refreshChrome();
  const other = Store.userById(c.otherId);
  const l = Store.listing(c.listingId);
  const done = l && l.status === "exchanged";

  box.innerHTML = `
    <div class="chat-head">
      <button class="icon-btn back-btn" id="backBtn" aria-label="Back to conversations">←</button>
      ${avatar(other)}
      <div class="who">
        <strong>${esc(other.name)}</strong>
        ${l ? `<button class="link-btn small" id="openListing">${(CATEGORIES[l.category] || CATEGORIES.other).icon} ${esc(l.title)}</button>` : `<span class="small muted">Listing removed</span>`}
      </div>
      ${l ? (done
        ? `<span class="cat" style="--cat:var(--ok)">✓ Exchanged</span>`
        : (l.ownerId === ME ? `<button class="btn primary sm" id="doneBtn">✓ Mark as exchanged</button>` : "")) : ""}
    </div>
    <div class="chat-body" id="chatBody">
      ${c.messages.map(m => m.from === "system"
        ? `<div class="bubble system">${esc(m.text)}<br><a href="impact.html" class="small">See impact →</a></div>`
        : `<div class="bubble ${m.from === ME ? "mine" : ""}">${esc(m.text)}<time>${fmtTime(m.ts)}</time></div>`).join("")}
      ${!c.messages.length ? `<p class="muted small" style="text-align:center">Start the conversation — ask about condition, quantity or pickup time.</p>` : ""}
    </div>
    ${done ? "" : `<div class="quick-replies">${QUICK.map(q => `<button type="button">${esc(q)}</button>`).join("")}</div>`}
    <form class="chat-input" id="chatForm">
      <input id="msg" maxlength="1000" autocomplete="off" placeholder="Write a message…" aria-label="Message" ${done ? "" : "autofocus"}>
      <button class="btn primary">Send</button>
    </form>`;

  $("#chatLayout").classList.add("in-chat");
  const body = $("#chatBody"); body.scrollTop = body.scrollHeight;

  $("#chatForm").addEventListener("submit", e => { e.preventDefault(); send($("#msg").value); });
  $$(".quick-replies button").forEach(b => b.addEventListener("click", () => send(b.textContent)));
  $("#backBtn").addEventListener("click", () => { activeId = null; history.replaceState(null, "", "messages.html"); renderAll(); });
  $("#openListing")?.addEventListener("click", () => openListing(l.id));
  $("#doneBtn")?.addEventListener("click", () => confirmExchange(c, l, other));
}

async function send(text) {
  text = String(text).trim();
  if (!text || !activeId) return;
  const id = activeId;
  const input = $("#msg"); if (input) input.disabled = true;
  try { await Store.sendMessage(id, text); renderAll(); }
  catch (err) { toast(err.message || "Message not sent"); if (input) input.value = text; }
  finally { const i = $("#msg"); if (i) { i.disabled = false; i.focus(); } }
}

function confirmExchange(c, l, other) {
  const co2 = co2For(l.category, l.weightKg);
  openModal(`
    <h2>Confirm exchange</h2>
    <p>Did <b>${esc(l.title)}</b> change hands with <b>${esc(other.name)}</b>?</p>
    <dl class="facts">
      <div><dt>Weight</dt><dd>${esc(l.weightKg)} kg</dd></div>
      <div><dt>CO₂e avoided</dt><dd>~${co2.toFixed(1)} kg</dd></div>
    </dl>
    <p class="muted small">This marks the listing as exchanged and adds it to your history and impact dashboard.</p>
    <div class="form-actions">
      <button class="btn ghost" id="noBtn">Not yet</button>
      <button class="btn primary" id="yesBtn">Yes, it's done ♻️</button>
    </div>`, {
    onOpen(m) {
      $("#noBtn", m).addEventListener("click", closeModal);
      $("#yesBtn", m).addEventListener("click", () => {
        Store.completeExchange(c.id).then(() => {
          closeModal(); renderAll();
          toast(`Nice! ${l.weightKg} kg kept out of landfill 🌱`);
        }).catch(err => toast(err.message || "Couldn't complete the exchange"));
      });
    }
  });
}

function renderAll() { renderChat(); renderList(); }

document.addEventListener("DOMContentLoaded", () => {
  if (!activeId && innerWidth > 760) activeId = Store.conversations()[0]?.id || null;
  renderAll();
  $("#convoList").addEventListener("click", e => {
    const b = e.target.closest(".convo"); if (!b) return;
    activeId = b.dataset.id;
    history.replaceState(null, "", "messages.html?c=" + activeId);
    renderAll();
    $("#msg")?.focus();
  });
  document.addEventListener("listingschange", renderAll);
  document.addEventListener("messageschange", renderAll);
});
