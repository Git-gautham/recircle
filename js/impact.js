/* ReCircle — impact dashboard (Chart.js) */

let scope = "all", monthChart, catChart;

/* rule-of-thumb equivalents (see footnote on the page) */
const TREE_KG_PER_YEAR = 21, CAR_KG_PER_KM = 0.17, PHONE_KG_PER_CHARGE = 0.008;

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

function data() {
  const all = Store.history();
  return scope === "me" ? all.filter(h => h.fromId === ME || h.toId === ME) : all;
}

function renderKPIs(rows) {
  const kg = rows.reduce((s, h) => s + h.weightKg, 0);
  const co2 = rows.reduce((s, h) => s + co2For(h.category, h.weightKg), 0);
  const people = new Set(rows.flatMap(h => [h.fromId, h.toId])).size;
  const listings = Store.listings().filter(l => (scope === "all" || l.ownerId === ME) && l.status !== "exchanged").length;
  const tiles = [
    ["Waste diverted", fmtNum(kg), "kg", "kept out of landfill"],
    ["CO₂e avoided", fmtNum(co2), "kg", "estimated emissions saved"],
    ["Exchanges", rows.length, "", scope === "me" ? "hand-offs you took part in" : "completed hand-offs"],
    scope === "me"
      ? ["Active listings", listings, "", "things you've put up"]
      : ["People involved", people, "", "givers and receivers"]
  ];
  $("#kpis").innerHTML = tiles.map(([label, v, unit, note]) => `
    <div class="card kpi"><div class="label">${label}</div>
      <div class="value" data-count="${String(v).replace(/,/g, "")}">${v}${unit ? `<small>${unit}</small>` : ""}</div>
      <p class="note">${note}</p></div>`).join("");
  animateCounts();

  $("#equiv").innerHTML = [
    ["🌳", fmtNum(co2 / TREE_KG_PER_YEAR), "tree-years of CO₂ absorption"],
    ["🚗", fmtNum(co2 / CAR_KG_PER_KM), "km not driven by car"],
    ["📱", fmtNum(co2 / PHONE_KG_PER_CHARGE), "phone charges"]
  ].map(([i, n, t]) => `<div><div class="e-ico" aria-hidden="true">${i}</div><strong>${n}</strong><span>${t}</span></div>`).join("");
}

/* count-up animation on the big numbers */
function animateCounts() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  $$(".kpi .value").forEach(el => {
    const target = Number(el.dataset.count);
    if (!target) return;
    const small = el.querySelector("small")?.outerHTML || "";
    const t0 = performance.now(), dur = 900;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.innerHTML = fmtNum(target * e) + small;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function renderCharts(rows) {
  const ink2 = css("--ink-2"), line = css("--line"), brand = css("--brand-2");
  Chart.defaults.font.family = '"DM Sans", system-ui, sans-serif';
  Chart.defaults.color = ink2;

  /* last 6 months */
  const months = [];
  const d = new Date(); d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push({ key: m.getFullYear() + "-" + m.getMonth(), label: m.toLocaleDateString("en-IN", { month: "short" }), kg: 0, co2: 0 });
  }
  rows.forEach(h => {
    const dt = new Date(h.date), k = dt.getFullYear() + "-" + dt.getMonth();
    const m = months.find(x => x.key === k);
    if (m) { m.kg += h.weightKg; m.co2 += co2For(h.category, h.weightKg); }
  });

  monthChart?.destroy();
  monthChart = new Chart($("#monthChart"), {
    type: "bar",
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: "kg diverted", data: months.map(m => Math.round(m.kg)),
        backgroundColor: brand, borderRadius: 6, maxBarThickness: 44
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { afterLabel: c => "~" + Math.round(months[c.dataIndex].co2) + " kg CO₂e avoided" } } },
      scales: {
        x: { grid: { display: false }, border: { color: line } },
        y: { beginAtZero: true, grid: { color: line }, border: { display: false }, ticks: { callback: v => v + " kg" } }
      }
    }
  });

  /* by category */
  const byCat = {};
  rows.forEach(h => { byCat[h.category] = (byCat[h.category] || 0) + h.weightKg; });
  const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
  catChart?.destroy();
  catChart = new Chart($("#catChart"), {
    type: "doughnut",
    data: {
      labels: cats.map(k => (CATEGORIES[k] || CATEGORIES.other).label),
      datasets: [{ data: cats.map(k => byCat[k]), backgroundColor: cats.map(k => (CATEGORIES[k] || CATEGORIES.other).color),
                   borderColor: css("--surface"), borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: {
        legend: { position: "right", labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 10 } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtNum(c.raw)} kg` } }
      }
    }
  });
  if (!rows.length) {
    $("#catChart").parentElement.insertAdjacentHTML("beforeend",
      `<div class="empty" style="position:absolute;inset:0;display:grid;place-items:center">No exchanges yet</div>`);
  } else {
    $("#catChart").parentElement.querySelector(".empty")?.remove();
  }
}

function renderLeaders() {
  const given = {};
  Store.history().forEach(h => { given[h.fromId] = (given[h.fromId] || 0) + h.weightKg; });
  const top = Object.entries(given).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $("#leaders").innerHTML = top.map(([id, kg], i) => {
    const u = Store.userById(id);
    return `<li><span class="rank">${i + 1}</span>${avatar(u, "xs")}<span class="nm">${esc(u.name)}${id === ME ? " (you)" : ""}<br>
      <span class="muted small">${ROLES[u.role] || ""}</span></span><span class="kg">${fmtNum(kg)} kg</span></li>`;
  }).join("");
}

function renderAll() {
  const rows = data();
  renderKPIs(rows);
  renderCharts(rows);
  renderLeaders();
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
  $("#scopeSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    scope = b.dataset.scope;
    $$("#scopeSeg button").forEach(x => x.classList.toggle("on", x === b));
    renderAll();
  });
  document.addEventListener("themechange", () => renderCharts(data()));
  document.addEventListener("profilechange", renderAll);
  document.addEventListener("listingschange", renderAll);
});
