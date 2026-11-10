/* ReCircle — List waste form */

let pickMap, pickMarker, photoPreview = null, photoBlobs = null;
const loc = { ...myLocationSafe() };

function myLocationSafe() { try { return myLocation(); } catch (e) { return { ...DEFAULT_CENTER }; } }

function formData() {
  const f = new FormData($("#postForm"));
  return {
    kind: f.get("kind"),
    category: f.get("category") || "other",
    title: (f.get("title") || "").trim(),
    desc: (f.get("desc") || "").trim(),
    qty: Number(f.get("qty")) || 1,
    unit: f.get("unit"),
    weightKg: Number(f.get("weightKg")) || 0,
    condition: (f.get("condition") || "").trim(),
    price: Number(f.get("price")) || 0,
    place: (f.get("place") || "").trim() || "Near " + DEFAULT_CENTER.place,
    lat: +loc.lat.toFixed(5),
    lng: +loc.lng.toFixed(5),
    image: photoPreview
  };
}

function updatePreview() {
  const d = formData();
  const fake = { ...d, id: "preview", ownerId: ME, status: "available", createdAt: Date.now(),
                 title: d.title || "Your listing title" };
  $("#preview").innerHTML = listingCard(fake, null);
  const co2 = co2For(d.category, d.weightKg);
  $("#impactNum").textContent = "~" + (co2 < 10 ? co2.toFixed(1) : fmtNum(co2)) + " kg";
}

function initPickMap() {
  pickMap = L.map("pickMap").setView([loc.lat, loc.lng], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(pickMap);
  pickMarker = L.marker([loc.lat, loc.lng], { draggable: true }).addTo(pickMap);
  const setLoc = ll => { loc.lat = ll.lat; loc.lng = ll.lng; pickMarker.setLatLng(ll); };
  pickMap.on("click", e => setLoc(e.latlng));
  pickMarker.on("dragend", () => setLoc(pickMarker.getLatLng()));
  pickMap._setLoc = setLoc;
}

/* Shrink photos so they fit comfortably in browser storage */
function resizeToBlob(file, max, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? resolve(b) : reject(new Error("Image conversion failed")), "image/jpeg", quality);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const startCat = params.get("cat") || "paper";

  $("#catPick").innerHTML = Object.entries(CATEGORIES).map(([k, c]) => `
    <label style="--cat:${c.color}"><input type="radio" name="category" value="${k}" ${k === startCat ? "checked" : ""}>
      <span aria-hidden="true">${c.icon}</span>${c.label}</label>`).join("");
  if (params.get("kind") === "wanted") $("input[name=kind][value=wanted]").checked = true;
  $("#placeInput").value = loc.place || "";

  try { initPickMap(); }
  catch (e) { $("#pickMap").innerHTML = '<p class="empty">Map unavailable offline — your profile location will be used.</p>'; }

  updatePreview();
  $("#postForm").addEventListener("input", updatePreview);
  $("#postForm").addEventListener("change", updatePreview);

  $("input[name=photo]").addEventListener("change", async e => {
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
  });

  $("#geoBtn").addEventListener("click", async () => {
    try {
      const p = await detectLocation();
      if (pickMap) { pickMap._setLoc(p); pickMap.setView([p.lat, p.lng], 15); }
      else { loc.lat = p.lat; loc.lng = p.lng; }
      if (!$("#placeInput").value) $("#placeInput").value = "My location";
      toast("Pin moved to your location");
    } catch (err) { toast("Couldn't get your location — click on the map instead"); }
  });

  $("#postForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!Auth.isSignedIn()) { toast("Sign in before publishing a listing"); openAuth(); return; }
    const d = formData();
    if (d.title.length < 3) { toast("Title needs at least 3 characters"); $("[name=title]").focus(); return; }
    if (!(d.weightKg > 0)) { toast("Please add an approximate weight"); $("[name=weightKg]").focus(); return; }

    const btn = e.submitter || $("#postForm button[type=submit]");
    btn.disabled = true; btn.textContent = "Publishing…";
    try { await Store.addListing(d, photoBlobs); }
    catch (err) { toast(err.message || "Couldn't publish — please try again"); btn.disabled = false; btn.textContent = "Publish listing"; return; }
    refreshChrome();

    openModal(`
      <h2>🎉 Listing published!</h2>
      <p>Your ${d.kind === "wanted" ? "request" : "listing"} is now live on the marketplace.</p>
      <p class="muted small">Your listing is shared with the ReCircle community.</p>
      <div class="form-actions">
        <a class="btn ghost" href="marketplace.html">View marketplace</a>
        <a class="btn primary" href="messages.html">Open messages</a>
      </div>`);
    $("#postForm").reset(); photoBlobs = null;
    if (photoPreview) { URL.revokeObjectURL(photoPreview); photoPreview = null; }
    const img = $("#photoDrop img"); if (img) img.remove();
    $("input[name=category][value=" + startCat + "]").checked = true;
    updatePreview();
    btn.disabled = false; btn.textContent = "Publish listing";
  });
});
