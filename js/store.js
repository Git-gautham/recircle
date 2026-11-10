/* ReCircle — shared Supabase data store with a small local UI cache. */

const STORE_KEY = "recircle_v2";
const BUCKET = "listing-images";
const PUBLIC_TTL = 60 * 1000;
const EXCHANGES_TTL = 5 * 60 * 1000;
const LISTING_COLUMNS = "id, owner_id, kind, category, title, description, qty, unit, weight_kg, condition, price, place, lat, lng, image, thumb, status, created_at";
const CONV_COLUMNS = "id, listing_id, owner_id, participant_id, owner_read_at, participant_read_at, owner_confirmed_at, participant_confirmed_at, created_at";
const MSG_COLUMNS = "id, conversation_id, sender_id, body, created_at";
let ME = "me";

const Store = (() => {
  let state = null;
  const seed = () => ({
    version: 2, production: true, user: { id: ME, name: "Guest User", role: "individual",
      place: DEFAULT_CENTER.place, lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng },
    users: [], listings: [], remoteListings: [], remoteUsers: [], conversations: [], history: []
  });
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { console.warn("Could not save local cache", e); } };
  const load = () => {
    if (state) return state;
    try { state = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { state = null; }
    if (!state || state.version !== 2 || state.production !== true) { state = seed(); save(); }
    return state;
  };
  const remote = () => typeof Auth !== "undefined" && Auth.isSignedIn() && typeof supabaseClient !== "undefined";
  const isUuid = id => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
  const remoteListing = row => ({
    id: row.id, ownerId: row.owner_id, kind: row.kind, category: row.category,
    title: row.title, desc: row.description, qty: Number(row.qty), unit: row.unit,
    weightKg: Number(row.weight_kg), condition: row.condition, price: Number(row.price),
    place: row.place, lat: row.lat, lng: row.lng, image: row.image, thumb: row.thumb,
    status: row.status, createdAt: new Date(row.created_at).getTime()
  });
  async function uploadListingPhotos(full, thumb) {
    const base = `${Auth.user().id}/${crypto.randomUUID()}`;
    const opts = { contentType: "image/jpeg", cacheControl: "31536000", upsert: false };
    const bucket = supabaseClient.storage.from(BUCKET);
    const a = await bucket.upload(base + ".jpg", full, opts);
    if (a.error) throw a.error;
    const b = await bucket.upload(base + "_thumb.jpg", thumb, opts);
    if (b.error) { await bucket.remove([base + ".jpg"]); throw b.error; }
    return { image: bucket.getPublicUrl(base + ".jpg").data.publicUrl, thumb: bucket.getPublicUrl(base + "_thumb.jpg").data.publicUrl };
  }
  function storagePath(url) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const i = typeof url === "string" ? url.indexOf(marker) : -1;
    return i < 0 ? null : decodeURIComponent(url.slice(i + marker.length));
  }
  async function removeListingPhotos(urls) {
    const paths = urls.map(storagePath).filter(Boolean);
    if (paths.length) await supabaseClient.storage.from(BUCKET).remove(paths);
  }

  return {
    async loadProfiles(ids) {
      if (!ids.length) return;
      const s = load(), known = new Set((s.remoteUsers || []).map(u => u.id));
      const missing = [...new Set(ids)].filter(id => id && !known.has(id));
      if (!missing.length) return;
      const { data, error } = await supabaseClient.from("profiles").select("id, display_name, role, place").in("id", missing);
      if (error) throw error;
      s.remoteUsers = [...(s.remoteUsers || []), ...data.map(p => ({ id: p.id, name: p.display_name, role: p.role, place: p.place }))];
      save();
    },
    async loadPublic(force = false) {
      const s = load();
      if (!force && s.publicLoadedAt && Date.now() - s.publicLoadedAt < PUBLIC_TTL) return;
      const { data, error } = await supabaseClient.from("listings").select(LISTING_COLUMNS).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      s.remoteListings = data.map(remoteListing); s.publicLoadedAt = Date.now(); save();
      await this.loadProfiles(data.map(r => r.owner_id));
    },
    async loadExchanges(force = false) {
      const s = load();
      if (!force && s.exchangesLoadedAt && Date.now() - s.exchangesLoadedAt < EXCHANGES_TTL) return;
      const { data, error } = await supabaseClient.from("exchanges").select("id, listing_id, title, category, weight_kg, from_id, to_id, created_at").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      s.history = data.map(h => ({ id: h.id, listingId: h.listing_id, title: h.title, category: h.category, weightKg: Number(h.weight_kg), fromId: h.from_id, toId: h.to_id, date: new Date(h.created_at).getTime() }));
      s.exchangesLoadedAt = Date.now(); save();
      await this.loadProfiles(data.flatMap(h => [h.from_id, h.to_id]));
    },
    async loadPrivate() {
      if (!remote()) return;
      const s = load(), me = Auth.user().id;
      if (s.privateUser !== me) { s.conversations = []; s.lastMsgAt = null; s.privateUser = me; }
      const convs = await supabaseClient.from("conversations").select(CONV_COLUMNS);
      if (convs.error) throw convs.error;
      const msgs = await supabaseClient.from("messages").select(MSG_COLUMNS).order("created_at", { ascending: true }).limit(1000);
      if (msgs.error) throw msgs.error;
      const old = new Map(s.conversations.map(c => [c.id, c]));
      s.conversations = convs.data.map(c => {
        const prev = old.get(c.id), mine = c.owner_id === me;
        const serverReadAt = new Date(mine ? c.owner_read_at : c.participant_read_at).getTime();
        return { id: c.id, listingId: c.listing_id, ownerId: c.owner_id, participantId: c.participant_id,
          otherId: mine ? c.participant_id : c.owner_id,
          readAt: Math.max(serverReadAt, prev?.readAt || 0),
          ownerConfirmedAt: c.owner_confirmed_at, participantConfirmedAt: c.participant_confirmed_at,
          messages: [], unread: 0 };
      });
      msgs.data.forEach(m => this.receiveMessage(m, false));
      if (msgs.data.length) s.lastMsgAt = msgs.data[msgs.data.length - 1].created_at;
      s.conversations.forEach(c => { c.unread = c.messages.filter(m => m.from !== me && m.ts > c.readAt).length; });
      save(); await this.loadProfiles(s.conversations.map(c => c.otherId));
      document.dispatchEvent(new CustomEvent("messageschange"));
    },
    me() { return load().user; },
    saveMe(patch) { Object.assign(load().user, patch); save(); },
    userById(id) {
      const s = load();
      if (id === ME) return s.user;
      if (!id) return { id: null, name: "Former member", role: "individual" };
      return (s.remoteUsers || []).find(u => u.id === id) || { id, name: "ReCircle member", role: "individual" };
    },
    listings() { return [...load().listings, ...(load().remoteListings || [])].sort((a, b) => b.createdAt - a.createdAt); },
    listing(id) { return this.listings().find(l => l.id === id); },
    async addListing(data, photo) {
      if (!remote()) throw new Error("Please sign in first");
      let urls = { image: null, thumb: null };
      if (photo) urls = await uploadListingPhotos(photo.full, photo.thumb);
      const result = await supabaseClient.from("listings").insert({
        owner_id: Auth.user().id, kind: data.kind, category: data.category, title: data.title,
        description: data.desc, qty: data.qty, unit: data.unit, weight_kg: data.weightKg,
        condition: data.condition, price: data.price, place: data.place, lat: data.lat, lng: data.lng,
        image: urls.image, thumb: urls.thumb
      }).select(LISTING_COLUMNS).single();
      if (result.error) { await removeListingPhotos([urls.image, urls.thumb]); throw result.error; }
      const l = remoteListing(result.data), s = load();
      s.remoteListings = [l, ...(s.remoteListings || [])]; save();
      document.dispatchEvent(new CustomEvent("listingschange")); return l;
    },
    async updateListing(id, patch) {
      const row = {};
      ["kind", "category", "title", "description", "qty", "unit", "weight_kg", "condition", "price", "place", "lat", "lng", "status"]
        .forEach(key => { if (patch[key] !== undefined) row[key] = patch[key]; });
      if (patch.desc !== undefined) row.description = patch.desc;
      if (patch.weightKg !== undefined) row.weight_kg = patch.weightKg;
      if (!Object.keys(row).length) throw new Error("No listing changes to save");
      const result = await supabaseClient.from("listings").update(row).eq("id", id).select(LISTING_COLUMNS).single();
      if (result.error) throw result.error;
      const updated = remoteListing(result.data), s = load();
      s.remoteListings = (s.remoteListings || []).map(l => l.id === id ? updated : l);
      save(); return updated;
    },
    async deleteListing(id) {
      const l = this.listing(id), { error } = await supabaseClient.from("listings").delete().eq("id", id);
      if (error) throw error;
      if (l) await removeListingPhotos([l.image, l.thumb]);
      const s = load(); s.remoteListings = (s.remoteListings || []).filter(x => x.id !== id);
      s.conversations = s.conversations.filter(c => c.listingId !== id); save();
    },
    conversations() { return load().conversations.slice().sort((a, b) => lastTs(b) - lastTs(a)); },
    conversation(id) { return load().conversations.find(c => c.id === id); },
    async openConversation(listingId) {
      if (!remote()) throw new Error("Please sign in to message");
      const me = Auth.user().id, l = this.listing(listingId);
      if (!l) throw new Error("Listing not found");
      if (l.ownerId === me) throw new Error("This is your own listing");
      let result = await supabaseClient.from("conversations").select("id").eq("listing_id", listingId).eq("participant_id", me).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        result = await supabaseClient.from("conversations").insert({ listing_id: listingId, owner_id: l.ownerId, participant_id: me }).select("id").single();
        if (result.error) throw result.error;
      }
      await this.loadPrivate(); return this.conversation(result.data.id);
    },
    async sendMessage(convId, text) {
      const result = await supabaseClient.from("messages").insert({ conversation_id: convId, sender_id: Auth.user().id, body: text }).select(MSG_COLUMNS).single();
      if (result.error) throw result.error; this.receiveMessage(result.data);
    },
    receiveMessage(row, persist = true) {
      const c = this.conversation(row.conversation_id);
      if (!c || c.messages.some(m => m.id === row.id)) return false;
      const ts = new Date(row.created_at).getTime();
      c.messages.push({ id: row.id, from: row.sender_id, text: row.body, ts });
      if (row.sender_id !== ME && ts > (c.readAt || 0)) c.unread = (c.unread || 0) + 1;
      const s = load(); if (!s.lastMsgAt || row.created_at > s.lastMsgAt) s.lastMsgAt = row.created_at;
      if (persist) save(); return true;
    },
    markRead(convId) {
      const c = this.conversation(convId); if (!c) return;
      const latestIncoming = c.messages.reduce((latest, m) => m.from === ME ? latest : Math.max(latest, m.ts), 0);
      if (!c.unread && c.readAt >= latestIncoming) return;
      c.unread = 0; c.readAt = Date.now(); save();
      if (remote()) supabaseClient.rpc("mark_conversation_read", { p_conversation: convId }).then(({ error }) => { if (error) console.error("mark read failed", error); });
    },
    /* Confirm the hand-off. The second person's confirmation completes it. */
    async completeExchange(convId) {
      const result = await supabaseClient.rpc("complete_exchange", { p_conversation: convId });
      if (result.error) throw result.error;
      const d = result.data, c = this.conversation(convId);
      if (c) { c.ownerConfirmedAt = d.owner_confirmed_at; c.participantConfirmedAt = d.participant_confirmed_at; }
      if (d.completed) {
        const l = this.listing(d.listing_id); if (l) l.status = "exchanged";
        load().conversations.forEach(x => {
          if (x.listingId === d.listing_id && x.id !== convId) { x.ownerConfirmedAt = null; x.participantConfirmedAt = null; }
        });
        load().exchangesLoadedAt = 0;
        document.dispatchEvent(new CustomEvent("listingschange"));
      }
      save(); return d;
    },
    /* Take back my confirmation (only before the exchange is completed). */
    async withdrawConfirmation(convId) {
      const result = await supabaseClient.rpc("withdraw_exchange_confirmation", { p_conversation: convId });
      if (result.error) throw result.error;
      const c = this.conversation(convId);
      if (c) { c.ownerConfirmedAt = result.data.owner_confirmed_at; c.participantConfirmedAt = result.data.participant_confirmed_at; }
      save(); return result.data;
    },
    /* Apply a live conversation update. Returns true if a confirmation changed. */
    applyConversationUpdate(row) {
      const c = this.conversation(row.id);
      if (!c) return false;
      const changed = (c.ownerConfirmedAt || null) !== (row.owner_confirmed_at || null)
        || (c.participantConfirmedAt || null) !== (row.participant_confirmed_at || null)
        || c.listingId !== row.listing_id
        || c.ownerId !== row.owner_id || c.participantId !== row.participant_id;
      c.ownerConfirmedAt = row.owner_confirmed_at; c.participantConfirmedAt = row.participant_confirmed_at;
      c.listingId = row.listing_id; c.ownerId = row.owner_id; c.participantId = row.participant_id;
      c.otherId = c.ownerId === ME ? c.participantId : (c.participantId === ME ? c.ownerId : c.otherId);
      if (row.owner_confirmed_at && row.participant_confirmed_at) {
        const l = this.listing(row.listing_id); if (l) l.status = "exchanged";
        load().exchangesLoadedAt = 0;
      }
      save(); return changed;
    },
    history() { return load().history.slice().sort((a, b) => b.date - a.date); },
    unreadCount() { return load().conversations.reduce((n, c) => n + (c.unread || 0), 0); },
    reset() { localStorage.removeItem(STORE_KEY); state = null; load(); }
  };
  function lastTs(c) { return c.messages.length ? c.messages[c.messages.length - 1].ts : 0; }
})();

function co2For(category, kg) {
  const c = CATEGORIES[category] || CATEGORIES.other;
  return (Number(kg) || 0) * c.co2;
}
