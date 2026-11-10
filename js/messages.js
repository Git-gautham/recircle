/* ReCircle — buyer/seller messaging */

const QUICK_BUYER = {
  start: ["Is it still available?", "When can I pick it up?", "Can you share the condition?"],
  response: ["That works for me.", "Could we choose another time?", "Thank you! 🙏"],
  arrange: ["I can arrange pickup.", "Can we confirm the pickup area?", "I will message when I am nearby."]
};
const QUICK_SELLER = {
  start: ["Yes, it is still available.", "What time would suit you?", "I can share more details."],
  response: ["That time works for me.", "Please share your estimated arrival.", "Thank you! 🙏"],
  arrange: ["Can we confirm the pickup time?", "The item is reserved for you.", "Please message when you are nearby."]
};
let activeId = new URLSearchParams(location.search).get("c");

function quickReplies(c, l) {
  if (!l) return [];
  const isSeller = l.ownerId === ME;
  const sets = isSeller ? QUICK_SELLER : QUICK_BUYER;
  if (!c.messages.length) return sets.start;
  const last = c.messages[c.messages.length - 1];
  if (c.messages.length === 1 || last.from !== ME) return sets.response;
  return sets.arrange;
}

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
  const isSeller = l && l.ownerId === ME;
  const confirmedByMe = isSeller ? c.ownerConfirmedAt : c.participantConfirmedAt;
  const confirmedByOther = isSeller ? c.participantConfirmedAt : c.ownerConfirmedAt;
  const replies = quickReplies(c, l);

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
        : `<div class="exchange-actions">
             <button class="btn primary sm" id="doneBtn" ${confirmedByMe ? "disabled" : ""}>${confirmedByMe ? "✓ Confirmed" : "✓ Confirm exchange"}</button>
             <span class="small muted">${confirmedByOther ? "The other participant has confirmed." : "Both participants must confirm."}</span>
           </div>`) : ""}
    </div>
    <div class="chat-body" id="chatBody">
      ${c.messages.map(m => m.from === "system"
        ? `<div class="bubble system">${esc(m.text)}<br><a href="impact.html" class="small">See impact →</a></div>`
        : `<div class="bubble ${m.from === ME ? "mine" : ""}">${esc(m.text)}<time>${fmtTime(m.ts)}</time></div>`).join("")}
      ${!c.messages.length ? `<p class="muted small" style="text-align:center">Start the conversation — ask about condition, quantity or pickup time.</p>` : ""}
    </div>
    ${done || !replies.length ? "" : `<div class="quick-replies" aria-label="Suggested messages">${replies.map(q => `<button type="button">${esc(q)}</button>`).join("")}</div>`}
    ${done ? `<p class="chat-ended muted small">This exchange is complete. Messaging is closed.</p>` : `
      <form class="chat-input" id="chatForm">
        <input id="msg" maxlength="1000" autocomplete="off" placeholder="Write a message…" aria-label="Message" autofocus>
        <button class="btn primary">Send</button>
      </form>`}`;

  $("#chatLayout").classList.add("in-chat");
  const body = $("#chatBody"); body.scrollTop = body.scrollHeight;

  $("#chatForm").addEventListener("submit", e => { e.preventDefault(); send($("#msg").value); });
  $$(".quick-replies button").forEach(b => b.addEventListener("click", () => send(b.textContent)));
  $("#backBtn").addEventListener("click", () => { activeId = null; history.replaceState(null, "", "messages.html"); renderAll(); });
  $("#openListing")?.addEventListener("click", () => openListing(l.id));
  $("#doneBtn")?.addEventListener("click", () => confirmExchange(c, l, other, confirmedByMe));
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

function confirmExchange(c, l, other, alreadyConfirmed) {
  if (alreadyConfirmed) return;
  const co2 = co2For(l.category, l.weightKg);
  openModal(`
    <h2>Confirm exchange</h2>
    <p>Did <b>${esc(l.title)}</b> change hands with <b>${esc(other.name)}</b>?</p>
    <dl class="facts">
      <div><dt>Weight</dt><dd>${esc(l.weightKg)} kg</dd></div>
      <div><dt>CO₂e avoided</dt><dd>~${co2.toFixed(1)} kg</dd></div>
    </dl>
    <p class="muted small">Both you and ${esc(other.name)} must confirm. The listing will be marked exchanged and added to impact/history only after both confirmations.</p>
    <div class="form-actions">
      <button class="btn ghost" id="noBtn">Not yet</button>
      <button class="btn primary" id="yesBtn">Yes, it's done ♻️</button>
    </div>`, {
    onOpen(m) {
      $("#noBtn", m).addEventListener("click", closeModal);
      $("#yesBtn", m).addEventListener("click", () => {
        Store.completeExchange(c.id).then(() => {
          closeModal(); renderAll();
          toast(`Your confirmation was recorded. ${c.ownerConfirmedAt && c.participantConfirmedAt ? `Nice! ${l.weightKg} kg kept out of landfill 🌱` : "Waiting for the other participant."}`);
        }).catch(err => toast(err.message || "Couldn't complete the exchange"));
      });
    }
  });
}

function renderAll() { renderChat(); renderList(); }

function renderMessagesError(e) {
  const message = e?.detail?.message || "Messages are temporarily unavailable.";
  $("#convoList").innerHTML = `<p class="muted small" style="padding:0 16px">${esc(message)}</p>`;
}

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
  document.addEventListener("messageschange", () => {
    const convos = Store.conversations();
    if (activeId && !convos.some(c => c.id === activeId)) {
      activeId = innerWidth > 760 ? convos[0]?.id || null : null;
      history.replaceState(null, "", activeId ? "messages.html?c=" + activeId : "messages.html");
    }
    if (!activeId && innerWidth > 760) activeId = convos[0]?.id || null;
    renderAll();
  });
  document.addEventListener("messageserror", renderMessagesError);
});
