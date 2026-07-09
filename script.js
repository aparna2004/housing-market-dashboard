const metricLabels = {
  median_sale_price: "Median sale price",
  median_list_price: "Median list price",
  inventory: "Inventory",
  new_listings: "New listings",
  median_days_on_market: "Median days on market",
  sold_above_list: "Sold above list %",
  price_drops: "Price drops",
};

const moneyMetrics = new Set(["median_sale_price", "median_list_price"]);
const percentMetrics = new Set(["sold_above_list"]);
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const stateSelect = document.querySelector("#stateSelect");
const countySelect = document.querySelector("#countySelect");
const metricSelect = document.querySelector("#metricSelect");
const cards = document.querySelector("#cards");
const insights = document.querySelector("#insights");
const countyBars = document.querySelector("#countyBars");
const trendTitle = document.querySelector("#trendTitle");
const trendBadge = document.querySelector("#trendBadge");
const trendCanvas = document.querySelector("#trendChart");
const seasonCanvas = document.querySelector("#seasonChart");

let rows = createSampleData();

document.querySelector("#csvInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const imported = parseCsv(await file.text());
  if (imported.length) {
    rows = imported;
    setupFilters();
    render();
  } else {
    alert("No usable rows found. Check that the CSV has date, state, county, and metric columns.");
  }
});

stateSelect.addEventListener("change", () => {
  updateCountyOptions();
  render();
});
countySelect.addEventListener("change", render);
metricSelect.addEventListener("change", render);

setupFilters();
render();

function createSampleData() {
  const markets = [
    ["California", "Los Angeles", 625000, 13800, 42, 0.31],
    ["California", "San Diego", 690000, 5100, 35, 0.37],
    ["Texas", "Travis", 365000, 3900, 31, 0.28],
    ["Texas", "Harris", 255000, 10200, 44, 0.18],
    ["Florida", "Miami-Dade", 330000, 7200, 58, 0.21],
    ["Florida", "Orange", 290000, 4300, 49, 0.19],
    ["New York", "Kings", 710000, 3600, 67, 0.16],
    ["New York", "Queens", 590000, 4200, 63, 0.14],
  ];
  const data = [];
  for (let year = 2019; year <= 2022; year++) {
    for (let month = 0; month < 12; month++) {
      if (year === 2022 && month > 2) break;
      const t = (year - 2019) * 12 + month;
      const season = Math.sin(((month - 2) / 12) * Math.PI * 2);
      for (const [state, county, price, inventory, days, soldAbove] of markets) {
        const hotness = 1 + t * 0.012 + season * 0.035;
        const inventorySoftness = 1 - t * 0.009 - season * 0.08;
        data.push({
          date: `${year}-${String(month + 1).padStart(2, "0")}-01`,
          state,
          county,
          median_sale_price: Math.round(price * hotness),
          median_list_price: Math.round(price * (1.04 + season * 0.015 + t * 0.008)),
          inventory: Math.max(450, Math.round(inventory * inventorySoftness)),
          new_listings: Math.max(120, Math.round(inventory * (0.18 + season * 0.035))),
          median_days_on_market: Math.max(12, Math.round(days - t * 0.35 - season * 5)),
          sold_above_list: Math.min(0.72, Math.max(0.05, soldAbove + t * 0.006 + season * 0.07)),
          price_drops: Math.max(20, Math.round(inventory * (0.055 - season * 0.012 + (year === 2022 ? 0.012 : 0)))),
        });
      }
    }
  }
  return data;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(normalizeKey);
  return lines.slice(1).map(splitCsvLine).map((values) => {
    const raw = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const date = raw.period_begin || raw.period_end || raw.date || raw.month || raw.week;
    const state = raw.state || raw.state_name || raw.region_state;
    const county = raw.county || raw.county_name || raw.region || raw.region_name;
    if (!date || !state || !county) return null;
    const row = { date, state, county };
    for (const metric of Object.keys(metricLabels)) row[metric] = toNumber(raw[metric]);
    return row;
  }).filter(Boolean);
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function normalizeKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(/[$,%]/g, ""));
  if (!Number.isFinite(number)) return null;
  return Math.abs(number) > 1 && String(value).includes("%") ? number / 100 : number;
}

function setupFilters() {
  stateSelect.innerHTML = option("All states", "All states") + unique(rows.map((row) => row.state)).map((state) => option(state, state)).join("");
  updateCountyOptions();
}

function updateCountyOptions() {
  const state = stateSelect.value;
  const counties = unique(rows.filter((row) => state === "All states" || row.state === state).map((row) => row.county));
  countySelect.innerHTML = option("All counties", "All counties") + counties.map((county) => option(county, county)).join("");
}

function option(label, value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function render() {
  const metric = metricSelect.value;
  const filtered = selectedRows();
  const latestDate = filtered.map((row) => row.date).sort().at(-1);
  const latest = filtered.filter((row) => row.date === latestDate);
  const previous = filtered.filter((row) => row.date < latestDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-latest.length);
  const series = aggregateByDate(filtered, metric);
  const latestValue = average(latest.map((row) => row[metric]));
  const previousValue = average(previous.map((row) => row[metric]));
  const delta = previousValue ? (latestValue - previousValue) / previousValue : 0;

  cards.innerHTML = [
    card("Current " + metricLabels[metric], formatValue(metric, latestValue), `${formatPercent(delta)} vs prior period`),
    card("Inventory", formatValue("inventory", average(latest.map((row) => row.inventory))), "Supply available to buyers"),
    card("Days on market", formatValue("median_days_on_market", average(latest.map((row) => row.median_days_on_market))), "Lower values favor sellers"),
    card("Sold above list", formatValue("sold_above_list", average(latest.map((row) => row.sold_above_list))), "Demand pressure signal"),
  ].join("");

  trendTitle.textContent = `${metricLabels[metric]} over time`;
  trendBadge.textContent = delta >= 0 ? "Rising" : "Cooling";
  drawLineChart(trendCanvas, series, metric);
  drawBarChart(seasonCanvas, aggregateByMonth(filtered, metric), metric);
  renderCountyBars(metric);
  renderInsights(metric, latestValue, delta, filtered);
}

function selectedRows() {
  const state = stateSelect.value;
  const county = countySelect.value;
  return rows.filter((row) => (state === "All states" || row.state === state) && (county === "All counties" || row.county === county));
}

function aggregateByDate(data, metric) {
  const grouped = group(data.filter((row) => row[metric] != null), (row) => row.date);
  return Object.keys(grouped).sort().map((date) => ({ label: date.slice(0, 7), value: average(grouped[date].map((row) => row[metric])) }));
}

function aggregateByMonth(data, metric) {
  return months.map((label, month) => {
    const values = data.filter((row) => new Date(row.date).getMonth() === month).map((row) => row[metric]).filter((value) => value != null);
    return { label, value: average(values) };
  });
}

function renderCountyBars(metric) {
  const state = stateSelect.value;
  const data = rows.filter((row) => state === "All states" || row.state === state);
  const grouped = group(data, (row) => `${row.state} / ${row.county}`);
  const values = Object.entries(grouped).map(([label, records]) => ({ label, value: average(records.slice(-6).map((row) => row[metric])) }))
    .filter((item) => item.value != null).sort((a, b) => b.value - a.value).slice(0, 8);
  const max = Math.max(...values.map((item) => item.value), 1);
  countyBars.innerHTML = values.map((item) => `
    <div class="bar-row">
      <div class="bar-label"><span>${escapeHtml(item.label)}</span><strong>${formatValue(metric, item.value)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(item.value / max) * 100}%"></div></div>
    </div>
  `).join("");
}

function renderInsights(metric, latestValue, delta, data) {
  const inventoryTrend = slope(aggregateByDate(data, "inventory").map((point) => point.value));
  const priceTrend = slope(aggregateByDate(data, "median_sale_price").map((point) => point.value));
  const daysTrend = slope(aggregateByDate(data, "median_days_on_market").map((point) => point.value));
  const season = aggregateByMonth(data, metric).filter((point) => point.value != null).sort((a, b) => b.value - a.value);
  const strongestMonth = season[0]?.label || "N/A";
  const weakestMonth = season.at(-1)?.label || "N/A";
  insights.innerHTML = [
    `<li><strong>${metricLabels[metric]} is ${delta >= 0 ? "up" : "down"} ${formatPercent(Math.abs(delta))} recently.</strong> This indicates a ${delta >= 0 ? "strengthening" : "cooling"} short-term market signal.</li>`,
    `<li><strong>${priceTrend >= 0 ? "Prices show upward momentum." : "Prices show easing momentum."}</strong> Buyers should compare list and sale prices before bidding; sellers should avoid overpricing if momentum cools.</li>`,
    `<li><strong>Inventory is ${inventoryTrend >= 0 ? "expanding" : "tightening"}.</strong> ${inventoryTrend >= 0 ? "More supply improves buyer choice and negotiation power." : "Tighter supply usually increases seller leverage."}</li>`,
    `<li><strong>Market speed is ${daysTrend <= 0 ? "faster" : "slower"}.</strong> ${daysTrend <= 0 ? "Homes are moving quicker, so buyers need stronger pre-approval and faster decisions." : "Longer selling times can create room for concessions."}</li>`,
    `<li><strong>Seasonality:</strong> ${strongestMonth} is the strongest average month for this metric, while ${weakestMonth} is the weakest.</li>`,
  ].join("");
}

function drawLineChart(canvas, points, metric) {
  const ctx = canvas.getContext("2d");
  const box = chartBox(canvas, ctx);
  const values = points.map((point) => point.value).filter((value) => value != null);
  const [min, max] = domain(values);
  ctx.strokeStyle = "#b64f2d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = box.left + (index / Math.max(points.length - 1, 1)) * box.width;
    const y = box.bottom - ((point.value - min) / Math.max(max - min, 1)) * box.height;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  drawAxisLabels(ctx, box, points, metric, min, max);
}

function drawBarChart(canvas, points, metric) {
  const ctx = canvas.getContext("2d");
  const box = chartBox(canvas, ctx);
  const values = points.map((point) => point.value).filter((value) => value != null);
  const [, max] = domain(values);
  const gap = 9;
  const barWidth = box.width / points.length - gap;
  points.forEach((point, index) => {
    const height = (point.value / Math.max(max, 1)) * box.height;
    const x = box.left + index * (barWidth + gap);
    ctx.fillStyle = "#1b6b5f";
    ctx.fillRect(x, box.bottom - height, barWidth, height);
    ctx.fillStyle = "#766a5f";
    ctx.font = "12px sans-serif";
    ctx.fillText(point.label, x, box.bottom + 20);
  });
  drawYAxis(ctx, box, metric, 0, max);
}

function chartBox(canvas, ctx) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const box = { left: 72, top: 24, right: canvas.width - 24, bottom: canvas.height - 54 };
  box.width = box.right - box.left;
  box.height = box.bottom - box.top;
  ctx.strokeStyle = "#ded1bf";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.left, box.top);
  ctx.lineTo(box.left, box.bottom);
  ctx.lineTo(box.right, box.bottom);
  ctx.stroke();
  return box;
}

function drawAxisLabels(ctx, box, points, metric, min, max) {
  drawYAxis(ctx, box, metric, min, max);
  ctx.fillStyle = "#766a5f";
  ctx.font = "12px sans-serif";
  const first = points[0]?.label || "";
  const last = points.at(-1)?.label || "";
  ctx.fillText(first, box.left, box.bottom + 24);
  ctx.fillText(last, box.right - 52, box.bottom + 24);
}

function drawYAxis(ctx, box, metric, min, max) {
  ctx.fillStyle = "#766a5f";
  ctx.font = "12px sans-serif";
  ctx.fillText(formatValue(metric, max), 8, box.top + 8);
  ctx.fillText(formatValue(metric, min), 8, box.bottom);
}

function card(label, value, help) {
  return `<article class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><span>${escapeHtml(help)}</span></article>`;
}

function formatValue(metric, value) {
  if (value == null || Number.isNaN(value)) return "N/A";
  if (moneyMetrics.has(metric)) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (percentMetrics.has(metric)) return formatPercent(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value || 0);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function group(values, keyFn) {
  return values.reduce((acc, value) => {
    const key = keyFn(value);
    acc[key] ||= [];
    acc[key].push(value);
    return acc;
  }, {});
}

function average(values) {
  const clean = values.filter((value) => value != null && Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function domain(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.08 || max * 0.08 || 1;
  return [Math.max(0, min - pad), max + pad];
}

function slope(values) {
  const clean = values.filter((value) => value != null);
  if (clean.length < 2) return 0;
  return clean.at(-1) - clean[0];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
