/* =========================================================
   ReCircle — data store (browser localStorage)
   ---------------------------------------------------------
   No server needed: all data is saved in the visitor's
   browser. To move to a real backend later, keep these
   function names and change only their insides.
   ========================================================= */

const STORE_KEY = "recircle_v1";
const ME = "me";

const Store = (() => {
  let state = null;

  function monthsAgoDate(m, salt) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - m);
    d.setDate(2 + (salt * 7) % 25);
    if (d > new Date()) d.setTime(Date.now() - (salt % 5 + 1) * D);
    return d.getTime();
  }

  function seed() {
    const now = Date.now();
    return {
      version: 1,
      user: {
        id: ME, name: "Guest User", role: "individual",
        place: DEFAULT_CENTER.place, lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng
      },
      users: USERS.map(u => ({ ...u })),
      listings: LISTINGS.map(l => {
        const { ago, ...rest } = l;
        return { ...rest, status: "available", createdAt: now - ago, image: null };
      }),
      conversations: [],
      history: HISTORY.map((h, i) => {
        const { monthsAgo, ...rest } = h;
        return { id: "h" + (i + 1), listingId: null, ...rest, date: monthsAgoDate(monthsAgo, i) };
      })
    };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("Could not save to localStorage", e); }
  }

  function load() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (e) { state = null; }
    if (!state || state.version !== 1) { state = seed(); save(); }
    return state;
  }

  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  return {
    /* ---------- user ---------- */
    me() { return load().user; },
    saveMe(patch) { Object.assign(load().user, patch); save(); },
    userById(id) {
      const s = load();
      if (id === ME) return s.user;
      return s.users.find(u => u.id === id) || { id, name: "Unknown", role: "individual" };
    },

    /* ---------- listings ---------- */
    listings() { return load().listings.slice().sort((a, b) => b.createdAt - a.createdAt); },
    listing(id) { return load().listings.find(l => l.id === id); },
    addListing(data) {
      const l = { id: uid("l"), status: "available", createdAt: Date.now(), ownerId: ME, ...data };
      load().listings.push(l); save(); return l;
    },
    updateListing(id, patch) {
      const l = this.listing(id); if (!l) return;
      Object.assign(l, patch); save(); return l;
    },
    deleteListing(id) {
      const s = load();
      s.listings = s.listings.filter(l => l.id !== id);
      s.conversations = s.conversations.filter(c => c.listingId !== id);
      save();
    },

    /* ---------- conversations ---------- */
    conversations() {
      return load().conversations.slice().sort((a, b) => lastTs(b) - lastTs(a));
    },
    conversation(id) { return load().conversations.find(c => c.id === id); },
    /* other = the person I'm talking to about this listing */
    openConversation(listingId, otherId) {
      const s = load();
      const l = this.listing(listingId);
      otherId = otherId || l.ownerId;
      let c = s.conversations.find(c => c.listingId === listingId && c.otherId === otherId);
      if (!c) {
        c = { id: uid("c"), listingId, otherId, messages: [], unread: 0 };
        s.conversations.push(c); save();
      }
      return c;
    },
    addMessage(convId, from, text) {
      const c = this.conversation(convId); if (!c) return;
      c.messages.push({ from, text, ts: Date.now() });
      if (from !== ME) c.unread = (c.unread || 0) + 1;
      save(); return c;
    },
    markRead(convId) {
      const c = this.conversation(convId);
      if (c && c.unread) { c.unread = 0; save(); }
    },
    unreadCount() { return load().conversations.reduce((n, c) => n + (c.unread || 0), 0); },

    /* ---------- exchanges ---------- */
    history() { return load().history.slice().sort((a, b) => b.date - a.date); },
    completeExchange(convId) {
      const c = this.conversation(convId); if (!c) return null;
      const l = this.listing(c.listingId); if (!l) return null;
      /* Who gives, who receives */
      const owner = l.ownerId, other = c.otherId === owner ? ME : c.otherId;
      const giver = l.kind === "offer" ? owner : other;
      const taker = l.kind === "offer" ? other : owner;
      const rec = {
        id: uid("h"), listingId: l.id, title: l.title, category: l.category,
        weightKg: Number(l.weightKg) || 0, fromId: giver, toId: taker, date: Date.now()
      };
      load().history.push(rec);
      l.status = "exchanged";
      c.exchangeId = rec.id;
      c.messages.push({ from: "system", text: "Exchange completed — " + rec.weightKg + " kg kept out of landfill ♻️", ts: Date.now() });
      save(); return rec;
    },

    /* ---------- utilities ---------- */
    reset() { localStorage.removeItem(STORE_KEY); state = null; load(); }
  };

  function lastTs(c) { return c.messages.length ? c.messages[c.messages.length - 1].ts : 0; }
})();

/* Estimated CO2e avoided for an exchange (kg) */
function co2For(category, kg) {
  const c = CATEGORIES[category] || CATEGORIES.other;
  return (Number(kg) || 0) * c.co2;
}
