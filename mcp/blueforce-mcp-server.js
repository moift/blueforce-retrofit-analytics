#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(ROOT, "public", "assets", "scenario-data.json");

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function vehicleType(model = "") {
  if (model.includes("Retrofit")) return "Retrofit";
  if (model.includes("Lightning")) return "OEM EV";
  if (model.includes("Diesel")) return "Diesel";
  if (model.includes("ICE")) return "ICE";
  return "Other";
}

function costAt(row, year) {
  return Number(row.purchase_price || 0) + Number(row.annual_operating_cost || 0) * Number(year || 0);
}

function lifecycleEmissionsAt(row, year) {
  return Number(row.manufacturing_emissions_tonnes || 0) + Number(row.annual_operating_emissions_tonnes || 0) * Number(year || 0);
}

function familyRows(data, vehicle) {
  return (data.BaseCase_Summary || [])
    .filter((row) => String(row.model || "").startsWith(vehicle))
    .map((row) => ({ ...row, type: vehicleType(row.model) }));
}

function normalizeVehicle(input) {
  const value = String(input || "F-150").toUpperCase().replace(/\s+/g, "");
  if (value.includes("350")) return "F-350";
  if (value.includes("450")) return "F-450";
  return "F-150";
}

function normalizeHorizon(input) {
  const n = Number(input ?? 10);
  if (!Number.isFinite(n)) return 10;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function currency(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

function tonnes(value) {
  return `${Number(value || 0).toFixed(1)} tonnes CO2e`;
}

const EV_POLICY_SOURCES = [
  {
    name: "BC Go Electric rebates and programs",
    jurisdiction: "British Columbia",
    url: "https://goelectricbc.gov.bc.ca/rebates-and-programs/",
    use: "Customer-facing rebate and program eligibility research.",
  },
  {
    name: "BC Low Carbon Fuel Standard electricity",
    jurisdiction: "British Columbia",
    url: "https://www2.gov.bc.ca/gov/content/industry/electricity-alternative-energy/transportation-energies/renewable-low-carbon-fuels/electricity",
    use: "Carbon-credit methodology and ownership assumptions.",
  },
  {
    name: "Natural Resources Canada charging and EV resources",
    jurisdiction: "Canada",
    url: "https://natural-resources.canada.ca/energy-efficiency/transportation-alternative-fuels/electric-charging-alternative-fuelling-stationslocator-map",
    use: "Charging infrastructure context and station validation.",
  },
  {
    name: "Clean Fuel Regulations",
    jurisdiction: "Canada",
    url: "https://www.canada.ca/en/environment-climate-change/services/managing-pollution/energy-production/fuel-regulations/clean-fuel-regulations.html",
    use: "Federal clean-fuel credit context. Treat credit price as market-based, not fixed.",
  },
];

function asText(obj) {
  return { content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] };
}

function toolSchemas() {
  return [
    {
      name: "get_vehicle_summary",
      description: "Return executive summary metrics for one vehicle family and forecast horizon.",
      inputSchema: {
        type: "object",
        properties: {
          vehicle: { type: "string", enum: ["F-150", "F-350", "F-450"] },
          horizon: { type: "number", minimum: 0, maximum: 10 },
        },
      },
    },
    {
      name: "compare_pathways",
      description: "Compare ICE/diesel, OEM EV, and BlueForce retrofit pathways for a vehicle family.",
      inputSchema: {
        type: "object",
        properties: {
          vehicle: { type: "string", enum: ["F-150", "F-350", "F-450"] },
          horizon: { type: "number", minimum: 0, maximum: 10 },
        },
      },
    },
    {
      name: "get_carbon_credit_summary",
      description: "Return the separate carbon-credit model summary. Carbon credits are not included in lifecycle cost.",
      inputSchema: {
        type: "object",
        properties: {
          vehicle: { type: "string", enum: ["F-150", "F-350", "F-450"] },
          kmPerYear: { type: "number", enum: [15000, 20000, 30000] },
        },
      },
    },
    {
      name: "get_maintenance_methodology",
      description: "Explain how maintenance cost is estimated in the model.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_ev_policy_sources",
      description: "Return official BC and federal policy/source links used by the app.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_model_checks",
      description: "Return exported model quality checks from the scenario workbook.",
      inputSchema: { type: "object", properties: {} },
    },
  ];
}

function callTool(name, args = {}) {
  const data = loadData();
  const vehicle = normalizeVehicle(args.vehicle);
  const horizon = normalizeHorizon(args.horizon);

  if (name === "get_vehicle_summary") {
    const rows = familyRows(data, vehicle);
    const ranked = rows.map((row) => ({
      model: row.model,
      pathway: row.type,
      totalCost: costAt(row, horizon),
      lifecycleEmissions: lifecycleEmissionsAt(row, horizon),
      annualOperatingCost: Number(row.annual_operating_cost || 0),
      maintenanceStatus: "Included in annual operating cost; separate maintenance field is not present in BaseCase_Summary.",
    })).sort((a, b) => a.totalCost - b.totalCost);
    const retrofit = ranked.find((row) => row.pathway === "Retrofit");
    const ice = ranked.find((row) => row.pathway === "ICE") || ranked.find((row) => row.pathway === "Diesel");
    return asText({
      vehicle,
      horizon,
      bestOption: ranked[0]?.pathway,
      bestOptionModel: ranked[0]?.model,
      retrofitSavingsVsIce: retrofit && ice ? currency(ice.totalCost - retrofit.totalCost) : "not available",
      retrofitLifecycleEmissionsAvoidedVsIce: retrofit && ice ? tonnes(ice.lifecycleEmissions - retrofit.lifecycleEmissions) : "not available",
      note: "Uses static exported scenario-data.json. Incentives default to $0 unless validated separately.",
      ranked,
    });
  }

  if (name === "compare_pathways") {
    return asText({
      vehicle,
      horizon,
      pathways: familyRows(data, vehicle).map((row) => ({
        model: row.model,
        pathway: row.type,
        purchasePriceCAD: Number(row.purchase_price || 0),
        annualOperatingCostCAD: Number(row.annual_operating_cost || 0),
        maintenanceStatus: "Included in annual operating cost; separate maintenance field is not present in BaseCase_Summary.",
        cumulativeCostCAD: costAt(row, horizon),
        manufacturingEmissionsTonnes: Number(row.manufacturing_emissions_tonnes || 0),
        lifecycleEmissionsTonnes: lifecycleEmissionsAt(row, horizon),
      })),
    });
  }

  if (name === "get_carbon_credit_summary") {
    const kmPerYear = Number(args.kmPerYear || 20000);
    const rows = (data.Carbon_Credit_Revenue || [])
      .filter((row) => String(row.model || "").startsWith(vehicle) && Number(row.km_per_year) === kmPerYear && Number(row.year) === 10)
      .map((row) => ({
        model: row.model,
        kmPerYear,
        year: Number(row.year),
        accumulatedCreditValueCAD: Number(row.cumulative_credit_value_cad || 0),
      }));
    return asText({
      vehicle,
      kmPerYear,
      scope: "Separate carbon-credit revenue only. It does not reduce lifecycle cost in the core model unless a user explicitly runs a sensitivity.",
      rows,
    });
  }

  if (name === "get_maintenance_methodology") {
    return asText({
      formula: "Annual maintenance cost = annual kilometres × maintenance cost per kilometre.",
      sourceFields: ["maintenance_per_km", "annual_maintenance_cost_cad", "annual_km"],
      importantNote: "EVs still have maintenance: tires, brakes, inspections, fluids/coolant, suspension, and general service. They usually have less powertrain maintenance than ICE vehicles, but not zero maintenance.",
      validationNeeded: "Sponsor should validate retrofit maintenance split, battery service assumptions, and heavy-duty duty-cycle assumptions.",
    });
  }

  if (name === "get_ev_policy_sources") return asText(EV_POLICY_SOURCES);

  if (name === "get_model_checks") return asText(data.Model_Checks || []);

  throw new Error(`Unknown tool: ${name}`);
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(request) {
  const { id, method, params } = request;
  try {
    if (method === "initialize") {
      return send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "blueforce-retrofit-mcp", version: "0.1.0" },
        },
      });
    }
    if (method === "tools/list") {
      return send({ jsonrpc: "2.0", id, result: { tools: toolSchemas() } });
    }
    if (method === "tools/call") {
      const result = callTool(params?.name, params?.arguments || {});
      return send({ jsonrpc: "2.0", id, result });
    }
    if (method?.startsWith("notifications/")) return;
    return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  } catch (error) {
    return send({ jsonrpc: "2.0", id, error: { code: -32000, message: error.message } });
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    handle(JSON.parse(line));
  } catch (error) {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
});
