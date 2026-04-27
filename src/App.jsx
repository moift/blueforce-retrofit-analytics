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
  emissions: "CO2e avoided equals the comparison vehicle cumulative emissions minus retrofit cumulative emissions for the selected horizon.",
  ghg: "GHG means greenhouse gas emissions. The model stores annual emissions in tonnes of CO2e, then multiplies through 3, 5, or 10 years for cumulative emissions.",
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

function App() {
  const data = useScenarioData();
  const [activeView, setActiveView] = useState("overview");
  const [vehicle, setVehicle] = useState("F-150");
  const [scenario, setScenario] = useState("base");
  const [horizon, setHorizon] = useState(10);
  const [expandedCard, setExpandedCard] = useState("hero");

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

  const comparisons = useMemo(() => {
    if (!data) return [];
    return data.Comparison_Summary.filter((row) => row.retrofit_model.startsWith(vehicle));
  }, [data, vehicle]);

  const retrofit = rows.find((row) => row.type === "Retrofit");
  const iceComparison = comparisons.find((row) => row.comparison.includes("ICE"));
  const otherComparison = comparisons.find((row) => !row.comparison.includes("ICE"));
  const otherType = otherComparison?.comparison?.replace("Retrofit vs ", "") || "comparison vehicle";
  const horizonCostKey = `total_cost_year_${horizon}`;
  const horizonSavingsKey = `savings_year_${horizon}`;
  const horizonEmissionsKey = `emissions_avoided_year_${horizon}`;
  const horizonCumulativeEmissionsKey = `cumulative_emissions_year_${horizon}`;
  const best = rows.reduce((winner, row) => (!winner || row[horizonCostKey] < winner[horizonCostKey] ? row : winner), null);
  const retrofitWins = best?.type === "Retrofit";

  const costChart = useMemo(
    () =>
      rows.map((row) => ({
        type: row.type,
        "3 years": Math.round(row.total_cost_year_3),
        "5 years": Math.round(row.total_cost_year_5),
        "10 years": Math.round(row.total_cost_year_10),
      })),
    [rows],
  );

  const operatingCostData = useMemo(
    () => rows.map((row) => ({ type: row.type, annual: Math.round(row.annual_operating_cost) })),
    [rows],
  );

  const emissionsChart = useMemo(
    () =>
      rows.map((row) => ({
        type: row.type,
        annual: Number(row.annual_emissions_tonnes.toFixed(2)),
        cumulative: Number(row[horizonCumulativeEmissionsKey].toFixed(2)),
      })),
    [rows, horizonCumulativeEmissionsKey],
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
    const emissionAvoided = iceComparison?.[horizonEmissionsKey] || 0;
    return [
      `${vehicle} retrofit saves ${currency(savings)} versus ICE over ${horizon} years in the exported model.`,
      `${tonnes(emissionAvoided)} CO2e is avoided versus ICE over the selected horizon.`,
      scenario === "capital"
        ? "Capital cost is the key validation item before presenting a final client recommendation."
        : "Capital, maintenance, and battery assumptions should stay clearly marked as validation items.",
    ];
  }, [vehicle, horizon, scenario, iceComparison, horizonSavingsKey, horizonEmissionsKey]);

  if (!data || !retrofit) {
    return (
      <div className="loading-screen">
        <div className="loading-card">Loading BlueForce scenario model...</div>
      </div>
    );
  }

  const insightLine = retrofitWins
    ? `${vehicle} retrofit is currently the lowest-cost pathway over ${horizon} years.`
    : `${vehicle} retrofit remains competitive, but ${best?.type} is lowest in this selected view.`;

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

        <section className="control-grid">
          <SegmentedControl
            label="Vehicle"
            value={vehicle}
            onChange={setVehicle}
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
          {(activeView === "overview" || activeView === "scenario") && (
            <>
              <GlassCard className={`hero-card ${expandedCard === "hero" ? "expanded" : ""}`} onClick={() => setExpandedCard(expandedCard === "hero" ? "" : "hero")}>
                <div className="hero-content">
                  <p className="eyebrow">Scenario Summary</p>
                  <h2>Retrofit Advantage</h2>
                  <p>{insightLine}</p>
                  <div className={retrofitWins ? "status-pill good" : "status-pill watch"}>
                    <Sparkles size={17} />
                    {retrofitWins ? "Strong retrofit case" : "Review scenario drivers"}
                  </div>
                  {expandedCard === "hero" && (
                    <div className="hero-detail">
                      <strong>Model rule</strong>
                      <span>Cost = purchase price + annual operating cost x selected years.</span>
                    </div>
                  )}
                </div>
                <div className="hero-stats">
                  <MetricCard label="Selected vehicle" value={vehicle} note={SCENARIOS[scenario].fullLabel || SCENARIOS[scenario].label} description="Changes every chart and metric to the selected truck family." icon={Car} />
                  <MetricCard label="Selected horizon" value={`${horizon} years`} note="Forecast period" description="Uses the exported 3, 5, or 10 year model columns." icon={TrendingUp} />
                  <MetricCard label="Retrofit savings vs ICE" value={compactMoney(iceComparison?.[horizonSavingsKey])} note="Cumulative savings" description={explanations.savings} icon={CircleDollarSign} accent="warm" />
                </div>
              </GlassCard>

              <GlassCard className="chart-card">
                <SectionTitle eyebrow="Cost Comparison" title={rows.map((row) => row.type).join(" vs ")} action={<span className="tiny-label">Selected horizon cumulative cost</span>} help={explanations.cumulativeCost} />
                <ResponsiveContainer width="100%" height={310}>
                  <BarChart data={costChart} margin={{ top: 22, right: 18, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.16)" vertical={false} />
                    <XAxis dataKey="type" stroke="rgba(255,255,255,.84)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,.78)" tickLine={false} axisLine={false} tickFormatter={compactMoney} />
                    <Tooltip content={<GlassTooltip formatter={currency} note={explanations.cumulativeCost} />} />
                    <Bar dataKey={`${horizon} years`} radius={[18, 18, 8, 8]}>
                      {costChart.map((entry) => (
                        <Cell key={entry.type} fill={palette[entry.type] || "#ffffff"} fillOpacity={0.92} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>

              <GlassCard className="metrics-panel">
                <SectionTitle eyebrow="Decision Signals" title="Current selection" />
                <div className="metric-grid">
                  <MetricCard label="Operating cost" value={annual(retrofit.annual_operating_cost)} note="Retrofit annual total" description={explanations.operatingCost} icon={Gauge} />
                  <MetricCard label="CO2e avoided" value={tonnes(iceComparison?.[horizonEmissionsKey])} note="vs ICE" description={explanations.emissions} icon={Leaf} />
                  <MetricCard label={`Savings vs ${otherType}`} value={compactMoney(otherComparison?.[horizonSavingsKey])} note={`${horizon} year total`} description={explanations.savings} icon={CircleDollarSign} accent="warm" />
                  <MetricCard label="Lowest pathway" value={best?.type} note={`${horizon} year total cost`} description="Compares every available pathway for the selected truck and horizon, then shows the lowest cumulative cost." icon={Sparkles} />
                </div>
              </GlassCard>

              <GlassCard className="scenario-card">
                <SectionTitle eyebrow="Scenario Analysis" title={SCENARIOS[scenario].fullLabel || "Base case"} action={<span className="tiny-label">{SCENARIOS[scenario].description}</span>} help={explanations.scenario} />
                <ResponsiveContainer width="100%" height={290}>
                  <LineChart data={sensitivityChart} margin={{ top: 20, right: 18, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.16)" vertical={false} />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,.84)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,.78)" tickLine={false} axisLine={false} tickFormatter={compactMoney} />
                    <Tooltip content={<GlassTooltip formatter={currency} note={SCENARIOS[scenario].description} />} />
                    {["Retrofit", "ICE", "OEM EV", "Diesel"].map((key) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={palette[key]} strokeWidth={3.5} dot={{ r: 5, strokeWidth: 2 }} activeDot={{ r: 7 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </GlassCard>
            </>
          )}

          {(activeView === "vehicles" || activeView === "overview") && (
            <GlassCard className="vehicle-panel">
              <SectionTitle eyebrow="Vehicle Insights" title={`${vehicle} pathway comparison`} help="Click a vehicle card to reveal a short interpretation. All values come from BaseCase_Summary." />
              <div className="vehicle-grid">
                {rows.map((row) => (
                  <button key={row.model} className={expandedCard === row.model ? "vehicle-card selected" : "vehicle-card"} type="button" onClick={() => setExpandedCard(expandedCard === row.model ? "" : row.model)}>
                    <span className="vehicle-dot" style={{ "--dot": palette[row.type] }} />
                    <h3>{row.type}</h3>
                    <p>{row.model}</p>
                    <dl>
                      <div><Term label="Purchase" help="Starting capital cost in CAD from the base dataset." /><dd>{currency(row.purchase_price)}</dd></div>
                      <div><Term label="Annual op." help={explanations.operatingCost} /><dd>{annual(row.annual_operating_cost)}</dd></div>
                      <div><Term label={`${horizon} year cost`} help={explanations.cumulativeCost} /><dd>{currency(row[horizonCostKey])}</dd></div>
                      <div><Term label={`${horizon} year GHG`} help={explanations.ghg} /><dd>{tonnes(row[horizonCumulativeEmissionsKey])}</dd></div>
                    </dl>
                    {expandedCard === row.model && (
                      <p className="vehicle-note">{row.type === "Retrofit" ? "Retrofit combines lower upfront cost with low operating emissions in this model." : `${row.type} is included as the comparison baseline for cost and emissions.`}</p>
                    )}
                  </button>
                ))}
              </div>
            </GlassCard>
          )}

          {activeView === "emissions" && (
            <>
              <GlassCard className="chart-card wide">
                <SectionTitle eyebrow="Emissions Panel" title="Annual and cumulative emissions" help={explanations.ghg} />
                <ResponsiveContainer width="100%" height={330}>
                  <BarChart data={emissionsChart} margin={{ top: 20, right: 18, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.13)" vertical={false} />
                    <XAxis dataKey="type" stroke="rgba(255,255,255,.72)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,.72)" tickLine={false} axisLine={false} tickFormatter={tonnes} />
                    <Tooltip content={<GlassTooltip formatter={tonnes} note="Annual emissions are tonnes CO2e per year. Cumulative emissions follow the selected horizon." />} />
                    <Bar dataKey="annual" radius={[12, 12, 0, 0]} fill="#dff8ef" name="Annual" />
                    <Bar dataKey="cumulative" radius={[12, 12, 0, 0]} fill="#ffffff" opacity={0.65} name={`${horizon} year cumulative`} />
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>
              <GlassCard className="recommendation-panel">
                <SectionTitle eyebrow="CO2e Avoided" title={tonnes(iceComparison?.[horizonEmissionsKey])} />
                <p className="panel-copy">Retrofit keeps operating emissions dramatically lower than ICE and diesel pathways in the current model.</p>
              </GlassCard>
            </>
          )}

          {activeView === "assumptions" && (
            <>
              <GlassCard className="assumption-panel">
                <SectionTitle eyebrow="Data Status" title="Confirmed inputs" />
                <StatusList items={["Vehicle purchase prices in current dataset", "Annual operating cost totals from exported model", "Annual and cumulative emissions from exported model", "3, 5, and 10 year scenario outputs"]} />
              </GlassCard>
              <GlassCard className="assumption-panel">
                <SectionTitle eyebrow="Pending Validation" title="Sponsor questions" />
                <StatusList items={["Confirm F-350 retrofit price", "Confirm fuel/electricity and maintenance split if client wants a detailed operating breakdown", "Confirm retrofit maintenance costs", "Confirm battery lifespan, replacement risk, and manufacturing emissions"]} muted />
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
                      <th>Selected GHG</th>
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
                        <td>{tonnes(row[horizonCumulativeEmissionsKey])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {(activeView === "overview" || activeView === "scenario") && (
            <>
              <GlassCard className="breakdown-card">
                <SectionTitle eyebrow="Operating Cost" title="Annual operating total" help={explanations.operatingCost} />
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={operatingCostData} margin={{ top: 18, right: 18, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.12)" vertical={false} />
                    <XAxis dataKey="type" stroke="rgba(255,255,255,.72)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,.72)" tickLine={false} axisLine={false} tickFormatter={compactMoney} />
                    <Tooltip content={<GlassTooltip formatter={currency} note={explanations.operatingCost} />} />
                    <Bar dataKey="annual" fill="#ffffff" opacity={0.76} radius={[14, 14, 6, 6]} />
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
