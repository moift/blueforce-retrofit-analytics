import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Car,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Home,
  Info,
  Leaf,
  Sparkles,
  Table2,
  TrendingUp,
  Zap,
} from "lucide-react";

const SCENARIOS = {
  base: {
    label: "Base",
    fullLabel: "Base Case",
    description: "Default model result using the exported 3, 5, and 10 year forecast.",
  },
  km: {
    label: "High kilometres",
    fullLabel: "Kilometres Driven",
    sheet: "Scenario1_KM",
    parameter: "km_per_year",
    metric: "cumulative_total_cost",
    description: "Tests how the business case changes when annual kilometres increase.",
    formatX: (value) => `${Number(value / 1000).toFixed(0)}k km`,
  },
  fleet: {
    label: "Large fleet",
    fullLabel: "Fleet Size",
    sheet: "Scenario2_Fleet",
    parameter: "fleet_size",
    metric: "cumulative_total_cost",
    description: "Shows how retrofit savings scale when the fleet grows.",
    formatX: (value) => `${value} vehicles`,
  },
  fuel: {
    label: "High fuel cost",
    fullLabel: "Fuel Cost",
    sheet: "Scenario3_Fuel",
    parameter: "fuel_multiplier",
    metric: "cumulative_total_cost",
    description: "Tests sensitivity to higher gas, diesel, and electricity prices.",
    formatX: (value) => `${Number(value).toFixed(1)}x`,
  },
  maintenance: {
    label: "High maintenance",
    fullLabel: "Maintenance Cost",
    sheet: "Scenario4_Maintenance",
    parameter: "inflation_rate",
    metric: "cumulative_total_cost",
    description: "Tests whether retrofit still holds up when service costs rise.",
    formatX: (value) => `${Math.round(Number(value) * 100)}%`,
  },
  capital: {
    label: "Capital variation",
    fullLabel: "Capital Cost",
    sheet: "Scenario6_Capital",
    parameter: "capital_cost_multiplier",
    metric: "cumulative_total_cost",
    description: "Tests how sensitive the result is to purchase and retrofit cost.",
    formatX: (value) => `${Number(value).toFixed(1)}x`,
  },
};

const VEHICLES = ["F-150", "F-350", "F-450"];
const HORIZONS = [3, 5, 10];
const palette = {
  Retrofit: "#dff8ef",
  ICE: "#ffb4ad",
  "OEM EV": "#b9d0ff",
  Diesel: "#d4c3ff",
};

const navItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "scenario", label: "Scenario", icon: Gauge },
  { id: "vehicles", label: "Vehicles", icon: Car },
  { id: "emissions", label: "Emissions", icon: Leaf },
  { id: "assumptions", label: "Assumptions", icon: ClipboardList },
  { id: "table", label: "Data Table", icon: Table2 },
];

const explanations = {
  cumulativeCost: "Cumulative cost comes directly from the model export: purchase price plus annual operating cost multiplied across the selected forecast horizon.",
  operatingCost: "Annual operating cost is the exported total yearly operating amount. The current JSON does not separate fuel/electricity from maintenance, so the dashboard does not invent that split.",
  savings: "Savings equals the comparison vehicle cumulative cost minus the retrofit cumulative cost for the selected year horizon.",
  emissions: "CO2e avoided equals the comparison vehicle emissions minus retrofit emissions for the selected horizon. The lifecycle version includes manufacturing plus operating emissions.",
  manufacturing: "Manufacturing emissions are the estimated one-time CO2e released before the vehicle enters service. The dataset stores this in kg CO2e; the model converts it to tonnes.",
  lifecycle: "Lifecycle emissions start with manufacturing emissions at year 0, then add cumulative operating emissions from fuel, diesel, or electricity use.",
  operatingEmissions: "Operating emissions are the emissions created while driving the vehicle. They do not include manufacturing emissions.",
  ghg: "GHG means greenhouse gas emissions. The model reports tonnes of CO2e so different gases can be compared using one common unit.",
  scenario: "Scenario lines use the exported sensitivity sheets. Only one driver changes at a time while the other assumptions stay constant.",
};

function currency(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(number).toLocaleString()}`;
}

function compactMoney(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1_000) return `$${Math.round(number / 1_000)}k`;
  return `$${Math.round(number)}`;
}

function tonnes(value) {
  return `${Number(value || 0).toFixed(Math.abs(Number(value || 0)) >= 10 ? 1 : 2)} t`;
}

function annual(value) {
  return `${currency(value)}/yr`;
}

function vehicleType(model) {
  if (model.includes("Retrofit")) return "Retrofit";
  if (model.includes("Lightning")) return "OEM EV";
  if (model.includes("Diesel")) return "Diesel";
  return "ICE";
}

function metricValue(row, key) {
  return Number(row?.[key] ?? 0);
}

function useScenarioData() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/assets/scenario-data.json")
      .then((response) => response.json())
      .then(setData)
      .catch((error) => console.error("Unable to load scenario data", error));
  }, []);
  return data;
}

function GlassCard({ children, className = "", onClick }) {
  return (
    <section className={`glass-card ${className}`} onClick={onClick}>
      {children}
    </section>
  );
}

function HelpTip({ text }) {
  return (
    <span className="help-tip" tabIndex="0" aria-label={text}>
      <Info size={13} />
      <span>{text}</span>
    </span>
  );
}

function SectionTitle({ eyebrow, title, action, help }) {
  return (
    <div className="section-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}{help && <HelpTip text={help} />}</h2>
      </div>
      {action}
    </div>
  );
}

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <GlassCard className="control-card">
      <p className="eyebrow">{label}</p>
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option.value}
            className={value === option.value ? "segment active" : "segment"}
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function MetricCard({ label, value, note, description, icon: Icon = Sparkles, accent = "mint", onClick }) {
  const Tag = onClick ? "button" : "article";
  const props = onClick ? { type: "button", onClick } : { tabIndex: 0 };
  return (
    <Tag className={`metric-card accent-${accent}`} {...props}>
      <span className="metric-icon"><Icon size={18} /></span>
      <span className="metric-label">{label}{description && <HelpTip text={description} />}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </Tag>
  );
}

function Term({ label, help }) {
  return <dt>{label}{help && <HelpTip text={help} />}</dt>;
}

function CrystalArc() {
  return (
    <div className="crystal-arc" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <span key={index} style={{ "--i": index }} />
      ))}
    </div>
  );
}

function VehicleIllustration({ type, family }) {
  const accent = palette[type] || "#ffffff";
  const isElectric = type === "Retrofit" || type === "OEM EV";
  const familyClass = family.toLowerCase().replace("-", "");
  const Wheel = ({ x, y = 244, r = 42 }) => (
    <g className="wheel-set">
      <circle cx={x} cy={y} r={r} fill="rgba(18,24,27,.96)" />
      <circle cx={x} cy={y} r={r * 0.54} fill="rgba(236,240,240,.92)" />
      <circle cx={x} cy={y} r={r * 0.28} fill="rgba(95,105,108,.82)" />
      <path d={`M${x - r * 0.45} ${y} H${x + r * 0.45} M${x} ${y - r * 0.45} V${y + r * 0.45}`} stroke="rgba(255,255,255,.58)" strokeWidth="4" strokeLinecap="round" />
    </g>
  );

  const ElectricMark = ({ x = 610, y = 156 }) => (
    isElectric ? <path d={`M${x} ${y} l-28 42 h26 l-18 39 46-52 h-28 l20-29z`} fill={accent} opacity=".92" /> : null
  );

  const f150 = (
    <g filter="url(#vehicleShadow)">
      <path d="M178 151 H332 C352 151 369 165 375 184 L390 225 H138 L151 176 C155 161 164 151 178 151Z" fill="url(#truckBody)" />
      <path d="M386 145 H592 C620 145 646 164 653 191 L661 225 H382 L373 186 C369 168 374 145 386 145Z" fill="url(#truckBody)" />
      <path d="M196 162 H259 L259 196 H173 L181 174 C184 166 189 162 196 162Z" fill="url(#truckGlass)" />
      <path d="M269 162 H324 C338 162 350 172 354 185 L358 196 H269Z" fill="url(#truckGlass)" />
      <path d="M415 162 H584 C600 162 614 172 619 187 L622 198 H415Z" fill="rgba(255,255,255,.32)" />
      <rect x="430" y="171" width="72" height="18" rx="6" fill={accent} opacity=".78" />
      <rect x="515" y="171" width="72" height="18" rx="6" fill="rgba(255,255,255,.48)" />
      <path d="M142 225 H670 L654 244 H128 Z" fill="rgba(31,37,41,.9)" />
      <Wheel x={226} r={39} />
      <Wheel x={561} r={39} />
      <path d="M396 216 H550" stroke={accent} strokeWidth="6" strokeLinecap="round" opacity=".9" />
      <ElectricMark x={612} y={157} />
    </g>
  );

  const f350 = (
    <g filter="url(#vehicleShadow)">
      <path d="M160 145 H339 C363 145 382 160 389 184 L405 229 H126 L141 173 C145 157 152 145 160 145Z" fill="url(#truckBody)" />
      <path d="M398 135 H628 C658 135 683 157 690 187 L699 229 H396 L385 184 C380 160 386 135 398 135Z" fill="url(#truckBody)" />
      <path d="M179 157 H251 L251 197 H152 L161 171 C164 162 170 157 179 157Z" fill="url(#truckGlass)" />
      <path d="M263 157 H330 C345 157 358 168 362 183 L366 197 H263Z" fill="url(#truckGlass)" />
      <rect x="428" y="153" width="198" height="50" rx="11" fill="rgba(255,255,255,.28)" />
      <rect x="446" y="165" width="76" height="25" rx="7" fill={accent} opacity=".78" />
      <rect x="535" y="165" width="72" height="25" rx="7" fill="rgba(255,255,255,.46)" />
      <path d="M125 229 H710 L694 251 H110 Z" fill="rgba(31,37,41,.92)" />
      <Wheel x={219} r={45} />
      <Wheel x={575} r={45} />
      <circle cx="637" cy="244" r="38" fill="rgba(18,24,27,.92)" />
      <circle cx="637" cy="244" r="20" fill="rgba(236,240,240,.86)" />
      <path d="M410 218 H615" stroke={accent} strokeWidth="7" strokeLinecap="round" opacity=".9" />
      <path d="M118 221 H166" stroke="rgba(255,255,255,.65)" strokeWidth="5" strokeLinecap="round" />
      <ElectricMark x={641} y={151} />
    </g>
  );

  const f450 = (
    <g filter="url(#vehicleShadow)">
      <path d="M143 143 H324 C350 143 369 158 378 184 L394 232 H104 L122 171 C126 155 134 143 143 143Z" fill="url(#truckBody)" />
      <path d="M174 156 H249 L249 198 H136 L148 169 C153 160 160 156 174 156Z" fill="url(#truckGlass)" />
      <path d="M263 156 H321 C337 156 350 167 355 183 L359 198 H263Z" fill="url(#truckGlass)" />
      <path d="M391 142 H684 C696 142 706 152 706 164 V226 H391Z" fill="rgba(242,246,245,.80)" />
      <rect x="414" y="157" width="78" height="54" rx="9" fill={accent} opacity=".65" />
      <rect x="507" y="157" width="76" height="54" rx="9" fill="rgba(255,255,255,.40)" />
      <rect x="598" y="157" width="76" height="54" rx="9" fill="rgba(255,255,255,.32)" />
      <path d="M100 232 H717 L700 255 H84 Z" fill="rgba(31,37,41,.94)" />
      <Wheel x={211} r={47} />
      <Wheel x={567} r={43} />
      <circle cx="630" cy="247" r="39" fill="rgba(18,24,27,.92)" />
      <circle cx="630" cy="247" r="21" fill="rgba(236,240,240,.86)" />
      <path d="M395 221 H682" stroke={accent} strokeWidth="8" strokeLinecap="round" opacity=".9" />
      <path d="M701 166 H727 V207 H701" fill="rgba(255,255,255,.32)" />
      <path d="M690 145 L720 126" stroke="rgba(255,255,255,.58)" strokeWidth="5" strokeLinecap="round" />
      <ElectricMark x={650} y={151} />
    </g>
  );

  const body = family === "F-150" ? f150 : family === "F-350" ? f350 : f450;

  return (
    <svg className={`vehicle-visual vehicle-${familyClass}`} viewBox="0 0 760 320" role="img" aria-label={`${family} ${type} vehicle visual`}>
      <defs>
        <linearGradient id="truckBody" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.97)" />
          <stop offset=".58" stopColor="rgba(226,233,235,.88)" />
          <stop offset="1" stopColor="rgba(164,177,181,.78)" />
        </linearGradient>
        <linearGradient id="truckGlass" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(216,243,255,.95)" />
          <stop offset="1" stopColor="rgba(84,110,122,.76)" />
        </linearGradient>
        <filter id="vehicleShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="24" stdDeviation="20" floodColor="rgba(14,20,22,.34)" />
        </filter>
      </defs>
      <path className="route-line" d="M58 178 L135 178 L166 210 L238 210 L283 181 L360 181" />
      <path className="route-line route-line-soft" d="M86 143 L121 143 L121 171 L158 171" />
      {body}
      <text x="380" y="292" textAnchor="middle" className="vehicle-caption">{family} / {type}</text>
    </svg>
  );
}

function App() {
  const data = useScenarioData();
  const [activeView, setActiveView] = useState("overview");
  const [vehicle, setVehicle] = useState("F-150");
  const [scenario, setScenario] = useState("base");
  const [horizon, setHorizon] = useState(10);
  const [selectedType, setSelectedType] = useState("Retrofit");

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const rows = useMemo(() => {
    if (!data) return [];
    return data.BaseCase_Summary.filter((row) => row.model.startsWith(vehicle)).map((row) => ({
      ...row,
      type: vehicleType(row.model),
    }));
  }, [data, vehicle]);

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.type === selectedType)) {
      setSelectedType("Retrofit");
    }
  }, [rows, selectedType]);

  const comparisons = useMemo(() => {
    if (!data) return [];
    return data.Comparison_Summary.filter((row) => row.retrofit_model.startsWith(vehicle));
  }, [data, vehicle]);

  const retrofit = rows.find((row) => row.type === "Retrofit");
  const selectedRow = rows.find((row) => row.type === selectedType) || retrofit;
  const iceComparison = comparisons.find((row) => row.comparison.includes("ICE"));
  const otherComparison = comparisons.find((row) => !row.comparison.includes("ICE"));
  const selectedComparison = selectedType === "ICE"
    ? iceComparison
    : selectedType === "Retrofit"
      ? iceComparison
      : comparisons.find((row) => row.comparison.includes(selectedType));
  const otherType = otherComparison?.comparison?.replace("Retrofit vs ", "") || "comparison vehicle";
  const horizonCostKey = `total_cost_year_${horizon}`;
  const horizonSavingsKey = `savings_year_${horizon}`;
  const horizonEmissionsKey = `emissions_avoided_year_${horizon}`;
  const horizonLifecycleAvoidedKey = `lifecycle_emissions_avoided_year_${horizon}`;
  const horizonOperatingEmissionsKey = `cumulative_operating_emissions_year_${horizon}`;
  const horizonLifecycleEmissionsKey = `lifecycle_emissions_year_${horizon}`;
  const horizonCumulativeEmissionsKey = horizonLifecycleEmissionsKey;
  const best = rows.reduce((winner, row) => (!winner || row[horizonCostKey] < winner[horizonCostKey] ? row : winner), null);
  const retrofitWins = best?.type === "Retrofit";

  const costChart = useMemo(
    () =>
      rows.map((row) => ({
        type: row.type,
        selected: Math.round(row[horizonCostKey]),
        "3 years": Math.round(row.total_cost_year_3),
        "5 years": Math.round(row.total_cost_year_5),
        "10 years": Math.round(row.total_cost_year_10),
      })),
    [rows, horizonCostKey],
  );

  const operatingCostData = useMemo(
    () => rows.map((row) => ({ type: row.type, annual: Math.round(row.annual_operating_cost) })),
    [rows],
  );

  const emissionsChart = useMemo(
    () =>
      rows.map((row) => ({
        type: row.type,
        manufacturing: Number(metricValue(row, "manufacturing_emissions_tonnes").toFixed(2)),
        operating: Number(metricValue(row, horizonOperatingEmissionsKey).toFixed(2)),
        lifecycle: Number(metricValue(row, horizonLifecycleEmissionsKey).toFixed(2)),
      })),
    [rows, horizonOperatingEmissionsKey, horizonLifecycleEmissionsKey],
  );

  const sensitivityChart = useMemo(() => {
    if (!data || scenario === "base") {
      return [3, 5, 10].map((year) => {
        const item = { label: `${year}Y` };
        rows.forEach((row) => {
          item[row.type] = row[`total_cost_year_${year}`];
        });
        return item;
      });
    }
    const config = SCENARIOS[scenario];
    return [...new Set(data[config.sheet].filter((row) => row.model.startsWith(vehicle) && Number(row.year) === horizon).map((row) => Number(row[config.parameter])))]
      .sort((a, b) => a - b)
      .map((param) => {
        const item = { label: config.formatX(param) };
        data[config.sheet]
          .filter((row) => row.model.startsWith(vehicle) && Number(row.year) === horizon && Number(row[config.parameter]) === param)
          .forEach((row) => {
            item[vehicleType(row.model)] = Number(row[config.metric]);
          });
        return item;
      });
  }, [data, rows, scenario, vehicle, horizon]);

  const recommendations = useMemo(() => {
    const savings = iceComparison?.[horizonSavingsKey] || 0;
    const lifecycleAvoided = iceComparison?.[horizonLifecycleAvoidedKey] || 0;
    const operatingAvoided = iceComparison?.[horizonEmissionsKey] || 0;
    return [
      `${vehicle} retrofit saves ${currency(savings)} versus ICE over ${horizon} years in the exported model.`,
      `${tonnes(lifecycleAvoided)} lifecycle CO2e is avoided versus ICE, including manufacturing plus operating emissions.`,
      `Operating-only avoided emissions are ${tonnes(operatingAvoided)}, so the dashboard now separates use-phase impact from the full lifecycle view.`,
      scenario === "capital"
        ? "Capital cost is the key validation item before presenting a final client recommendation."
        : "Capital, maintenance, battery lifespan, and manufacturing-emissions assumptions should stay clearly marked as validation items.",
    ];
  }, [vehicle, horizon, scenario, iceComparison, horizonSavingsKey, horizonEmissionsKey, horizonLifecycleAvoidedKey]);

  if (!data || !retrofit || !selectedRow) {
    return (
      <div className="loading-screen">
        <div className="loading-card">Loading BlueForce scenario model...</div>
      </div>
    );
  }

  const selectedSavings = selectedType === "Retrofit"
    ? iceComparison?.[horizonSavingsKey]
    : selectedRow[horizonCostKey] - retrofit[horizonCostKey];
  const selectedEmissionsGap = selectedType === "Retrofit"
    ? iceComparison?.[horizonLifecycleAvoidedKey]
    : metricValue(selectedRow, horizonLifecycleEmissionsKey) - metricValue(retrofit, horizonLifecycleEmissionsKey);
  const advantageScore = Math.max(6, Math.min(98, Math.round((retrofit[horizonCostKey] / Math.max(selectedRow[horizonCostKey], retrofit[horizonCostKey])) * 100)));
  const storyCost = selectedType === "Retrofit" ? retrofit[horizonCostKey] : selectedRow[horizonCostKey];
  const storySavings = iceComparison?.[horizonSavingsKey] || 0;
  const storyEmissions = iceComparison?.[horizonLifecycleAvoidedKey] || 0;
  const storySentence = retrofitWins
    ? `${vehicle} retrofit is the lowest-cost option in this ${horizon}-year view, saving ${currency(storySavings)} versus ICE and avoiding ${tonnes(storyEmissions)} lifecycle CO2e.`
    : `${vehicle} retrofit is not the lowest-cost option in this view, so the model highlights which cost driver needs validation.`;
  const storySteps = [
    { label: "1. Start", title: vehicle, detail: `Choose the truck family and compare available pathways.` },
    { label: "2. Pathway", title: selectedRow.type, detail: `Selected model: ${selectedRow.model}.` },
    { label: "3. Cost", title: currency(storyCost), detail: `${horizon}-year cumulative cost from the model output.` },
    { label: "4. Outcome", title: retrofitWins ? "Retrofit leads" : `${best?.type} leads`, detail: retrofitWins ? `${currency(storySavings)} saved vs ICE.` : "Review sponsor assumptions before recommendation." },
  ];

  return (
    <main className="app-background">
      <aside className="nav-rail" aria-label="Dashboard sections">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={activeView === id ? "nav-button active" : "nav-button"}
            type="button"
            title={label}
            data-label={label}
            onClick={() => setActiveView(id)}
          >
            <Icon size={22} />
          </button>
        ))}
      </aside>

      <section className="dashboard-shell">
        <header className="dashboard-header">
          <div className="brand-group">
            <img src="/assets/logos/blueforce-logo.png" alt="BlueForce Energy" />
            <div>
              <p className="eyebrow">BCIT Capstone Forecast</p>
              <h1>Scenario Studio</h1>
            </div>
          </div>
          <div className="header-actions">
            <span>{today}</span>
            <button type="button" className="utility-button" onClick={() => setActiveView("assumptions")}>
              <Info size={18} /> Data notes
            </button>
            <button type="button" className="utility-button" onClick={() => setActiveView("table")}>
              <Table2 size={18} /> Model table
            </button>
            <img src="/assets/logos/bcit-logo.svg" alt="BCIT" />
          </div>
        </header>

        <section className="reference-hero" aria-label="BlueForce retrofit scenario hero">
          <div className="hero-copy">
            <p className="eyebrow">BlueForce Energy x BCIT Capstone</p>
            <h2>Forecast Every Retrofit, Right on Time, for Less Fleet Cost</h2>
            <p>
              Compare purchase cost, operating cost, lifecycle emissions, and scenario risk across F-150, F-350, and F-450 pathways.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={() => setActiveView("scenario")}>Explore scenarios</button>
              <span>{vehicle} / {selectedRow.type} / {horizon} years</span>
            </div>
          </div>

          <div className="hero-object">
            <CrystalArc />
            <VehicleIllustration key={`${vehicle}-${selectedType}-hero`} type={selectedRow.type} family={vehicle} />
            <div className="hero-readout" aria-label="Selected retrofit summary">
              <span><b>{currency(selectedRow[horizonCostKey])}</b>{horizon} year cost</span>
              <span><b>{tonnes(selectedRow[horizonLifecycleEmissionsKey])}</b>lifecycle CO2e</span>
              <span><b>{currency(selectedRow.annual_operating_cost)}</b>annual operating</span>
            </div>
          </div>

          <div className="partner-strip" aria-label="Project partners">
            <span>BlueForce Energy</span>
            <span>BCIT Applied Research</span>
            <span>Lifecycle CO2e</span>
            <span>Scenario Forecast</span>
            <span>Fleet Retrofit</span>
          </div>
        </section>

        <section className="control-grid">
          <SegmentedControl
            label="Vehicle family"
            value={vehicle}
            onChange={(value) => {
              setVehicle(value);
              setActiveView("overview");
            }}
            options={VEHICLES.map((item) => ({ label: item, value: item }))}
          />
          <SegmentedControl
            label="Scenario"
            value={scenario}
            onChange={(value) => {
              setScenario(value);
              setActiveView(value === "base" ? "overview" : "scenario");
            }}
            options={Object.entries(SCENARIOS).map(([value, item]) => ({ label: item.label, value }))}
          />
          <SegmentedControl
            label="Horizon"
            value={String(horizon)}
            onChange={(value) => setHorizon(Number(value))}
            options={HORIZONS.map((item) => ({ label: `${item} years`, value: String(item) }))}
          />
        </section>

        <section className={`view-stack view-${activeView}`}>
          {(activeView === "overview" || activeView === "scenario" || activeView === "vehicles") && (
            <>
              <GlassCard className="story-card">
                <div className="story-intro">
                  <p className="eyebrow">Decision story</p>
                  <h2>Should this fleet retrofit?</h2>
                  <p>{storySentence}</p>
                </div>
                <div className="story-steps">
                  {storySteps.map((step) => (
                    <article className="story-step" key={step.label}>
                      <span>{step.label}</span>
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </article>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="vehicle-showcase">
                <div className="showcase-list">
                  <p className="eyebrow">Select pathway</p>
                  {rows.map((row) => (
                    <button
                      key={row.model}
                      className={selectedType === row.type ? "pathway-card active" : "pathway-card"}
                      type="button"
                      onClick={() => setSelectedType(row.type)}
                    >
                      <span className="vehicle-dot" style={{ "--dot": palette[row.type] }} />
                      <span>
                        <strong>{row.type}</strong>
                        <small>{row.model}</small>
                      </span>
                      <b>{compactMoney(row[horizonCostKey])}</b>
                    </button>
                  ))}
                </div>

                <div className="showcase-stage">
                  <div className="stage-kicker">
                    <span>{vehicle} selected</span>
                    <span>{SCENARIOS[scenario].fullLabel}</span>
                  </div>
                  <h2>{selectedRow.model}</h2>
                  <VehicleIllustration key={`${vehicle}-${selectedType}-stage`} type={selectedRow.type} family={vehicle} />
                  <div className="stage-readout">
                    <div>
                      <p className="eyebrow">{horizon} year cost</p>
                      <strong>{currency(selectedRow[horizonCostKey])}</strong>
                    </div>
                    <div>
                      <p className="eyebrow">Annual op.</p>
                      <strong>{annual(selectedRow.annual_operating_cost)}</strong>
                    </div>
                    <div>
                      <p className="eyebrow">Lifecycle GHG</p>
                      <strong>{tonnes(selectedRow[horizonLifecycleEmissionsKey])}</strong>
                    </div>
                  </div>
                </div>

                <div className="showcase-analytics">
                  <div className="score-ring" style={{ "--score": advantageScore }}>
                    <span>{advantageScore}%</span>
                    <small>Retrofit index</small>
                  </div>
                  <MetricCard label="Purchase price" value={currency(selectedRow.purchase_price)} note="Starting capital" description="Purchase price is the starting capital cost in the exported base dataset." icon={CircleDollarSign} />
                  <MetricCard label={selectedType === "Retrofit" ? "Savings vs ICE" : "Retrofit gap"} value={compactMoney(selectedSavings)} note={`${horizon} year view`} description={explanations.savings} icon={TrendingUp} accent="warm" />
                  <MetricCard label="Lifecycle CO2e difference" value={tonnes(selectedEmissionsGap)} note={selectedType === "Retrofit" ? "avoided vs ICE" : "above retrofit"} description={explanations.emissions} icon={Leaf} />
                </div>
              </GlassCard>

              <GlassCard className="chart-card showcase-chart">
                <SectionTitle eyebrow="Cost Comparison" title={`${vehicle} pathway cost`} action={<span className="tiny-label">Selected horizon cumulative cost</span>} help={explanations.cumulativeCost} />
                <ResponsiveContainer width="100%" height={310}>
                  <BarChart data={costChart} margin={{ top: 22, right: 18, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(75,91,108,0.14)" vertical={false} />
                    <XAxis dataKey="type" stroke="rgba(58,70,86,.74)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(58,70,86,.68)" tickLine={false} axisLine={false} tickFormatter={compactMoney} />
                    <Tooltip content={<GlassTooltip formatter={currency} note={explanations.cumulativeCost} />} />
                    <Bar dataKey="selected" radius={[18, 18, 8, 8]}>
                      {costChart.map((entry) => (
                        <Cell key={entry.type} fill={palette[entry.type] || "#ffffff"} fillOpacity={entry.type === selectedType ? 1 : 0.55} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>

              <GlassCard className="metrics-panel decision-panel">
                <SectionTitle eyebrow="Decision Signals" title="Current selection" />
                <div className="metric-grid">
                  <MetricCard label="Operating cost" value={annual(selectedRow.annual_operating_cost)} note={`${selectedRow.type} annual total`} description={explanations.operatingCost} icon={Gauge} />
                  <MetricCard label="Lifecycle GHG" value={tonnes(selectedRow[horizonLifecycleEmissionsKey])} note={`${horizon} year manufacturing + operating`} description={explanations.lifecycle} icon={Leaf} />
                  <MetricCard label="Manufacturing GHG" value={tonnes(selectedRow.manufacturing_emissions_tonnes)} note="one-time starting point" description={explanations.manufacturing} icon={Zap} />
                  <MetricCard label="Operating GHG" value={tonnes(selectedRow[horizonOperatingEmissionsKey])} note={`${horizon} year driving emissions`} description={explanations.operatingEmissions} icon={Leaf} />
                  <MetricCard label={`Retrofit vs ${otherType}`} value={compactMoney(otherComparison?.[horizonSavingsKey])} note={`${horizon} year savings`} description={explanations.savings} icon={CircleDollarSign} accent="warm" />
                  <MetricCard label="Lowest pathway" value={best?.type} note={`${horizon} year total cost`} description="Compares every available pathway for the selected truck and horizon, then shows the lowest cumulative cost." icon={Sparkles} />
                </div>
              </GlassCard>

              <GlassCard className="scenario-card">
                <SectionTitle eyebrow="Scenario Analysis" title={SCENARIOS[scenario].fullLabel || "Base case"} action={<span className="tiny-label">{SCENARIOS[scenario].description}</span>} help={explanations.scenario} />
                <ResponsiveContainer width="100%" height={290}>
                  <LineChart data={sensitivityChart} margin={{ top: 20, right: 18, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(75,91,108,0.14)" vertical={false} />
                    <XAxis dataKey="label" stroke="rgba(58,70,86,.74)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(58,70,86,.68)" tickLine={false} axisLine={false} tickFormatter={compactMoney} />
                    <Tooltip content={<GlassTooltip formatter={currency} note={SCENARIOS[scenario].description} />} />
                    {["Retrofit", "ICE", "OEM EV", "Diesel"].map((key) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={palette[key]} strokeWidth={key === selectedType ? 5 : 3.2} dot={{ r: key === selectedType ? 6 : 4, strokeWidth: 2 }} activeDot={{ r: 7 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </GlassCard>

              <GlassCard className="breakdown-card">
                <SectionTitle eyebrow="Operating Cost" title="Annual operating total" help={explanations.operatingCost} />
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={operatingCostData} margin={{ top: 18, right: 18, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(75,91,108,0.14)" vertical={false} />
                    <XAxis dataKey="type" stroke="rgba(58,70,86,.64)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(58,70,86,.64)" tickLine={false} axisLine={false} tickFormatter={compactMoney} />
                    <Tooltip content={<GlassTooltip formatter={currency} note={explanations.operatingCost} />} />
                    <Bar dataKey="annual" fill="#5b748f" opacity={0.72} radius={[14, 14, 6, 6]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="data-note">Fuel/electricity vs maintenance split is marked pending until those columns are available in the exported model data.</p>
              </GlassCard>

              <GlassCard className="recommendation-panel">
                <SectionTitle eyebrow="Recommendation" title="Client-facing takeaways" />
                <ol className="recommendations">
                  {recommendations.map((item) => <li key={item}>{item}</li>)}
                </ol>
              </GlassCard>
            </>
          )}

          {activeView === "emissions" && (
            <>
              <GlassCard className="chart-card wide">
                <SectionTitle eyebrow="Emissions Panel" title="Lifecycle emissions breakdown" help={explanations.lifecycle} />
                <ResponsiveContainer width="100%" height={330}>
                  <BarChart data={emissionsChart} margin={{ top: 20, right: 18, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(75,91,108,0.14)" vertical={false} />
                    <XAxis dataKey="type" stroke="rgba(58,70,86,.64)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(58,70,86,.64)" tickLine={false} axisLine={false} tickFormatter={tonnes} />
                    <Tooltip content={<GlassTooltip formatter={tonnes} note="Lifecycle emissions add manufacturing emissions to cumulative operating emissions for the selected horizon." />} />
                    <Bar dataKey="manufacturing" stackId="lifecycle" radius={[0, 0, 8, 8]} fill="#b9d0ff" name="Manufacturing" />
                    <Bar dataKey="operating" stackId="lifecycle" radius={[12, 12, 0, 0]} fill="#dff8ef" name={`${horizon} year operating`} />
                    <Bar dataKey="lifecycle" fill="transparent" name="Lifecycle total" />
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>
              <GlassCard className="recommendation-panel">
                <SectionTitle eyebrow="Lifecycle CO2e Avoided" title={tonnes(iceComparison?.[horizonLifecycleAvoidedKey])} />
                <p className="panel-copy">Retrofit is now evaluated with manufacturing emissions as the starting point, then operating emissions are added through the selected horizon.</p>
              </GlassCard>
            </>
          )}

          {activeView === "assumptions" && (
            <>
              <GlassCard className="assumption-panel">
                <SectionTitle eyebrow="Data Status" title="Confirmed inputs" />
                <StatusList items={["Vehicle purchase prices in current dataset", "Annual operating cost totals from exported model", "Manufacturing emissions estimates from updated dataset", "Operating and lifecycle emissions from exported model", "3, 5, and 10 year scenario outputs"]} />
              </GlassCard>
              <GlassCard className="assumption-panel">
                <SectionTitle eyebrow="Pending Validation" title="Sponsor questions" />
                <StatusList items={["Confirm F-350 retrofit price", "Confirm fuel/electricity and maintenance split if client wants a detailed operating breakdown", "Confirm retrofit maintenance costs", "Confirm battery lifespan and replacement risk", "Validate manufacturing-emissions estimates with sponsor if used in final claims"]} muted />
              </GlassCard>
            </>
          )}

          {activeView === "table" && (
            <GlassCard className="table-panel">
              <SectionTitle eyebrow="Model Output" title="3, 5, and 10 year totals" help="This is the raw summarized model output displayed in a readable table." />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Type</th>
                      <th>Annual Op.</th>
                      <th>3 Year Cost</th>
                      <th>5 Year Cost</th>
                      <th>10 Year Cost</th>
                      <th>Operating GHG</th>
                      <th>Manufacturing GHG</th>
                      <th>Lifecycle GHG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.model}>
                        <td>{row.model}</td>
                        <td>{row.type}</td>
                        <td>{annual(row.annual_operating_cost)}</td>
                        <td>{currency(row.total_cost_year_3)}</td>
                        <td>{currency(row.total_cost_year_5)}</td>
                        <td>{currency(row.total_cost_year_10)}</td>
                        <td>{tonnes(row[horizonOperatingEmissionsKey])}</td>
                        <td>{tonnes(row.manufacturing_emissions_tonnes)}</td>
                        <td>{tonnes(row[horizonLifecycleEmissionsKey])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </section>
      </section>
    </main>
  );
}

function GlassTooltip({ active, payload, label, formatter, note }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <p key={item.dataKey}>
          <span style={{ background: item.color || item.fill }} />
          {item.name || item.dataKey}: {formatter(item.value)}
        </p>
      ))}
      {note && <small>{note}</small>}
    </div>
  );
}

function StatusList({ items, muted = false }) {
  return (
    <ul className={muted ? "status-list muted-list" : "status-list"}>
      {items.map((item) => (
        <li key={item}>
          <Info size={16} />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default App;
