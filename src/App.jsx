import React from "react";
import { motion } from "motion/react";
import * as THREE from "three";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart as BarChartIcon,
  Car,
  Database,
  CircleDollarSign,
  Gauge,
  GitBranch,
  Home,
  Info,
  Leaf,
  Linkedin,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  MousePointerClick,
  Phone,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Smartphone,
  Tablet,
  Volume2,
  VolumeX,
  Table2,
  TrendingUp,
  Users,
  X,
  Zap,
  Search,
  SendHorizontal,
  MessageCircle,
  Sun,
  Moon,
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
  carbon: {
    label: "Carbon credits",
    fullLabel: "BC LCFS Carbon Credits",
    sheet: "Carbon_Credit_Revenue",
    parameter: "km_per_year",
    metric: "cumulative_credit_value_cad",
    description: "Shows accumulated BC LCFS credit revenue for eligible electric models while the base credit price stays fixed.",
    formatX: (value) => `${Number(value).toLocaleString()} km/year`,
  },
};

const VEHICLES = ["F-150", "F-350", "F-450"];
const OWNERSHIP_MODES = [
  { id: "service", label: "Service", donorCostFraction: 0, donorEmissions: false, help: "Retrofit service only. No donor ICE purchase price or manufacturing emissions are added." },
  { id: "used", label: "Used car", donorCostFraction: 0.5, donorEmissions: true, help: "Adds 50% of the matching ICE purchase price and 100% of matching ICE manufacturing emissions to retrofit." },
  { id: "full", label: "New car", donorCostFraction: 1, donorEmissions: true, help: "Adds a selected percentage of the matching ICE purchase price and 100% of matching ICE manufacturing emissions to retrofit." },
];
const DEFAULT_TUNER_INDEX = {
  base: 0,
  km: 0,
  fleet: 0,
  fuel: 1,
  maintenance: 0,
  carbon: 0,
};

const FOCUS_OPTIONS = [
  { value: "cost", label: "Cost", help: "Total cost and breakeven story." },
  { value: "savings", label: "Savings", help: "Retrofit advantage versus ICE or EV." },
  { value: "emissions", label: "Emissions", help: "Lifecycle CO2e and avoided emissions." },
];

const TUNER_OPTIONS = [
  { value: "base", label: "Base", help: "Default exported forecast." },
  { value: "km", label: "Kilometres", help: "Drag annual driving distance." },
  { value: "fleet", label: "Fleet", help: "Drag number of vehicles." },
  { value: "fuel", label: "Fuel", help: "Drag fuel and electricity price pressure." },
  { value: "maintenance", label: "Maintenance", help: "Drag service-cost pressure." },
  { value: "carbon", label: "Carbon credits", help: "Drag annual kilometres and show credit revenue only." },
];
const palette = {
  Retrofit: "#2563EB",
  ICE: "#6B7280",
  "OEM EV": "#10B981",
  Diesel: "#F59E0B",
};

const linePalette = {
  Retrofit: "#2563EB",
  ICE: "#6B7280",
  "OEM EV": "#10B981",
  Diesel: "#F59E0B",
};

const CONNECTOR_GLOSSARY = {
  "Level 2": "Common AC charging. Slower than DC fast charging; useful for workplace, overnight, and longer parking stops.",
  CCS: "Combined Charging System. A common DC fast-charging connector used by many newer EVs in North America.",
  CHAdeMO: "Older DC fast-charging connector. Still appears at some stations, but is less common on newer North American EVs.",
  J1772: "Standard Level 2 plug used by many non-Tesla EVs for AC charging.",
  "NACS/Tesla": "Tesla-style North American Charging Standard connector. Adoption is growing across newer EV networks.",
};

const scenarioLineColors = ["#111827", "#5E6671", "#9CA3AF", "#C7CBD1", "#E5E7EB"];

const navItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "simulator", label: "Fleet Simulator", icon: SlidersHorizontal },
  { id: "comparison", label: "Vehicle Comparison", icon: Car },
  { id: "scenario", label: "Scenario Analysis", icon: BarChartIcon },
  { id: "breakeven", label: "Breakeven", icon: TrendingUp },
  { id: "carbon", label: "Carbon Impact", icon: Leaf },
  { id: "policy", label: "EV Policy", icon: ShieldCheck },
  { id: "ev-network", label: "EV Network", icon: MapPin },
  { id: "data-map", label: "Data Map", icon: GitBranch },
];

const EV_POLICY_LINKS = [
  {
    jurisdiction: "BC",
    title: "Go Electric BC rebates and programs",
    summary: "Provincial hub for EV rebates, charger support, fleet programs, Indigenous programs, and Go Electric resources.",
    whyItMatters: "Best source for BC customer-facing rebate options and program eligibility checks.",
    url: "https://goelectricbc.gov.bc.ca/rebates-and-programs/",
    tag: "Rebates",
  },
  {
    jurisdiction: "BC",
    title: "Go Electric home and workplace charging rebates",
    summary: "Official BC page for Level 2 charger rebates for homes, multi-unit buildings, workplaces, and Indigenous communities.",
    whyItMatters: "Useful when explaining charging readiness and infrastructure support to fleet customers.",
    url: "https://goelectricbc.gov.bc.ca/rebates-and-programs/for-individuals/save-on-home-and-workplace-charging/",
    tag: "Charging",
  },
  {
    jurisdiction: "BC",
    title: "BC Low Carbon Fuel Standard",
    summary: "Official BC LCFS page covering low-carbon fuel credits, credit market information, bulletins, and requirements.",
    whyItMatters: "Relevant for the app’s carbon-credit discussion, but credit ownership must be validated with the client.",
    url: "https://www2.gov.bc.ca/gov/content?id=7A5A56783287434B85C4B33656B35627",
    tag: "Credits",
  },
  {
    jurisdiction: "Canada",
    title: "Federal zero-emission vehicle incentives",
    summary: "Canada.ca overview of federal ZEV incentives, including light-duty affordability support and medium/heavy-duty programs.",
    whyItMatters: "Useful for checking whether a vehicle pathway may qualify for federal purchase support.",
    url: "https://www.canada.ca/en/services/transport/zero-emission-vehicles/zero-emission-vehicles-incentives.html",
    tag: "Federal",
  },
  {
    jurisdiction: "Canada",
    title: "iZEV program status reference",
    summary: "Transport Canada’s light-duty iZEV page notes that the previous iZEV program has ended and is kept for reference.",
    whyItMatters: "Prevents outdated incentive assumptions from entering the retrofit business case.",
    url: "https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles/light-duty-zero-emission-vehicles",
    tag: "Status",
  },
  {
    jurisdiction: "Canada",
    title: "Zero-emission vehicles information hub",
    summary: "Federal information hub for ZEV incentives, infrastructure funding, commercial vehicles, policy, and regulations.",
    whyItMatters: "Good starting point for federal policy context and updates useful to customers and funders.",
    url: "https://www.canada.ca/en/services/transport/zero-emission-vehicles.html",
    tag: "Policy",
  },
];

const DEVICE_PREVIEW_MODES = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "phone", label: "Phone", icon: Smartphone },
];

const VISUAL_THEME_OPTIONS = [
  { id: "light", label: "Day", icon: Sun },
  { id: "night", label: "Night", icon: Moon },
];

const DATA_MAP_NODES = [
  { id: "blueforce", label: "BlueForce inputs", shortLabel: "BlueForce", type: "source", category: "Client", summary: "Retrofit price ranges, service assumptions, prototype platform notes, and sponsor questions.", feeds: ["Capital cost", "Retrofit assumptions", "Validation list"] },
  { id: "full-dataset", label: "Full Dataset", shortLabel: "Full dataset", type: "source", category: "Team dataset", summary: "Combined vehicle table used by the Python model and dashboard outputs.", feeds: ["Vehicle rows", "Fuel consumption", "Maintenance", "Manufacturing emissions"] },
  { id: "nrcan", label: "NRCan fuel ratings", shortLabel: "NRCan", type: "source", category: "Public data", summary: "Fuel and energy consumption reference data for comparable ICE, diesel, and EV pathways.", feeds: ["L/100km", "kWh/100km", "Fuel cost logic"] },
  { id: "bc-hydro", label: "BC Hydro rates", shortLabel: "BC Hydro", type: "source", category: "Utility data", summary: "Electricity rate assumptions used to estimate EV and retrofit charging cost.", feeds: ["$/kWh", "Electricity multiplier", "Operating cost"] },
  { id: "fuel-history", label: "Fuel price history", shortLabel: "Fuel prices", type: "source", category: "Market data", summary: "Gasoline and diesel price assumptions used for base case and sensitivity analysis.", feeds: ["$/L", "Fuel multiplier", "Scenario analysis"] },
  { id: "maintenance", label: "Maintenance benchmarks", shortLabel: "Maintenance", type: "source", category: "Benchmarks", summary: "Cost-per-kilometre maintenance estimates for ICE, diesel, EV, and retrofit pathways.", feeds: ["CAD/km", "Annual maintenance", "Lifecycle cost"] },
  { id: "emissions", label: "Emissions factors", shortLabel: "Emissions", type: "source", category: "Environmental", summary: "Operating and manufacturing emissions assumptions used for lifecycle CO2e calculations.", feeds: ["kg CO2e/L", "kg CO2e/kWh", "Manufacturing CO2e"] },
  { id: "lcfs", label: "Carbon credit assumptions", shortLabel: "Carbon credits", type: "source", category: "Funding", summary: "BC credit value assumptions shown separately from lifecycle cost until ownership is validated.", feeds: ["Credit value", "kWh use", "Funding signal"] },
  { id: "ev-network-source", label: "BC charging network", shortLabel: "Chargers", type: "source", category: "Infrastructure", summary: "EV station coverage and connector data used for the infrastructure discussion view.", feeds: ["Station count", "Connectors", "Fleet readiness"] },
  { id: "python", label: "Python forecasting model", type: "process", category: "Model", summary: "Transforms source data into cost, emissions, breakeven, scenario, and carbon outputs.", feeds: ["3/5/10 year forecast", "Scenario tables", "Breakeven outputs"] },
  { id: "dashboard", label: "Decision platform", type: "output", category: "App", summary: "Client-facing interface for exploring vehicle pathways, assumptions, infrastructure, and recommendations.", feeds: ["Executive KPIs", "Charts", "Explainers", "Client story"] },
];

const DATA_MAP_LAYERS = [
  { id: "inputs", label: "Data inputs", angle: -110 },
  { id: "model", label: "Forecast model", angle: -20 },
  { id: "outputs", label: "Client outputs", angle: 70 },
  { id: "validation", label: "Validation", angle: 160 },
];

const GREATER_VANCOUVER_STATIONS = [
  {
    id: "vancouver-city-hall",
    name: "Vancouver City Hall charging hub",
    city: "Vancouver",
    address: "453 W 12th Ave, Vancouver",
    lat: 49.2609,
    lng: -123.1139,
    operator: "Public / municipal",
    plugs: 8,
    fastChargers: 2,
    level2: 6,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public parkade / civic area",
    fleetUse: "Useful central Vancouver top-up point for municipal and service fleets.",
  },
  {
    id: "pacific-centre",
    name: "CF Pacific Centre parkade",
    city: "Vancouver",
    address: "701 W Georgia St, Vancouver",
    lat: 49.2832,
    lng: -123.1190,
    operator: "Retail / parkade network",
    plugs: 12,
    fastChargers: 0,
    level2: 12,
    connectorTypes: ["Level 2", "J1772"],
    access: "Public parkade",
    fleetUse: "Downtown destination charging; better for dwell time than fast turnaround.",
  },
  {
    id: "science-world",
    name: "False Creek / Science World chargers",
    city: "Vancouver",
    address: "1455 Quebec St, Vancouver",
    lat: 49.2734,
    lng: -123.1039,
    operator: "Public charging network",
    plugs: 6,
    fastChargers: 1,
    level2: 5,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public destination area",
    fleetUse: "Good urban corridor coverage near downtown and Main Street routes.",
  },
  {
    id: "bcit-burnaby",
    name: "BCIT Burnaby campus chargers",
    city: "Burnaby",
    address: "3700 Willingdon Ave, Burnaby",
    lat: 49.2506,
    lng: -123.0014,
    operator: "Institutional / campus",
    plugs: 10,
    fastChargers: 0,
    level2: 10,
    connectorTypes: ["Level 2", "J1772"],
    access: "Campus parking areas",
    fleetUse: "Strong education/campus demonstration site for fleet-electrification planning.",
  },
  {
    id: "metrotown",
    name: "Metropolis at Metrotown charging cluster",
    city: "Burnaby",
    address: "4700 Kingsway, Burnaby",
    lat: 49.2276,
    lng: -123.0076,
    operator: "Retail / charging network",
    plugs: 18,
    fastChargers: 2,
    level2: 16,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public mall parking",
    fleetUse: "Large central Burnaby charging cluster near high-traffic commercial routes.",
  },
  {
    id: "brentwood",
    name: "The Amazing Brentwood chargers",
    city: "Burnaby",
    address: "4567 Lougheed Hwy, Burnaby",
    lat: 49.2677,
    lng: -123.0008,
    operator: "Retail / parkade network",
    plugs: 14,
    fastChargers: 1,
    level2: 13,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public parkade",
    fleetUse: "Supports North Burnaby routes and Lougheed corridor operations.",
  },
  {
    id: "richmond-oval",
    name: "Richmond Olympic Oval chargers",
    city: "Richmond",
    address: "6111 River Rd, Richmond",
    lat: 49.1749,
    lng: -123.1510,
    operator: "Municipal / public network",
    plugs: 8,
    fastChargers: 1,
    level2: 7,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public civic parking",
    fleetUse: "Useful Richmond civic node near airport and river-road fleet corridors.",
  },
  {
    id: "mcarthurglen",
    name: "McArthurGlen outlet charging cluster",
    city: "Richmond",
    address: "1000-7899 Templeton Station Rd, Richmond",
    lat: 49.1971,
    lng: -123.1417,
    operator: "Retail / charging network",
    plugs: 12,
    fastChargers: 2,
    level2: 10,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public retail parking",
    fleetUse: "Airport-adjacent charging node for shuttle, service, and delivery fleets.",
  },
  {
    id: "surrey-central",
    name: "Surrey Central charging hub",
    city: "Surrey",
    address: "102 Ave & City Pkwy, Surrey",
    lat: 49.1897,
    lng: -122.8486,
    operator: "Public / transit-area network",
    plugs: 10,
    fastChargers: 2,
    level2: 8,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public urban centre",
    fleetUse: "Strong South Fraser coverage for high-kilometre regional fleet routes.",
  },
  {
    id: "guildford",
    name: "Guildford Town Centre chargers",
    city: "Surrey",
    address: "10355 152 St, Surrey",
    lat: 49.1894,
    lng: -122.8047,
    operator: "Retail / charging network",
    plugs: 14,
    fastChargers: 1,
    level2: 13,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public mall parking",
    fleetUse: "Good east Surrey charging coverage near Highway 1 access.",
  },
  {
    id: "lonsdale-quay",
    name: "Lonsdale Quay charging area",
    city: "North Vancouver",
    address: "123 Carrie Cates Ct, North Vancouver",
    lat: 49.3102,
    lng: -123.0838,
    operator: "Public / municipal network",
    plugs: 6,
    fastChargers: 1,
    level2: 5,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public waterfront area",
    fleetUse: "North Shore charging point near ferry, service, and municipal routes.",
  },
  {
    id: "park-royal",
    name: "Park Royal charging cluster",
    city: "West Vancouver",
    address: "2002 Park Royal S, West Vancouver",
    lat: 49.3251,
    lng: -123.1403,
    operator: "Retail / charging network",
    plugs: 12,
    fastChargers: 1,
    level2: 11,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public mall parking",
    fleetUse: "West Vancouver node for service fleets crossing the Lions Gate corridor.",
  },
  {
    id: "coquitlam-centre",
    name: "Coquitlam Centre chargers",
    city: "Coquitlam",
    address: "2929 Barnet Hwy, Coquitlam",
    lat: 49.2795,
    lng: -122.7984,
    operator: "Retail / charging network",
    plugs: 16,
    fastChargers: 2,
    level2: 14,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public mall parking",
    fleetUse: "Tri-Cities charging anchor near Barnet and Lougheed corridors.",
  },
  {
    id: "new-west-anvil",
    name: "New Westminster civic charging area",
    city: "New Westminster",
    address: "777 Columbia St, New Westminster",
    lat: 49.2015,
    lng: -122.9126,
    operator: "Municipal / public network",
    plugs: 6,
    fastChargers: 1,
    level2: 5,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public civic / downtown parking",
    fleetUse: "Central point for fleet routes between Burnaby, Surrey, and Coquitlam.",
  },
  {
    id: "tsawwassen-mills",
    name: "Tsawwassen Mills charging cluster",
    city: "Delta",
    address: "5000 Canoe Pass Way, Delta",
    lat: 49.0397,
    lng: -123.0854,
    operator: "Retail / highway charging network",
    plugs: 18,
    fastChargers: 4,
    level2: 14,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO", "NACS/Tesla"],
    access: "Public mall parking",
    fleetUse: "Strategic South Delta and ferry-corridor charging point.",
  },
  {
    id: "langley-events",
    name: "Langley Events Centre chargers",
    city: "Langley",
    address: "7888 200 St, Langley",
    lat: 49.1452,
    lng: -122.6668,
    operator: "Public / destination network",
    plugs: 8,
    fastChargers: 1,
    level2: 7,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public event parking",
    fleetUse: "Useful eastern Metro Vancouver range-extension point.",
  },
  {
    id: "port-moody-city-hall",
    name: "Port Moody civic chargers",
    city: "Port Moody",
    address: "100 Newport Dr, Port Moody",
    lat: 49.2833,
    lng: -122.8313,
    operator: "Municipal / public network",
    plugs: 6,
    fastChargers: 0,
    level2: 6,
    connectorTypes: ["Level 2", "J1772"],
    access: "Public civic parking",
    fleetUse: "Supports Tri-Cities service routes and lower-speed charging needs.",
  },
  {
    id: "victoria-downtown",
    name: "Downtown Victoria charging cluster",
    city: "Victoria",
    address: "Douglas St & Pandora Ave, Victoria",
    lat: 48.4284,
    lng: -123.3656,
    operator: "Municipal / public network",
    plugs: 18,
    fastChargers: 3,
    level2: 15,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public downtown parking",
    fleetUse: "Vancouver Island anchor for municipal, service, and government fleet routes.",
  },
  {
    id: "nanaimo-terminal",
    name: "Nanaimo ferry corridor chargers",
    city: "Nanaimo",
    address: "Departure Bay / downtown Nanaimo",
    lat: 49.1659,
    lng: -123.9401,
    operator: "Highway / public network",
    plugs: 14,
    fastChargers: 4,
    level2: 10,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO", "NACS/Tesla"],
    access: "Public corridor charging",
    fleetUse: "Useful island logistics node between ferry traffic, Nanaimo, and central-island routes.",
  },
  {
    id: "kelowna-downtown",
    name: "Kelowna urban charging hub",
    city: "Kelowna",
    address: "Queensway / downtown Kelowna",
    lat: 49.8880,
    lng: -119.4960,
    operator: "Public / municipal network",
    plugs: 20,
    fastChargers: 4,
    level2: 16,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public city parking",
    fleetUse: "Okanagan anchor for regional service, tourism, delivery, and municipal fleets.",
  },
  {
    id: "kamloops-highway",
    name: "Kamloops highway charging hub",
    city: "Kamloops",
    address: "Trans-Canada Hwy / Aberdeen area, Kamloops",
    lat: 50.6745,
    lng: -120.3273,
    operator: "Highway / public network",
    plugs: 18,
    fastChargers: 6,
    level2: 12,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO", "NACS/Tesla"],
    access: "Public highway charging",
    fleetUse: "Interior corridor hub for longer-distance service routes and fleet range confidence.",
  },
  {
    id: "whistler-village",
    name: "Whistler Village charging cluster",
    city: "Whistler",
    address: "Village Gate Blvd, Whistler",
    lat: 50.1163,
    lng: -122.9574,
    operator: "Destination / public network",
    plugs: 16,
    fastChargers: 3,
    level2: 13,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public destination parking",
    fleetUse: "Sea-to-Sky destination node for shuttle, tourism, and municipal fleet planning.",
  },
  {
    id: "prince-george",
    name: "Prince George regional charging hub",
    city: "Prince George",
    address: "15th Ave / downtown Prince George",
    lat: 53.9171,
    lng: -122.7497,
    operator: "Public / highway network",
    plugs: 16,
    fastChargers: 5,
    level2: 11,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public regional charging",
    fleetUse: "Northern BC anchor for regional fleet coverage and longer-distance public-sector routes.",
  },
  {
    id: "revelstoke-transcanada",
    name: "Revelstoke Trans-Canada charging node",
    city: "Revelstoke",
    address: "Victoria Rd / Trans-Canada Hwy, Revelstoke",
    lat: 50.9981,
    lng: -118.1957,
    operator: "Highway / public network",
    plugs: 12,
    fastChargers: 4,
    level2: 8,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public highway charging",
    fleetUse: "Mountain corridor support for Trans-Canada service routes and range-risk planning.",
  },
  {
    id: "cranbrook-highway",
    name: "Cranbrook Kootenay charging hub",
    city: "Cranbrook",
    address: "Victoria Ave N / Highway 95A, Cranbrook",
    lat: 49.5120,
    lng: -115.7694,
    operator: "Highway / public network",
    plugs: 10,
    fastChargers: 3,
    level2: 7,
    connectorTypes: ["Level 2", "CCS", "CHAdeMO"],
    access: "Public highway charging",
    fleetUse: "Kootenay coverage point for regional fleets operating outside the Lower Mainland.",
  },
  {
    id: "terrace-regional",
    name: "Terrace northwest charging node",
    city: "Terrace",
    address: "Lakelse Ave, Terrace",
    lat: 54.5182,
    lng: -128.6032,
    operator: "Public / regional network",
    plugs: 8,
    fastChargers: 2,
    level2: 6,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public regional charging",
    fleetUse: "Northwest BC planning node for regional service, utility, and municipal operations.",
  },
  {
    id: "fort-st-john",
    name: "Fort St. John charging node",
    city: "Fort St. John",
    address: "100 St / Alaska Hwy, Fort St. John",
    lat: 56.2524,
    lng: -120.8464,
    operator: "Public / regional network",
    plugs: 8,
    fastChargers: 2,
    level2: 6,
    connectorTypes: ["Level 2", "CCS"],
    access: "Public regional charging",
    fleetUse: "Northeast BC coverage signal for resource, service, and public-sector fleet planning.",
  },
];

const EV_NETWORK_SOURCE_NOTE = "BC-wide infrastructure planning view. Locations and charger counts are representative planning clusters and should be validated against NRCan or Open Charge Map before final client recommendations. Real-time charger availability is not included.";
const FEDERAL_CFR_REFERENCE_PRICE_CAD_PER_TONNE = 350;
const FEDERAL_CFR_NOTE = "Federal CFR credit value is market-based. This app uses CAD $350/t CO2e only as an unconfirmed sensitivity from the client discussion, not as a guaranteed credit price.";
const PROJECT_TEAM = [
  {
    name: "Saad",
    role: "App Development & Data Analyst",
    focus: "Application architecture, interface design, data integration, and client-facing product direction.",
    tone: "male",
    photo: "/assets/team-saad.jpeg",
    photoPosition: "center center",
    photoScale: 1,
    featured: true,
  },
  {
    name: "Ross",
    role: "Data Modelling & Research Analyst",
    focus: "Scenario modelling, forecasting logic, financial framing, and research validation.",
    tone: "male-alt",
    photo: "/assets/team-ross.jpeg",
    photoPosition: "center center",
    photoScale: 1,
  },
  {
    name: "Ocean",
    role: "QA, Data Review & Documentation",
    focus: "Quality assurance, dataset verification, documentation control, and delivery support.",
    tone: "female",
    photo: "/assets/team-ocean.jpeg",
    photoPosition: "center center",
    photoScale: 1,
  },
];

const PROJECT_NETWORK_GROUPS = [
  {
    id: "students",
    title: "Core team",
    members: PROJECT_TEAM,
  },
  {
    id: "blueforce",
    title: "BlueForce",
    compact: true,
    members: [
      { name: "Nataliia Vladyka" },
      { name: "Vandad" },
    ],
  },
  {
    id: "bcit",
    title: "BCIT",
    compact: true,
    members: [
      { name: "Carrie" },
      { name: "Alan Stewart" },
      { name: "Clay Howey" },
    ],
  },
  {
    id: "faculty",
    title: "Capstone faculty",
    compact: true,
    members: [
      { name: "Arman Roland" },
      { name: "Linda Butterfield" },
    ],
  },
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
  scenario: "Scenario charts now use year on the x-axis. Each line is one sensitivity case, so only one driver changes at a time while the other assumptions stay constant.",
};

function currency(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  const absolute = Math.abs(number);
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(2)}M`;
  return `${sign}$${Math.round(absolute).toLocaleString()}`;
}

function compactMoney(value) {
  const number = Number(value || 0);
  const sign = number < 0 ? "-" : "";
  const absolute = Math.abs(number);
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}$${Math.round(absolute / 1_000)}k`;
  return `${sign}$${Math.round(absolute)}`;
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

function scenarioSeriesLabel(parameter, value, config) {
  const number = Number(value);
  if (parameter === "km_per_year") return `${Math.round(number).toLocaleString()} km/year`;
  if (parameter === "fleet_size") return `${Math.round(number)} vehicles`;
  if (parameter === "fuel_multiplier") return `${number.toFixed(2).replace(/\.00$/, "")}x fuel`;
  if (parameter === "inflation_rate") return `${Math.round(number * 100)}% maintenance`;
  return config?.formatX ? config.formatX(number) : String(value);
}

function scenarioHasZeroBaseline(scenario) {
  return ["km", "fleet", "carbon"].includes(scenario);
}

function isCarbonEligibleRow(row) {
  return row?.type === "Retrofit" || row?.type === "OEM EV";
}

function scenarioZeroBaselineValue(scenario, row) {
  if (scenario === "fleet") return 0;
  if (scenario === "carbon") return isCarbonEligibleRow(row) ? 0 : null;
  if (scenario === "km") return Number(row?.purchase_price || 0);
  return null;
}

function scenarioValuesFor(data, scenario) {
  const config = SCENARIOS[scenario];
  if (!data || !config?.sheet || !config.parameter) return [];
  const exportedValues = [...new Set((data[config.sheet] || []).map((row) => Number(row[config.parameter])))]
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  return scenarioHasZeroBaseline(scenario) ? [0, ...exportedValues.filter((value) => value !== 0)] : exportedValues;
}

function metricValue(row, key) {
  return Number(row?.[key] ?? 0);
}

function applyForecastFields(row) {
  const purchasePrice = Number(row.purchase_price || 0);
  const annualOperatingCost = Number(row.annual_operating_cost || 0);
  const annualOperatingEmissions = Number(row.annual_operating_emissions_tonnes ?? row.annual_emissions_tonnes ?? 0);
  const manufacturingEmissions = Number(row.manufacturing_emissions_tonnes || 0);
  return {
    ...row,
    purchase_price: purchasePrice,
    annual_operating_cost: annualOperatingCost,
    annual_operating_emissions_tonnes: annualOperatingEmissions,
    annual_emissions_tonnes: annualOperatingEmissions,
    manufacturing_emissions_tonnes: manufacturingEmissions,
  };
}

function retrofitOwnershipAdjustment(row, familyRows, ownershipMode, newCarPercent = 100) {
  if (row.type !== "Retrofit") return row;
  const mode = OWNERSHIP_MODES.find((item) => item.id === ownershipMode) || OWNERSHIP_MODES[0];
  const donorIce = familyRows.find((candidate) => candidate.type === "ICE") || familyRows.find((candidate) => candidate.type === "Diesel");
  const donorFraction = mode.id === "full" ? Math.max(0.1, Math.min(1, Number(newCarPercent || 100) / 100)) : mode.donorCostFraction;
  const donorPurchase = Number(donorIce?.purchase_price || 0) * donorFraction;
  const donorManufacturing = mode.donorEmissions ? Number(donorIce?.manufacturing_emissions_tonnes || 0) : 0;
  return {
    ...row,
    purchase_price: Number(row.purchase_price || 0) + donorPurchase,
    base_retrofit_purchase_price: Number(row.purchase_price || 0),
    donor_ice_purchase_price_added: donorPurchase,
    donor_ice_purchase_price_fraction: donorFraction,
    donor_ice_manufacturing_emissions_added_tonnes: donorManufacturing,
    manufacturing_emissions_tonnes: Number(row.manufacturing_emissions_tonnes || 0) + donorManufacturing,
    ownership_mode: mode.id,
    new_car_price_percent: mode.id === "full" ? Number(newCarPercent || 100) : null,
  };
}

function costAt(row, year) {
  const horizonYear = Math.max(0, Number(year || 0));
  return Number(row?.purchase_price || 0) + Number(row?.annual_operating_cost || 0) * horizonYear;
}

function operatingEmissionsAt(row, year) {
  const horizonYear = Math.max(0, Number(year || 0));
  return Number(row?.annual_operating_emissions_tonnes ?? row?.annual_emissions_tonnes ?? 0) * horizonYear;
}

function lifecycleEmissionsAt(row, year) {
  return Number(row?.manufacturing_emissions_tonnes || 0) + operatingEmissionsAt(row, year);
}

function scenarioOwnershipCostAdjustment(row, scenario, parameterValue) {
  if (row?.type !== "Retrofit" || scenario === "carbon") return 0;
  const donorCost = Number(row.donor_ice_purchase_price_added || 0);
  if (!donorCost) return 0;
  if (scenario === "fleet") return donorCost * Number(parameterValue || 0);
  return donorCost;
}

function firstYearWhere(leftRow, rightRow, valueGetter) {
  if (!leftRow || !rightRow) return null;
  for (let year = 0; year <= 10; year += 1) {
    if (valueGetter(leftRow, year) <= valueGetter(rightRow, year)) return year;
  }
  return null;
}

function formatBreakevenYear(year) {
  if (year == null) return ">10 years";
  return `Year ${year}`;
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

function ConnectorTag({ type }) {
  const text = CONNECTOR_GLOSSARY[type] || "Connector type used at this station.";
  return (
    <span className="connector-tag" tabIndex="0" aria-label={`${type}: ${text}`}>
      {type}
      <span className="connector-tip">{text}</span>
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

function StoryChapter({ number, title, copy }) {
  return (
    <section className="story-chapter">
      <span>{number}</span>
      <div>
        <p className="eyebrow">Story step</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </section>
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

function RadioCard({ label, options, value, onChange }) {
  return (
    <GlassCard className="radio-card">
      <p className="eyebrow">{label}</p>
      <div className="radio-row">
        {options.map((option) => (
          <label key={option.value} className={value === option.value ? "radio-choice active" : "radio-choice"}>
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="radio-dot" />
            <span>
              <strong>{option.label}</strong>
              <small>{option.help}</small>
            </span>
          </label>
        ))}
      </div>
    </GlassCard>
  );
}

function ScenarioTuner({
  scenario,
  onScenarioChange,
  values,
  valueIndex,
  onValueIndexChange,
  activeValueLabel,
  focusMode,
  vehicle,
  selectedType,
  horizon,
  previewCost,
  previewSavings,
  previewBest,
  previewCostLabel,
  previewSavingsLabel,
  previewBestLabel,
  onReset,
  onOpenDetails,
}) {
  const disabled = scenario === "base" || values.length === 0;
  return (
    <GlassCard className="scenario-tuner">
      <div className="tuner-mode">
        <div className="tuner-heading">
          <span className="soft-icon"><SlidersHorizontal size={18} /></span>
          <div>
            <p className="eyebrow">Scenario tuner</p>
            <h2>Stress-test one driver.</h2>
          </div>
        </div>
        <div className="tuner-radio-grid" role="radiogroup" aria-label="Scenario driver">
          {TUNER_OPTIONS.map((option) => (
            <label key={option.value} className={scenario === option.value ? "tuner-radio active" : "tuner-radio"}>
              <input
                type="radio"
                name="scenario-driver"
                checked={scenario === option.value}
                onChange={() => onScenarioChange(option.value)}
              />
              <span className="radio-dot" />
              <span>
                <strong>{option.label}</strong>
                <small>{option.help}</small>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="tuner-slider-panel">
        <div className="slider-title">
          <div>
            <p className="eyebrow">Drag control</p>
            <h3>{activeValueLabel}</h3>
          </div>
          <button type="button" className="ghost-action" onClick={onReset}><RotateCcw size={15} />Reset</button>
        </div>
        <input
          className="scenario-slider"
          type="range"
          min="0"
          max={Math.max(values.length - 1, 0)}
          step="1"
          value={disabled ? 0 : valueIndex}
          disabled={disabled}
          onChange={(event) => onValueIndexChange(Number(event.target.value))}
          aria-label="Scenario assumption slider"
        />
        <div className="slider-scale">
          <span>{disabled ? "Base model" : activeValueLabel}</span>
          <span>{disabled ? "No sensitivity selected" : `${values.length} exported cases`}</span>
        </div>
        <p className="tuner-note">
          Starts at zero. Then uses exported model cases.
        </p>
      </div>

      <div className="tuner-preview">
        <p className="eyebrow">Live readout</p>
        <h3>{vehicle} / {selectedType}</h3>
        <div className="preview-grid">
          <span><b>{currency(previewCost)}</b>{previewCostLabel || `${horizon} year cost`}</span>
          <span><b>{compactMoney(previewSavings)}</b>{previewSavingsLabel || "retrofit vs ICE"}</span>
          <span><b>{previewBest}</b>{previewBestLabel || "lowest pathway"}</span>
        </div>
        <button type="button" className="detail-button" onClick={onOpenDetails}>
          <MousePointerClick size={16} /> Explain
        </button>
        <small>Focus: {FOCUS_OPTIONS.find((item) => item.value === focusMode)?.label}</small>
      </div>
    </GlassCard>
  );
}

function InsightPanel({ detail, onClose }) {
  if (!detail) return null;
  return (
    <GlassCard className="insight-panel">
      <button className="drawer-close" type="button" onClick={onClose} aria-label="Close detail panel">
        <X size={16} />
      </button>
      <p className="eyebrow">More context</p>
      <h2>{detail.title}</h2>
      <p>{detail.body}</p>
      <dl className="insight-facts">
        {detail.facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </GlassCard>
  );
}


function LayerCard({ icon: Icon, eyebrow, title, value, copy, onClick }) {
  return (
    <button type="button" className="layer-card" onClick={onClick}>
      <span className="layer-icon"><Icon size={20} /></span>
      <span className="eyebrow">{eyebrow}</span>
      <strong>{title}</strong>
      <b>{value}</b>
      <small>{copy}</small>
      <span className="poke-hint">Click to open layer</span>
    </button>
  );
}

function TeamAvatar({ member }) {
  if (member.photo) {
    return (
      <div className="team-face-orb has-photo" aria-hidden="true">
        <img
          src={member.photo}
          alt=""
          style={{
            objectPosition: member.photoPosition || "center 26%",
            transform: `scale(${member.photoScale || 1})`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="team-face-orb" aria-hidden="true">
      <span className="face-hair" />
      <span className="face-head"><i /><i /></span>
      <span className="face-smile" />
    </div>
  );
}

function LayerDrawer({ detail, onClose }) {
  useEffect(() => {
    if (!detail) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detail, onClose]);

  if (!detail) return null;

  return createPortal(
    <div className="layer-backdrop" role="presentation" onClick={onClose}>
      <aside className={detail.networkGroups ? "layer-drawer team-drawer" : "layer-drawer"} role="dialog" aria-modal="true" aria-label={detail.title} onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close layer-close" type="button" onClick={onClose} aria-label="Close detail layer">
          <X size={18} />
        </button>
        <p className="eyebrow">Project details</p>
        <h2>{detail.title}</h2>
        {detail.body && <p>{detail.body}</p>}
        {detail.networkGroups && (
          <div className="team-network-sections">
            {detail.networkGroups.map((group) => (
              <section key={group.id} className={`team-network-section ${group.compact ? "compact" : ""}`}>
                <span>{group.title}</span>
                {group.compact ? (
                  <div className="team-support-line" aria-label={`${group.title} support`}>
                    <strong>{group.title}</strong>
                    <span>{group.members.map((member) => member.name).join(", ")}</span>
                  </div>
                ) : (
                  <div className="team-showcase-grid">
                    {group.members.map((member) => (
                      <article key={`${group.id}-${member.name}`} className={`team-avatar-card ${member.featured ? "featured" : ""} tone-${member.tone || "neutral"}`}>
                        <TeamAvatar member={member} />
                        <strong>{member.name}</strong>
                        <small>{member.role}</small>
                        {member.focus && <p>{member.focus}</p>}
                        <div className="team-contact-row" aria-label={`${member.name} contact placeholders`}>
                          <span title="LinkedIn placeholder"><Linkedin size={13} /></span>
                          <span title="Email placeholder"><Mail size={13} /></span>
                          <span title="Phone placeholder"><Phone size={13} /></span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
        {detail.team && !detail.networkGroups && (
          <div className="team-showcase-grid">
            {detail.team.map((member) => (
              <article key={member.name} className={`team-avatar-card tone-${member.tone}`}>
                <TeamAvatar member={member} />
                <strong>{member.name}</strong>
                <small>{member.role}</small>
                {member.focus && <p>{member.focus}</p>}
                <div className="team-contact-row" aria-label={`${member.name} contact placeholders`}>
                  <span title="LinkedIn placeholder"><Linkedin size={13} /></span>
                  <span title="Email placeholder"><Mail size={13} /></span>
                  <span title="Phone placeholder"><Phone size={13} /></span>
                </div>
              </article>
            ))}
          </div>
        )}
        {detail.facts?.length > 0 && (
          <dl className="insight-facts layer-facts">
            {detail.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {detail.takeaway && (
          <div className="layer-takeaway">
            <Sparkles size={18} />
            <span>{detail.takeaway}</span>
          </div>
        )}
      </aside>
    </div>,
    document.body,
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
  const accent = palette[type] || "#111827";
  const isElectric = type === "Retrofit" || type === "OEM EV";
  const isRetrofit = type === "Retrofit";
  const isOemEv = type === "OEM EV";
  const familyClass = family.toLowerCase().replace("-", "");
  const id = `${familyClass}-${type.toLowerCase().replace(/\s+/g, "-")}`;

  const Wheel = ({ x, y = 242, r = 42, dual = false }) => (
    <g className="wheel-set">
      {dual && <circle cx={x + r * 0.7} cy={y} r={r * 0.9} fill="rgba(18,24,27,.82)" />}
      <circle cx={x} cy={y} r={r} fill="rgba(18,24,27,.96)" />
      <circle cx={x} cy={y} r={r * 0.62} fill="rgba(236,240,240,.94)" />
      <circle cx={x} cy={y} r={r * 0.34} fill="rgba(84,93,99,.84)" />
      <path d={`M${x - r * 0.46} ${y} H${x + r * 0.46} M${x} ${y - r * 0.46} V${y + r * 0.46}`} stroke="rgba(255,255,255,.72)" strokeWidth="4" strokeLinecap="round" />
    </g>
  );

  const Lighting = ({ x = 606, y = 150 }) => (
    isElectric ? <path d={`M${x} ${y} l-30 45 h27 l-18 42 49-57 h-30 l22-30z`} fill={accent} opacity={isRetrofit ? ".95" : ".58"} /> : null
  );

  const Headlights = ({ x = 625, y = 196 }) => (
    <>
      <rect x={x} y={y} width="32" height="10" rx="5" fill={isElectric ? accent : "#F8FAFC"} opacity={isElectric ? ".78" : ".9"} />
      <rect x={x - 498} y={y + 16} width="28" height="8" rx="4" fill="#F8FAFC" opacity=".75" />
    </>
  );

  const DetailStripe = ({ x = 388, y = 217, width = 182 }) => (
    <path d={`M${x} ${y} H${x + width}`} stroke={isElectric ? accent : "rgba(55,65,81,.42)"} strokeWidth={isElectric ? 7 : 5} strokeLinecap="round" opacity={isElectric ? ".82" : ".45"} />
  );

  const f150 = (
    <g filter={`url(#${id}-shadow)`}>
      <path d="M146 223 H674 L654 247 H128 Z" fill="rgba(24,28,32,.92)" />
      <path d="M178 151 H331 C354 151 371 165 379 187 L393 225 H137 L151 176 C155 161 164 151 178 151Z" fill={`url(#${id}-body)`} />
      <path d="M390 146 H588 C622 146 648 166 656 197 L663 225 H383 L374 187 C369 168 374 146 390 146Z" fill={`url(#${id}-body)`} />
      <path d="M195 162 H260 V198 H172 L181 174 C184 166 189 162 195 162Z" fill={`url(#${id}-glass)`} />
      <path d="M270 162 H323 C340 162 352 173 357 188 L360 198 H270Z" fill={`url(#${id}-glass)`} />
      <path d="M420 162 H586 C605 162 620 174 624 194 L626 201 H420Z" fill="rgba(255,255,255,.38)" />
      <rect x="428" y="171" width="72" height="20" rx="6" fill={isRetrofit ? accent : "rgba(107,114,128,.38)"} opacity=".78" />
      <rect x="514" y="171" width="70" height="20" rx="6" fill="rgba(255,255,255,.52)" />
      <path d="M395 148 L374 186" stroke="rgba(17,24,39,.22)" strokeWidth="4" />
      <Headlights x={624} y={195} />
      <Wheel x={226} r={39} />
      <Wheel x={562} r={39} />
      <DetailStripe x={402} y={216} width={146} />
      <Lighting x={612} y={153} />
    </g>
  );

  const f350 = (
    <g filter={`url(#${id}-shadow)`}>
      <path d="M122 228 H711 L694 253 H106 Z" fill="rgba(24,28,32,.94)" />
      <path d="M158 145 H340 C367 145 386 161 394 187 L407 229 H124 L141 172 C145 156 151 145 158 145Z" fill={`url(#${id}-body)`} />
      <path d="M401 136 H626 C660 136 686 158 694 192 L702 229 H395 L385 185 C380 160 386 136 401 136Z" fill={`url(#${id}-body)`} />
      <path d="M177 157 H252 V199 H151 L161 171 C164 162 170 157 177 157Z" fill={`url(#${id}-glass)`} />
      <path d="M264 157 H330 C347 157 360 168 365 185 L368 199 H264Z" fill={`url(#${id}-glass)`} />
      <rect x="428" y="154" width="196" height="50" rx="12" fill="rgba(255,255,255,.32)" />
      <rect x="446" y="166" width="76" height="25" rx="7" fill={isRetrofit ? accent : "rgba(107,114,128,.36)"} opacity=".78" />
      <rect x="536" y="166" width="72" height="25" rx="7" fill="rgba(255,255,255,.50)" />
      <path d="M407 138 L385 185" stroke="rgba(17,24,39,.24)" strokeWidth="5" />
      <path d="M120 221 H168" stroke="rgba(255,255,255,.65)" strokeWidth="5" strokeLinecap="round" />
      <Headlights x={656} y={198} />
      <Wheel x={220} r={45} />
      <Wheel x={576} r={44} dual />
      <DetailStripe x={416} y={219} width={196} />
      <Lighting x={642} y={151} />
    </g>
  );

  const f450 = (
    <g filter={`url(#${id}-shadow)`}>
      <path d="M96 232 H724 L704 258 H80 Z" fill="rgba(24,28,32,.95)" />
      <path d="M143 142 H324 C352 142 372 158 381 186 L396 232 H104 L122 170 C126 154 134 142 143 142Z" fill={`url(#${id}-body)`} />
      <path d="M174 156 H250 V199 H136 L148 169 C153 160 160 156 174 156Z" fill={`url(#${id}-glass)`} />
      <path d="M263 156 H322 C339 156 353 168 358 185 L361 199 H263Z" fill={`url(#${id}-glass)`} />
      <path d="M394 139 H684 C701 139 713 151 713 168 V228 H394Z" fill="rgba(245,247,248,.88)" />
      <rect x="418" y="156" width="82" height="56" rx="10" fill={isRetrofit ? accent : "rgba(107,114,128,.33)"} opacity=".68" />
      <rect x="516" y="156" width="78" height="56" rx="10" fill="rgba(255,255,255,.48)" />
      <rect x="610" y="156" width="76" height="56" rx="10" fill="rgba(255,255,255,.38)" />
      <path d="M395 141 L382 188" stroke="rgba(17,24,39,.24)" strokeWidth="5" />
      <path d="M707 166 H731 V207 H707" fill="rgba(255,255,255,.44)" />
      <path d="M690 145 L721 126" stroke="rgba(255,255,255,.64)" strokeWidth="5" strokeLinecap="round" />
      <Headlights x={682} y={200} />
      <Wheel x={212} r={47} />
      <Wheel x={568} r={43} dual />
      <DetailStripe x={402} y={221} width={282} />
      <Lighting x={653} y={151} />
    </g>
  );

  const body = family === "F-150" ? f150 : family === "F-350" ? f350 : f450;

  return (
    <svg className={`vehicle-visual vehicle-${familyClass} vehicle-${type.toLowerCase().replace(/\s+/g, "-")}`} viewBox="0 0 760 320" role="img" aria-label={`${family} ${type} vehicle visual`}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.98)" />
          <stop offset=".50" stopColor={isOemEv ? "rgba(229,246,241,.92)" : "rgba(232,236,238,.92)"} />
          <stop offset="1" stopColor="rgba(156,170,176,.82)" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="rgba(221,245,255,.96)" />
          <stop offset="1" stopColor="rgba(74,93,105,.78)" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="170%">
          <feDropShadow dx="0" dy="24" stdDeviation="18" floodColor="rgba(14,20,22,.28)" />
        </filter>
      </defs>
      <ellipse cx="382" cy="260" rx={family === "F-150" ? "260" : family === "F-350" ? "292" : "318"} ry="34" fill="rgba(17,24,39,.08)" />
      {body}
      <text x="380" y="294" textAnchor="middle" className="vehicle-caption">{family} / {type}</text>
    </svg>
  );
}


function InteractiveVehicleViewer({ type, family }) {
  const mountRef = useRef(null);
  const groupRef = useRef(null);
  const rotationRef = useRef({ yaw: -0.35, pitch: 0.08 });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [angle, setAngle] = useState(340);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(5.5, 3.0, 7.5);
    camera.lookAt(0, 0.55, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 2.0);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(4, 6, 5);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x93c5fd, 0.65);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    const group = buildTruckModel(type, family);
    group.rotation.y = rotationRef.current.yaw;
    group.rotation.x = rotationRef.current.pitch;
    groupRef.current = group;
    scene.add(group);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 96),
      new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.055 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.72;
    ground.scale.z = 0.42;
    scene.add(ground);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!dragRef.current.active && groupRef.current) {
        groupRef.current.rotation.y += 0.0022;
        rotationRef.current.yaw = groupRef.current.rotation.y;
        setAngle(Math.round(((groupRef.current.rotation.y * 180 / Math.PI) % 360 + 360) % 360));
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((item) => {
        if (item.geometry) item.geometry.dispose();
        if (item.material) {
          if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose());
          else item.material.dispose();
        }
      });
    };
  }, [type, family]);

  const updateRotation = (clientX, clientY) => {
    const drag = dragRef.current;
    if (!drag.active || !groupRef.current) return;
    const dx = clientX - drag.lastX;
    const dy = clientY - drag.lastY;
    drag.lastX = clientX;
    drag.lastY = clientY;
    rotationRef.current.yaw += dx * 0.012;
    rotationRef.current.pitch = Math.max(-0.32, Math.min(0.26, rotationRef.current.pitch + dy * 0.004));
    groupRef.current.rotation.y = rotationRef.current.yaw;
    groupRef.current.rotation.x = rotationRef.current.pitch;
    setAngle(Math.round(((rotationRef.current.yaw * 180 / Math.PI) % 360 + 360) % 360));
  };

  return (
    <div
      className="vehicle-3d-viewer true-vehicle-3d"
      onPointerDown={(event) => {
        dragRef.current = { active: true, lastX: event.clientX, lastY: event.clientY };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => updateRotation(event.clientX, event.clientY)}
      onPointerUp={(event) => {
        dragRef.current.active = false;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
      onPointerCancel={() => { dragRef.current.active = false; }}
      role="img"
      aria-label={`${family} ${type} real-time 3D vehicle view`}
    >
      <div ref={mountRef} className="vehicle-three-canvas" />
      <div className="vehicle-3d-meta">
        <span>Drag to rotate</span>
        <b>{angle}°</b>
      </div>
    </div>
  );
}

function buildTruckModel(type, family) {
  const group = new THREE.Group();
  const isElectric = type === "Retrofit" || type === "OEM EV";
  const isRetrofit = type === "Retrofit";
  const accent = new THREE.Color(palette[type] || "#111827");
  const bodyColor = type === "Retrofit" ? 0xdbeafe : type === "OEM EV" ? 0xd1fae5 : type === "Diesel" ? 0xfef3c7 : 0xe5e7eb;
  const darkerColor = type === "Retrofit" ? 0x93c5fd : type === "OEM EV" ? 0x86efac : type === "Diesel" ? 0xfbbf24 : 0xb7bec8;
  const body = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.42, metalness: 0.18 });
  const darker = new THREE.MeshStandardMaterial({ color: darkerColor, roughness: 0.48, metalness: 0.12 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xaed7e6, roughness: 0.08, metalness: 0.04, transmission: 0.12, transparent: true, opacity: 0.78 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.72 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xe7ebed, roughness: 0.26, metalness: 0.62 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.34, metalness: isRetrofit ? 0.3 : 0.12 });
  const black = new THREE.MeshStandardMaterial({ color: 0x22272e, roughness: 0.5, metalness: 0.2 });

  const dims = family === "F-150"
    ? { scale: 1, cab: 1.52, bed: 2.05, width: 1.55, height: 0.72, wheel: 0.36, rearDual: false, service: false }
    : family === "F-350"
      ? { scale: 1.12, cab: 1.68, bed: 2.35, width: 1.7, height: 0.82, wheel: 0.42, rearDual: true, service: false }
      : { scale: 1.22, cab: 1.64, bed: 2.9, width: 1.86, height: 0.92, wheel: 0.44, rearDual: true, service: true };

  const addBox = (name, size, pos, mat, radius = 0.02) => {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const addWheel = (x, z, r, w = 0.22) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 44), tire);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -0.38, z);
    wheel.castShadow = true;
    group.add(wheel);
    const wheelRim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.018, 36), rim);
    wheelRim.rotation.z = Math.PI / 2;
    wheelRim.position.copy(wheel.position);
    group.add(wheelRim);
    return wheel;
  };

  addBox("lower chassis", [dims.cab + dims.bed + 0.55, 0.26, dims.width], [0.25, -0.08, 0], black);
  addBox("front cab", [dims.cab, dims.height, dims.width], [-1.08, 0.35, 0], body);
  addBox("hood", [0.92, dims.height * 0.46, dims.width * 0.96], [-2.32, 0.19, 0], body);
  addBox("grille", [0.08, 0.42, dims.width * 0.72], [-2.81, 0.16, 0], black);

  if (dims.service) {
    addBox("service body", [dims.bed, dims.height * 0.92, dims.width * 1.02], [1.15, 0.28, 0], darker);
    [-0.42, 0.28, 0.98].forEach((x) => addBox("service door", [0.42, 0.5, 0.035], [x + 1.15, 0.32, dims.width * 0.53], isRetrofit ? accentMat : body));
  } else {
    addBox("pickup bed", [dims.bed, dims.height * 0.58, dims.width], [0.78, 0.16, 0], body);
    addBox("bed side", [dims.bed * 0.86, 0.12, 0.06], [0.86, 0.52, dims.width * 0.52], darker);
    addBox("bed side", [dims.bed * 0.86, 0.12, 0.06], [0.86, 0.52, -dims.width * 0.52], darker);
  }

  addBox("windshield", [0.46, 0.44, dims.width * 0.82], [-1.72, 0.67, 0], glass);
  addBox("side glass left", [0.46, 0.38, 0.035], [-0.98, 0.68, dims.width * 0.515], glass);
  addBox("side glass right", [0.46, 0.38, 0.035], [-0.98, 0.68, -dims.width * 0.515], glass);
  addBox("rear glass", [0.06, 0.38, dims.width * 0.72], [-0.25, 0.66, 0], glass);
  addBox("front lamp", [0.055, 0.12, 0.26], [-2.86, 0.2, dims.width * 0.31], isElectric ? accentMat : body);
  addBox("front lamp", [0.055, 0.12, 0.26], [-2.86, 0.2, -dims.width * 0.31], isElectric ? accentMat : body);

  if (isElectric) {
    addBox("battery rail", [dims.bed * 0.72, 0.08, 0.08], [0.66, -0.01, dims.width * 0.58], accentMat);
    addBox("battery rail", [dims.bed * 0.72, 0.08, 0.08], [0.66, -0.01, -dims.width * 0.58], accentMat);
    addBox("charge pack", [0.58, 0.16, 0.38], [0.85, -0.06, 0], accentMat);
  }

  const frontX = -2.15;
  const rearX = dims.service ? 1.82 : 1.45;
  addWheel(frontX, dims.width * 0.57, dims.wheel);
  addWheel(frontX, -dims.width * 0.57, dims.wheel);
  addWheel(rearX, dims.width * 0.57, dims.wheel);
  addWheel(rearX, -dims.width * 0.57, dims.wheel);
  if (dims.rearDual) {
    addWheel(rearX + 0.33, dims.width * 0.57, dims.wheel * 0.94);
    addWheel(rearX + 0.33, -dims.width * 0.57, dims.wheel * 0.94);
  }

  group.scale.setScalar(dims.scale);
  group.position.y = -0.02;
  return group;
}

function ControlSlider({ label, value, min, max, step, format, onChange }) {
  const trackRef = useRef(null);
  const rectRef = useRef(null);
  const draggingRef = useRef(false);
  const percent = max === min ? 0 : ((Number(value) - min) / (max - min)) * 100;
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(Number(value));

  useEffect(() => {
    onChangeRef.current = onChange;
    valueRef.current = Number(value);
  }, [onChange, value]);

  const valueFromClientX = (clientX) => {
    const rect = rectRef.current || trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return valueRef.current;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, Number(snapped.toFixed(4))));
  };

  useEffect(() => {
    const track = trackRef.current;
    const updateFromClientX = (clientX) => onChangeRef.current(valueFromClientX(clientX));
    const startDragging = (event) => {
      event.preventDefault();
      draggingRef.current = true;
      rectRef.current = track?.getBoundingClientRect();
      updateFromClientX(event.clientX);
    };
    const handleMouseMove = (event) => {
      if (!draggingRef.current) return;
      event.preventDefault();
      updateFromClientX(event.clientX);
    };
    const stopDragging = () => {
      draggingRef.current = false;
      rectRef.current = null;
    };
    const handleTouchMove = (event) => {
      if (!draggingRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      updateFromClientX(touch.clientX);
    };
    const startTouch = (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      draggingRef.current = true;
      rectRef.current = track?.getBoundingClientRect();
      updateFromClientX(touch.clientX);
    };

    track?.addEventListener("mousedown", startDragging);
    track?.addEventListener("touchstart", startTouch, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", stopDragging);
    return () => {
      track?.removeEventListener("mousedown", startDragging);
      track?.removeEventListener("touchstart", startTouch);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopDragging);
    };
  }, [min, max, step]);

  const handleKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") return onChange(min);
    if (event.key === "End") return onChange(max);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    onChange(Math.max(min, Math.min(max, Number((Number(value) + direction * step).toFixed(4)))));
  };

  return (
    <label className="live-control smooth-live-control">
      <span>{label}<b>{format(value)}</b></span>
      <div
        ref={trackRef}
        className={draggingRef.current ? "smooth-slider smooth-slider-drag-track dragging" : "smooth-slider smooth-slider-drag-track"}
        role="slider"
        tabIndex="0"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value)}
        onKeyDown={handleKeyDown}
      >
        <div className="smooth-slider-fill" style={{ width: `${percent}%` }} />
        <div className="smooth-slider-thumb" style={{ left: `${percent}%` }} />
      </div>
    </label>
  );
}

function usePremiumInteractionFeedback(enabled = true) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const playTone = (event) => {
      const target = event.target?.closest?.("button, a, summary, input[type='range'], select, .smooth-slider");
      if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current || new AudioContextClass();
      audioRef.current = context;
      if (context.state === "suspended") context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(420, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(250, context.currentTime + 0.055);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.018, context.currentTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.07);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.075);
    };
    window.addEventListener("pointerdown", playTone, { passive: true });
    return () => window.removeEventListener("pointerdown", playTone);
  }, [enabled]);
}

function useLiquidPointerEffect() {
  useEffect(() => {
    const selector = ".yana-card, .yana-kpi-card, .yana-path-card, .locked-analytics-card, .method-step-card, .yana-sidebar button";
    const handlePointerMove = (event) => {
      const target = event.target?.closest?.(selector);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      target.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);
}

function EVNetworkMap({ stations, selectedStation, onSelectStation }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markerLayerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
    }).setView([53.6, -125.2], 5);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    stations.forEach((station) => {
      const fastClass = station.fastChargers > 0 ? " fast" : "";
      const selectedClass = selectedStation?.id === station.id ? " selected" : "";
      const icon = L.divIcon({
        className: `ev-map-pin${fastClass}${selectedClass}`,
        html: `<span>${station.fastChargers > 0 ? "⚡" : "•"}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([station.lat, station.lng], { icon }).addTo(layer);
      marker.on("click", () => onSelectStation(station));
    });

    if (stations.length) {
      const bounds = L.latLngBounds(stations.map((station) => [station.lat, station.lng]));
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 12 });
    }
  }, [stations, selectedStation, onSelectStation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedStation) return;
    map.flyTo([selectedStation.lat, selectedStation.lng], Math.max(map.getZoom(), 13), { duration: 0.7 });
  }, [selectedStation]);

  return <div className="ev-map-canvas" ref={containerRef} aria-label="BC EV station map" />;
}

function App() {
  const data = useScenarioData();
  const [activeView, setActiveView] = useState("overview");
  const [vehicle, setVehicle] = useState("F-150");
  const [scenario, setScenario] = useState("base");
  const [horizon, setHorizon] = useState(10);
  const [ownershipMode, setOwnershipMode] = useState("service");
  const [newCarPercent, setNewCarPercent] = useState(50);
  const [selectedType, setSelectedType] = useState("Retrofit");
  const [stationSearch, setStationSearch] = useState("");
  const [stationCity, setStationCity] = useState("All");
  const [selectedStation, setSelectedStation] = useState(GREATER_VANCOUVER_STATIONS[0]);
  const [selectedDataNode, setSelectedDataNode] = useState(DATA_MAP_NODES[0]);
  const [isUnlocked, setIsUnlocked] = useState(() => window.localStorage.getItem("blueforce-demo-unlocked") === "true");
  const [soundOn, setSoundOn] = useState(() => window.localStorage.getItem("blueforce-demo-sound") !== "off");
  const [dataMode, setDataMode] = useState("snapshot");
  const [devicePreview, setDevicePreview] = useState("desktop");
  const [visualTheme, setVisualTheme] = useState(() => (localStorage.getItem("blueforce-visual-theme") === "night" ? "night" : "light"));
  const [loginUnlocking, setLoginUnlocking] = useState(false);
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [focusMode, setFocusMode] = useState("cost");
  const [detailOpen, setDetailOpen] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [tunerIndexByScenario, setTunerIndexByScenario] = useState(DEFAULT_TUNER_INDEX);
  const [scenarioTab, setScenarioTab] = useState("km");
  const [simulatorInputs, setSimulatorInputs] = useState({
    fleetSize: 1,
    annualKm: 20000,
    fuelMultiplier: 1,
    electricityMultiplier: 1,
    maintenanceInflation: 0,
    horizon: 10,
  });
  const pageCarouselRef = useRef(null);
  const pagePanelRefs = useRef({});
  const activeViewRef = useRef("overview");
  const carouselNavLockRef = useRef(false);
  const carouselNavReleaseRef = useRef(null);
  const carouselWheelReleaseRef = useRef(null);
  const carouselGestureLockRef = useRef(false);

  usePremiumInteractionFeedback(isUnlocked && soundOn);
  useLiquidPointerEffect();

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const releaseCarouselNavLock = React.useCallback((delay = 0) => {
    window.clearTimeout(carouselNavReleaseRef.current);
    if (!delay) {
      carouselNavLockRef.current = false;
      return;
    }
    carouselNavReleaseRef.current = window.setTimeout(() => {
      carouselNavLockRef.current = false;
    }, delay);
  }, []);

  const scrollToView = React.useCallback((viewId, behavior = "smooth") => {
    const carousel = pageCarouselRef.current;
    const panel = pagePanelRefs.current[viewId];
    if (!carousel || !panel) return;
    carouselNavLockRef.current = behavior === "smooth";
    releaseCarouselNavLock(behavior === "smooth" ? 420 : 0);
    carousel.scrollTo({ left: panel.offsetLeft, behavior });
  }, [releaseCarouselNavLock]);

  const goToView = React.useCallback((viewId, behavior = "smooth") => {
    setActiveView(viewId);
    window.requestAnimationFrame(() => scrollToView(viewId, behavior));
  }, [scrollToView]);

  const getNearestCarouselView = React.useCallback(() => {
    const carousel = pageCarouselRef.current;
    if (!carousel) return null;
    const panels = navItems
      .map((item) => [item.id, pagePanelRefs.current[item.id]])
      .filter((entry) => entry[1]);
    if (!panels.length) return null;
    const center = carousel.scrollLeft + carousel.clientWidth / 2;
    let nearestId = panels[0][0];
    let nearestDistance = Infinity;
    panels.forEach(([id, node]) => {
      const nodeCenter = node.offsetLeft + node.offsetWidth / 2;
      const distance = Math.abs(nodeCenter - center);
      if (distance < nearestDistance) {
        nearestId = id;
        nearestDistance = distance;
      }
    });
    return nearestId;
  }, []);

  const handleCarouselWheel = React.useCallback((event) => {
    const carousel = pageCarouselRef.current;
    if (!carousel) return;
    const horizontalDelta = Math.abs(event.deltaX) > 2
      ? event.deltaX
      : event.shiftKey && Math.abs(event.deltaY) > 2
        ? event.deltaY
        : 0;
    if (!horizontalDelta) return;
    event.preventDefault();
    carouselGestureLockRef.current = true;
    carouselNavLockRef.current = true;
    carousel.style.scrollSnapType = "none";
    carousel.style.scrollBehavior = "auto";
    carousel.scrollLeft += horizontalDelta;
    window.clearTimeout(carouselWheelReleaseRef.current);
    carouselWheelReleaseRef.current = window.setTimeout(() => {
      const nearestView = getNearestCarouselView();
      carouselGestureLockRef.current = false;
      carousel.style.scrollSnapType = "";
      carousel.style.scrollBehavior = "";
      if (nearestView) {
        setActiveView(nearestView);
        scrollToView(nearestView, "smooth");
      } else {
        releaseCarouselNavLock();
      }
    }, 220);
  }, [getNearestCarouselView, releaseCarouselNavLock, scrollToView]);

  useEffect(
    () => () => {
      window.clearTimeout(carouselNavReleaseRef.current);
      window.clearTimeout(carouselWheelReleaseRef.current);
      carouselGestureLockRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (!isUnlocked) return undefined;
    const frame = window.requestAnimationFrame(() => scrollToView(activeViewRef.current, "auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [devicePreview, isUnlocked, scrollToView]);

  const syncActiveViewFromCarousel = React.useCallback(() => {
    const carousel = pageCarouselRef.current;
    if (!carousel || carouselNavLockRef.current || carouselGestureLockRef.current) return;
    const nearestId = getNearestCarouselView();
    if (!nearestId) return;
    if (nearestId !== activeViewRef.current) {
      setActiveView(nearestId);
    }
  }, [getNearestCarouselView]);

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

  const inputRows = data?.Breakeven_Input_Check || [];
  const baseRows = useMemo(() => {
    if (!data) return [];
    return data.BaseCase_Summary.filter((row) => row.model.startsWith(vehicle)).map((row) => applyForecastFields({
      ...row,
      type: vehicleType(row.model),
    }));
  }, [data, vehicle]);

  const rows = useMemo(() => baseRows.map((row) => retrofitOwnershipAdjustment(row, baseRows, ownershipMode, newCarPercent)), [baseRows, ownershipMode, newCarPercent]);

  useEffect(() => {
    if (rows.length && !rows.some((row) => row.type === selectedType)) {
      setSelectedType("Retrofit");
    }
  }, [rows, selectedType]);

  useEffect(() => {
    setSimulatorInputs((current) => ({ ...current, horizon }));
  }, [horizon]);

  const comparisons = useMemo(() => {
    if (!data) return [];
    return data.Comparison_Summary.filter((row) => row.retrofit_model.startsWith(vehicle));
  }, [data, vehicle]);

  const carbonCreditRates = data?.Carbon_Credit_Rates || [];
  const creditProgramReview = data?.Credit_Program_Review || [];

  const retrofit = rows.find((row) => row.type === "Retrofit");
  const iceRow = rows.find((row) => row.type === "ICE");
  const selectedRow = rows.find((row) => row.type === selectedType) || retrofit;
  const activeOwnership = OWNERSHIP_MODES.find((item) => item.id === ownershipMode) || OWNERSHIP_MODES[0];
  const emissionsAvoidedVsIce = iceRow && retrofit ? lifecycleEmissionsAt(iceRow, horizon) - lifecycleEmissionsAt(retrofit, horizon) : 0;
  const selectedCarbonCreditRow = carbonCreditRates.find((row) => row.model === selectedRow?.model);
  const retrofitCarbonCreditRow = carbonCreditRates.find((row) => row.model === retrofit?.model);
  const carbonCreditMethodNote = creditProgramReview.find((row) => row.program === "BC Low Carbon Fuel Standard (LCFS)")?.model_action;
  const iceComparison = comparisons.find((row) => row.comparison.includes("ICE"));
  const otherComparison = comparisons.find((row) => !row.comparison.includes("ICE"));
  const otherType = otherComparison?.comparison?.replace("Retrofit vs ", "") || "comparison vehicle";
  const scenarioValueOptions = useMemo(() => scenarioValuesFor(data, scenario), [data, scenario]);
  const scenarioValueIndex = Math.min(
    tunerIndexByScenario[scenario] ?? 0,
    Math.max(scenarioValueOptions.length - 1, 0),
  );
  const scenarioParamValue = scenario === "base" ? null : scenarioValueOptions[scenarioValueIndex];
  const activeScenarioLabel = scenario === "base"
    ? "Base model"
    : scenarioSeriesLabel(SCENARIOS[scenario].parameter, scenarioParamValue, SCENARIOS[scenario]);
  const isCarbonScenario = scenario === "carbon";

  const tunedRows = useMemo(() => {
    if (!data || scenario === "base" || scenarioParamValue == null) {
      return rows.map((row) => ({ ...row, tunedCost: costAt(row, horizon), tunedSource: "BaseCase_Summary" }));
    }

    const config = SCENARIOS[scenario];
    const source = data[config.sheet] || [];

    return rows
      .map((row) => {
        const match = source.find(
          (candidate) => candidate.model === row.model
            && Number(candidate.year) === horizon
            && Number(candidate[config.parameter]) === Number(scenarioParamValue),
        );

        const zeroBaseline = Number(scenarioParamValue) === 0 && scenarioHasZeroBaseline(scenario);
        if (zeroBaseline) {
          const baselineValue = scenarioZeroBaselineValue(scenario, row);
          if (baselineValue == null) return null;
          return {
            ...row,
            tunedCost: baselineValue,
            tunedSource: "Zero baseline",
          };
        }

        if (scenario === "carbon" && !match) {
          return null;
        }

        const matchedCost = match ? Number(match[config.metric]) : costAt(row, horizon);
        return {
          ...row,
          tunedCost: matchedCost + (match ? scenarioOwnershipCostAdjustment(row, scenario, scenarioParamValue) : 0),
          tunedSource: config.sheet,
        };
      })
      .filter(Boolean);
  }, [data, rows, scenario, scenarioParamValue, horizon]);

  const selectedTunedRow = tunedRows.find((row) => row.type === selectedType) || tunedRows.find((row) => row.type === "Retrofit") || selectedRow;
  const retrofitTunedRow = tunedRows.find((row) => row.type === "Retrofit") || retrofit;
  const iceTunedRow = tunedRows.find((row) => row.type === "ICE");
  const best = tunedRows.reduce((winner, row) => {
    if (!winner) return row;
    return isCarbonScenario
      ? row.tunedCost > winner.tunedCost ? row : winner
      : row.tunedCost < winner.tunedCost ? row : winner;
  }, null);
  const activeSavingsVsIce = isCarbonScenario
    ? Number(retrofitTunedRow?.tunedCost || 0)
    : Number(iceTunedRow?.tunedCost ?? 0) - Number(retrofitTunedRow?.tunedCost ?? 0);
  const retrofitWins = isCarbonScenario ? true : best?.type === "Retrofit";

  const costChart = useMemo(
    () =>
      tunedRows.map((row) => ({
        type: isCarbonScenario ? row.model : row.type,
        pathwayType: row.type,
        selected: Math.round(row.tunedCost),
        "3 years": Math.round(costAt(row, 3)),
        "5 years": Math.round(costAt(row, 5)),
        "10 years": Math.round(costAt(row, 10)),
      })),
    [tunedRows, isCarbonScenario],
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
        operating: Number(operatingEmissionsAt(row, horizon).toFixed(2)),
        lifecycle: Number(lifecycleEmissionsAt(row, horizon).toFixed(2)),
      })),
    [rows, horizon],
  );

  const scenarioChart = useMemo(() => {
    if (!data || !selectedRow) {
      return { data: [], keys: [], colors: {}, note: "" };
    }

    if (scenario === "base") {
      const keys = rows.map((row) => row.type);
      const colors = Object.fromEntries(keys.map((key) => [key, linePalette[key] || scenarioLineColors[0]]));
      return {
        data: Array.from({ length: 11 }, (_, year) => {
          const item = { label: `${year}Y` };
          rows.forEach((row) => {
            item[row.type] = costAt(row, year);
          });
          return item;
        }),
        keys,
        colors,
        note: "Base case starts at Year 0 purchase price, then shows 3, 5, and 10 year cumulative costs by pathway.",
      };
    }

    const config = SCENARIOS[scenario];
    const source = data[config.sheet] || [];
    const modelRows = source.filter((row) => row.model === selectedRow.model);
    const parameterValues = scenarioValuesFor(data, scenario);
    const keys = parameterValues.map((value) => scenarioSeriesLabel(config.parameter, value, config));
    const colors = Object.fromEntries(keys.map((key, index) => [key, scenarioLineColors[index % scenarioLineColors.length]]));

    return {
      data: Array.from({ length: 11 }, (_, index) => {
        const year = index;
        const item = { label: `${year}Y` };
        parameterValues.forEach((parameterValue, parameterIndex) => {
          const match = modelRows.find(
            (row) => Number(row.year) === year && Number(row[config.parameter]) === parameterValue,
          );
          if (parameterValue === 0 && scenarioHasZeroBaseline(scenario)) {
            item[keys[parameterIndex]] = scenarioZeroBaselineValue(scenario, selectedRow);
          } else {
            item[keys[parameterIndex]] = match
              ? Number(match[config.metric]) + scenarioOwnershipCostAdjustment(selectedRow, scenario, parameterValue)
              : null;
          }
        });
        return item;
      }),
      keys,
      colors,
      note: `Year x-axis; lines compare ${config.fullLabel.toLowerCase()} cases for ${selectedRow.type}.`,
    };
  }, [data, rows, scenario, selectedRow]);

  const recommendations = useMemo(() => {
    if (isCarbonScenario) {
      return [
        `Credit revenue only: ${currency(retrofitTunedRow?.tunedCost ?? 0)} over ${horizon}Y.`,
        `Base price fixed; kilometres drive value.`,
        vehicle === "F-150" ? "Eligible pathways: Retrofit + Lightning." : "Eligible pathway: Retrofit.",
      ];
    }

    return [
      `Savings vs ICE: ${currency(activeSavingsVsIce)} over ${horizon}Y.`,
      `Lifecycle CO2e avoided: ${tonnes(emissionsAvoidedVsIce)}.`,
      scenario === "base" ? "Base case ready for client discussion." : `${SCENARIOS[scenario].fullLabel}: ${activeScenarioLabel}.`,
    ];
  }, [isCarbonScenario, vehicle, horizon, scenario, retrofitTunedRow, emissionsAvoidedVsIce, activeSavingsVsIce, activeScenarioLabel]);

  const stationCities = useMemo(
    () => ["All", ...Array.from(new Set(GREATER_VANCOUVER_STATIONS.map((station) => station.city))).sort()],
    [],
  );
  const filteredStations = useMemo(() => {
    const query = stationSearch.trim().toLowerCase();
    return GREATER_VANCOUVER_STATIONS.filter((station) => {
      const matchesCity = stationCity === "All" || station.city === stationCity;
      const text = `${station.name} ${station.city} ${station.address} ${station.operator} ${station.connectorTypes.join(" ")}`.toLowerCase();
      return matchesCity && (!query || text.includes(query));
    });
  }, [stationSearch, stationCity]);
  const evNetworkStats = useMemo(() => {
    const cities = new Set(filteredStations.map((station) => station.city));
    return {
      stations: filteredStations.length,
      plugs: filteredStations.reduce((total, station) => total + station.plugs, 0),
      fast: filteredStations.reduce((total, station) => total + station.fastChargers, 0),
      level2: filteredStations.reduce((total, station) => total + station.level2, 0),
      cities: cities.size,
    };
  }, [filteredStations]);

  useEffect(() => {
    if (filteredStations.length && !filteredStations.some((station) => station.id === selectedStation?.id)) {
      setSelectedStation(filteredStations[0]);
    }
  }, [filteredStations, selectedStation]);

  if (!data || !retrofit || !selectedRow) {
    return (
      <div className="loading-screen">
        <div className="loading-card">Loading BlueForce scenario model...</div>
      </div>
    );
  }

  const selectedSavings = selectedType === "Retrofit"
    ? activeSavingsVsIce
    : Number(selectedTunedRow?.tunedCost ?? 0) - Number(retrofitTunedRow?.tunedCost ?? 0);
  const advantageScore = Math.max(6, Math.min(98, Math.round((Number(retrofitTunedRow?.tunedCost ?? 0) / Math.max(Number(selectedTunedRow?.tunedCost ?? 0), Number(retrofitTunedRow?.tunedCost ?? 0), 1)) * 100)));
  const storyCost = selectedTunedRow?.tunedCost ?? costAt(selectedRow, horizon);
  const storySavings = activeSavingsVsIce;
  const storySentence = isCarbonScenario
    ? `${vehicle} retrofit credit value: ${currency(retrofitTunedRow?.tunedCost ?? 0)} over ${horizon}Y.`
    : retrofitWins
      ? `Retrofit wins: ${currency(storySavings)} lower than ICE over ${horizon}Y.`
      : `${best?.type || "Another pathway"} leads. Validate assumptions before recommendation.`;
  const storySteps = isCarbonScenario
    ? [
        { label: "1. Start", title: vehicle, detail: "Show only eligible electric charging pathways." },
        { label: "2. Scope", title: "Credits only", detail: "No vehicle purchase price, fuel, maintenance, or total cost is included." },
        { label: "3. Value", title: currency(storyCost), detail: `${horizon}-year accumulated BC LCFS credit value.` },
        { label: "4. Output", title: best?.model || "Eligible EV", detail: "Highest accumulated credit revenue in this scenario case." },
      ]
    : [
        { label: "1. Start", title: vehicle, detail: `Choose the truck family and compare available pathways.` },
        { label: "2. Pathway", title: selectedTunedRow?.type || selectedRow.type, detail: `Selected model: ${selectedTunedRow?.model || selectedRow.model}.` },
        { label: "3. Cost", title: currency(storyCost), detail: `${horizon}-year cumulative cost in the current view.` },
        { label: "4. Outcome", title: retrofitWins ? "Retrofit leads" : `${best?.type} leads`, detail: retrofitWins ? `${currency(storySavings)} saved vs ICE.` : "Review sponsor assumptions before recommendation." },
      ];

  const breakevenVsIce = (data?.Breakeven_10yr_Summary || []).find(
    (row) => row.retrofit_model === `${vehicle} Retrofit` && row.comparison_model === `${vehicle} ICE`,
  );
  const storyCarbonKm = isCarbonScenario && scenarioParamValue != null ? Number(scenarioParamValue) : 20_000;
  const storyCarbonValue = (data?.Carbon_Credit_Revenue || []).find(
    (row) => row.model === `${vehicle} Retrofit` && Number(row.year) === horizon && Number(row.km_per_year) === storyCarbonKm,
  )?.cumulative_credit_value_cad || 0;
  const federalCfrPotentialValue = Math.max(0, emissionsAvoidedVsIce) * FEDERAL_CFR_REFERENCE_PRICE_CAD_PER_TONNE;
  const combinedCreditPotentialValue = Number(storyCarbonValue || 0) + federalCfrPotentialValue;
  const dynamicCostBreakevenYear = firstYearWhere(retrofit, iceRow, costAt);
  const dynamicEmissionsBreakevenYear = firstYearWhere(retrofit, iceRow, lifecycleEmissionsAt);
  const breakevenText = formatBreakevenYear(dynamicCostBreakevenYear);
  const emissionsBreakevenText = formatBreakevenYear(dynamicEmissionsBreakevenYear);
  const narrativeSteps = [
    {
      eyebrow: "01 / Current option",
      title: "Current ICE baseline",
      value: currency(iceTunedRow?.tunedCost ?? costAt(iceRow, horizon) ?? 0),
      copy: `ICE benchmark, ${horizon}Y.`,
      action: () => setDetailOpen("cost"),
    },
    {
      eyebrow: "02 / Retrofit option",
      title: "BlueForce retrofit",
      value: currency(retrofitTunedRow?.tunedCost ?? 0),
      copy: `BlueForce retrofit pathway.`,
      action: () => setDetailOpen("savings"),
    },
    {
      eyebrow: "03 / Climate result",
      title: "Lifecycle emissions difference",
      value: tonnes(emissionsAvoidedVsIce),
      copy: "Manufacturing + operating CO2e.",
      action: () => setDetailOpen("emissions"),
    },
    {
      eyebrow: "04 / Credit upside",
      title: "Carbon-credit potential",
      value: currency(storyCarbonValue),
      copy: `BC LCFS value at ${storyCarbonKm.toLocaleString()} km/year.`,
      action: () => setDetailOpen("carbon"),
    },
    {
      eyebrow: "05 / Decision point",
      title: "Breakeven result",
      value: breakevenText,
      copy: "Adjusted retrofit breakeven.",
      action: () => setDetailOpen("scenario"),
    },
  ];

  const lowestLifecycle = rows.reduce((winner, row) => {
    if (!winner) return row;
    return (lifecycleEmissionsAt(row, horizon) || Infinity) < (lifecycleEmissionsAt(winner, horizon) || Infinity) ? row : winner;
  }, null);
  const executiveMetrics = [
    { label: "Best financial path", value: isCarbonScenario ? best?.type || "Eligible EV" : best?.type || "Pending", detail: isCarbonScenario ? "Credit view" : `${horizon}Y lifecycle cost` },
    { label: "Savings vs ICE", value: isCarbonScenario ? currency(retrofitTunedRow?.tunedCost ?? 0) : currency(activeSavingsVsIce), detail: isCarbonScenario ? "Credit revenue" : `${vehicle} retrofit` },
    { label: "Breakeven", value: breakevenText, detail: "Adjusted model" },
    { label: "Lowest CO2e", value: lowestLifecycle?.type || "Pending", detail: tonnes(lowestLifecycle ? lifecycleEmissionsAt(lowestLifecycle, horizon) : 0) },
    { label: "Funding signal", value: currency(storyCarbonValue), detail: "BC LCFS estimate" },
  ];

  const detailContent = {
    cost: isCarbonScenario ? {
      title: "How the carbon-credit value is built",
      body: `The carbon-credit section is intentionally not a total-cost calculation. It only totals accumulated BC LCFS credit revenue for eligible electric charging over ${horizon} years.`,
      takeaway: "This view excludes purchase price, fuel/electricity cost, maintenance, and all ICE/diesel pathways.",
      facts: [
        { label: "Current source", value: "Carbon_Credit_Revenue export" },
        { label: "Retrofit credit value", value: currency(retrofitTunedRow?.tunedCost) },
        { label: "Selected value", value: currency(selectedTunedRow?.tunedCost ?? storyCost) },
        { label: "Highest value", value: best?.model || "Pending" },
      ],
    } : {
      title: "How the cost answer is built",
      body: `The app starts with the simplest question: after ${horizon} years, which pathway costs less for ${vehicle}? The number shown here comes from the existing exported model row for the selected truck, pathway, scenario, and horizon.`,
      takeaway: retrofitWins
        ? "Retrofit is currently the lowest-cost pathway in this view."
        : `The current view favors ${best?.type || "another pathway"}; validate the cost driver before using it as a recommendation.`,
      facts: [
        { label: "Current source", value: scenario === "base" ? "Base case export" : `${SCENARIOS[scenario].fullLabel} export` },
        { label: "Retrofit cost", value: currency(retrofitTunedRow?.tunedCost) },
        { label: "Selected cost", value: currency(selectedTunedRow?.tunedCost ?? storyCost) },
        { label: "Lowest pathway", value: best?.type || "Pending" },
      ],
    },
    savings: isCarbonScenario ? {
      title: "Why ICE and diesel are not shown here",
      body: "This scenario answers one narrow question: how much money is made from accumulated carbon credits when eligible electric models charge and drive more kilometres.",
      takeaway: "ICE and diesel do not create EV charging credits, so they are removed from this section instead of being shown as zero-value alternatives.",
      facts: [
        { label: "Included", value: vehicle === "F-150" ? "F-150 Retrofit + Lightning" : `${vehicle} Retrofit` },
        { label: "Excluded", value: "ICE and diesel" },
        { label: "Variable", value: "15k / 20k / 30k km/year" },
        { label: "Metric", value: "Accumulated credit value" },
      ],
    } : {
      title: "What the savings number means",
      body: "Savings are not a separate assumption. They are the cost difference between the matching ICE pathway and the retrofit pathway for the same truck, time horizon, and scenario case.",
      takeaway: activeSavingsVsIce >= 0
        ? `${vehicle} retrofit shows ${currency(activeSavingsVsIce)} in ${horizon}-year savings versus ICE in the current view.`
        : `${vehicle} retrofit is ${currency(Math.abs(activeSavingsVsIce))} higher than ICE in the current view.`,
      facts: [
        { label: "Retrofit cost", value: currency(retrofitTunedRow?.tunedCost) },
        { label: "ICE cost", value: currency(iceTunedRow?.tunedCost) },
        { label: activeSavingsVsIce >= 0 ? "Savings vs ICE" : "Extra cost vs ICE", value: currency(Math.abs(activeSavingsVsIce)) },
        { label: "Time horizon", value: `${horizon} years` },
      ],
    },
    emissions: {
      title: "How lifecycle emissions work",
      body: "Lifecycle emissions begin before the first kilometre is driven. The model starts with manufacturing emissions, then adds operating emissions from fuel, diesel, or electricity through the selected horizon.",
      takeaway: `${tonnes(emissionsAvoidedVsIce)} lifecycle CO2e is avoided versus ICE in this view.`,
      facts: [
        { label: "Manufacturing", value: tonnes(selectedRow.manufacturing_emissions_tonnes) },
        { label: "Operating", value: tonnes(operatingEmissionsAt(selectedRow, horizon)) },
        { label: "Lifecycle", value: tonnes(lifecycleEmissionsAt(selectedRow, horizon)) },
        { label: "Avoided vs ICE", value: tonnes(emissionsAvoidedVsIce) },
      ],
    },
    scenario: {
      title: "What changes when you move the tuner",
      body: "The tuner is conservative on purpose. It changes one exported driver at a time, so the story stays explainable: kilometres, fleet size, fuel prices, maintenance, or carbon-credit kilometres change while the rest stays constant.",
      takeaway: scenario === "base"
        ? "Base case is the calm reference point. Move one assumption to stress-test the decision."
        : `${SCENARIOS[scenario].fullLabel} is set to ${activeScenarioLabel}; use this as a sensitivity test, not a new source of truth.`,
      facts: [
        { label: "Driver", value: SCENARIOS[scenario].fullLabel },
        { label: "Current case", value: activeScenarioLabel },
        { label: "Visible metric", value: FOCUS_OPTIONS.find((item) => item.value === focusMode)?.label || "Cost" },
        { label: "Model rule", value: "One variable changes" },
      ],
    },
    carbon: {
      title: "How BC LCFS carbon credits are estimated",
      body: "BC credits are not literally paid per kW. The model uses eligible EV electricity use in kWh, converts it to MJ, applies the BC LCFS formula, then multiplies credits by the fixed base price of $258.74 per credit.",
      takeaway: carbonCreditMethodNote || "The carbon-credit section keeps the credit price fixed and varies annual kilometres, so usage drives the credit value.",
      facts: [
        { label: "BC LCFS price", value: "$258.74/credit" },
        { label: "Federal CFR sensitivity", value: `$${FEDERAL_CFR_REFERENCE_PRICE_CAD_PER_TONNE}/t CO2e` },
        { label: "Current km case", value: `${storyCarbonKm.toLocaleString()} km/year` },
        { label: "Scope", value: "Credit potential only" },
      ],
    },
    team: {
      title: "Project team",
      body: "Core delivery team for the retrofit decision model, interface, and validation workflow.",
      takeaway: "Student cards show the primary builders. BlueForce, BCIT, and faculty support are listed below as concise references.",
      networkGroups: PROJECT_NETWORK_GROUPS,
      facts: [],
    }
  };

  const primaryMetricHelp = isCarbonScenario
    ? "The carbon-credit section only counts accumulated BC LCFS credit revenue. It excludes purchase price, fuel/electricity cost, maintenance, and other vehicle costs."
    : explanations.cumulativeCost;
  const primaryMetricEyebrow = isCarbonScenario ? "Carbon-credit revenue" : "Cost comparison";
  const primaryMetricTitle = isCarbonScenario ? `${vehicle} eligible electric models` : `${vehicle} pathways`;
  const primaryMetricLabel = isCarbonScenario ? `${horizon}-year accumulated credit value` : `${horizon}-year cumulative cost`;
  const retrofitPrimaryValue = isCarbonScenario ? retrofitTunedRow?.tunedCost : retrofitTunedRow?.tunedCost;
  const outcomeValueLabel = isCarbonScenario ? "credit value" : "retrofit cost";
  const outcomeSavingsLabel = isCarbonScenario ? "retrofit credit value" : "savings vs ICE";

  const updateScenario = (value) => {
    setScenario(value);
    goToView(value === "base" ? "overview" : "scenario");
  };

  const updateTunerIndex = (value) => {
    setTunerIndexByScenario((current) => ({ ...current, [scenario]: value }));
    goToView("scenario");
  };

  const annualKm = Number(breakevenVsIce?.annual_km || 20000);
  const inputForModel = (model) => inputRows.find((row) => row.model === model) || {};
  const annualMaintenanceFor = (row) => Number(inputForModel(row.model).maintenance_per_km || 0) * annualKm;
  const lowestMaintenanceRow = rows.reduce((winner, row) => {
    if (!winner) return row;
    return annualMaintenanceFor(row) < annualMaintenanceFor(winner) ? row : winner;
  }, null);
  const costTimelineData = Array.from({ length: 11 }, (_, year) => {
    const item = { year: `${year}Y` };
    rows.forEach((row) => {
      item[row.type] = costAt(row, year);
    });
    return item;
  });
  const comparisonCards = rows.map((row) => {
    const annualMaintenance = annualMaintenanceFor(row);
    const savingsVsIce = iceRow ? costAt(iceRow, horizon) - costAt(row, horizon) : 0;
    const maintenanceInput = inputForModel(row.model);
    return {
      ...row,
      annualMaintenance,
      savingsVsIce,
      maintenancePerKm: Number(maintenanceInput.maintenance_per_km || 0),
      bestUse: row.type === "Retrofit"
        ? "Lower capital transition"
        : row.type === "OEM EV"
          ? "New EV replacement"
          : "Status quo benchmark",
    };
  });
  const breakevenDisplay = breakevenText;
  const scenarioTabs = [
    { id: "km", label: "Annual km sensitivity", insight: "Driving more kilometres generally strengthens the electric retrofit operating case." },
    { id: "fleet", label: "Fleet size sensitivity", insight: "Fleet scale turns per-vehicle savings into a larger procurement case." },
    { id: "fuel", label: "Fuel/electricity price", insight: "Higher fuel pressure increases the value of electrified pathways." },
    { id: "maintenance", label: "Maintenance inflation", insight: "Maintenance assumptions should be sponsor-validated before final claims." },
    { id: "emissions", label: "Emissions comparison", insight: "Lifecycle view separates manufacturing emissions from operating emissions." },
  ];
  const activeScenarioTab = scenarioTab;
  const scenarioTabConfig = SCENARIOS[activeScenarioTab];
  const scenarioTabChart = activeScenarioTab === "emissions"
    ? emissionsChart
    : (() => {
        const values = scenarioValuesFor(data, activeScenarioTab);
        const source = data?.[scenarioTabConfig.sheet] || [];
        const modelRows = source.filter((row) => row.model === selectedRow.model);
        return values.map((value) => {
          const match = modelRows.find((row) => Number(row.year) === horizon && Number(row[scenarioTabConfig.parameter]) === Number(value));
          const baseValue = Number(value) === 0 && scenarioHasZeroBaseline(activeScenarioTab)
            ? scenarioZeroBaselineValue(activeScenarioTab, selectedRow)
            : Number(match?.[scenarioTabConfig.metric] || 0);
          return {
            label: scenarioSeriesLabel(scenarioTabConfig.parameter, value, scenarioTabConfig),
            value: baseValue + (match ? scenarioOwnershipCostAdjustment(selectedRow, activeScenarioTab, value) : 0),
          };
        });
      })();
  const scenarioContext = {
    km: {
      axis: "X-axis: annual kilometres case. Y-axis: cumulative total cost at the selected year.",
      method: `Base case uses 20,000 km/year. A higher km case increases fuel, electricity, maintenance, and operating emissions while purchase price stays constant.`,
    },
    fleet: {
      axis: "X-axis: number of vehicles. Y-axis: total fleet cost at the selected year.",
      method: "Each vehicle keeps the same per-vehicle assumptions; the result scales by fleet size.",
    },
    fuel: {
      axis: "X-axis: fuel/electricity multiplier. Y-axis: cumulative total cost at the selected year.",
      method: "1.0x means the base fuel/electricity price from the dataset. 1.2x means 20% higher fuel/electricity cost while other inputs stay constant.",
    },
    maintenance: {
      axis: "X-axis: maintenance inflation case. Y-axis: cumulative total cost at the selected year.",
      method: `The chart uses ${annualKm.toLocaleString()} km/year and the selected ${horizon}-year horizon. A 5% bar means maintenance costs are inflated by 5% in the exported scenario case.`,
    },
    emissions: {
      axis: "X-axis: pathway. Y-axis: lifecycle emissions in tonnes CO2e.",
      method: "Each bar starts with manufacturing emissions, then stacks operating emissions through the selected year.",
    },
  };
  const scenarioStats = activeScenarioTab === "emissions"
    ? {
        primary: tonnes(lifecycleEmissionsAt(retrofitTunedRow, horizon)),
        secondary: `${vehicle} retrofit lifecycle CO2e`,
        delta: tonnes(emissionsAvoidedVsIce),
        deltaLabel: "Avoided vs ICE",
      }
    : (() => {
        const numericValues = scenarioTabChart.map((item) => Number(item.value || 0)).filter(Number.isFinite);
        const minValue = numericValues.length ? Math.min(...numericValues) : 0;
        const maxValue = numericValues.length ? Math.max(...numericValues) : 0;
        return {
          primary: compactMoney(maxValue),
          secondary: `${scenarioTabChart.length} model cases at Year ${horizon}`,
          delta: compactMoney(maxValue - minValue),
          deltaLabel: "Range across cases",
        };
      })();
  const scenarioCurrentLabel = activeScenarioTab === "emissions"
    ? "Lifecycle emissions"
    : `${scenarioTabs.find((tab) => tab.id === activeScenarioTab)?.label || "Scenario"}`;

  const updateSimulatorInput = (key, value) => {
    const next = Number(value);
    setSimulatorInputs((current) => ({ ...current, [key]: next }));
    if (key === "horizon") setHorizon(next);
  };
  const simulatedRows = rows.map((row) => {
    const input = inputForModel(row.model);
    const baseKm = 20000;
    const kmScale = simulatorInputs.annualKm / baseKm;
    const baseMaintenance = Number(input.maintenance_per_km || 0) * baseKm;
    const annualMaintenance = Number(input.maintenance_per_km || 0) * simulatorInputs.annualKm * (1 + simulatorInputs.maintenanceInflation);
    const baseEnergy = Math.max(Number(row.annual_operating_cost || 0) - baseMaintenance, 0);
    const energyMultiplier = row.type === "Retrofit" || row.type === "OEM EV" ? simulatorInputs.electricityMultiplier : simulatorInputs.fuelMultiplier;
    const annualEnergy = baseEnergy * kmScale * energyMultiplier;
    const annualOperating = annualMaintenance + annualEnergy;
    const lifecycleCost = (Number(row.purchase_price || 0) + annualOperating * simulatorInputs.horizon) * simulatorInputs.fleetSize;
    const lifecycleEmissions = (Number(row.manufacturing_emissions_tonnes || 0) + Number(row.annual_emissions_tonnes || 0) * kmScale * simulatorInputs.horizon) * simulatorInputs.fleetSize;
    return { ...row, annualMaintenance, annualEnergy, annualOperating, lifecycleCost, lifecycleEmissions };
  });
  const simulatedBest = simulatedRows.reduce((winner, row) => !winner || row.lifecycleCost < winner.lifecycleCost ? row : winner, null);
  const simulatedRetrofit = simulatedRows.find((row) => row.type === "Retrofit") || simulatedRows[0];
  const simulatedIce = simulatedRows.find((row) => row.type === "ICE") || simulatedRows.find((row) => row.type === "Diesel");
  const simulatedSavings = Number(simulatedIce?.lifecycleCost || 0) - Number(simulatedRetrofit?.lifecycleCost || 0);
  const simulatedGas = simulatedRows.find((row) => row.type === "ICE");
  const simulatedDiesel = simulatedRows.find((row) => row.type === "Diesel");
  const annualFuelSavingsVsGas = simulatedGas && simulatedRetrofit ? Math.max(0, Number(simulatedGas.annualEnergy || 0) - Number(simulatedRetrofit.annualEnergy || 0)) : 0;
  const annualFuelSavingsVsDiesel = simulatedDiesel && simulatedRetrofit ? Math.max(0, Number(simulatedDiesel.annualEnergy || 0) - Number(simulatedRetrofit.annualEnergy || 0)) : 0;
  const simulatedTimeline = Array.from({ length: Math.floor(simulatorInputs.horizon) + 1 }, (_, year) => {
    const item = { year: `${year}Y` };
    simulatedRows.forEach((row) => {
      const annualOperating = Number(row.annualOperating || 0);
      item[row.type] = (Number(row.purchase_price || 0) + annualOperating * year) * simulatorInputs.fleetSize;
    });
    return item;
  });
  const simulatedBreakevenYear = simulatedRetrofit && simulatedIce
    ? Array.from({ length: Math.floor(simulatorInputs.horizon) + 1 }, (_, year) => year).find((year) => {
        const retrofitCost = (Number(simulatedRetrofit.purchase_price || 0) + Number(simulatedRetrofit.annualOperating || 0) * year) * simulatorInputs.fleetSize;
        const iceCost = (Number(simulatedIce.purchase_price || 0) + Number(simulatedIce.annualOperating || 0) * year) * simulatorInputs.fleetSize;
        return retrofitCost <= iceCost;
      })
    : null;
  const simulatedBreakevenText = simulatedBreakevenYear == null ? `>${Math.round(simulatorInputs.horizon)} years` : `Year ${simulatedBreakevenYear}`;

  const emissionsTimelineData = Array.from({ length: 11 }, (_, year) => {
    const item = { year: `${year}Y` };
    rows.forEach((row) => {
      item[row.type] = lifecycleEmissionsAt(row, year);
    });
    return item;
  });


  const selectedPage = navItems.find((item) => item.id === activeView) || navItems[0];

  const PageHeader = ({ title, kicker }) => (
    <div className="yana-page-head">
      <div>
        {kicker && <p className="yana-kicker">{kicker}</p>}
        <h2>{title}</h2>
      </div>
    </div>
  );

  const assistantStarterPrompts = [
    "Which pathway wins right now?",
    "Explain the carbon credits",
    "Why is maintenance not zero?",
    "What should we tell the client?",
  ];

  const buildAssistantAnswer = (question) => {
    const lower = question.toLowerCase();
    const currentBest = best?.type || "the current lowest-cost pathway";
    const retrofitCost = currency(retrofitTunedRow?.tunedCost ?? costAt(retrofit, horizon));
    const iceCost = currency(iceTunedRow?.tunedCost ?? costAt(iceRow, horizon));
    const savings = currency(activeSavingsVsIce);
    const emissions = tonnes(emissionsAvoidedVsIce);
    const annualFuelGas = annual(annualFuelSavingsVsGas);
    const annualFuelDiesel = annual(annualFuelSavingsVsDiesel);
    const currentPage = selectedPage.label;

    if (lower.includes("team") || lower.includes("who built") || lower.includes("who made")) {
      return "Core team: Saad, Ross, and Ocean. BlueForce: Nataliia Vladyka. BCIT support: Alan Stewart and Clay Howey.";
    }

    if (lower.includes("what am i seeing") || lower.includes("current page") || lower.includes("this page")) {
      return `${currentPage} is showing ${vehicle} under ${activeOwnership.label} mode at Year ${horizon}. The current cost winner is ${currentBest}.`;
    }

    if (lower.includes("carbon") || lower.includes("credit") || lower.includes("cfr") || lower.includes("lcfs")) {
      return `BC LCFS potential is ${currency(storyCarbonValue)} at ${storyCarbonKm.toLocaleString()} km/year. Federal CFR sensitivity is ${currency(federalCfrPotentialValue)} at CAD $350/t CO2e. Combined potential is ${currency(combinedCreditPotentialValue)}.`;
    }

    if (lower.includes("fuel") || lower.includes("gas") || lower.includes("diesel")) {
      return `At ${simulatorInputs.annualKm.toLocaleString()} km/year, retrofit saves ${annualFuelGas} versus gasoline ICE${simulatedDiesel ? ` and ${annualFuelDiesel} versus diesel` : ""}. The app compares annual ICE fuel cost against retrofit electricity cost under the current multipliers.`;
    }

    if (lower.includes("maintenance") || lower.includes("service")) {
      return `Maintenance uses a simple benchmark: annual km × maintenance cost per km. In the simulator, ${vehicle} retrofit maintenance is ${annual(simulatedRetrofit?.annualMaintenance || 0)} at ${simulatorInputs.annualKm.toLocaleString()} km/year. EV maintenance is lower than ICE, not zero.`;
    }

    if (lower.includes("breakeven") || lower.includes("payback")) {
      return `Current breakeven is ${breakevenText}. In simulator mode it is ${simulatedBreakevenText} versus ICE, using ${activeOwnership.label}.`;
    }

    if (lower.includes("emission") || lower.includes("co2") || lower.includes("ghg")) {
      return `For ${vehicle}, retrofit avoids ${emissions} lifecycle CO2e versus ICE at Year ${horizon}. Lifecycle emissions = manufacturing at Year 0 + operating emissions over time.`;
    }

    if (lower.includes("how") || lower.includes("formula") || lower.includes("calculate")) {
      return "Core logic: lifecycle cost = purchase price + annual operating cost × years. Lifecycle CO2e = manufacturing CO2e at Year 0 + annual operating CO2e × years. Use the inline info markers on the relevant cards for context.";
    }

    if (lower.includes("cost") || lower.includes("saving") || lower.includes("win") || lower.includes("pathway")) {
      return `${currentBest} currently leads. Retrofit is ${retrofitCost}; ICE is ${iceCost}; retrofit difference versus ICE is ${savings} over ${horizon} years.`;
    }

    if (lower.includes("client") || lower.includes("recommend") || lower.includes("investor") || lower.includes("government")) {
      return `Lead with cost, breakeven, emissions avoided, and funding potential. For ${vehicle}, ${currentBest} leads now; retrofit difference versus ICE is ${savings}; lifecycle CO2e avoided is ${emissions}.`;
    }

    return `${vehicle}, Year ${horizon}: ${currentBest} leads. Retrofit is ${retrofitCost}; ICE is ${iceCost}; difference is ${savings}; emissions avoided are ${emissions}.`;
  };

  const askAssistant = (presetQuestion) => {
    const question = (presetQuestion || assistantQuestion).trim();
    if (!question) return;
    const answer = buildAssistantAnswer(question);
    setAssistantMessages((current) => [...current, { role: "user", text: question }, { role: "assistant", text: answer }]);
    setAssistantQuestion("");
    setAssistantOpen(true);
  };

  const renderAssistantDock = () => (
    <motion.aside className={assistantOpen ? "ai-command-dock open" : "ai-command-dock"} initial={false} animate={{ y: assistantOpen ? 0 : 12, opacity: assistantOpen ? 1 : 0.96 }} transition={{ duration: 0.22 }}>
      <button className="ai-command-trigger" type="button" onClick={() => setAssistantOpen((current) => !current)} aria-expanded={assistantOpen} aria-label={assistantOpen ? "Close Ask BlueForce" : "Open Ask BlueForce"} title="Ask BlueForce">
        <span className="ai-command-orb" aria-hidden="true" />
      </button>
      {assistantOpen && (
        <div className="ai-command-panel">
          <div className="ai-command-head">
            <button type="button" onClick={() => setAssistantOpen(false)} aria-label="Close AI assistant"><X size={16} /></button>
          </div>
          <div className={assistantMessages.length ? "ai-message-list" : "ai-message-list empty"}>
            {!assistantMessages.length && <div className="ai-message-empty">Ask a question.</div>}
            {assistantMessages.slice(-6).map((message, index) => (
              <div key={`${message.role}-${index}-${message.text.slice(0, 12)}`} className={`ai-message ${message.role}`}>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <form className="ai-question-form" onSubmit={(event) => { event.preventDefault(); askAssistant(); }}>
            <MessageCircle size={16} />
            <input value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} placeholder="Ask a question" />
            <button type="submit" aria-label="Ask question"><SendHorizontal size={16} /></button>
          </form>
        </div>
      )}
    </motion.aside>
  );

  const renderOverview = () => (
    <>
      <motion.section className="executive-brief-card cinematic-hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <div>
          <span>BCIT Capstone · BlueForce Energy</span>
          <h2>Retrofit Transition Decision Platform</h2>
          <p>Executive decision support for choosing whether to keep ICE/diesel, buy OEM EV, or retrofit fleet vehicles.</p>
          <div className="hero-signal-row" aria-label="Decision platform signals">
            <b>Lifecycle cost</b>
            <b>Emissions</b>
            <b>Breakeven</b>
            <b>Funding potential</b>
          </div>
        </div>
        <div className="executive-brief-actions">
          <button type="button" onClick={() => goToView("simulator")}>Start simulation</button>
          <button type="button" onClick={() => goToView("comparison")}>Compare vehicles</button>
        </div>
      </motion.section>
      <motion.section className="ai-briefing-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}>
        <div className="ai-pulse" aria-hidden="true" />
        <div>
          <span>AI briefing</span>
          <strong>{retrofitWins ? `${vehicle} retrofit is the current financial lead.` : `${best?.type || "Review"} currently leads under these assumptions.`}</strong>
          <p>{retrofitWins ? `${currency(activeSavingsVsIce)} lower than ICE over ${horizon} years, with ${tonnes(emissionsAvoidedVsIce)} lifecycle CO2e avoided.` : `Review ownership mode, vehicle price assumption, and sponsor-validated maintenance before final recommendation.`}</p>
        </div>
        <button type="button" onClick={() => setAssistantOpen(true)}>Ask the model</button>
      </motion.section>
      <motion.section className="yana-kpi-grid executive-kpis" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14 }}>
        <button className="yana-kpi-card" type="button" onClick={() => goToView("comparison")}><span>Best {horizon}-Year Option</span><strong>{best?.type || "Pending"}</strong><small>{currency(best?.tunedCost)} total cost</small></button>
        <button className="yana-kpi-card" type="button" onClick={() => setDetailOpen("savings")}><span>{horizon}-Year Difference</span><strong>{currency(activeSavingsVsIce)}</strong><small>Retrofit vs ICE</small></button>
        <button className="yana-kpi-card" type="button" onClick={() => goToView("carbon")}><span>Emissions Reduced</span><strong>{tonnes(emissionsAvoidedVsIce)}</strong><small>Lifecycle CO2e</small></button>
        <button className="yana-kpi-card" type="button" onClick={() => goToView("breakeven")}><span>Breakeven Year</span><strong>{breakevenText}</strong><small>$0 confirmed incentive</small></button>
      </motion.section>
      <section className="yana-main-grid executive-main-grid">
        <article className="yana-card yana-chart-card">
          <div className="yana-card-head"><div><span>Lifecycle Cost Comparison</span><h3>{vehicle} pathways, year 0 to 10</h3></div><p>Hover the curve to inspect cost at each year.</p></div>
          <ResponsiveContainer width="100%" height={330}>
            <LineChart data={costTimelineData} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} stroke="#6B7280" />
              <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} stroke="#6B7280" domain={[0, "auto"]} />
              <Tooltip content={<GlassTooltip formatter={currency} />} />
              <Legend />
              {rows.map((row) => <Line key={row.type} type="monotone" dataKey={row.type} stroke={linePalette[row.type] || "#9CA3AF"} strokeWidth={3} dot={{ r: 4 }} connectNulls isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </article>
        <aside className="yana-card yana-recommendation executive-recommendation">
          <span>Recommended Pathway</span>
          <h3>{retrofitWins ? "BlueForce Retrofit" : best?.type || "Review"}</h3>
          <p>{retrofitWins ? `Lowest ${horizon}-year cost for ${vehicle}, with ${currency(activeSavingsVsIce)} savings versus ICE.` : `Current assumptions favor ${best?.type}. Retrofit is ${currency(Math.abs(activeSavingsVsIce))} ${activeSavingsVsIce < 0 ? "higher" : "lower"} than ICE.`}</p>
          <p>{tonnes(emissionsAvoidedVsIce)} lifecycle CO2e avoided versus ICE.</p>
          <button type="button" onClick={() => setDetailOpen("cost")}>View cost logic</button>
        </aside>
      </section>
    </>
  );

  const renderSimulator = () => (
    <>
      <PageHeader title="Fleet simulator" kicker="Live controls. Drag and watch the chart move." />
      <section className="yana-simulator-grid live-simulator-grid">
        <article className="yana-card yana-input-panel live-input-panel">
          <ControlSlider label="Fleet size" value={simulatorInputs.fleetSize} min={0} max={50} step={1} format={(value) => `${Math.round(value)} vehicles`} onChange={(value) => updateSimulatorInput("fleetSize", value)} />
          <ControlSlider label="Annual km" value={simulatorInputs.annualKm} min={0} max={50000} step={250} format={(value) => `${Math.round(value).toLocaleString()} km`} onChange={(value) => updateSimulatorInput("annualKm", value)} />
          <ControlSlider label="Fuel price" value={simulatorInputs.fuelMultiplier} min={0.5} max={2} step={0.01} format={(value) => `${Number(value).toFixed(2)}x`} onChange={(value) => updateSimulatorInput("fuelMultiplier", value)} />
          <ControlSlider label="Electricity price" value={simulatorInputs.electricityMultiplier} min={0.5} max={2} step={0.01} format={(value) => `${Number(value).toFixed(2)}x`} onChange={(value) => updateSimulatorInput("electricityMultiplier", value)} />
          <ControlSlider label="Maintenance inflation" value={simulatorInputs.maintenanceInflation} min={0} max={0.3} step={0.005} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateSimulatorInput("maintenanceInflation", value)} />
          <ControlSlider label="Time horizon" value={simulatorInputs.horizon} min={0} max={10} step={1} format={(value) => `${Math.round(value)} years`} onChange={(value) => updateSimulatorInput("horizon", value)} />
        </article>
        <article className="yana-card yana-chart-card live-chart-card">
          <div className="yana-card-head">
            <div><span>Live simulator result</span><h3>{simulatedBest?.type || "Pending"} currently leads</h3></div>
            <b>{currency(simulatedRetrofit?.lifecycleCost || 0)}</b>
          </div>
          <div className="live-summary-row">
            <span><b>{currency(simulatedSavings)}</b> difference vs ICE</span>
            <span><b>{simulatedBreakevenText}</b> breakeven vs ICE</span>
            <span><b>{annual(simulatedRetrofit?.annualMaintenance || 0)}</b> maintenance</span>
            <span className="metric-explainer"><b>{annual(annualFuelSavingsVsGas)}</b> gas fuel savings<span className="metric-popover">Annual gasoline savings = ICE annual fuel cost minus retrofit electricity cost at the selected annual km and fuel/electricity multipliers.</span></span>
            {simulatedDiesel && <span className="metric-explainer"><b>{annual(annualFuelSavingsVsDiesel)}</b> diesel fuel savings<span className="metric-popover">Annual diesel savings = diesel annual fuel cost minus retrofit electricity cost at the selected annual km and fuel/electricity multipliers.</span></span>}
            <span><b>{tonnes(simulatedRetrofit?.lifecycleEmissions || 0)}</b> lifecycle CO2e</span>
          </div>
          <ResponsiveContainer width="100%" height={315}>
            <LineChart data={simulatedTimeline} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} stroke="#6B7280" />
              <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} stroke="#6B7280" domain={[0, "auto"]} />
              <Tooltip content={<GlassTooltip formatter={currency} />} />
              <Legend />
              {simulatedRows.map((row) => <Line key={row.type} type="monotone" dataKey={row.type} stroke={linePalette[row.type] || "#9CA3AF"} strokeWidth={3} dot={false} activeDot={{ r: 5 }} isAnimationActive animationDuration={260} />)}
              {simulatedRows.map((row, index) => (
                <ReferenceDot
                  key={`${row.type}-live-marker`}
                  x={`${Math.round(simulatorInputs.horizon)}Y`}
                  y={row.lifecycleCost}
                  r={5}
                  fill="#FFFFFF"
                  stroke={linePalette[row.type] || "#9CA3AF"}
                  strokeWidth={3}
                  ifOverflow="extendDomain"
                  label={{
                    value: compactMoney(row.lifecycleCost),
                    position: index === 0 ? "top" : index === 1 ? "right" : "bottom",
                    fill: linePalette[row.type] || "#6B7280",
                    fontSize: 12,
                    fontWeight: 760,
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </article>
      </section>
    </>
  );

  const renderComparison = () => (
    <>
      <PageHeader title="Vehicle comparison" kicker="Three pathways, same truck class." />
      <section className="yana-comparison-grid">
        {comparisonCards.map((row) => (
          <article key={row.model} className={`yana-path-card path-${row.type.toLowerCase().replace(/[^a-z0-9]+/g, "-")} ${row.type === best?.type ? "best" : ""} ${row.type === selectedType ? "selected" : ""}`} onClick={() => setSelectedType(row.type)}>
            <span>{row.type === "Retrofit" ? "BlueForce Retrofit" : row.type}</span>
            <h3>{row.model}</h3>
            <InteractiveVehicleViewer type={row.type} family={vehicle} />
            <dl>
              <div><dt>Purchase price</dt><dd>{currency(row.purchase_price)}</dd></div>
              <div className="metric-explainer"><dt>Annual maintenance <Info size={13} /></dt><dd>{annual(row.annualMaintenance)}</dd><span className="metric-popover">Estimated as {annualKm.toLocaleString()} km/year × {currency(row.maintenancePerKm)}/km. This is a benchmark planning estimate, not a confirmed BlueForce service quote. Validate tires, inspections, repairs, battery service, and duty-cycle assumptions with the sponsor.</span></div>
              <div><dt>Annual operating</dt><dd>{annual(row.annual_operating_cost)}</dd></div>
              <div><dt>{horizon}-year lifecycle cost</dt><dd>{currency(costAt(row, horizon))}</dd></div>
              <div className="metric-explainer"><dt>Savings vs ICE/gas <Info size={13} /></dt><dd className={row.savingsVsIce >= 0 ? "positive-metric" : "negative-metric"}>{currency(row.savingsVsIce)}</dd><span className="metric-popover">Formula: ICE/gas cumulative cost minus this pathway cumulative cost at Year {horizon}. Positive means this option is cheaper than the ICE/gas baseline; negative means it costs more under current assumptions.</span></div>
              <div><dt>Lifecycle emissions</dt><dd>{tonnes(lifecycleEmissionsAt(row, horizon))}</dd></div>
            </dl>
            <p>{row.type === "Retrofit" ? `${row.bestUse}. ${activeOwnership.help}` : row.bestUse}</p>
          </article>
        ))}
      </section>
    </>
  );

  const renderScenario = () => (
    <>
      <PageHeader title="Scenario analysis" kicker="One driver changes at a time." />
      <section className="yana-tabs">{scenarioTabs.map((tab) => <button key={tab.id} type="button" className={activeScenarioTab === tab.id ? "active" : ""} onClick={() => { setScenarioTab(tab.id); if (tab.id !== "emissions") setScenario(tab.id); }}>{tab.label}</button>)}</section>
      <section className="scenario-summary-strip">
        <article className="yana-card scenario-note"><span>Question</span><strong>What changes when one input moves?</strong><p>{scenarioContext[activeScenarioTab]?.axis}</p></article>
        <article className="yana-card scenario-note compact"><span>{scenarioCurrentLabel}</span><strong>{scenarioStats.primary}</strong><p>{scenarioStats.secondary}</p></article>
        <article className="yana-card scenario-note compact"><span>{scenarioStats.deltaLabel}</span><strong>{scenarioStats.delta}</strong><p>{scenarioContext[activeScenarioTab]?.method}</p></article>
      </section>
      <section className="yana-card yana-chart-card">
        <div className="yana-card-head"><div><span>{scenarioTabs.find((tab) => tab.id === activeScenarioTab)?.label}</span><h3>{selectedRow.type} sensitivity</h3></div><p>{scenarioTabs.find((tab) => tab.id === activeScenarioTab)?.insight}</p></div>
        <ResponsiveContainer width="100%" height={380}>
          {activeScenarioTab === "emissions" ? (
            <BarChart data={scenarioTabChart} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="type" tickLine={false} axisLine={false} stroke="#6B7280" />
              <YAxis tickFormatter={(value) => `${value}t`} tickLine={false} axisLine={false} stroke="#6B7280" domain={[0, "auto"]} />
              <Tooltip content={<GlassTooltip formatter={(value) => tonnes(value)} note={scenarioContext.emissions.method} />} />
              <Legend />
              <Bar dataKey="manufacturing" name="Manufacturing" stackId="a" fill="#9CA3AF" />
              <Bar dataKey="operating" name="Operating" stackId="a" fill="#2563EB" />
            </BarChart>
          ) : (
            <LineChart data={scenarioTabChart} margin={{ top: 18, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#6B7280" />
              <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} stroke="#6B7280" domain={[0, "auto"]} />
              <Tooltip content={<GlassTooltip formatter={currency} note={scenarioContext[activeScenarioTab]?.method} />} />
              <Line type="monotone" dataKey="value" name={`${horizon}-year cost`} stroke={linePalette[selectedRow.type] || "#2563EB"} strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} isAnimationActive animationDuration={260} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </section>
    </>
  );

  const renderBreakeven = () => (
    <>
      <PageHeader title="Breakeven" kicker="When cumulative retrofit cost catches or beats the comparison pathway." />
      <section className="yana-breakeven-grid">
        <article className="yana-card yana-breakeven-summary">
          <span>Breakeven year</span>
          <strong>{breakevenDisplay}</strong>
          <small>{activeOwnership.label} mode, $0 confirmed incentive</small>
          <p>{activeOwnership.help}</p>
          <dl className="mini-method-list">
            <div><dt>Retrofit start cost</dt><dd>{currency(retrofit?.purchase_price)}</dd></div>
            <div><dt>Includes donor ICE</dt><dd>{currency(retrofit?.donor_ice_purchase_price_added || 0)}</dd></div>
            <div><dt>Manufacturing CO2e added</dt><dd>{tonnes(retrofit?.donor_ice_manufacturing_emissions_added_tonnes || 0)}</dd></div>
          </dl>
        </article>
        <article className="yana-card yana-chart-card">
          <div className="yana-card-head"><div><span>Cumulative cost curve</span><h3>{vehicle} retrofit vs alternatives</h3></div><p>Hover a year to see purchase plus operating cost up to that point.</p></div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={costTimelineData} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} stroke="#6B7280" />
              <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} stroke="#6B7280" domain={[0, "auto"]} />
              <Tooltip content={<GlassTooltip formatter={currency} note={`Retrofit mode: ${activeOwnership.help}`} />} />
              <Legend />
              {rows.map((row) => <Line key={row.type} type="monotone" dataKey={row.type} stroke={linePalette[row.type] || "#9CA3AF"} strokeWidth={3} dot={{ r: 4 }} connectNulls isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </article>
      </section>
    </>
  );

  const renderCarbon = () => (
    <>
      <PageHeader title="Carbon impact" kicker="Funding and ESG view. Credits stay separate from lifecycle cost." />
      <section className="yana-kpi-grid compact carbon-credit-kpis">
        <article className="yana-kpi-card"><span>CO2e reduced</span><strong>{tonnes(emissionsAvoidedVsIce)}</strong><small>Lifecycle basis at Year {horizon}</small></article>
        <article className="yana-kpi-card"><span>BC LCFS potential</span><strong>{currency(storyCarbonValue)}</strong><small>{storyCarbonKm.toLocaleString()} km/year, model export</small></article>
        <article className="yana-kpi-card"><span>Federal CFR sensitivity</span><strong>{currency(federalCfrPotentialValue)}</strong><small>$350/t CO2e, unconfirmed market reference</small></article>
        <article className="yana-kpi-card"><span>Combined potential</span><strong>{currency(combinedCreditPotentialValue)}</strong><small>Separate from vehicle lifecycle cost</small></article>
      </section>
      <section className="carbon-credit-stack">
        <article className="yana-card yana-chart-card">
          <div className="yana-card-head">
            <div><span>Credit potential</span><h3>BC LCFS + Federal CFR sensitivity</h3></div>
            <p>Shown as funding potential only. It does not reduce total lifecycle cost.</p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={[
              { label: "BC LCFS", value: storyCarbonValue },
              { label: "Federal CFR", value: federalCfrPotentialValue },
              { label: "Combined", value: combinedCreditPotentialValue },
            ]} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#6B7280" />
              <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} stroke="#6B7280" domain={[0, "auto"]} />
              <Tooltip content={<GlassTooltip formatter={currency} note="BC LCFS comes from the model export. Federal CFR is estimated as lifecycle CO2e avoided × CAD $350/t sensitivity." />} />
              <Bar dataKey="value" name="Potential credit value" radius={[12, 12, 0, 0]}>
                <Cell fill="#2563EB" />
                <Cell fill="#10B981" />
                <Cell fill="#111827" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="yana-card carbon-method-card">
          <span>Method</span>
          <h3>Keep credits separate until ownership is validated.</h3>
          <dl>
            <div><dt>BC LCFS</dt><dd>Model export based on eligible EV charging electricity, kWh use, credit rate, annual km, and fixed base credit price.</dd></div>
            <div><dt>Federal CFR</dt><dd>Simple sensitivity: lifecycle CO2e avoided vs ICE × CAD $350/t. Market price and eligibility are not fixed.</dd></div>
            <div><dt>Combined</dt><dd>BC LCFS potential + Federal CFR sensitivity. Not added into lifecycle cost or breakeven.</dd></div>
          </dl>
          <p>{FEDERAL_CFR_NOTE}</p>
        </article>
      </section>
      <section className="carbon-chart-grid">
        <article className="yana-card yana-chart-card"><div className="yana-card-head"><div><span>Lifecycle emissions</span><h3>Manufacturing + operating emissions</h3></div><p>Year 0 starts with manufacturing emissions. Operating emissions add over time.</p></div><ResponsiveContainer width="100%" height={330}><BarChart data={emissionsChart}><CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="type" tickLine={false} axisLine={false} stroke="#6B7280" /><YAxis tickFormatter={(value) => `${value}t`} tickLine={false} axisLine={false} stroke="#6B7280" domain={[0, "auto"]} /><Tooltip content={<GlassTooltip formatter={(value) => tonnes(value)} note="Lifecycle emissions = manufacturing emissions + operating emissions through the selected year." />} /><Legend /><Bar dataKey="manufacturing" name="Manufacturing" stackId="a" fill="#9CA3AF" /><Bar dataKey="operating" name="Operating" stackId="a" fill="#2563EB" /></BarChart></ResponsiveContainer></article>
        <article className="yana-card yana-chart-card"><div className="yana-card-head"><div><span>Emissions breakeven</span><h3>{vehicle} lifecycle emissions curve</h3></div><p>Shows whether retrofit lifecycle CO2e catches or beats the ICE pathway over ten years.</p></div><ResponsiveContainer width="100%" height={330}><LineChart data={emissionsTimelineData} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="year" tickLine={false} axisLine={false} stroke="#6B7280" /><YAxis tickFormatter={(value) => `${value}t`} tickLine={false} axisLine={false} stroke="#6B7280" domain={[0, "auto"]} /><Tooltip content={<GlassTooltip formatter={(value) => tonnes(value)} note="Lifecycle emissions include manufacturing emissions at Year 0 plus operating emissions over time." />} /><Legend />{rows.map((row) => <Line key={row.type} type="monotone" dataKey={row.type} stroke={linePalette[row.type] || "#9CA3AF"} strokeWidth={3} dot={{ r: 4 }} connectNulls isAnimationActive={false} />)}</LineChart></ResponsiveContainer></article>
      </section>
    </>
  );

  const renderEVNetwork = () => {
    const activeStation = selectedStation || filteredStations[0] || GREATER_VANCOUVER_STATIONS[0];
    const priorityStations = [
      activeStation,
      ...filteredStations.filter((station) => station.id !== activeStation.id),
    ].slice(0, 6);
    return (
      <>
        <PageHeader title="BC charging network" kicker="Province-wide infrastructure view for customer and funding discussions." />
        <section className="ev-network-shell">
          <article className="yana-card ev-network-map-card">
            <div className="ev-map-toolbar">
              <div className="ev-map-search">
                <Search size={17} />
                <input
                  value={stationSearch}
                  onChange={(event) => setStationSearch(event.target.value)}
                  placeholder="Search station, city, connector, operator"
                  aria-label="Search EV stations"
                />
              </div>
              <select value={stationCity} onChange={(event) => setStationCity(event.target.value)} aria-label="Filter EV stations by city">
                {stationCities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <EVNetworkMap stations={filteredStations} selectedStation={activeStation} onSelectStation={setSelectedStation} />
            <div className="ev-map-hint">
              <span>Drag map</span>
              <span>Scroll to zoom</span>
              <span>Click pins for station details</span>
            </div>
          </article>
          <aside className="ev-network-side">
            <article className="yana-card ev-station-detail">
              <span className="ev-pill">Selected station</span>
              <h3>{activeStation.name}</h3>
              <p>{activeStation.address}</p>
              <dl>
                <div><dt>Operator</dt><dd>{activeStation.operator}</dd></div>
                <div><dt>Total plugs</dt><dd>{activeStation.plugs}</dd></div>
                <div><dt>DC fast</dt><dd>{activeStation.fastChargers}</dd></div>
                <div><dt>Level 2</dt><dd>{activeStation.level2}</dd></div>
                <div><dt>Connectors</dt><dd className="connector-chip-row">{activeStation.connectorTypes.map((type) => <ConnectorTag key={type} type={type} />)}</dd></div>
              </dl>
              <div className="ev-glass-note">
                <Zap size={17} />
                <span>{activeStation.fleetUse}</span>
              </div>
            </article>
            <article className="yana-card ev-network-kpis">
              <div><span>Stations shown</span><strong>{evNetworkStats.stations}</strong></div>
              <div><span>Total plugs</span><strong>{evNetworkStats.plugs}</strong></div>
              <div><span>DC fast</span><strong>{evNetworkStats.fast}</strong></div>
              <div><span>Level 2</span><strong>{evNetworkStats.level2}</strong></div>
              <div><span>Cities covered</span><strong>{evNetworkStats.cities}</strong></div>
            </article>
            <article className="yana-card ev-station-picker">
              <div>
                <span>Quick results</span>
                <strong>{filteredStations.length} locations</strong>
              </div>
              {priorityStations.map((station) => (
                <button key={station.id} type="button" className={station.id === activeStation.id ? "active" : ""} onClick={() => setSelectedStation(station)}>
                  <MapPin size={15} />
                  <span>{station.name}</span>
                  <small>{station.city} · {station.plugs} plugs</small>
                </button>
              ))}
            </article>
          </aside>
        </section>
        <p className="ev-source-note">{EV_NETWORK_SOURCE_NOTE}</p>
      </>
    );
  };

  const renderPolicy = () => {
    const bcLinks = EV_POLICY_LINKS.filter((item) => item.jurisdiction === "BC");
    const federalLinks = EV_POLICY_LINKS.filter((item) => item.jurisdiction === "Canada");
    return (
      <>
        <PageHeader title="EV policy and benefits" kicker="Official BC and federal sources only." />
        <section className="policy-hero-grid">
          <article className="yana-card policy-summary-card">
            <span>Why this matters</span>
            <h3>Use verified government sources before quoting incentives.</h3>
            <p>EV rebates, charger funding, and credit rules change. This page keeps the decision platform connected to official BC and federal pages instead of informal estimates.</p>
          </article>
          <article className="yana-card policy-check-card">
            <span>Client use</span>
            <ul>
              <li>Check current rebate eligibility.</li>
              <li>Validate charging support for workplaces and fleets.</li>
              <li>Keep carbon credits separate from lifecycle cost.</li>
            </ul>
          </article>
        </section>
        <section className="policy-source-grid">
          <article className="yana-card policy-column">
            <div className="policy-column-head"><span>British Columbia</span><strong>Provincial programs</strong></div>
            {bcLinks.map((item) => <PolicySourceCard key={item.title} item={item} />)}
          </article>
          <article className="yana-card policy-column">
            <div className="policy-column-head"><span>Canada</span><strong>Federal programs</strong></div>
            {federalLinks.map((item) => <PolicySourceCard key={item.title} item={item} />)}
          </article>
        </section>
        <section className="yana-card policy-note-card">
          <Info size={17} />
          <p>Do not treat listed incentives as guaranteed. Use these links to verify the exact vehicle class, buyer type, funding availability, stacking rules, and application timing before presenting a client recommendation.</p>
        </section>
      </>
    );
  };

  const renderDataMap = () => {
    const activeNode = selectedDataNode || DATA_MAP_NODES[0];
    const sourceNodes = DATA_MAP_NODES.filter((node) => node.type === "source");
    const center = 300;
    const outerRadius = 232;
    const layerRadius = 124;
    const sourceAngles = [-90, -48, -12, 30, 74, 116, 158, 204, 252];
    const pointFor = (angle, radius) => {
      const radians = angle * Math.PI / 180;
      return { x: center + Math.cos(radians) * radius, y: center + Math.sin(radians) * radius };
    };
    const labelAnchor = (x) => x < center - 28 ? "start" : x > center + 28 ? "end" : "middle";
    const labelOffset = (x) => x < center - 28 ? 24 : x > center + 28 ? -24 : 0;
    const placedSources = sourceNodes.map((node, index) => {
      const point = pointFor(sourceAngles[index] ?? ((360 / sourceNodes.length) * index), outerRadius);
      return {
        ...node,
        ...point,
        anchor: labelAnchor(point.x),
        labelX: point.x + labelOffset(point.x),
        labelY: point.y + (point.y < center - 175 ? (point.x < center - 40 ? 28 : -18) : point.y > center + 175 ? (point.x < center - 40 ? -18 : 24) : 4),
      };
    });
    const placedLayers = DATA_MAP_LAYERS.map((layer) => ({ ...layer, ...pointFor(layer.angle, layerRadius) }));

    return (
      <>
        <PageHeader title="Data source map" kicker="Demo test view: how evidence flows into the model." />
        <section className="data-map-shell">
          <article className="yana-card data-map-card">
            <div className="data-map-stage spatial" aria-label="Interactive data source mapping diagram">
              <svg viewBox="0 0 600 600" role="img" aria-label="Sources connected to model layers and dashboard outputs">
                <defs>
                  <radialGradient id="dataCoreGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#DCE6ED" />
                  </radialGradient>
                </defs>
                <circle cx={center} cy={center} r="240" className="data-orbit" />
                <circle cx={center} cy={center} r="134" className="data-inner-orbit" />
                {placedSources.map((node, index) => {
                  const layer = placedLayers[index % placedLayers.length];
                  return <path key={node.id} className={activeNode.id === node.id ? "data-link active" : "data-link"} d={`M ${node.x} ${node.y} Q ${center} ${center} ${layer.x} ${layer.y}`} />;
                })}
                {placedLayers.map((layer) => (
                  <g key={layer.id} className="data-layer-node">
                    <line x1={center} y1={center} x2={layer.x} y2={layer.y} className="data-core-link" />
                    <circle cx={layer.x} cy={layer.y} r="22" />
                    <text x={layer.x} y={layer.y + 42}>{layer.label}</text>
                  </g>
                ))}
                <g className="data-core-node">
                  <circle cx={center} cy={center} r="70" fill="url(#dataCoreGlow)" />
                  <Database x={center - 16} y={center - 30} size={32} />
                  <text x={center} y={center + 18}>Forecasting</text>
                  <text x={center} y={center + 38}>model</text>
                </g>
                {placedSources.map((node) => (
                  <g key={node.id} className={activeNode.id === node.id ? "data-source-node active" : "data-source-node"} onClick={() => setSelectedDataNode(node)} onMouseEnter={() => setSelectedDataNode(node)} tabIndex="0" role="button" aria-label={node.label}>
                    <circle className="data-hit" cx={node.x} cy={node.y} r="30" />
                    <circle cx={node.x} cy={node.y} r="14" />
                    <text x={node.labelX} y={node.labelY} textAnchor={node.anchor}>{node.shortLabel || node.label}</text>
                  </g>
                ))}
              </svg>
            </div>
          </article>
          <aside className="yana-card data-map-detail">
            <span>{activeNode.category}</span>
            <h3>{activeNode.label}</h3>
            <p>{activeNode.summary}</p>
            <div className="data-map-route"><span>Source</span><b>→</b><span>Model</span><b>→</b><span>Dashboard</span></div>
            <div className="data-feed-list">
              {activeNode.feeds.map((feed) => <button key={feed} type="button">{feed}</button>)}
            </div>
            <div className="data-map-flow">
              <div><b>1</b><span>Collect</span></div>
              <div><b>2</b><span>Transform</span></div>
              <div><b>3</b><span>Forecast</span></div>
              <div><b>4</b><span>Explain</span></div>
            </div>
          </aside>
        </section>
      </>
    );
  };

  const pageContent = {
    overview: renderOverview,
    simulator: renderSimulator,
    comparison: renderComparison,
    scenario: renderScenario,
    breakeven: renderBreakeven,
    carbon: renderCarbon,
    policy: renderPolicy,
    "ev-network": renderEVNetwork,
    "data-map": renderDataMap,
  };

  const handleLoginSubmit = (event) => {
    event.preventDefault();
    const normalizedCode = loginCode.trim().toLowerCase();
    if (["blueforce", "bcit", "capstone"].includes(normalizedCode)) {
      setLoginError("");
      setLoginUnlocking(true);
      window.setTimeout(() => {
        window.localStorage.setItem("blueforce-demo-unlocked", "true");
        setIsUnlocked(true);
      }, 850);
      return;
    }
    setLoginError("Access code not recognized.");
  };

  const handleLockApp = () => {
    window.localStorage.removeItem("blueforce-demo-unlocked");
    setLoginUnlocking(false);
    setLoginCode("");
    setLoginError("");
    setIsUnlocked(false);
  };

  const handleToggleSound = () => {
    setSoundOn((current) => {
      const next = !current;
      window.localStorage.setItem("blueforce-demo-sound", next ? "on" : "off");
      return next;
    });
  };

  const handleThemeChange = (themeId) => {
    setVisualTheme(themeId);
    window.localStorage.setItem("blueforce-visual-theme", themeId);
  };

  return (
    <>
      <div className={`device-preview-root device-preview-${devicePreview} theme-${visualTheme}`}>
        {isUnlocked && (
          <div className="device-preview-switch" role="radiogroup" aria-label="Preview viewport">
            {DEVICE_PREVIEW_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={devicePreview === id ? "active" : ""}
                onClick={() => setDevicePreview(id)}
                aria-pressed={devicePreview === id}
                title={`Switch to ${label.toLowerCase()} view`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
        <div className="device-preview-frame">
          <main className={isUnlocked ? "yana-app-shell" : "yana-app-shell app-locked-behind"} aria-hidden={!isUnlocked}>
      <aside className="yana-sidebar" aria-label="Primary navigation">
        <div className="yana-sidebar-logo"><img src="/assets/logos/blueforce-logo.png" alt="BlueForce Energy" /></div>
        <nav>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={activeView === id ? "active" : ""} onClick={() => goToView(id)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="yana-sidebar-foot" type="button" onClick={() => setDetailOpen("team")}>
          <Users size={18} />
          <span>Team</span>
        </button>
      </aside>
      <section className="yana-workspace">
        <header className="yana-topbar compact-topbar">
          <div className={ownershipMode === "full" ? "yana-filter-row full-top-controls new-car-active" : "yana-filter-row full-top-controls"}>
            <select value={vehicle} onChange={(event) => setVehicle(event.target.value)} aria-label="Vehicle model">
              {VEHICLES.map((item) => <option key={item}>{item}</option>)}
              <option value="additional-cars" disabled>Additional cars · Premium</option>
            </select>
            <div className="top-year-control">
              <ControlSlider label="Year" value={horizon} min={0} max={10} step={1} format={(value) => `Year ${Math.round(value)}`} onChange={(value) => setHorizon(value)} />
            </div>
            <div className="top-mode-toggle" role="radiogroup" aria-label="Retrofit purchase mode">
              {OWNERSHIP_MODES.map((mode) => (
                <button key={mode.id} type="button" className={ownershipMode === mode.id ? "active" : ""} onClick={() => { setOwnershipMode(mode.id); if (mode.id === "full") setNewCarPercent(50); }}>{mode.label}</button>
              ))}
            </div>
            {ownershipMode === "full" && (
              <div className="top-percent-control">
                <ControlSlider label="New car price" value={newCarPercent} min={1} max={100} step={1} format={(value) => `${Math.round(value)}%`} onChange={(value) => setNewCarPercent(value)} />
              </div>
            )}
            <div className="theme-mode-toggle" role="radiogroup" aria-label="Visual theme">
              {VISUAL_THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={visualTheme === id ? "active" : ""}
                  onClick={() => handleThemeChange(id)}
                  aria-pressed={visualTheme === id}
                  title={`${label} theme`}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="top-data-mode-toggle" role="radiogroup" aria-label="Data connection mode">
              <button type="button" className={dataMode === "snapshot" ? "active" : ""} onClick={() => setDataMode("snapshot")} title="Uses the exported scenario-data.json model snapshot.">
                Snapshot
              </button>
              <button type="button" className="locked-live" disabled title="Premium live data connection concept: connected sheets, market prices, and government data feeds.">
                Live <LockKeyhole size={12} />
              </button>
            </div>
            <button className="topbar-team-button" type="button" onClick={() => setDetailOpen("team")} title="Open team information">
              <Users size={15} />
              <span>Team</span>
            </button>
            <button className={soundOn ? "topbar-sound-button active" : "topbar-sound-button"} type="button" onClick={handleToggleSound} aria-pressed={soundOn} title={soundOn ? "Turn interface sound off" : "Turn interface sound on"}>
              {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundOn ? "Sound" : "Muted"}</span>
            </button>
            <button className="topbar-lock-button" type="button" onClick={handleLockApp} title="Lock app and return to sign in">
              <LogOut size={15} />
              <span>Lock</span>
            </button>
          </div>
        </header>
        <div className="yana-title-row">
          <div><p>{today}</p><h1>Retrofit Transition Decision Platform</h1></div>
          <span>{selectedPage.label}</span>
        </div>
        <div className="yana-page-carousel" ref={pageCarouselRef} onWheelCapture={handleCarouselWheel} onScroll={syncActiveViewFromCarousel} aria-label="Decision platform pages">
          {navItems.map((item) => {
            const renderPage = pageContent[item.id] || renderOverview;
            return (
              <section
                key={item.id}
                className={`yana-page-panel ${activeView === item.id ? "active" : ""}`}
                data-view-id={item.id}
                ref={(node) => {
                  if (node) pagePanelRefs.current[item.id] = node;
                }}
                aria-hidden={activeView !== item.id}
              >
                <div className="yana-page-panel-scroll">
                  <section className="yana-page">{renderPage()}</section>
                </div>
              </section>
            );
          })}
        </div>
      </section>
        {renderAssistantDock()}
        <LayerDrawer detail={detailOpen ? detailContent[detailOpen] : null} onClose={() => setDetailOpen(null)} />
          </main>
        </div>
      </div>
      {!isUnlocked && (
        <LoginWall
          loginCode={loginCode}
          loginError={loginError}
          isUnlocking={loginUnlocking}
          onCodeChange={setLoginCode}
          onSubmit={handleLoginSubmit}
        />
      )}
    </>
  );
}

function LoginWall({ loginCode, loginError, isUnlocking, onCodeChange, onSubmit }) {
  return (
    <main className={isUnlocking ? "login-wall-shell unlocking" : "login-wall-shell"}>
      <div className="lock-app-preview" aria-hidden="true">
        <div className="lock-preview-shell">
          <div className="lock-preview-sidebar">
            {Array.from({ length: 7 }).map((_, index) => <span key={index} />)}
          </div>
          <div className="lock-preview-workspace">
            <div className="lock-preview-top" />
            <div className="lock-preview-title" />
            <div className="lock-preview-kpis">
              <span /><span /><span /><span />
            </div>
            <div className="lock-preview-chart" />
          </div>
        </div>
      </div>
      <section className="login-stage" aria-label="Secure BlueForce access">
        <div className="login-panel-left">
          <div className="login-brand-row">
            <img src="/assets/logos/blueforce-logo.png" alt="BlueForce Energy" />
            <span>BCIT Capstone</span>
          </div>
          <div className="login-security-mark">
            <ShieldCheck size={22} />
          </div>
          <p className="login-kicker">Secure access</p>
          <h1>Decision platform</h1>
          <p className="login-copy">Enter the access code to open the BlueForce retrofit workspace.</p>
          <form className="login-form" onSubmit={onSubmit}>
            <label htmlFor="access-code">Access code</label>
            <div className="login-input-wrap">
              <LockKeyhole size={17} />
              <input
                id="access-code"
                value={loginCode}
                onChange={(event) => onCodeChange(event.target.value)}
                type="password"
                placeholder="Access code"
                autoComplete="off"
              />
            </div>
            {loginError && <small className="login-error">{loginError}</small>}
            <button type="submit" disabled={isUnlocking}>
              <LogIn size={17} />
              {isUnlocking ? "Unlocking" : "Enter platform"}
            </button>
          </form>
        </div>
        <div className="login-panel-right" aria-hidden="true">
          <div className="login-visual-grid" />
          <div className="login-vehicle-orbit">
            <div className="login-orbit-ring" />
            <div className="login-truck-shape"><span /></div>
          </div>
          <div className="login-visual-copy">
            <span>BlueForce model</span>
            <h2>Protected fleet transition workspace.</h2>
            <p>Cost, emissions, infrastructure, and funding views.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function PolicySourceCard({ item }) {
  return (
    <a className="policy-source-card" href={item.url} target="_blank" rel="noreferrer">
      <div>
        <span>{item.tag}</span>
        <h4>{item.title}</h4>
        <p>{item.summary}</p>
      </div>
      <small>{item.whyItMatters}</small>
    </a>
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
