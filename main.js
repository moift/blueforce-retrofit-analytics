const scenarioConfig = {
  base: {
    label: "Base case",
    description: "Default 3, 5, and 10 year totals from the model export.",
    xLabel: "Year horizon",
    yLabel: "Total cost (CAD)",
  },
  km: {
    sheet: "Scenario1_KM",
    parameter: "km_per_year",
    metric: "cumulative_total_cost",
    label: "Kilometres",
    xLabel: "Annual kilometres driven",
    yLabel: "Cumulative total cost (CAD)",
    description: "Only annual kilometres change while all other assumptions stay constant.",
    formatParameter: (value) => `${Number(value).toLocaleString()} km`,
  },
  fleet: {
    sheet: "Scenario2_Fleet",
    parameter: "fleet_size",
    metric: "cumulative_total_cost",
    label: "Fleet size",
    xLabel: "Number of vehicles",
    yLabel: "Fleet cumulative total cost (CAD)",
    description: "Only the number of vehicles changes while per-vehicle assumptions stay constant.",
    formatParameter: (value) => `${Number(value).toLocaleString()} vehicles`,
  },
  fuel: {
    sheet: "Scenario3_Fuel",
    parameter: "fuel_multiplier",
    metric: "cumulative_total_cost",
    label: "Fuel price",
    xLabel: "Fuel and electricity price multiplier",
    yLabel: "Cumulative total cost (CAD)",
    description: "Only fuel and electricity prices change to test sensitivity to energy prices.",
    formatParameter: (value) => `${Number(value).toFixed(1)}x`,
  },
  maintenance: {
    sheet: "Scenario4_Maintenance",
    parameter: "inflation_rate",
    metric: "cumulative_total_cost",
    label: "Maintenance",
    xLabel: "Maintenance inflation",
    yLabel: "Cumulative total cost (CAD)",
    description: "Only maintenance inflation changes to test the service-cost assumption.",
    formatParameter: (value) => `${Math.round(Number(value) * 100)}%`,
  },
  capital: {
    sheet: "Scenario6_Capital",
    parameter: "capital_cost_multiplier",
    metric: "cumulative_total_cost",
    label: "Capital cost",
    xLabel: "Capital cost multiplier",
    yLabel: "Cumulative total cost (CAD)",
    description: "Only purchase or retrofit capital cost changes to test upfront-cost sensitivity.",
    formatParameter: (value) => `${Number(value).toFixed(1)}x`,
  },
  emissions: {
    sheet: "Scenario5_Individual",
    parameter: "km_per_year",
    metric: "cumulative_emissions_tonnes_individual",
    label: "Emissions",
    xLabel: "Annual kilometres driven",
    yLabel: "Cumulative emissions (tonnes CO2e)",
    description: "Cumulative emissions change as annual kilometres change.",
    formatParameter: (value) => `${Number(value).toLocaleString()} km`,
  },
};

const palette = {
  "F-150 Retrofit": "#8ff0cf",
  "F-150 ICE": "#ff7070",
  "F-150 Lightning SR": "#86b4ff",
  "F-350 Retrofit": "#8ff0cf",
  "F-350 ICE": "#ff7070",
  "F-350 Diesel": "#a98cff",
  "F-450 Retrofit": "#8ff0cf",
  "F-450 ICE": "#ff7070",
  "F-450 Diesel": "#a98cff",
};

const modelNames = {
  "F-150 Retrofit": "Retrofit",
  "F-150 ICE": "ICE",
  "F-150 Lightning SR": "OEM EV",
  "F-350 Retrofit": "Retrofit",
  "F-350 ICE": "ICE",
  "F-350 Diesel": "Diesel",
  "F-450 Retrofit": "Retrofit",
  "F-450 ICE": "ICE",
  "F-450 Diesel": "Diesel",
};

const state = {
  view: "overview",
  family: "F-150",
  scenario: "base",
  horizon: 10,
};

const els = {
  ambientCanvas: document.querySelector("#ambient-canvas"),
  content: document.querySelector("#view-content"),
  familyControl: document.querySelector("#family-control"),
  scenarioControl: document.querySelector("#scenario-control"),
  horizonControl: document.querySelector("#horizon-control"),
  todayLabel: document.querySelector("#today-label"),
  navButtons: [...document.querySelectorAll(".nav-icon")],
};

let workbook;

function currency(value) {
  const number = Number(value);
  if (Math.abs(number) >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(number).toLocaleString()}`;
}

function compactMoney(value) {
  const number = Number(value);
  if (Math.abs(number) >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1_000) return `$${Math.round(number / 1_000)}k`;
  return `$${Math.round(number)}`;
}

function tonnes(value) {
  return `${Number(value).toFixed(Number(value) >= 10 ? 1 : 2)} t`;
}

function annualMoney(value) {
  return `${currency(value)}/yr`;
}

function familyRows() {
  return workbook.BaseCase_Summary.filter((row) => row.model.startsWith(state.family));
}

function comparisonRows() {
  return workbook.Comparison_Summary.filter((row) => row.retrofit_model.startsWith(state.family));
}

function retrofitRow() {
  return familyRows().find((row) => row.model.includes("Retrofit"));
}

function bestModelForHorizon() {
  const key = `total_cost_year_${state.horizon}`;
  return familyRows().reduce((best, row) => (!best || row[key] < best[key] ? row : best), null);
}

function labelFor(model) {
  return modelNames[model] || model.replace(`${state.family} `, "");
}

function makeControl(target, name, options, value, onChange) {
  target.innerHTML = options
    .map(
      (option) => `
        <label class="radio-pill">
          <input type="radio" name="${name}" value="${option.value}" ${option.value === value ? "checked" : ""} />
          <span>${option.label}</span>
        </label>
      `,
    )
    .join("");

  target.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.addEventListener("change", () => onChange(input.value));
  });
}

function renderControls() {
  makeControl(
    els.familyControl,
    "family",
    [
      { value: "F-150", label: "F-150" },
      { value: "F-350", label: "F-350" },
      { value: "F-450", label: "F-450" },
    ],
    state.family,
    (value) => {
      state.family = value;
      render();
    },
  );

  makeControl(
    els.scenarioControl,
    "scenario",
    [
      { value: "base", label: "Base" },
      { value: "km", label: "KM" },
      { value: "fleet", label: "Fleet" },
      { value: "fuel", label: "Fuel" },
      { value: "maintenance", label: "Maint." },
      { value: "capital", label: "Capital" },
      { value: "emissions", label: "Emissions" },
    ],
    state.scenario,
    (value) => {
      state.scenario = value;
      state.view = value === "emissions" ? "emissions" : "scenarios";
      render();
    },
  );

  makeControl(
    els.horizonControl,
    "horizon",
    [
      { value: "3", label: "3 Year" },
      { value: "5", label: "5 Year" },
      { value: "10", label: "10 Year" },
    ],
    String(state.horizon),
    (value) => {
      state.horizon = Number(value);
      render();
    },
  );
}

function heroMetricsHtml() {
  const best = bestModelForHorizon();
  const retrofit = retrofitRow();
  const comparison = comparisonRows().find((row) => row.comparison.includes("ICE"));
  const cards = [
    [`${state.horizon} year lowest cost`, labelFor(best.model), `${state.family} family`],
    ["Retrofit purchase price", currency(retrofit.purchase_price), "Base case input"],
    ["Annual savings vs ICE", comparison ? annualMoney(comparison.annual_operating_savings) : "n/a", "Operating cost"],
  ];

  return `<div class="hero-metrics">${cards.map(([label, value, note]) => statCard(label, value, note)).join("")}</div>`;
}

function insightHtml() {
  const comparison = comparisonRows().find((row) => row.comparison.includes("ICE"));
  const other = comparisonRows().find((row) => !row.comparison.includes("ICE"));
  const retrofit = retrofitRow();
  const savingsKey = `savings_year_${state.horizon}`;
  const emissionsKey = `emissions_avoided_year_${state.horizon}`;
  const cards = [
    [`${state.horizon} year winner`, labelFor(bestModelForHorizon().model), "Lowest total cost"],
    ["Retrofit annual operating cost", annualMoney(retrofit.annual_operating_cost), "Base case"],
    ["Retrofit savings vs ICE", comparison ? compactMoney(comparison[savingsKey]) : "n/a", `${state.horizon} year total`],
    ["Emissions avoided vs ICE", comparison ? tonnes(comparison[emissionsKey]) : "n/a", `${state.horizon} year total`],
    [other ? `Savings vs ${labelFor(other.comparison_model)}` : "Alternate savings", other ? compactMoney(other[savingsKey]) : "n/a", `${state.horizon} year total`],
  ];
  return `<div class="stat-grid">${cards.map(([label, value, note]) => statCard(label, value, note)).join("")}</div>`;
}

function statCard(label, value, note) {
  return `<article class="sub-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

function vehiclesHtml() {
  const horizonKey = `total_cost_year_${state.horizon}`;
  return `
    <div class="vehicle-grid">
      ${familyRows()
        .map(
          (row) => `
            <article class="pill-card">
              <div class="vehicle-head">
                <span class="vehicle-dot" style="--dot:${palette[row.model]}"></span>
                <div><h3>${labelFor(row.model)}</h3><p class="muted">${row.model}</p></div>
              </div>
              <dl>
                <div><dt>Purchase price</dt><dd>${currency(row.purchase_price)}</dd></div>
                <div><dt>Annual operating</dt><dd>${annualMoney(row.annual_operating_cost)}</dd></div>
                <div><dt>${state.horizon} year cost</dt><dd>${currency(row[horizonKey])}</dd></div>
                <div><dt>10 year emissions</dt><dd>${tonnes(row.cumulative_emissions_year_10)}</dd></div>
              </dl>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function comparisonsHtml() {
  const savingsKey = `savings_year_${state.horizon}`;
  const emissionsKey = `emissions_avoided_year_${state.horizon}`;
  return `
    <div class="comparison-list">
      ${comparisonRows()
        .map(
          (row) => `
            <article class="list-card">
              <div>
                <h3>${row.comparison}</h3>
                <p>${row.retrofit_model} against ${row.comparison_model}</p>
              </div>
              <span>${annualMoney(row.annual_operating_savings)} operating savings</span>
              <strong>${currency(row[savingsKey])}</strong>
              <small>${tonnes(row[emissionsKey])} emissions avoided</small>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function methodHtml() {
  const active = scenarioConfig[state.scenario];
  const rows = [
    "Input: all_scenarios_export_final.xlsx converted into app-ready JSON.",
    `Truck family: ${state.family}.`,
    `Scenario view: ${active.label}.`,
    `Displayed result horizon: ${state.horizon} years.`,
    state.scenario === "emissions"
      ? "Chart metric: cumulative emissions in tonnes CO2e."
      : "Chart metric: cumulative total cost in CAD.",
  ];
  return `<div class="method-list">${rows.map((row) => `<p>${row}</p>`).join("")}</div>`;
}

function tableHtml() {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>3 Year Cost</th>
            <th>5 Year Cost</th>
            <th>10 Year Cost</th>
            <th>10 Year Emissions</th>
          </tr>
        </thead>
        <tbody>
          ${familyRows()
            .map(
              (row) => `
                <tr>
                  <td>${labelFor(row.model)}</td>
                  <td>${currency(row.total_cost_year_3)}</td>
                  <td>${currency(row.total_cost_year_5)}</td>
                  <td>${currency(row.total_cost_year_10)}</td>
                  <td>${tonnes(row.cumulative_emissions_year_10)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function chartModuleHtml(title = "Scenario performance") {
  const active = scenarioConfig[state.scenario];
  return `
    <section class="glass-module chart-module">
      <div class="module-head">
        <div><p class="eyebrow">Scenario Analysis</p><h2>${title}</h2></div>
        <button class="more-button" type="button" aria-label="Chart options">...</button>
      </div>
      <p class="module-copy">${active.description}</p>
      <svg id="scenario-chart" role="img" aria-label="Scenario analysis chart"></svg>
      <p class="module-note">${state.scenario === "base" ? `Reading exported base-case totals for ${state.family}.` : `Showing the ${state.horizon} year result while only ${active.label.toLowerCase()} changes.`}</p>
    </section>
  `;
}

function renderView() {
  if (state.view === "overview") {
    els.content.innerHTML = `
      ${chartModuleHtml()}
      <section class="glass-module metric-module">${heroMetricsHtml()}</section>
      <section class="glass-module metric-module">${insightHtml()}</section>
      <section class="glass-module vehicle-module"><div class="module-head"><div><p class="eyebrow">Base Case</p><h2>Vehicle pathways</h2></div><p class="module-note">Showing ${state.horizon} year totals for ${state.family} pathways.</p></div>${vehiclesHtml()}</section>
      <section class="glass-module comparison-module"><div class="module-head"><div><p class="eyebrow">Comparison Summary</p><h2>Retrofit edge</h2></div></div>${comparisonsHtml()}</section>
      <section class="glass-module wide-module"><div class="module-head"><div><p class="eyebrow">Horizon Table</p><h2>3, 5, and 10 year totals</h2></div></div>${tableHtml()}</section>
    `;
  }

  if (state.view === "scenarios") {
    els.content.innerHTML = `
      ${chartModuleHtml("Sensitivity analysis")}
      <section class="glass-module metric-module">${insightHtml()}</section>
      <section class="glass-module method-module"><div class="module-head"><div><p class="eyebrow">Method</p><h2>What changed</h2></div></div>${methodHtml()}</section>
      <section class="glass-module wide-module"><div class="module-head"><div><p class="eyebrow">Pathways</p><h2>Base case reference</h2></div></div>${vehiclesHtml()}</section>
    `;
  }

  if (state.view === "vehicles") {
    els.content.innerHTML = `
      <section class="glass-module wide-module"><div class="module-head"><div><p class="eyebrow">Vehicle Comparison</p><h2>${state.family} pathways</h2></div></div>${vehiclesHtml()}</section>
      <section class="glass-module comparison-module"><div class="module-head"><div><p class="eyebrow">Retrofit Edge</p><h2>Savings summary</h2></div></div>${comparisonsHtml()}</section>
      <section class="glass-module method-module"><div class="module-head"><div><p class="eyebrow">Key Metrics</p><h2>Decision signal</h2></div></div>${insightHtml()}</section>
    `;
  }

  if (state.view === "emissions") {
    const priorScenario = state.scenario;
    state.scenario = "emissions";
    els.content.innerHTML = `
      ${chartModuleHtml("Emissions profile")}
      <section class="glass-module metric-module">${insightHtml()}</section>
      <section class="glass-module method-module"><div class="module-head"><div><p class="eyebrow">Method</p><h2>Emissions logic</h2></div></div>${methodHtml()}</section>
      <section class="glass-module wide-module"><div class="module-head"><div><p class="eyebrow">Vehicle emissions</p><h2>10 year output</h2></div></div>${vehiclesHtml()}</section>
    `;
    state.scenario = priorScenario === "emissions" ? "emissions" : priorScenario;
  }

  if (state.view === "method") {
    els.content.innerHTML = `
      <section class="glass-module wide-module"><div class="module-head"><div><p class="eyebrow">Method</p><h2>Model inputs and assumptions</h2></div></div>${methodHtml()}</section>
      <section class="glass-module vehicle-module"><div class="module-head"><div><p class="eyebrow">Base Case</p><h2>Vehicle pathways</h2></div></div>${vehiclesHtml()}</section>
      <section class="glass-module comparison-module"><div class="module-head"><div><p class="eyebrow">Comparison</p><h2>Retrofit edge</h2></div></div>${comparisonsHtml()}</section>
    `;
  }

  if (state.view === "table") {
    els.content.innerHTML = `
      <section class="glass-module wide-module"><div class="module-head"><div><p class="eyebrow">Horizon Table</p><h2>3, 5, and 10 year totals</h2></div></div>${tableHtml()}</section>
      <section class="glass-module wide-module"><div class="module-head"><div><p class="eyebrow">Vehicle detail</p><h2>${state.family} pathways</h2></div></div>${vehiclesHtml()}</section>
    `;
  }

  renderScenarioChart();
}

function buildBaseSeries() {
  return {
    xValues: [3, 5, 10],
    xLabel: "Year horizon",
    yLabel: "Total cost (CAD)",
    formatX: (value) => `${value}y`,
    formatValue: currency,
    series: familyRows().map((row) => ({
      label: labelFor(row.model),
      color: palette[row.model],
      values: [row.total_cost_year_3, row.total_cost_year_5, row.total_cost_year_10],
    })),
  };
}

function buildScenarioSeries() {
  const active = scenarioConfig[state.scenario === "base" ? "km" : state.scenario];
  const rows = workbook[active.sheet]
    .filter((row) => row.model.startsWith(state.family))
    .filter((row) => Number(row.year) === state.horizon);
  const xValues = [...new Set(rows.map((row) => Number(row[active.parameter])))]
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b);

  return {
    xValues,
    xLabel: active.xLabel,
    yLabel: active.yLabel,
    formatX: active.formatParameter,
    formatValue: active.metric.includes("emissions") ? tonnes : currency,
    series: familyRows().map((baseRow) => ({
      label: labelFor(baseRow.model),
      color: palette[baseRow.model],
      values: xValues.map((xValue) => {
        const match = rows.find((row) => row.model === baseRow.model && Number(row[active.parameter]) === xValue);
        return match ? Number(match[active.metric]) : null;
      }),
    })),
  };
}

function renderLineChart(svg, config) {
  if (!svg) return;
  const ns = "http://www.w3.org/2000/svg";
  const width = 1040;
  const height = 420;
  const padTop = 34;
  const padRight = 32;
  const padBottom = 62;
  const padLeft = 76;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const values = config.series.flatMap((series) => series.values).filter((value) => typeof value === "number");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yMin = min > 0 ? min * 0.92 : min * 1.08;
  const yMax = max * 1.05 || 1;
  const xCount = Math.max(config.xValues.length - 1, 1);
  const xScale = (index) => padLeft + (index / xCount) * chartWidth;
  const yScale = (value) => padTop + chartHeight - ((value - yMin) / (yMax - yMin || 1)) * chartHeight;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const add = (tag, attrs, text) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    if (text !== undefined) node.textContent = text;
    svg.appendChild(node);
    return node;
  };

  add("rect", { x: 0, y: 0, width, height, rx: 8, fill: "rgba(255,255,255,0.08)" });

  for (let step = 0; step <= 4; step += 1) {
    const value = yMin + ((yMax - yMin) * step) / 4;
    const y = yScale(value);
    add("line", { x1: padLeft, y1: y, x2: width - padRight, y2: y, stroke: "rgba(255,255,255,0.18)", "stroke-width": 1 });
    add("text", { x: padLeft - 12, y: y + 4, "text-anchor": "end", fill: "rgba(255,255,255,0.84)", "font-size": 12 }, config.formatValue(value));
  }

  config.xValues.forEach((xValue, index) => {
    const x = xScale(index);
    add("line", { x1: x, y1: padTop, x2: x, y2: padTop + chartHeight, stroke: "rgba(255,255,255,0.12)", "stroke-width": 1 });
    add("text", { x, y: height - 24, "text-anchor": "middle", fill: "rgba(255,255,255,0.86)", "font-size": 12 }, config.formatX(xValue));
  });

  config.series.forEach((series) => {
    const points = series.values
      .map((value, index) => (typeof value === "number" ? { x: xScale(index), y: yScale(value) } : null))
      .filter(Boolean);
    add("polyline", {
      points: points.map((point) => `${point.x},${point.y}`).join(" "),
      fill: "none",
      stroke: series.color,
      "stroke-width": 3.2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    points.forEach((point) => {
      add("circle", { cx: point.x, cy: point.y, r: 5, fill: series.color });
      add("circle", { cx: point.x, cy: point.y, r: 10, fill: series.color, opacity: 0.16 });
    });
  });

  config.series.forEach((series, index) => {
    const x = padLeft + index * 180;
    add("circle", { cx: x, cy: 18, r: 5, fill: series.color });
    add("text", { x: x + 12, y: 22, fill: "rgba(255,255,255,0.9)", "font-size": 12 }, series.label);
  });

  add("text", { x: width / 2, y: height - 4, "text-anchor": "middle", fill: "rgba(255,255,255,0.82)", "font-size": 13 }, config.xLabel);
}

function renderScenarioChart() {
  const chart = document.querySelector("#scenario-chart");
  const scenarioForChart = state.view === "emissions" ? "emissions" : state.scenario;
  const originalScenario = state.scenario;
  state.scenario = scenarioForChart;
  renderLineChart(chart, state.scenario === "base" ? buildBaseSeries() : buildScenarioSeries());
  state.scenario = originalScenario;
}

function renderNav() {
  els.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
}

function render() {
  renderControls();
  renderNav();
  renderView();
}

function resizeCanvas() {
  const canvas = els.ambientCanvas;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

function startAmbientBackground() {
  const canvas = els.ambientCanvas;
  const ctx = canvas.getContext("2d");

  function draw(time) {
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(245,250,246,0.22)");
    gradient.addColorStop(0.5, "rgba(165,182,178,0.08)");
    gradient.addColorStop(1, "rgba(178,144,110,0.16)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    const wave = Math.sin(time * 0.00045) * 40;
    const sheen = ctx.createLinearGradient(wave, 0, width + wave, height);
    sheen.addColorStop(0, "rgba(255,255,255,0.18)");
    sheen.addColorStop(0.48, "rgba(255,255,255,0.03)");
    sheen.addColorStop(0.75, "rgba(179,144,110,0.14)");
    sheen.addColorStop(1, "rgba(255,255,255,0.08)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    requestAnimationFrame(draw);
  }

  resizeCanvas();
  requestAnimationFrame(draw);
}

function initNav() {
  els.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      if (state.view === "emissions") state.scenario = "emissions";
      render();
    });
  });
}

async function init() {
  const response = await fetch("./assets/scenario-data.json");
  workbook = await response.json();
  els.todayLabel.textContent = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  initNav();
  startAmbientBackground();
  render();
  window.addEventListener("resize", resizeCanvas);
}

init().catch((error) => {
  console.error("App failed to initialize", error);
});
