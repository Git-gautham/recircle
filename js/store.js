/* =========================================================
   ReCircle — data store (browser localStorage)
   ---------------------------------------------------------
   No server needed: all data is saved in the visitor's
   browser. To move to a real backend later, keep these
   function names and change only their insides.
   ========================================================= */

const STORE_KEY = "recircle_v1";
let ME = "me";

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
  const remote = () => typeof Auth !== "undefined" && Auth.isSignedIn() && typeof supabaseClient !== "undefined";
  const remoteId = id => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
  const remoteListing = row => ({
    id: row.id, ownerId: row.owner_id, kind: row.kind, category: row.category,
    title: row.title, desc: row.description, qty: row.qty, unit: row.unit,
    weightKg: row.weight_kg, condition: row.condition, price: row.price,
    place: row.place, lat: row.lat, lng: row.lng, image: row.image,
    status: row.status, createdAt: new Date(row.created_at).getTime()
  });

  return {
    async sync() {
      if (!remote()) return;
      const [listingResult, profileResult] = await Promise.all([
        supabaseClient.from("listings").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("profiles").select("id, display_name, role, place, lat, lng")
      ]);
      if (listingResult.error) throw listingResult.error;
      if (profileResult.error) throw profileResult.error;
      const s = load();
      s.remoteListings = listingResult.data.map(remoteListing);
      s.remoteUsers = profileResult.data.map(p => ({
        id: p.id, name: p.display_name, role: p.role, place: p.place, lat: p.lat, lng: p.lng
      }));
      save();
      document.dispatchEvent(new CustomEvent("listingschange"));
      const conversations = await supabaseClient.from("conversations").select("*");
      if (conversations.error) throw conversations.error;
      const messages = await supabaseClient.from("messages").select("*").order("created_at");
      if (messages.error) throw messages.error;
      const currentId = Auth.user().id;
      const remoteConversations = conversations.data.map(c => ({
        id: c.id, listingId: c.listing_id,
        otherId: c.owner_id === currentId ? c.participant_id : c.owner_id,
        messages: messages.data.filter(m => m.conversation_id === c.id).map(m => ({
          from: m.sender_id, text: m.body, ts: new Date(m.created_at).getTime()
        })), unread: 0
      }));
      s.conversations = [...s.conversations.filter(c => !remoteId(c.id)), ...remoteConversations];
      save();
    },
    /* ---------- user ---------- */
    me() { return load().user; },
    saveMe(patch) { Object.assign(load().user, patch); save(); },
    userById(id) {
      const s = load();
      if (id === ME) return s.user;
      const remoteUser = (s.remoteUsers || []).find(u => u.id === id);
      if (remoteUser) return remoteUser;
      return s.users.find(u => u.id === id) || { id, name: "Unknown", role: "individual" };
    },

    /* ---------- listings ---------- */
    listings() { return [...load().listings, ...(load().remoteListings || [])].sort((a, b) => b.createdAt - a.createdAt); },
    listing(id) { return this.listings().find(l => l.id === id); },
    addListing(data) {
      const ownerId = remote() ? Auth.user().id : ME;
      const l = { id: uid("l"), status: "available", createdAt: Date.now(), ownerId, ...data };
      load().listings.push(l); save();
      if (remote()) {
        supabaseClient.from("listings").insert({
          owner_id: ownerId, kind: l.kind, category: l.category, title: l.title,
          description: l.desc, qty: l.qty, unit: l.unit, weight_kg: l.weightKg,
          condition: l.condition, price: l.price, place: l.place, lat: l.lat, lng: l.lng,
          image: l.image
        }).select().single().then(({ data: row, error }) => {
          if (error) { console.error("Could not publish listing", error); toast("Listing saved locally but could not be shared"); return; }
          const s = load();
          s.listings = s.listings.filter(x => x.id !== l.id);
          s.remoteListings = [...(s.remoteListings || []), remoteListing(row)];
          save(); document.dispatchEvent(new CustomEvent("listingschange"));
        });
      }
      return l;
    },
    updateListing(id, patch) {
      const l = this.listing(id); if (!l) return;
      Object.assign(l, patch); save();
      if (remote() && remoteId(id)) {
        const row = {};
        if (patch.status) row.status = patch.status;
        if (Object.keys(row).length) supabaseClient.from("listings").update(row).eq("id", id)
          .then(({ error }) => { if (error) console.error("Could not update listing", error); });
      }
      return l;
    },
    deleteListing(id) {
      const s = load();
      s.listings = s.listings.filter(l => l.id !== id);
      s.remoteListings = (s.remoteListings || []).filter(l => l.id !== id);
      s.conversations = s.conversations.filter(c => c.listingId !== id);
      if (remote() && remoteId(id)) supabaseClient.from("listings").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("Could not delete listing", error); });
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
        c = { id: remote() && remoteId(listingId) ? crypto.randomUUID() : uid("c"), listingId, otherId, messages: [], unread: 0 };
        s.conversations.push(c); save();
        if (remote() && remoteId(listingId) && remoteId(otherId)) {
          supabaseClient.from("conversations").insert({
            id: c.id, listing_id: listingId,
            owner_id: l.ownerId, participant_id: Auth.user().id
          }).then(({ error }) => { if (error && error.code !== "23505") console.error("Could not create conversation", error); });
        }
      }
      return c;
    },
    addMessage(convId, from, text) {
      const c = this.conversation(convId); if (!c) return;
      c.messages.push({ from, text, ts: Date.now() });
      if (from !== ME) c.unread = (c.unread || 0) + 1;
      save();
      if (remote() && remoteId(convId) && from === Auth.user().id) {
        supabaseClient.from("messages").insert({
          conversation_id: convId, sender_id: from, body: text
        }).then(({ error }) => {
          if (error) console.error("Could not send message", error);
        });
      }
      return c;
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
