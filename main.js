import * as THREE from "./vendor/three.module.js";

const constants = {
  discountRate: 0.06,
  horizons: [3, 5, 10],
  vehicles: {
    gas: {
      label: "Gasoline",
      startingCost: 45000,
      fuelPer100: 12.5,
      maintenancePerKm: 0.085,
      tailpipeKgPerKm: 0.299,
      manufacturingTonnes: 8,
    },
    ev: {
      label: "Electric",
      startingCost: 85000,
      energyPer100: 30,
      maintenancePerKm: 0.045,
      tailpipeKgPerKm: 0,
      manufacturingTonnes: 12,
    },
    retrofit: {
      label: "Retrofit",
      startingCost: 50000,
      energyPer100: 32,
      maintenancePerKm: 0.05,
      tailpipeKgPerKm: 0,
      manufacturingTonnes: 6,
    },
  },
};

const state = {
  scenarioMode: "km",
  km: 20000,
  fleet: 25,
  gasPrice: 1.8,
  electricityPrice: 0.14,
  maintenance: 1,
  retrofitCost: 50000,
};

const els = {
  scenarioMode: document.querySelector("#scenario-mode"),
  scenarioNote: document.querySelector("#scenario-note"),
  km: document.querySelector("#km"),
  fleet: document.querySelector("#fleet"),
  gasPrice: document.querySelector("#gas-price"),
  electricityPrice: document.querySelector("#electricity-price"),
  maintenance: document.querySelector("#maintenance"),
  retrofitCost: document.querySelector("#retrofit-cost"),
  kmLabel: document.querySelector("#km-label"),
  fleetLabel: document.querySelector("#fleet-label"),
  gasPriceLabel: document.querySelector("#gas-price-label"),
  electricityPriceLabel: document.querySelector("#electricity-price-label"),
  maintenanceLabel: document.querySelector("#maintenance-label"),
  retrofitCostLabel: document.querySelector("#retrofit-cost-label"),
  retrofits: document.querySelector("#metric-retrofits"),
  savings: document.querySelector("#metric-savings"),
  co2: document.querySelector("#metric-co2"),
  benefit: document.querySelector("#metric-benefit"),
  gasCostKm: document.querySelector("#gas-cost-km"),
  evCostKm: document.querySelector("#ev-cost-km"),
  retrofitCostKm: document.querySelector("#retrofit-cost-km"),
  gasAnnual: document.querySelector("#gas-annual"),
  evAnnual: document.querySelector("#ev-annual"),
  retrofitAnnual: document.querySelector("#retrofit-annual"),
  table: document.querySelector("#forecast-table"),
  benefitChart: document.querySelector("#benefit-chart"),
  co2Chart: document.querySelector("#co2-chart"),
};

function currency(value) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

function fullCurrency(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

function costPerKm(type) {
  const vehicle = constants.vehicles[type];
  const maintenance = vehicle.maintenancePerKm * state.maintenance;

  if (type === "gas") {
    return (vehicle.fuelPer100 / 100) * state.gasPrice + maintenance;
  }

  return (vehicle.energyPer100 / 100) * state.electricityPrice + maintenance;
}

function startingCost(type) {
  return type === "retrofit" ? state.retrofitCost : constants.vehicles[type].startingCost;
}

function annualOperatingCost(type) {
  return costPerKm(type) * state.km * state.fleet;
}

function npvCost(type, years) {
  let total = startingCost(type) * state.fleet;
  for (let year = 1; year <= years; year += 1) {
    total += annualOperatingCost(type) / (1 + constants.discountRate) ** year;
  }
  return total;
}

function emissions(type, years) {
  const vehicle = constants.vehicles[type];
  const manufacturing = vehicle.manufacturingTonnes * state.fleet;
  const operating = vehicle.tailpipeKgPerKm * state.km * years * state.fleet / 1000;
  return manufacturing + operating;
}

function horizonRows() {
  return constants.horizons.map((years) => {
    const gas = npvCost("gas", years);
    const ev = npvCost("ev", years);
    const retrofit = npvCost("retrofit", years);

    return {
      years,
      gas,
      ev,
      retrofit,
      retrofitVsGas: gas - retrofit,
      retrofitVsEv: ev - retrofit,
      gasEmissions: emissions("gas", years),
      evEmissions: emissions("ev", years),
      retrofitEmissions: emissions("retrofit", years),
    };
  });
}

function breakevenYears() {
  const gasDelta = startingCost("retrofit") - startingCost("gas");
  const annualSavings = costPerKm("gas") * state.km - costPerKm("retrofit") * state.km;
  if (annualSavings <= 0) return null;
  return Math.max(gasDelta / annualSavings, 0);
}

function lineChart(svg, rows, key, color) {
  const ns = "http://www.w3.org/2000/svg";
  const width = 960;
  const height = 360;
  const pad = 48;
  const values = rows.map((row) => row[key]);
  const min = Math.min(0, ...values);
  const max = Math.max(...values) || 1;
  const x = (index) => pad + (index / (rows.length - 1)) * (width - pad * 2);
  const y = (value) => height - pad - ((value - min) / (max - min || 1)) * (height - pad * 2);
  const points = rows.map((row, index) => `${x(index)},${y(row[key])}`).join(" ");
  const area = `${pad},${height - pad} ${points} ${width - pad},${height - pad}`;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren();

  const add = (tag, attrs, text = "") => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
    if (text) node.textContent = text;
    svg.appendChild(node);
    return node;
  };

  add("rect", { x: 0, y: 0, width, height, rx: 8, fill: "#080a0a" });
  add("rect", { x: 1, y: 1, width: width - 2, height: height - 2, rx: 8, fill: "none", stroke: color, "stroke-width": 1, opacity: 0.35, "stroke-dasharray": "2 8" });
  for (let gx = pad; gx <= width - pad; gx += 28) {
    for (let gy = pad; gy <= height - pad; gy += 22) {
      add("circle", { cx: gx, cy: gy, r: 0.9, fill: "#aaabac", opacity: 0.22 });
    }
  }
  add("polygon", { points: area, fill: color, opacity: 0.12 });
  [0.25, 0.5, 0.75].forEach((n) => {
    const gy = pad + n * (height - pad * 2);
    add("line", { x1: pad, y1: gy, x2: width - pad, y2: gy, stroke: "#484848", "stroke-width": 1, "stroke-dasharray": "2 8" });
  });
  add("line", { x1: pad, y1: height - pad, x2: width - pad, y2: height - pad, stroke: "#aaabac", "stroke-width": 1, opacity: 0.36, "stroke-dasharray": "2 7" });
  add("polyline", { points, fill: "none", stroke: color, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round" });
  rows.forEach((row, index) => {
    add("circle", { cx: x(index), cy: y(row[key]), r: 7, fill: "#080a0a", stroke: color, "stroke-width": 2.2 });
    add("circle", { cx: x(index), cy: y(row[key]), r: 2.2, fill: color });
    if (index % 2 === 0) {
      add("text", { x: x(index), y: height - 14, "text-anchor": "middle", fill: "#aeb8ae", "font-size": 14 }, row.year);
    }
  });
}

function render() {
  const rows = horizonRows();
  const last = rows.at(-1);
  const breakeven = breakevenYears();
  const scenarioNotes = {
    km: "Only annual kilometres should change in this scenario.",
    vehicles: "Only the number of vehicles should change in this scenario.",
    fuel: "Only gas and electricity prices should change in this scenario.",
    maintenance: "Only the maintenance multiplier should change in this scenario.",
    emissions: "Emissions per kilometre and manufacturing emissions are included in the comparison.",
  };

  els.scenarioNote.textContent = scenarioNotes[state.scenarioMode];
  els.kmLabel.textContent = `${state.km.toLocaleString()} km`;
  els.fleetLabel.textContent = state.fleet.toLocaleString();
  els.gasPriceLabel.textContent = `$${state.gasPrice.toFixed(2)}/L`;
  els.electricityPriceLabel.textContent = `$${state.electricityPrice.toFixed(2)}/kWh`;
  els.maintenanceLabel.textContent = `${state.maintenance.toFixed(2)}x`;
  els.retrofitCostLabel.textContent = fullCurrency(state.retrofitCost);

  const gasAnnual = annualOperatingCost("gas");
  const evAnnual = annualOperatingCost("ev");
  const retrofitAnnual = annualOperatingCost("retrofit");
  const gasKm = costPerKm("gas");
  const evKm = costPerKm("ev");
  const retrofitKm = costPerKm("retrofit");

  els.gasCostKm.textContent = `$${gasKm.toFixed(2)}/km`;
  els.evCostKm.textContent = `$${evKm.toFixed(2)}/km`;
  els.retrofitCostKm.textContent = `$${retrofitKm.toFixed(2)}/km`;
  els.gasAnnual.textContent = `${fullCurrency(gasAnnual)}/year`;
  els.evAnnual.textContent = `${fullCurrency(evAnnual)}/year`;
  els.retrofitAnnual.textContent = `${fullCurrency(retrofitAnnual)}/year`;

  els.retrofits.textContent = currency(last.retrofitVsGas);
  els.savings.textContent = breakeven === null ? "No break" : `${breakeven.toFixed(1)} yr`;
  els.co2.textContent = `${Math.round(last.gasEmissions - last.retrofitEmissions).toLocaleString()} t`;
  els.benefit.textContent = `$${retrofitKm.toFixed(2)}/km`;

  els.table.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.years} years</td>
      <td>${currency(row.gas)}</td>
      <td>${currency(row.ev)}</td>
      <td>${currency(row.retrofit)}</td>
      <td>${currency(row.retrofitVsGas)}</td>
      <td>${currency(row.retrofitVsEv)}</td>
    </tr>
  `).join("");

  lineChart(els.benefitChart, rows.map((row) => ({ year: `${row.years}y`, value: row.retrofitVsGas })), "value", "#6bd5bc");
  lineChart(els.co2Chart, rows.map((row) => ({ year: `${row.years}y`, value: row.gasEmissions - row.retrofitEmissions })), "value", "#ff9f45");
  updateGlobe(rows);
}

for (const [key, input] of Object.entries({
  km: els.km,
  fleet: els.fleet,
  gasPrice: els.gasPrice,
  electricityPrice: els.electricityPrice,
  maintenance: els.maintenance,
  retrofitCost: els.retrofitCost,
})) {
  input.addEventListener("input", () => {
    state[key] = Number(input.value);
    render();
  });
}

els.scenarioMode.addEventListener("change", () => {
  state.scenarioMode = els.scenarioMode.value;
  render();
});

const canvas = document.querySelector("#globe-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.08, 4.45);

const textureLoader = new THREE.TextureLoader();
const globe = new THREE.Mesh(
  new THREE.SphereGeometry(1.55, 96, 96),
  new THREE.MeshPhongMaterial({
    map: textureLoader.load("./assets/earth_atmos_2048.jpg"),
    normalMap: textureLoader.load("./assets/earth_normal_2048.jpg"),
    specularMap: textureLoader.load("./assets/earth_specular_2048.jpg"),
    shininess: 28,
    specular: new THREE.Color("#ff9f45"),
  })
);
scene.add(globe);

const glow = new THREE.Mesh(
  new THREE.SphereGeometry(1.62, 96, 96),
  new THREE.MeshBasicMaterial({ color: "#ff9f45", transparent: true, opacity: 0.13, wireframe: true })
);
scene.add(glow);

const pointsGeometry = new THREE.BufferGeometry();
const pointCount = 900;
const positions = new Float32Array(pointCount * 3);
for (let i = 0; i < pointCount; i += 1) {
  const radius = 2.15 + Math.random() * 1.3;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  positions[i * 3 + 2] = radius * Math.cos(phi);
}
pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const points = new THREE.Points(
  pointsGeometry,
  new THREE.PointsMaterial({ size: 0.014, color: "#d9fff1", transparent: true, opacity: 0.5 })
);
scene.add(points);

const arcGroup = new THREE.Group();
scene.add(arcGroup);

const light = new THREE.DirectionalLight("#ffffff", 2.2);
light.position.set(-3, 2.5, 4);
scene.add(light);
scene.add(new THREE.AmbientLight("#ffb45c", 0.48));
scene.add(new THREE.HemisphereLight("#6bd5bc", "#ff9f45", 0.32));

function makeArc(angle, height, color) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(Math.cos(angle) * 1.58, Math.sin(angle) * 0.45, Math.sin(angle) * 1.1),
    new THREE.Vector3(Math.cos(angle + 0.55) * 1.9, height, Math.sin(angle + 0.55) * 1.35),
    new THREE.Vector3(Math.cos(angle + 1.1) * 1.58, -Math.sin(angle) * 0.55, Math.sin(angle + 1.1) * 1.1),
  ]);
  return new THREE.Line(
    new THREE.TubeGeometry(curve, 40, 0.006, 6, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 })
  );
}

function updateGlobe(rows) {
  const last = rows.at(-1);
  const arcTarget = Math.min(16, Math.max(4, Math.round((last.gasEmissions - last.retrofitEmissions) / 25)));
  while (arcGroup.children.length < arcTarget) {
    arcGroup.add(makeArc(Math.random() * Math.PI * 2, 0.7 + Math.random() * 1.1, Math.random() > 0.4 ? "#ff9f45" : "#6bd5bc"));
  }
  while (arcGroup.children.length > arcTarget) {
    arcGroup.remove(arcGroup.children.at(-1));
  }
  arcGroup.children.forEach((arc, index) => {
    arc.material.opacity = 0.32 + Math.min(0.46, (last.gasEmissions - last.retrofitEmissions) / 1000) + (index % 3) * 0.04;
  });
}

function resize() {
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / Math.max(clientHeight, 1);
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);

function animate() {
  resize();
  globe.rotation.y += 0.0024;
  glow.rotation.y -= 0.0022;
  points.rotation.y += 0.0008;
  arcGroup.rotation.y += 0.0042;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

render();
animate();
