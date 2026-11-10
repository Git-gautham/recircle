/* =========================================================
   ReCircle — seed data
   ---------------------------------------------------------
   Shared reference data lives here. Edit freely:
   - CATEGORIES : waste categories + impact factors
   The production store starts with no seeded users, listings or history.
   ========================================================= */

/* Default map centre: Perinthalmanna, Malappuram (Kerala) */
const DEFAULT_CENTER = { lat: 10.9765, lng: 76.2260, place: "Perinthalmanna" };
const DEMO_MODE = false;

/* co2 = kg CO2e avoided per kg of material reused instead of landfilled.
   These are rounded, indicative figures for a student demo —
   replace them with values from a source your team trusts. */
const CATEGORIES = {
  paper:        { label: "Paper & Cardboard", icon: "📦", color: "#b5833f", co2: 0.9 },
  plastic:      { label: "Plastic",           icon: "🧴", color: "#3a7ca5", co2: 1.5 },
  ewaste:       { label: "E-waste",           icon: "🔌", color: "#6b4fa0", co2: 2.0 },
  metal:        { label: "Metal & Scrap",     icon: "🔩", color: "#6c757d", co2: 4.0 },
  glass:        { label: "Glass",             icon: "🫙", color: "#2a9d8f", co2: 0.3 },
  textile:      { label: "Textiles",          icon: "🧵", color: "#c2643b", co2: 3.0 },
  wood:         { label: "Wood & Furniture",  icon: "🪵", color: "#8a5a2b", co2: 0.6 },
  organic:      { label: "Organic",           icon: "🍂", color: "#5c8a3a", co2: 0.5 },
  construction: { label: "Construction",      icon: "🧱", color: "#a0522d", co2: 0.05 },
  other:        { label: "Other",             icon: "♻️", color: "#4a6b5d", co2: 0.5 }
};

const ROLES = {
  individual: "Individual",
  business:   "Business",
  student:    "Student",
  recycler:   "Recycler"
};

const USERS = [
  { id: "u1",  name: "Malabar Spice Restaurant", role: "business",   place: "Perinthalmanna" },
  { id: "u2",  name: "Anjali R.",                role: "student",    place: "Vengoor" },
  { id: "u3",  name: "GreenLoop Recyclers",      role: "recycler",   place: "Angadipuram" },
  { id: "u4",  name: "Faisal K.",                role: "individual", place: "Pattikkad" },
  { id: "u5",  name: "Nila Tailoring Unit",      role: "business",   place: "Cherpulassery" },
  { id: "u6",  name: "Riya Pickles & Preserves", role: "business",   place: "Mankada" },
  { id: "u7",  name: "Arjun M.",                 role: "student",    place: "Perinthalmanna" },
  { id: "u8",  name: "Coir Craft Collective",    role: "recycler",   place: "Malappuram" },
  { id: "u9",  name: "Shibu Electricals",        role: "business",   place: "Pulamanthole" },
  { id: "u10", name: "Fathima N.",               role: "individual", place: "Melattur" }
];

/* Helper: time offsets relative to "now" so the demo always looks fresh */
const H = 3600 * 1000, D = 24 * H;

const LISTINGS = [
  { id: "l1", kind: "offer", title: "Flattened cardboard boxes (40 pcs)", category: "paper",
    qty: 40, unit: "pieces", weightKg: 12, price: 0, condition: "Clean, dry",
    desc: "Delivery boxes from our weekly vegetable supply. Flattened and stacked. Great for packing, moving or craft projects. Pick up after 3 pm.",
    ownerId: "u1", lat: 10.9771, lng: 76.2273, place: "Perinthalmanna", ago: 5 * H },
  { id: "l2", kind: "wanted", title: "Need cardboard for college model project", category: "paper",
    qty: 10, unit: "pieces", weightKg: 3, price: 0, condition: "Any",
    desc: "Building a scale model of a green campus for our design lab. Need about 10 large sheets of corrugated cardboard.",
    ownerId: "u2", lat: 10.9918, lng: 76.2617, place: "Vengoor", ago: 9 * H },
  { id: "l3", kind: "offer", title: "Old phones, chargers & a dead laptop", category: "ewaste",
    qty: 7, unit: "items", weightKg: 4, price: 0, condition: "Not working",
    desc: "3 old Android phones, 3 chargers and a laptop that won't power on. Would love these to reach someone who can repair or recover parts.",
    ownerId: "u4", lat: 11.0049, lng: 76.2011, place: "Pattikkad", ago: 1 * D },
  { id: "l4", kind: "wanted", title: "Buying PET bottles in bulk", category: "plastic",
    qty: 100, unit: "kg", weightKg: 100, price: 18, condition: "Rinsed, caps off",
    desc: "We collect clear PET bottles for recycling into flakes. ₹18/kg, we pick up for 20 kg and above.",
    ownerId: "u3", lat: 10.9856, lng: 76.2118, place: "Angadipuram", ago: 2 * D },
  { id: "l5", kind: "offer", title: "Cotton fabric offcuts — 2 sacks", category: "textile",
    qty: 2, unit: "sacks", weightKg: 15, price: 0, condition: "Clean, mixed colours",
    desc: "Leftover cotton pieces from stitching. Good for quilts, cloth bags, stuffing or rags.",
    ownerId: "u5", lat: 10.8706, lng: 76.3082, place: "Cherpulassery", ago: 3 * D },
  { id: "l6", kind: "offer", title: "Glass jars with lids (60 nos)", category: "glass",
    qty: 60, unit: "pieces", weightKg: 18, price: 0, condition: "Washed",
    desc: "Surplus 500 ml jars. Lids included. Ideal for home food businesses, storage or planters.",
    ownerId: "u6", lat: 11.0266, lng: 76.2275, place: "Mankada", ago: 4 * D },
  { id: "l7", kind: "offer", title: "Copper & aluminium wire offcuts", category: "metal",
    qty: 6, unit: "kg", weightKg: 6, price: 300, condition: "Mixed lengths",
    desc: "Offcuts from house-wiring jobs. Sorted into copper and aluminium bags.",
    ownerId: "u9", lat: 10.9442, lng: 76.1955, place: "Pulamanthole", ago: 5 * D },
  { id: "l8", kind: "wanted", title: "Coconut husk for coir making", category: "organic",
    qty: 200, unit: "kg", weightKg: 200, price: 2, condition: "Dry",
    desc: "Our women's collective makes coir mats and pots. We pay ₹2/kg for dry husk and can collect from homes in Malappuram area.",
    ownerId: "u8", lat: 11.0510, lng: 76.0711, place: "Malappuram", ago: 6 * D },
  { id: "l9", kind: "offer", title: "Wooden pallets (8 nos)", category: "wood",
    qty: 8, unit: "pieces", weightKg: 120, price: 0, condition: "Sturdy",
    desc: "Shipping pallets in good shape. Furniture makers, gardeners and DIYers welcome.",
    ownerId: "u1", lat: 10.9769, lng: 76.2280, place: "Perinthalmanna", ago: 6 * D + 4 * H },
  { id: "l10", kind: "offer", title: "Broken floor tiles — mosaic friendly", category: "construction",
    qty: 1, unit: "heap", weightKg: 80, price: 0, condition: "Broken pieces",
    desc: "Left over after renovating our kitchen. Colourful ceramic pieces, great for mosaic art or garden paths.",
    ownerId: "u10", lat: 10.9605, lng: 76.2401, place: "Melattur", ago: 7 * D },
  { id: "l11", kind: "wanted", title: "Old Arduino / sensor modules", category: "ewaste",
    qty: 5, unit: "items", weightKg: 1, price: 0, condition: "Working or repairable",
    desc: "Student robotics club looking for spare microcontroller boards, servos or sensors for our open lab.",
    ownerId: "u7", lat: 10.9781, lng: 76.2232, place: "Perinthalmanna", ago: 8 * D },
  { id: "l12", kind: "offer", title: "Kitchen vegetable peels (daily)", category: "organic",
    qty: 10, unit: "kg/day", weightKg: 10, price: 0, condition: "Fresh, sorted",
    desc: "We separate vegetable waste every day. Perfect for composting, biogas or animal feed. Collect before 10 am.",
    ownerId: "u1", lat: 10.9773, lng: 76.2269, place: "Perinthalmanna", ago: 9 * D },
  { id: "l13", kind: "offer", title: "Newspapers & old textbooks", category: "paper",
    qty: 25, unit: "kg", weightKg: 25, price: 0, condition: "Dry",
    desc: "A year of newspapers plus Plus Two textbooks. Books may help a junior student; the rest can be recycled.",
    ownerId: "u4", lat: 11.0052, lng: 76.2019, place: "Pattikkad", ago: 10 * D },
  { id: "l14", kind: "offer", title: "Used flex banners (large)", category: "plastic",
    qty: 6, unit: "pieces", weightKg: 9, price: 0, condition: "Printed, intact",
    desc: "Event banners. Make durable tarps, bags or shade covers.",
    ownerId: "u2", lat: 10.9924, lng: 76.2609, place: "Vengoor", ago: 11 * D },
  { id: "l15", kind: "wanted", title: "Scrap metal of any kind", category: "metal",
    qty: 50, unit: "kg", weightKg: 50, price: 25, condition: "Any",
    desc: "Iron, steel, aluminium, copper — we buy at fair rates and recycle responsibly.",
    ownerId: "u3", lat: 10.9849, lng: 76.2127, place: "Angadipuram", ago: 12 * D },
  { id: "l16", kind: "offer", title: "Thermocol packaging blocks", category: "plastic",
    qty: 3, unit: "bags", weightKg: 2, price: 0, condition: "Clean",
    desc: "From a fridge and TV delivery. Useful for packing, insulation or school models.",
    ownerId: "u10", lat: 10.9611, lng: 76.2395, place: "Melattur", ago: 13 * D }
];

/* Past exchanges in the community (powers the impact dashboard).
   monthsAgo = how many months back from today. */
const HISTORY = [
  { title: "Cardboard cartons",        category: "paper",   weightKg: 30,  fromId: "u1",  toId: "u2",  monthsAgo: 5 },
  { title: "PET bottles",              category: "plastic", weightKg: 42,  fromId: "u4",  toId: "u3",  monthsAgo: 5 },
  { title: "Coconut husk",             category: "organic", weightKg: 150, fromId: "u10", toId: "u8",  monthsAgo: 4 },
  { title: "Old CRT monitor",          category: "ewaste",  weightKg: 14,  fromId: "u9",  toId: "u3",  monthsAgo: 4 },
  { title: "Fabric offcuts",           category: "textile", weightKg: 20,  fromId: "u5",  toId: "u10", monthsAgo: 4 },
  { title: "Glass bottles",            category: "glass",   weightKg: 35,  fromId: "u6",  toId: "u3",  monthsAgo: 3 },
  { title: "Wooden crates",            category: "wood",    weightKg: 40,  fromId: "u1",  toId: "u7",  monthsAgo: 3 },
  { title: "Aluminium cans",           category: "metal",   weightKg: 18,  fromId: "u2",  toId: "u3",  monthsAgo: 3 },
  { title: "Vegetable waste (month)",  category: "organic", weightKg: 260, fromId: "u1",  toId: "u8",  monthsAgo: 2 },
  { title: "Copper wire scrap",        category: "metal",   weightKg: 9,   fromId: "u9",  toId: "u3",  monthsAgo: 2 },
  { title: "Old textbooks",            category: "paper",   weightKg: 12,  fromId: "u4",  toId: "u7",  monthsAgo: 2 },
  { title: "Phone & tablet parts",     category: "ewaste",  weightKg: 3,   fromId: "u10", toId: "u7",  monthsAgo: 1 },
  { title: "Cotton scraps",            category: "textile", weightKg: 25,  fromId: "u5",  toId: "u8",  monthsAgo: 1 },
  { title: "Glass jars",               category: "glass",   weightKg: 22,  fromId: "u6",  toId: "u10", monthsAgo: 1 },
  { title: "Broken tiles",             category: "construction", weightKg: 120, fromId: "u4", toId: "u2", monthsAgo: 0 },
  { title: "PET bottles",              category: "plastic", weightKg: 55,  fromId: "u2",  toId: "u3",  monthsAgo: 0 },
  { title: "Newspapers",               category: "paper",   weightKg: 40,  fromId: "u10", toId: "u3",  monthsAgo: 0 }
];
