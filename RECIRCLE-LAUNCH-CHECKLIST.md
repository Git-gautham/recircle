# ReCircle — Changes Needed Before Public Launch

**Project:** ReCircle (TERRACODE 2026) · **Repo:** `Git-gautham/recircle` · **Supabase project:** `axcpgigdwmhumvcuiqoy`
**Checked against the code on:** 10 Nov 2026

This file lists every change needed before ReCircle is opened to the public, in the order to do them.
Each item says **why** it matters, **where** to change it, and **exactly what** to do. A tick-box checklist is at the end ([Section 8](#8-master-checklist)).

> **How the SQL was checked:** the database migration in [Appendix A](#appendix-a--migration-v2sql) was run on a local PostgreSQL 16 copy of your `schema.sql`, with stand-ins for Supabase's `auth` and `storage` parts. 27 tests passed (security rules, limits, exchanges, account deletion). It also ran cleanly over existing test data. It has **not** been run on your real Supabase project yet — do that in Step 2.

---

## Contents

0. [Summary — what's wrong today](#0-summary--whats-wrong-today)
1. [Supabase dashboard settings (no code)](#1-supabase-dashboard-settings-no-code)
2. [Database migration](#2-database-migration)
3. [Website code changes](#3-website-code-changes)
4. [Optional but recommended](#4-optional-but-recommended)
5. [Storage & bandwidth budget (50 users, 50 listings)](#5-storage--bandwidth-budget-50-users-50-listings)
6. [Launch test plan](#6-launch-test-plan)
7. [After launch](#7-after-launch)
8. [Master checklist](#8-master-checklist)
- [Appendix A — migration-v2.sql](#appendix-a--migration-v2sql)
- [Appendix B — Verdict on the earlier review list](#appendix-b--verdict-on-the-earlier-review-list)

---

## 0. Summary — what's wrong today

| # | Problem | Severity | Fixed in |
|---|---|---|---|
| 1 | Fake auto-replies appear in **real** chats under a real user's name (`messages.js`) | 🔴 Blocker | 3.1 |
| 2 | Anyone can inject code through the listing `image` field → runs for every visitor (stored XSS) | 🔴 Blocker | 2 + 3.2 |
| 3 | Signup emails only reach Supabase team members, 2 per hour → public can't sign up | 🔴 Blocker | 1.3 |
| 4 | Writes are not awaited — "Message seller" and "Publish" can silently fail | 🔴 Blocker | 3.3 |
| 5 | Photos stored as base64 text → ~79 GB/month egress vs 5 GB free | 🔴 Blocker | 2 + 3.4 + 3.3 |
| 6 | Logged-out visitors see only fake demo listings | 🟠 Critical | 3.1 + 3.3 |
| 7 | Exchanges, history and impact are browser-only and show made-up numbers | 🟠 Critical | 2 + 3.7 |
| 8 | Any user can make themselves `admin` with one API call | 🟠 Critical | 2 |
| 9 | Any user can open a chat with *any* other user (forged `owner_id`) | 🟠 Critical | 2 |
| 10 | No limits on text length, photo size, listings or messages per user | 🟠 Critical | 2 |
| 11 | Exact home location (≈1 m) of every user is public in `profiles` | 🟠 Critical | 2 + 3.5 |
| 12 | New users default to Bengaluru coordinates | 🟡 High | 2 + 3.5 |
| 13 | Chat isn't real-time; unread badge never shows for real messages | 🟡 High | 2 + 3.6 |
| 14 | No password reset / resend-confirmation | 🟡 High | 3.8 |
| 15 | No account deletion | 🟡 High | 2 + 3.9 |
| 16 | No report button, no CAPTCHA | 🟡 High | 2 + 3.10 + 4.1 |
| 17 | `supabase-js@2` loaded unpinned from a CDN | 🟢 Medium | 3.11 |
| 18 | No privacy policy | 🟢 Medium | 3.12 |
| 19 | Pop-ups don't trap keyboard focus; unknown category crashes Messages | 🟢 Medium | 3.11 |
| 20 | Free Supabase project pauses after 1 week without activity | 🟢 Medium | 7 |

**Order of work:** Section 1 → Section 2 → Section 3 (in order) → Section 6 tests → launch.
Do **4.1 CAPTCHA last**: once it is switched on in Supabase, sign-in stops working until the code sends a CAPTCHA token.

---

## 1. Supabase dashboard settings (no code)

### 1.1 URL configuration
**Why:** confirmation and password-reset links must point at your live site, not `localhost`.

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL:** `https://git-gautham.github.io/recircle/`
3. **Redirect URLs** → add both:
   - `https://git-gautham.github.io/recircle/**`
   - `http://127.0.0.1:5500/**` (VS Code Live Server, for testing)
4. Save.

### 1.2 Email confirmation and password rules
1. **Authentication → Sign In / Providers → Email:** keep **Confirm email = ON**.
2. In the same Email provider settings, set **Minimum password length = 8**.
3. In `js/ui.js` → `openAuth()`, change the password input to `minlength="8"` so the form matches.

### 1.3 Custom email sender (SMTP) — 🔴 blocker
**Why:** Supabase's built-in email service only delivers to members of your Supabase team, at 2 emails per hour. Any other signup fails with *"Email address not authorized."*

**Option A — Gmail (no domain needed, free):**
1. Use the Gmail account you want emails to come from (a project account like `recircle.app@gmail.com` is best).
2. Google Account → **Security** → turn on **2-Step Verification**.
3. Google Account → search **"App passwords"** → create one named `Supabase` → copy the 16-character password.
4. Supabase → **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:

   | Field | Value |
   |---|---|
   | Sender email | your Gmail address |
   | Sender name | `ReCircle` |
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | your Gmail address |
   | Password | the 16-character app password |

5. **Authentication → Rate Limits** → *Rate limit for sending emails* → `30` per hour (default after custom SMTP).

**Option B — Brevo** (needs a domain you own): host `smtp-relay.brevo.com`, port `587`, username = Brevo login, password = Brevo **SMTP key**, sender = verified address on your domain.

### 1.4 Email templates
Supabase → **Authentication → Emails → Templates**:
1. **Confirm signup** → paste the contents of `supabase/confirm-signup-email.html`. Subject: `Confirm your ReCircle account`.
2. **Reset password** → copy the same design, change the heading to *"Reset your password"* and the button text to *"Choose a new password"*. Keep `{{ .ConfirmationURL }}` as the link. Subject: `Reset your ReCircle password`.

### 1.5 Delete test data (recommended)
**Why:** old test listings have base64 photos and values the new rules reject. The migration keeps them, but editing them later would fail.

Supabase → **Table Editor**: delete test rows from `messages`, `conversations`, `listings`. Delete test users under **Authentication → Users** (their profiles are removed automatically).

---

## 2. Database migration

**What it does** (full SQL in [Appendix A](#appendix-a--migration-v2sql)):

| Section | Change |
|---|---|
| 0 | Removes old base64 photos from listings |
| 1 | Drops `lat`/`lng` from `profiles` (privacy + fixes the Bengaluru default); limits name/place length; fixes the signup trigger for blank names; **blocks self-promotion to `admin`** |
| 2 | Adds `thumb` column; validates title/description/category/unit/numbers/coordinates; **only accepts photo URLs from your own Storage bucket** (stops XSS); rounds location to ~110 m; max **20 active listings** and **10 new per hour** per user |
| 3 | Only the buyer can open a chat, and only with the listing's real owner; adds read-times for unread badges; max 30 new chats/day |
| 4 | Messages ≤ 1000 chars; max 20/minute and 500/day per user; turns on real-time for `messages` |
| 5 | New `exchanges` table + `complete_exchange()` function (owner confirms; updates listing and history together) |
| 6 | New `reports` table (users can report; only you can read them) |
| 7 | Creates `listing-images` Storage bucket (public, **300 KB max, JPEG only**), users can only upload into their own folder, max **40 files** per user |
| 8 | `delete_my_account()` function |
| 9 | Only signed-in users can call the new functions |

**Steps:**
1. Copy [Appendix A](#appendix-a--migration-v2sql) into a new file `supabase/migration-v2.sql` in your repo (keeps a record).
2. Supabase → **SQL Editor → New query** → paste the whole file → **Run**.
3. It runs as one transaction: if any error appears, nothing was changed. Copy the error and fix before re-running.
4. Check: **Table Editor** shows `exchanges` and `reports`; **Storage** shows bucket `listing-images`; **Database → Publications → supabase_realtime** includes `messages`.
5. If you skipped 1.5 and later want the rules enforced on old rows too, delete the bad rows, then run:
   ```sql
   alter table public.listings validate constraint listings_numbers_ok;
   alter table public.listings validate constraint listings_category_ok;
   alter table public.listings validate constraint listings_unit_ok;
   alter table public.listings validate constraint listings_title_len;
   ```

> ⚠️ The website code in Section 3 expects this migration. After running it, the **current** site will show errors on profile load (it still asks for `lat`/`lng`) until 3.5 is done. Do Section 2 and Section 3 in the same sitting, or test on a branch first.

---

## 3. Website code changes

Files are in your `recircle` folder. Do these in order.

### 3.1 Production mode — remove demo data and fake replies

**Why:** fake listings, fake users, fake history and fake chat replies must not appear on a public site.

**`js/data.js`** — add at the very top:
```js
/* false = real site (Supabase only). true = offline demo with fake data. */
const DEMO_MODE = false;
```

**`js/store.js`**
1. Change the storage key so visitors' old cached demo data is thrown away:
   ```js
   const STORE_KEY = "recircle_v2";
   ```
2. In `seed()` change `version: 1` → `version: 2`, and only load demo data in demo mode:
   ```js
   users: DEMO_MODE ? USERS.map(u => ({ ...u })) : [],
   listings: DEMO_MODE ? LISTINGS.map(l => {
     const { ago, ...rest } = l;
     return { ...rest, status: "available", createdAt: now - ago, image: null };
   }) : [],
   conversations: [],
   history: DEMO_MODE ? HISTORY.map((h, i) => {
     const { monthsAgo, ...rest } = h;
     return { id: "h" + (i + 1), listingId: null, ...rest, date: monthsAgoDate(monthsAgo, i) };
   }) : []
   ```
3. In `load()` change `state.version !== 1` → `state.version !== 2`.
4. In `userById()` change the fallback name `"Unknown"` → `"Former member"` (shown when a user deleted their account).

**`js/ui.js`** — in `renderChrome()` footer, show the reset button only in demo mode:
```js
${DEMO_MODE ? `<button class="link-btn" id="resetDemo">Reset demo data</button>` : ""}
```
and change the listener line to:
```js
$("#resetDemo")?.addEventListener("click", () => { /* same body as before */ });
```

**`js/post.js`** — delete the whole `simulateInterest()` function and the line `const who = simulateInterest(listing);`. In the success modal, keep only the "shared with the ReCircle community" text.

**`js/messages.js`** — in `send()` delete both `setTimeout(...)` blocks (the "is typing…" and the `AUTO_REPLIES` reply). The new `send()` is in 3.6.

---

### 3.2 Fix the image injection (XSS)

**Why:** `listingCard()` and `detail.js` write `l.image` straight into `<img src="...">`. A value like `x" onerror="..."` runs code for every visitor and can steal their login. The migration blocks bad values in the database; this blocks them in the browser too.

**`js/ui.js`** — add below `esc()`:
```js
/* Only allow photos from our own Storage bucket, or a local preview */
function safeImageUrl(url) {
  if (typeof url !== "string") return "";
  const bucket = SUPABASE_URL + "/storage/v1/object/public/listing-images/";
  const ok = url.startsWith(bucket) || url.startsWith("blob:" + location.origin + "/");
  return ok ? esc(url) : "";
}
```

**`js/ui.js` → `listingCard()`** — replace the `media` lines:
```js
const src = safeImageUrl(l.thumb || l.image);
const media = src
  ? `<img src="${src}" alt="" loading="lazy">`
  : `<span class="card-glyph" aria-hidden="true">${cat.icon}</span>`;
```

**`js/detail.js` → `openListing()`** — replace the `media` lines:
```js
const src = safeImageUrl(l.image || l.thumb);
const media = src
  ? `<img src="${src}" alt="${esc(l.title)}">`
  : `<span aria-hidden="true">${cat.icon}</span>`;
```

**`js/marketplace.js` → `drawMap()`** — the popup uses an inline `onclick`. Replace the button with:
```js
<button class="btn primary sm" style="margin-top:8px" data-open-listing="${esc(l.id)}">View details</button>
```
and add once inside `initMap()`:
```js
map.on("popupopen", e => {
  const btn = e.popup.getElement().querySelector("[data-open-listing]");
  if (btn) btn.addEventListener("click", () => openListing(btn.dataset.openListing));
});
```

---

### 3.3 Rewrite the Supabase part of `js/store.js`

**Why:** fixes four things at once —
- logged-out visitors can see real listings,
- writes are **awaited** (no more silent failures),
- the site downloads **only what it needs** (cuts egress),
- data is cached for 60 seconds so moving between pages doesn't re-download everything.

**Step 1 — helpers.** Add near the top of `store.js` (after `let ME = "me";`):
```js
const BUCKET = "listing-images";
const PUBLIC_TTL = 60 * 1000;          // reuse listings for 60 s between pages
const EXCHANGES_TTL = 5 * 60 * 1000;   // reuse history for 5 min
const LISTING_COLUMNS = "id, owner_id, kind, category, title, description, qty, unit, weight_kg, condition, price, place, lat, lng, image, thumb, status, created_at";
const CONV_COLUMNS = "id, listing_id, owner_id, participant_id, owner_read_at, participant_read_at, created_at";
const MSG_COLUMNS = "id, conversation_id, sender_id, body, created_at";

async function uploadListingPhotos(full, thumb) {
  const base = `${Auth.user().id}/${crypto.randomUUID()}`;
  const opts = { contentType: "image/jpeg", cacheControl: "31536000", upsert: false };
  const bucket = supabaseClient.storage.from(BUCKET);
  const a = await bucket.upload(base + ".jpg", full, opts);
  if (a.error) throw a.error;
  const b = await bucket.upload(base + "_thumb.jpg", thumb, opts);
  if (b.error) { await bucket.remove([base + ".jpg"]); throw b.error; }
  return {
    image: bucket.getPublicUrl(base + ".jpg").data.publicUrl,
    thumb: bucket.getPublicUrl(base + "_thumb.jpg").data.publicUrl
  };
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
```

**Step 2 — inside the `Store` object**, update `remoteListing` to include the thumbnail:
```js
const remoteListing = row => ({
  id: row.id, ownerId: row.owner_id, kind: row.kind, category: row.category,
  title: row.title, desc: row.description, qty: Number(row.qty), unit: row.unit,
  weightKg: Number(row.weight_kg), condition: row.condition, price: Number(row.price),
  place: row.place, lat: row.lat, lng: row.lng, image: row.image, thumb: row.thumb,
  status: row.status, createdAt: new Date(row.created_at).getTime()
});
```

**Step 3 — replace the whole `async sync() { ... }` method** with these methods:
```js
/* Make sure we know the names of these users */
async loadProfiles(ids) {
  const s = load();
  const known = new Set((s.remoteUsers || []).map(u => u.id));
  const missing = [...new Set(ids)].filter(id => id && !known.has(id));
  if (!missing.length) return;
  const { data, error } = await supabaseClient.from("profiles")
    .select("id, display_name, role, place").in("id", missing);
  if (error) throw error;
  s.remoteUsers = [...(s.remoteUsers || []),
    ...data.map(p => ({ id: p.id, name: p.display_name, role: p.role, place: p.place }))];
  save();
},

/* Listings — for everyone, signed in or not */
async loadPublic(force = false) {
  const s = load();
  if (!force && s.publicLoadedAt && Date.now() - s.publicLoadedAt < PUBLIC_TTL) return;
  const { data, error } = await supabaseClient.from("listings")
    .select(LISTING_COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  s.remoteListings = data.map(remoteListing);
  s.publicLoadedAt = Date.now();
  save();
  await this.loadProfiles(data.map(r => r.owner_id));
},

/* History + impact — for everyone */
async loadExchanges(force = false) {
  const s = load();
  if (!force && s.exchangesLoadedAt && Date.now() - s.exchangesLoadedAt < EXCHANGES_TTL) return;
  const { data, error } = await supabaseClient.from("exchanges")
    .select("id, listing_id, title, category, weight_kg, from_id, to_id, created_at")
    .order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  s.history = data.map(h => ({
    id: h.id, listingId: h.listing_id, title: h.title, category: h.category,
    weightKg: Number(h.weight_kg), fromId: h.from_id, toId: h.to_id,
    date: new Date(h.created_at).getTime()
  }));
  s.exchangesLoadedAt = Date.now();
  save();
  await this.loadProfiles(data.flatMap(h => [h.from_id, h.to_id]));
},

/* My conversations — only new messages are downloaded after the first time */
async loadPrivate() {
  if (!remote()) return;
  const s = load(), me = Auth.user().id;
  if (s.privateUser !== me) { s.conversations = []; s.lastMsgAt = null; s.privateUser = me; }

  const convs = await supabaseClient.from("conversations").select(CONV_COLUMNS);
  if (convs.error) throw convs.error;

  let q = supabaseClient.from("messages").select(MSG_COLUMNS)
    .order("created_at", { ascending: true }).limit(1000);
  if (s.lastMsgAt) q = q.gt("created_at", s.lastMsgAt);
  const msgs = await q;
  if (msgs.error) throw msgs.error;

  const old = new Map(s.conversations.map(c => [c.id, c]));
  s.conversations = convs.data.map(c => {
    const prev = old.get(c.id);
    const mine = c.owner_id === me;
    return {
      id: c.id, listingId: c.listing_id,
      otherId: mine ? c.participant_id : c.owner_id,
      readAt: new Date(mine ? c.owner_read_at : c.participant_read_at).getTime(),
      messages: prev ? prev.messages : [], unread: 0
    };
  });
  msgs.data.forEach(m => this.receiveMessage(m, false));
  if (msgs.data.length) s.lastMsgAt = msgs.data[msgs.data.length - 1].created_at;
  s.conversations.forEach(c => {
    c.unread = c.messages.filter(m => m.from !== me && m.ts > c.readAt).length;
  });
  save();
  await this.loadProfiles(s.conversations.map(c => c.otherId));
},
```

**Step 4 — replace `addListing`, `updateListing`, `deleteListing`:**
```js
async addListing(data, photo) {
  if (!remote()) throw new Error("Please sign in first");
  let urls = { image: null, thumb: null };
  if (photo) urls = await uploadListingPhotos(photo.full, photo.thumb);
  const { data: row, error } = await supabaseClient.from("listings").insert({
    owner_id: Auth.user().id, kind: data.kind, category: data.category, title: data.title,
    description: data.desc, qty: data.qty, unit: data.unit, weight_kg: data.weightKg,
    condition: data.condition, price: data.price, place: data.place,
    lat: data.lat, lng: data.lng, image: urls.image, thumb: urls.thumb
  }).select(LISTING_COLUMNS).single();
  if (error) {
    await removeListingPhotos([urls.image, urls.thumb]);
    throw error;
  }
  const s = load(), l = remoteListing(row);
  s.remoteListings = [l, ...(s.remoteListings || [])];
  save();
  document.dispatchEvent(new CustomEvent("listingschange"));
  return l;
},

async updateListing(id, patch) {
  const row = {};
  if (patch.status) row.status = patch.status;
  const { error } = await supabaseClient.from("listings").update(row).eq("id", id);
  if (error) throw error;
  const l = this.listing(id);
  if (l) Object.assign(l, patch);
  save();
  return l;
},

async deleteListing(id) {
  const l = this.listing(id);
  const { error } = await supabaseClient.from("listings").delete().eq("id", id);
  if (error) throw error;
  if (l) await removeListingPhotos([l.image, l.thumb]);
  const s = load();
  s.remoteListings = (s.remoteListings || []).filter(x => x.id !== id);
  s.conversations = s.conversations.filter(c => c.listingId !== id);
  save();
},
```

**Step 5 — replace `openConversation`, `addMessage`, `markRead`, `completeExchange`:**
```js
async openConversation(listingId) {
  if (!remote()) throw new Error("Please sign in to message");
  const me = Auth.user().id;
  const l = this.listing(listingId);
  if (!l) throw new Error("Listing not found");
  if (l.ownerId === me) throw new Error("This is your own listing");

  let { data: c, error } = await supabaseClient.from("conversations")
    .select("id").eq("listing_id", listingId).eq("participant_id", me).maybeSingle();
  if (error) throw error;
  if (!c) {
    const ins = await supabaseClient.from("conversations")
      .insert({ listing_id: listingId, owner_id: l.ownerId, participant_id: me })
      .select("id").single();
    if (ins.error) throw ins.error;
    c = ins.data;
  }
  await this.loadPrivate();
  return this.conversation(c.id);
},

async sendMessage(convId, text) {
  const { data: row, error } = await supabaseClient.from("messages")
    .insert({ conversation_id: convId, sender_id: Auth.user().id, body: text })
    .select(MSG_COLUMNS).single();
  if (error) throw error;
  this.receiveMessage(row);
},

/* Add a message from the server (also used by real-time). Returns true if new. */
receiveMessage(row, persist = true) {
  const c = this.conversation(row.conversation_id);
  if (!c || c.messages.some(m => m.id === row.id)) return false;
  const ts = new Date(row.created_at).getTime();
  c.messages.push({ id: row.id, from: row.sender_id, text: row.body, ts });
  if (row.sender_id !== ME && ts > (c.readAt || 0)) c.unread = (c.unread || 0) + 1;
  const s = load();
  if (!s.lastMsgAt || row.created_at > s.lastMsgAt) s.lastMsgAt = row.created_at;
  if (persist) save();
  return true;
},

markRead(convId) {
  const c = this.conversation(convId);
  if (!c || !c.unread) return;
  c.unread = 0; c.readAt = Date.now(); save();
  if (remote()) supabaseClient.rpc("mark_conversation_read", { p_conversation: convId })
    .then(({ error }) => { if (error) console.error("mark read failed", error); });
},

async completeExchange(convId) {
  const { data, error } = await supabaseClient.rpc("complete_exchange", { p_conversation: convId });
  if (error) throw error;
  const l = this.listing(data.listing_id);
  if (l) l.status = "exchanged";
  const s = load();
  s.exchangesLoadedAt = 0;   // force fresh history next time
  save();
  return data;
},
```
Delete the old `addMessage` method. Keep `conversations()`, `conversation()`, `unreadCount()`, `history()`, `listings()`, `listing()`, `me()`, `saveMe()`, `userById()`, `reset()`.

**Step 6 — `js/ui.js`, page start-up.** Replace the `DOMContentLoaded` block at the bottom:
```js
document.addEventListener("DOMContentLoaded", async () => {
  try { await Auth.init(); }
  catch (err) { console.error("Supabase authentication could not initialize", err); }
  renderChrome();
  try { await Store.loadPublic(); }
  catch (err) { console.error(err); toast("Listings are temporarily unavailable"); }
  try { await Store.loadExchanges(); } catch (err) { console.error(err); }
  try { await Store.loadPrivate(); } catch (err) { console.error(err); }
  refreshChrome();
  startRealtime();                       // see 3.6
  document.dispatchEvent(new CustomEvent("listingschange"));
});
```
`js/impact.js` doesn't listen for `listingschange` yet — add inside its `DOMContentLoaded`:
```js
document.addEventListener("listingschange", renderAll);
```

**Step 7 — `js/detail.js`, use the async methods.** In the click handler inside `openListing()`:
```js
if (act === "chat") {
  if (!Auth.isSignedIn()) { closeModal(); openAuth(); return; }
  const btn = e.target.closest("[data-act]");
  btn.disabled = true;
  Store.openConversation(l.id)
    .then(c => { location.href = "messages.html?c=" + c.id; })
    .catch(err => { toast(err.message || "Couldn't start the chat"); btn.disabled = false; });
}
if (act === "toggle") {
  Store.updateListing(l.id, { status: l.status === "reserved" ? "available" : "reserved" })
    .then(() => { toast("Status updated"); closeModal(); document.dispatchEvent(new CustomEvent("listingschange")); })
    .catch(err => toast(err.message || "Couldn't update"));
}
if (act === "delete" && confirm("Delete this listing?")) {
  Store.deleteListing(l.id)
    .then(() => { toast("Listing deleted"); closeModal(); document.dispatchEvent(new CustomEvent("listingschange")); })
    .catch(err => toast(err.message || "Couldn't delete"));
}
```

---

### 3.4 Photos → Supabase Storage (with thumbnails)

**Why:** base64 photos are the main cause of the egress problem (Section 5). Storage files are cached by the browser and Supabase's CDN.

**`js/post.js`**
1. Replace `let pickMap, pickMarker, photoData = null;` with:
   ```js
   let pickMap, pickMarker, photoPreview = null, photoBlobs = null;
   ```
2. Replace `resizeImage()` with:
   ```js
   /* Resize a photo to a JPEG Blob (max side = max px) */
   function resizeToBlob(file, max, quality = 0.7) {
     return new Promise((resolve, reject) => {
       const img = new Image();
       img.onload = () => {
         const s = Math.min(1, max / Math.max(img.width, img.height));
         const c = document.createElement("canvas");
         c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
         c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
         URL.revokeObjectURL(img.src);
         c.toBlob(b => b ? resolve(b) : reject(new Error("Image conversion failed")), "image/jpeg", quality);
       };
       img.onerror = reject;
       img.src = URL.createObjectURL(file);
     });
   }
   ```
3. In `formData()` change `image: photoData` → `image: photoPreview` (preview only; the real upload uses `photoBlobs`).
4. Replace the photo `change` handler body:
   ```js
   const file = e.target.files[0]; if (!file) return;
   try {
     let full = await resizeToBlob(file, 800, 0.7);
     if (full.size > 280 * 1024) full = await resizeToBlob(file, 800, 0.5);
     if (full.size > 280 * 1024) { toast("Photo is too large — try another one"); return; }
     const thumb = await resizeToBlob(file, 400, 0.7);
     photoBlobs = { full, thumb };
     if (photoPreview) URL.revokeObjectURL(photoPreview);
     photoPreview = URL.createObjectURL(full);
     const old = $("#photoDrop img"); if (old) old.remove();
     const img = document.createElement("img"); img.src = photoPreview; img.alt = "Selected photo";
     $("#photoDrop").prepend(img);
     updatePreview();
   } catch (err) { toast("Couldn't read that image"); }
   ```
5. Replace the form `submit` handler:
   ```js
   $("#postForm").addEventListener("submit", async e => {
     e.preventDefault();
     if (!Auth.isSignedIn()) { toast("Sign in before publishing a listing"); openAuth(); return; }
     const d = formData();
     if (d.title.length < 3) { toast("Title needs at least 3 characters"); $("[name=title]").focus(); return; }
     if (!(d.weightKg > 0)) { toast("Please add an approximate weight"); $("[name=weightKg]").focus(); return; }
     const btn = e.submitter || $("#postForm button[type=submit]");
     btn.disabled = true; btn.textContent = "Publishing…";
     try {
       await Store.addListing(d, photoBlobs);
       openModal(`
         <h2>🎉 Listing published!</h2>
         <p>Your ${d.kind === "wanted" ? "request" : "listing"} is now live on the marketplace.</p>
         <div class="form-actions">
           <a class="btn ghost" href="marketplace.html">View marketplace</a>
           <a class="btn primary" href="history.html">My listings</a>
         </div>`);
       $("#postForm").reset(); photoBlobs = null;
       if (photoPreview) { URL.revokeObjectURL(photoPreview); photoPreview = null; }
       const img = $("#photoDrop img"); if (img) img.remove();
       updatePreview();
     } catch (err) {
       toast(err.message || "Couldn't publish — please try again");
     } finally {
       btn.disabled = false; btn.textContent = "Publish listing";
     }
   });
   ```

**`post.html`**
- Title input: add `minlength="3"`.
- Photo hint: change *"optional — stays on this device"* → *"optional — max one photo"*.
- Under the map, add the privacy note (see 3.5).

---

### 3.5 Location privacy + Bengaluru fix

**Why:** the migration removes `lat`/`lng` from `profiles`. Your own location now stays only in your browser (used for "distance from you"). Listing pins are rounded to ~110 m by the database.

**`js/supabase.js`**
1. `loadProfile()` → select only `"id, display_name, role, place"`, and save without coordinates:
   ```js
   if (data) Store.saveMe({
     id: data.id, name: data.display_name || user().email?.split("@")[0] || "ReCircle user",
     role: data.role || "individual", place: data.place || ""
   });
   ```
2. `saveProfile()` → remove the `lat` and `lng` lines from `next`, and change the last `Store.saveMe(...)` to:
   ```js
   Store.saveMe({ id: data.id, name: data.display_name, role: data.role, place: data.place });
   ```
3. `localProfile()` → keep `lat: me.lat, lng: me.lng` (from the browser only).
4. The role list in `saveProfile` must **not** include `"admin"` (it doesn't today — keep it that way).

**`post.html`** — add right under `<div id="pickMap"></div>`:
```html
<p class="muted small" style="margin-top:8px">🔒 Only an approximate area (about 100 m) is shown publicly. Share the exact pickup address in chat.</p>
```

---

### 3.6 Real-time chat + unread badges

**`js/ui.js`** — add this function (above the `DOMContentLoaded` block):
```js
/* Live updates for new messages (one connection per open tab) */
let realtimeChannel = null;
function startRealtime() {
  if (!Auth.isSignedIn() || realtimeChannel) return;
  realtimeChannel = supabaseClient.channel("recircle-messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async ({ new: row }) => {
      if (Store.conversation(row.conversation_id)) Store.receiveMessage(row);
      else { try { await Store.loadPrivate(); } catch (e) { console.error(e); } }
      refreshChrome();
      document.dispatchEvent(new CustomEvent("messageschange", { detail: row }));
    })
    .subscribe();
}
```
Row Level Security decides which messages each user receives, so people only get messages from their own chats.

**`js/messages.js`**
1. Replace `send()`:
   ```js
   async function send(text) {
     text = String(text).trim();
     if (!text || !activeId) return;
     const input = $("#msg");
     if (input) input.disabled = true;
     try {
       await Store.sendMessage(activeId, text);
       renderAll();
     } catch (err) {
       toast(err.message || "Message not sent");
       if (input) input.value = text;
     } finally {
       const i = $("#msg"); if (i) { i.disabled = false; i.focus(); }
     }
   }
   ```
2. In `renderChat()`:
   - Only the **owner** confirms an exchange. Change the button condition to:
     ```js
     ${l ? (done
       ? `<span class="cat" style="--cat:var(--ok)">✓ Exchanged</span>`
       : (l.ownerId === ME ? `<button class="btn primary sm" id="doneBtn">✓ Mark as exchanged</button>` : ""))
       : ""}
     ```
   - Guard unknown categories: replace `CATEGORIES[l.category].icon` with `(CATEGORIES[l.category] || CATEGORIES.other).icon` (also in `renderList()`).
   - Chat input: add `maxlength="1000"`.
3. Replace the `yesBtn` click handler in `confirmExchange()`:
   ```js
   $("#yesBtn", m).addEventListener("click", async e => {
     e.target.disabled = true;
     try {
       await Store.completeExchange(c.id);
       closeModal(); renderAll();
       toast(`Nice! ${l.weightKg} kg kept out of landfill 🌱`);
     } catch (err) {
       toast(err.message || "Couldn't complete the exchange");
       e.target.disabled = false;
     }
   });
   ```
4. In the `DOMContentLoaded` block add:
   ```js
   document.addEventListener("messageschange", renderAll);
   ```

---

### 3.7 History and Impact from the shared `exchanges` table

Already handled by `Store.loadExchanges()` (3.3) — `history.js`, `impact.js` and `home.js` read `Store.history()`, which is now filled from Supabase.

Check these small things:
- **`js/history.js` → `exportCSV()`**: use `(CATEGORIES[h.category] || CATEGORIES.other).label`.
- **`js/impact.js`**: same guard in the doughnut chart labels/colours: `(CATEGORIES[k] || CATEGORIES.other)`.
- **`impact.html` footnote**: keep the note that CO₂ figures are estimates.

---

### 3.8 Password reset + resend confirmation

**`js/ui.js` → `openAuth()`** — add under the buttons:
```html
<p class="small"><button type="button" class="link-btn" id="forgotBtn">Forgot password?</button>
 · <button type="button" class="link-btn" id="resendBtn">Resend confirmation email</button></p>
```
and in `onOpen(m)`:
```js
$("#forgotBtn", m).addEventListener("click", async () => {
  const email = $("[name=email]", m).value.trim();
  if (!email) { error.textContent = "Type your email first."; return; }
  const { error: err } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("reset.html", location.href).href
  });
  error.textContent = err ? err.message : "If that email has an account, a reset link is on its way.";
});
$("#resendBtn", m).addEventListener("click", async () => {
  const email = $("[name=email]", m).value.trim();
  if (!email) { error.textContent = "Type your email first."; return; }
  const { error: err } = await supabaseClient.auth.resend({
    type: "signup", email, options: { emailRedirectTo: new URL("./", location.href).href }
  });
  error.textContent = err ? err.message : "Confirmation email sent again.";
});
```

**New file `reset.html`** (same `<head>` and script tags as `messages.html`, then):
```html
<main class="wrap" style="max-width:480px">
  <div class="page-head"><h1>Choose a new password</h1></div>
  <form id="resetForm" class="card form" style="padding:24px">
    <label>New password<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
    <button class="btn primary">Save password</button>
    <p class="muted small" id="resetMsg" role="alert"></p>
  </form>
</main>
<script>
document.addEventListener("DOMContentLoaded", () => {
  $("#resetForm").addEventListener("submit", async e => {
    e.preventDefault();
    const password = new FormData(e.target).get("password");
    const { error } = await supabaseClient.auth.updateUser({ password });
    $("#resetMsg").textContent = error
      ? error.message + " — the link may have expired; request a new one."
      : "Password updated. You can now use the site.";
    if (!error) setTimeout(() => { location.href = "index.html"; }, 1500);
  });
});
</script>
```
The reset link signs the user in automatically when the page opens; `updateUser` then saves the new password.

---

### 3.9 Delete my account

**`js/ui.js` → `openProfile()`** — add under the Sign out button:
```html
<button type="button" class="link-btn" id="deleteAccountBtn" style="color:var(--accent)">Delete my account</button>
```
and in `onOpen(m)`:
```js
$("#deleteAccountBtn", m).addEventListener("click", async () => {
  if (!confirm("Delete your account permanently? Your profile, listings, photos and messages will be removed.")) return;
  try {
    const uid = Auth.user().id;
    const bucket = supabaseClient.storage.from("listing-images");
    const { data: files } = await bucket.list(uid, { limit: 100 });
    if (files && files.length) await bucket.remove(files.map(f => `${uid}/${f.name}`));
    const { error } = await supabaseClient.rpc("delete_my_account");
    if (error) throw error;
    await supabaseClient.auth.signOut({ scope: "local" }).catch(() => {});
    Store.reset();
    location.href = "index.html";
  } catch (err) { toast(err.message || "Couldn't delete account"); }
});
```
Photos are removed first, then the account. Exchanges stay in the impact totals without the name.

> If Supabase refuses the delete with a permission error, delete the user manually under **Authentication → Users** and tell me — the function would then need to move into an Edge Function.

---

### 3.10 Report a listing

**`js/detail.js` → `openListing()`** — for signed-in users who are not the owner, add to `actions`:
```js
<button class="btn ghost" data-act="report">⚑ Report</button>
```
and in the click handler:
```js
if (act === "report") {
  if (!Auth.isSignedIn()) { closeModal(); openAuth(); return; }
  openModal(`
    <h2>Report this listing</h2>
    <form id="reportForm" class="form">
      <label>What's wrong?<textarea name="reason" required minlength="3" maxlength="300"></textarea></label>
      <div class="form-actions"><button class="btn primary">Send report</button></div>
    </form>`, {
    onOpen(m2) {
      $("#reportForm", m2).addEventListener("submit", async ev => {
        ev.preventDefault();
        const reason = new FormData(ev.target).get("reason").trim();
        const { error } = await supabaseClient.from("reports").insert({ listing_id: l.id, reason });
        toast(error ? (error.code === "23505" ? "You already reported this" : error.message) : "Thanks — we'll review it");
        if (!error) closeModal();
      });
    }
  });
}
```
Review reports in Supabase → **Table Editor → reports**. To remove a listing, delete it from **Table Editor → listings**.

---

### 3.11 Smaller fixes

**Pin the Supabase library** (a new release could break the site):
1. Download `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js` and save it as `vendor/supabase/supabase.js` (keeps everything local like Leaflet and Chart.js).
2. In **every** `.html` file replace
   `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
   with
   `<script src="vendor/supabase/supabase.js"></script>`
3. Add `vendor/supabase/LICENSE` (MIT, from the same npm package) for the credits.

**Pop-up keyboard focus (`js/ui.js` → `openModal`)** — after `if (onOpen) onOpen(m);` add:
```js
const opener = document.activeElement;
const focusables = () => [...m.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
(focusables()[1] || focusables()[0])?.focus();
m.addEventListener("keydown", e => {
  if (e.key !== "Tab") return;
  const f = focusables(); if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
m._opener = opener;
```
and in `closeModal()`, before `m.remove()`: `const back = m && m._opener;` and after it: `back?.focus?.();`.

**`README.md`** — update the "Notes on the demo" section: data is now shared via Supabase; the demo mode flag is in `js/data.js`.

---

### 3.12 Privacy policy + terms

**Why:** you collect emails, names, approximate locations and messages. India's data-protection law (DPDP Act 2023) expects users to be told what is collected and how to delete it. (Not legal advice — ask your faculty advisor if unsure.)

1. New page `privacy.html` (copy `history.html`'s layout) covering:
   - What is collected: email, display name, role, area, listing details and photos, approximate pickup location, chat messages.
   - Why: to run the marketplace and chat. No selling or ads.
   - Where: Supabase (database + storage), GitHub Pages (website).
   - Who sees what: listings and names are public; chats are only visible to the two people in them.
   - How to delete: **Profile → Delete my account**; contact email for other requests.
   - Do not share exact home addresses in listings.
2. Footer link: add `{ href: "privacy.html", label: "Privacy" }` to the footer links in `renderChrome()` (not to `NAV_LINKS`, so the top menu stays the same).
3. Sign-up form: add under the Create-account button:
   `<p class="muted small">By creating an account you agree to the <a href="privacy.html">privacy policy</a>.</p>`

---

## 4. Optional but recommended

### 4.1 CAPTCHA against bot signups (do this **last**)
Uses Cloudflare Turnstile (free).
1. Cloudflare dashboard → **Turnstile → Add site** → domain `git-gautham.github.io` → copy **Site key** and **Secret key**.
2. In every `.html` add: `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>`
3. In `openAuth()` add `<div id="captchaBox"></div>` above the buttons, and in `onOpen(m)`:
   ```js
   let captchaToken = "";
   const widget = window.turnstile?.render($("#captchaBox", m), {
     sitekey: "YOUR_SITE_KEY", callback: t => { captchaToken = t; }
   });
   ```
4. Pass `options: { captchaToken }` to `signInWithPassword`, `signUp` (merge into its existing `options`) and `resetPasswordForEmail`; call `turnstile.reset(widget)` after each attempt.
5. **Only after the code is live:** Supabase → **Authentication → Attack Protection → Enable CAPTCHA** → provider Turnstile → paste the **Secret key**.

### 4.2 Error monitoring
Show every Supabase error in a toast (done in the code above). For central logging later, a free self-hosted option is GlitchTip (open source, Sentry-compatible).

### 4.3 Content Security Policy
After 3.2 removes the inline `onclick`, you can add a CSP `<meta>` tag to each page. The site still uses inline `style="..."` attributes, so the policy must allow `'unsafe-inline'` for styles. Do this only after everything else works.

---

## 5. Storage & bandwidth budget (50 users, 50 listings)

Photo sizes were measured with the app's own resize settings: 800 px JPEG ≈ 35–90 KB, 400 px thumbnail ≈ 10–25 KB.
Traffic assumption: 50 active users × 15 page views per day.

| Free-plan resource | Limit | **Today's code** | **After this plan** | Worst case allowed by the new limits |
|---|---|---|---|---|
| Database size | 500 MB | ~9 MB ✅ | ~4 MB ✅ | ~60 MB (20 listings/user, 500 msgs/day) |
| File storage | 1 GB | 0 | ~4 MB ✅ | 600 MB (50 users × 40 files × 300 KB) ✅ |
| Egress (uncached) | 5 GB / month | **~79 GB ❌** | ~0.8 GB ✅ | |
| Cached egress (photos via CDN) | 5 GB / month | 0 | ~0.1 GB ✅ | |
| Real-time connections | 200 at once | 0 | ~50–100 ✅ | |
| Monthly active users | 50,000 | ✅ | ✅ | |

**Why today's code fails:** every page load downloads all 50 photos as text (~3.5 MB), so the 5 GB is used up after about 50 page views a day across the whole site.
**Why the plan fixes it:** listing data without photos is ~30 KB per load and reused for 60 seconds; photos are downloaded once per browser and cached for a year; chat downloads only *new* messages.

**Watch it:** Supabase → **Organization → Usage** (check weekly for the first month).

---

## 6. Launch test plan

Use **two browsers** (e.g. Chrome + Firefox, or one in private mode) with two real email addresses.

### 6.1 Account A
- [ ] Sign up → confirmation email arrives (from your Gmail/Brevo sender, not Supabase)
- [ ] Click the link → returns to the live site, signed in
- [ ] Edit profile (name, role, area) → saved after refresh
- [ ] Create a listing **with a photo** → appears on Marketplace; photo appears in Storage under `listing-images/<user-id>/`
- [ ] Map pin is near Perinthalmanna, not Bengaluru

### 6.2 Logged-out visitor
- [ ] Open Marketplace in a private window → Account A's listing is visible
- [ ] No fake listings, fake users or "Reset demo data" anywhere
- [ ] History and Impact show only real exchanges (0 at first)

### 6.3 Account B
- [ ] Sign up separately → can see A's listing → **Message** opens a chat
- [ ] Send a message → A sees it **without refreshing** and gets an unread badge
- [ ] A replies → B sees it live; no fake auto-replies appear
- [ ] B does **not** see a "Mark as exchanged" button; A does
- [ ] A marks exchanged → listing shows "Exchanged" for everyone; History and Impact update for both and for logged-out visitors
- [ ] B cannot edit or delete A's listing (no buttons; API also refuses)

### 6.4 Account features
- [ ] "Forgot password?" → email → `reset.html` → new password works
- [ ] "Resend confirmation email" works for an unconfirmed account
- [ ] Report a listing → row appears in `reports`
- [ ] Delete account B → B's profile, chats and photos are gone; A's history keeps the exchange with "Former member"

### 6.5 Security checks (browser console while signed in as B)
Open DevTools → Console on the live site and paste each line. Each must **fail**:
```js
// 1. make yourself admin → "You are not allowed to set this role"
await supabaseClient.from("profiles").update({ role: "admin" }).eq("id", Auth.user().id)

// 2. inject a bad image → check constraint "listings_image_ok"
await supabaseClient.from("listings").insert({ owner_id: Auth.user().id, kind: "offer", category: "paper",
  title: "test", weight_kg: 1, lat: 10.9, lng: 76.2, image: 'x" onerror="alert(1)' })

// 3. edit someone else's listing → returns no error but changes 0 rows; refresh to confirm nothing changed
await supabaseClient.from("listings").update({ title: "hacked" }).neq("owner_id", Auth.user().id)

// 4. write a fake exchange → row-level security error
await supabaseClient.from("exchanges").insert({ title: "fake", category: "paper", weight_kg: 999 })

// 5. upload into another user's folder → row-level security error
await supabaseClient.storage.from("listing-images").upload("someone-else/x.jpg", new Blob(["x"], { type: "image/jpeg" }))
```
And these limits:
- [ ] 21 messages within one minute → the 21st is refused
- [ ] 11 listings within one hour → the 11th is refused
- [ ] A photo larger than 300 KB (or a PNG sent directly to Storage) is refused

### 6.6 Devices
- [ ] Android Chrome and iPhone Safari: sign up, map pin, photo upload from camera, chat layout, profile pop-up
- [ ] Slow network (DevTools → Network → "Slow 4G"): pages still load; buttons show "Publishing…" and don't double-submit
- [ ] Keyboard only: Tab through sign-in pop-up; Esc closes it; focus returns to the button

---

## 7. After launch

- **Pausing:** free Supabase projects pause after **1 week with no activity**. Open the site at least every few days, or restore it from the dashboard if it pauses.
- **Backups:** export important tables (Table Editor → Export CSV) every week.
- **Usage:** check **Organization → Usage** weekly.
- **Moderation:** check `reports` every day or two.
- **Keys:** only the `sb_publishable_…` key belongs in the website. Never put the `service_role` / secret key in the repo.

---

## 8. Master checklist

### Supabase dashboard
- [ ] 1.1 Site URL + Redirect URLs set to `https://git-gautham.github.io/recircle/`
- [ ] 1.2 Confirm email ON, minimum password length 8
- [ ] 1.3 Custom SMTP set up (Gmail app password or Brevo)
- [ ] 1.3 Email rate limit set (30/hour)
- [ ] 1.4 Confirm-signup and reset-password templates pasted
- [ ] 1.5 Old test data deleted

### Database
- [ ] 2 `supabase/migration-v2.sql` saved in the repo
- [ ] 2 Migration run in SQL Editor with no errors
- [ ] 2 `exchanges`, `reports` tables and `listing-images` bucket exist
- [ ] 2 `messages` is in the `supabase_realtime` publication

### Website code
- [ ] 3.1 `DEMO_MODE = false`; store key `recircle_v2`; seed data off
- [ ] 3.1 Reset-demo button hidden; `simulateInterest` removed; auto-replies removed
- [ ] 3.2 `safeImageUrl()` used in `listingCard()` and `detail.js`
- [ ] 3.2 Map popup `onclick` replaced
- [ ] 3.3 `loadPublic`, `loadExchanges`, `loadPrivate`, `loadProfiles` added; `sync()` removed
- [ ] 3.3 `addListing`, `updateListing`, `deleteListing` are async and awaited
- [ ] 3.3 `openConversation`, `sendMessage`, `receiveMessage`, `markRead`, `completeExchange` replaced
- [ ] 3.3 `ui.js` start-up block replaced; `impact.js` listens for `listingschange`
- [ ] 3.3 `detail.js` uses the async methods
- [ ] 3.4 Photos resized to Blobs and uploaded to Storage with a thumbnail
- [ ] 3.4 Publish button awaits and shows errors
- [ ] 3.5 `supabase.js` no longer reads/writes profile `lat`/`lng`
- [ ] 3.5 Privacy note under the map
- [ ] 3.6 `startRealtime()` added; `messages.js` `send()` and exchange button updated
- [ ] 3.6 Only the owner sees "Mark as exchanged"
- [ ] 3.7 Unknown-category guards in history/impact/messages
- [ ] 3.8 Forgot password, resend confirmation, `reset.html`
- [ ] 3.9 Delete my account
- [ ] 3.10 Report listing
- [ ] 3.11 `supabase-js` pinned to 2.119.0 in `vendor/`
- [ ] 3.11 Modal focus trap
- [ ] 3.12 `privacy.html` + footer link + signup notice
- [ ] README updated

### Optional
- [ ] 4.1 Turnstile CAPTCHA (code first, then dashboard)
- [ ] 4.2 Error monitoring
- [ ] 4.3 Content Security Policy

### Testing & launch
- [ ] 6.1–6.4 Two-account test passed
- [ ] 6.5 All five console security checks fail as expected; limits work
- [ ] 6.6 Phone + slow network + keyboard tested
- [ ] Pushed to `main`; GitHub Pages deploy finished; live site re-tested
- [ ] Usage page checked after the first week

---

## Appendix A — migration-v2.sql

Save as `supabase/migration-v2.sql`, then paste into Supabase → SQL Editor → Run. Run it **once**, after `schema.sql`.
For a brand-new Supabase project in future: run `schema.sql` first, then this file.

```sql
-- =====================================================================
-- ReCircle — migration v2 (pre-launch hardening)
-- Run ONCE in Supabase → SQL Editor, AFTER schema.sql.
-- Everything is in one transaction: if any line fails, nothing changes.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0. Clean up test data that the new rules would reject
-- ---------------------------------------------------------------------
-- Old base64 photos are dropped (they will be re-uploaded to Storage).
update public.listings
   set image = null
 where image is not null
   and image not like 'https://axcpgigdwmhumvcuiqoy.supabase.co/storage/v1/object/public/listing-images/%';

-- ---------------------------------------------------------------------
-- 1. PROFILES — remove exact location, limit text, lock the admin role
-- ---------------------------------------------------------------------
-- Your own location now stays in your browser only (it is only used to
-- calculate distances). This also removes the Bengaluru default bug.
alter table public.profiles drop column if exists lat;
alter table public.profiles drop column if exists lng;

alter table public.profiles
  add constraint profiles_name_len  check (char_length(display_name) between 1 and 40) not valid,
  add constraint profiles_place_len check (char_length(place) <= 60) not valid;

-- Signup trigger: never create an empty or over-long name
-- (a blank "Name" field or a long email would otherwise break signup).
create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
                                nullif(split_part(new.email, '@', 1), ''),
                                'ReCircle user'), 40));
  return new;
end;
$$;

-- Nobody can make themselves admin through the website/API.
-- (You can still set it from the SQL Editor, which runs as "postgres".)
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated')
     and new.role = 'admin'
     and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
    raise exception 'You are not allowed to set this role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- 2. LISTINGS — thumbnails, validation, approximate location, limits
-- ---------------------------------------------------------------------
alter table public.listings add column if not exists thumb text;

alter table public.listings
  add constraint listings_title_len     check (char_length(title) between 3 and 70) not valid,
  add constraint listings_desc_len      check (char_length(description) <= 500) not valid,
  add constraint listings_place_len     check (char_length(place) <= 60) not valid,
  add constraint listings_condition_len check (char_length(condition) <= 40) not valid,
  add constraint listings_unit_ok       check (unit in ('pieces','kg','bags','items','sacks','kg/day')) not valid,
  add constraint listings_category_ok   check (category in ('paper','plastic','ewaste','metal','glass',
                                                            'textile','wood','organic','construction','other')) not valid,
  add constraint listings_numbers_ok    check (qty > 0 and qty <= 100000
                                               and weight_kg > 0 and weight_kg <= 10000
                                               and price >= 0 and price <= 1000000) not valid,
  add constraint listings_latlng_ok     check (lat between -90 and 90 and lng between -180 and 180) not valid,
  add constraint listings_image_ok      check (image is null or image like
    'https://axcpgigdwmhumvcuiqoy.supabase.co/storage/v1/object/public/listing-images/%') not valid,
  add constraint listings_thumb_ok      check (thumb is null or thumb like
    'https://axcpgigdwmhumvcuiqoy.supabase.co/storage/v1/object/public/listing-images/%') not valid;

-- Store only an approximate pickup point (3 decimals ≈ 110 m).
create or replace function public.round_listing_location()
returns trigger language plpgsql set search_path = public as $$
begin
  new.lat := round(new.lat::numeric, 3);
  new.lng := round(new.lng::numeric, 3);
  return new;
end;
$$;

drop trigger if exists listings_round_location on public.listings;
create trigger listings_round_location
  before insert or update of lat, lng on public.listings
  for each row execute function public.round_listing_location();

-- Max 20 active listings per user and max 10 new listings per hour.
create or replace function public.enforce_listing_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.listings
       where owner_id = new.owner_id and status <> 'exchanged') >= 20 then
    raise exception 'You can have at most 20 active listings';
  end if;
  if (select count(*) from public.listings
       where owner_id = new.owner_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many new listings in the last hour. Please try again later';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_limits on public.listings;
create trigger listings_limits
  before insert on public.listings
  for each row execute function public.enforce_listing_limits();

create index if not exists listings_owner_created_idx  on public.listings (owner_id, created_at);
create index if not exists listings_status_created_idx on public.listings (status, created_at desc);

-- ---------------------------------------------------------------------
-- 3. CONVERSATIONS — only the buyer can open a chat with the real owner,
--    read-state for unread badges, daily cap
-- ---------------------------------------------------------------------
drop policy if exists "Participants can create conversations" on public.conversations;
drop policy if exists "Buyers can start conversations" on public.conversations;
create policy "Buyers can start conversations" on public.conversations
  for insert to authenticated
  with check (
    auth.uid() = participant_id
    and participant_id <> owner_id
    and owner_id = (select l.owner_id from public.listings l
                     where l.id = listing_id and l.status <> 'exchanged')
  );

alter table public.conversations
  add column if not exists owner_read_at       timestamptz not null default now(),
  add column if not exists participant_read_at timestamptz not null default now();

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversations
     set owner_read_at       = case when auth.uid() = owner_id       then now() else owner_read_at end,
         participant_read_at = case when auth.uid() = participant_id then now() else participant_read_at end
   where id = p_conversation
     and auth.uid() in (owner_id, participant_id);
$$;

create or replace function public.enforce_conversation_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.conversations
       where participant_id = new.participant_id
         and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Daily limit for new conversations reached';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_limits on public.conversations;
create trigger conversations_limits
  before insert on public.conversations
  for each row execute function public.enforce_conversation_limits();

create index if not exists conversations_owner_idx       on public.conversations (owner_id);
create index if not exists conversations_participant_idx on public.conversations (participant_id, created_at);

-- ---------------------------------------------------------------------
-- 4. MESSAGES — length limit, rate limit, real-time
-- ---------------------------------------------------------------------
alter table public.messages
  add constraint messages_body_len check (char_length(body) between 1 and 1000) not valid;

create or replace function public.enforce_message_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too fast. Please wait a moment';
  end if;
  if (select count(*) from public.messages
       where sender_id = new.sender_id and created_at > now() - interval '1 day') >= 500 then
    raise exception 'Daily message limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_limits on public.messages;
create trigger messages_limits
  before insert on public.messages
  for each row execute function public.enforce_message_limits();

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_sender_created_idx       on public.messages (sender_id, created_at);

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime'
                    and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. EXCHANGES — shared history + impact dashboard
-- ---------------------------------------------------------------------
create table if not exists public.exchanges (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid unique references public.listings(id)      on delete set null,
  conversation_id uuid        references public.conversations(id) on delete set null,
  title           text not null,
  category        text not null,
  weight_kg       numeric not null check (weight_kg > 0 and weight_kg <= 10000),
  from_id         uuid references public.profiles(id) on delete set null,
  to_id           uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.exchanges enable row level security;
drop policy if exists "Exchanges are public" on public.exchanges;
create policy "Exchanges are public" on public.exchanges for select using (true);
-- No insert/update/delete policies: only complete_exchange() below can write.

create index if not exists exchanges_created_idx on public.exchanges (created_at desc);

-- The listing OWNER confirms the hand-off from the chat.
create or replace function public.complete_exchange(p_conversation uuid)
returns public.exchanges
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations%rowtype;
  l public.listings%rowtype;
  r public.exchanges%rowtype;
begin
  select * into c from public.conversations where id = p_conversation;
  if not found or auth.uid() is distinct from c.owner_id then
    raise exception 'Only the listing owner can confirm the exchange';
  end if;

  select * into l from public.listings where id = c.listing_id for update;
  if not found then
    raise exception 'Listing not found';
  end if;
  if l.status = 'exchanged' then
    raise exception 'This listing is already marked as exchanged';
  end if;

  update public.listings set status = 'exchanged' where id = l.id;

  insert into public.exchanges (listing_id, conversation_id, title, category, weight_kg, from_id, to_id)
  values (l.id, c.id, l.title, l.category, l.weight_kg,
          case when l.kind = 'offer' then c.owner_id else c.participant_id end,
          case when l.kind = 'offer' then c.participant_id else c.owner_id end)
  returning * into r;

  return r;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. REPORTS — "Report listing" button (only you see them: Table Editor → reports)
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  listing_id  uuid references public.listings(id) on delete cascade,
  reason      text not null check (char_length(reason) between 3 and 300),
  created_at  timestamptz not null default now(),
  unique (reporter_id, listing_id)
);

alter table public.reports enable row level security;
drop policy if exists "Users can file reports" on public.reports;
create policy "Users can file reports" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7. STORAGE — bucket for listing photos (max 300 KB, JPEG only)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 307200, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Counts how many photo files the current user has (max 40 = 20 listings × 2 files).
create or replace function public.my_listing_image_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from storage.objects
   where bucket_id = 'listing-images'
     and (storage.foldername(name))[1] = auth.uid()::text;
$$;

drop policy if exists "ReCircle: upload own listing images" on storage.objects;
create policy "ReCircle: upload own listing images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_listing_image_count() < 40
  );

drop policy if exists "ReCircle: see own listing image files" on storage.objects;
create policy "ReCircle: see own listing image files" on storage.objects
  for select to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "ReCircle: delete own listing images" on storage.objects;
create policy "ReCircle: delete own listing images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 8. ACCOUNT DELETION — removes the user and (via cascades) their
--    profile, listings, conversations, messages and reports.
--    Exchanges stay for the impact totals but lose the name (set null).
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Who may call the functions
-- ---------------------------------------------------------------------
revoke execute on function public.complete_exchange(uuid)      from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.delete_my_account()          from public, anon;
revoke execute on function public.my_listing_image_count()     from public, anon;
grant  execute on function public.complete_exchange(uuid)      to authenticated;
grant  execute on function public.mark_conversation_read(uuid) to authenticated;
grant  execute on function public.delete_my_account()          to authenticated;
grant  execute on function public.my_listing_image_count()     to authenticated;

commit;
```

---

## Appendix B — Verdict on the earlier review list

| # | Earlier point | Verdict | Note |
|---|---|---|---|
| 1 | Logged-out visitors don't see shared listings | ✅ Confirmed | They see only fake demo listings |
| 2 | Exchanges/impact local-only | ✅ Confirmed, worse | Status "exchanged" is never saved; History/Impact show made-up seed numbers to the public; buyer's button fails under RLS |
| 3 | Migration must be run manually | ⚠️ Partly | `schema.sql` already creates all 4 tables; `shared-data.sql` is only for older setups |
| 4 | Base64 photos | ✅ Confirmed | Real damage is egress (~79 GB/month), not DB size (~9 MB) |
| 5 | Messaging not real-time | ✅ Confirmed, worse | New messages appear only after a full page reload |
| 6 | Unread state not persisted | ✅ Confirmed, worse | Real chats always show 0 unread |
| 7 | Demo + production data mixed | ✅ Confirmed | Also fake auto-replies in real chats (blocker) |
| 8 | "Reset demo data" doesn't reset Supabase | ✅ Confirmed | Hide it on the public site |
| 9 | No password reset | ✅ Confirmed | Also no "resend confirmation" |
| 10 | No account deletion | ✅ Confirmed | Cascades already exist; needs a function |
| 11 | Roles aren't authorization | ✅ Confirmed, worse | `admin` is in the enum and users can set it on themselves |
| 12 | Location privacy | ✅ Confirmed, worse | `profiles` also exposes every user's lat/lng to ~1 m |
| 13 | No spam protection | ✅ Confirmed, worse | Forged `owner_id` lets anyone message anyone; no DB limits at all |
| 14 | Default email sender | ❌ Wrong priority | It's a launch blocker: only team members can receive emails |
| 15 | No monitoring | ✅ Valid | Fire-and-forget writes are the bigger issue |
| 16 | Accessibility | ✅ Valid | Pop-ups don't trap or return focus |
| 17 | Mobile testing | ✅ Valid | |
| 18 | No automated tests | ✅ Confirmed | Two-account test is the minimum |
| — | **Not in the earlier list** | 🔴 New | Stored XSS via `image`; fake auto-replies; non-awaited writes; Bengaluru default; unpinned `supabase-js`; unknown category crash; project pausing; privacy policy |

---

**Sources for the free-plan numbers:** [Supabase pricing](https://supabase.com/docs/pricing) · [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Brevo SMTP for Supabase](https://developers.brevo.com/docs/supabase-smtp-integration)
