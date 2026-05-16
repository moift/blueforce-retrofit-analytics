# BlueForce Retrofit MCP Server

This folder exposes the BlueForce retrofit model as a small MCP server.

## What it does

The web app is for humans. This MCP server is for AI assistants. It lets an AI tool ask structured questions such as:

- What is the 10-year summary for F-150?
- Compare retrofit, ICE/diesel, and OEM EV pathways.
- Explain the maintenance-cost methodology.
- Return carbon-credit values as a separate revenue model.
- Return official EV policy/source links.

It reads the same static app export:

```txt
public/assets/scenario-data.json
```

## Run locally

From the app folder:

```bash
npm run mcp
```

The server speaks MCP over standard input/output, so it waits for JSON-RPC messages from an MCP client.

## Claude Desktop style config

```json
{
  "mcpServers": {
    "blueforce-retrofit": {
      "command": "node",
      "args": [
        "/Users/Mo/Files/01 Business/General thread - Codex/retrofit-analytics-app/mcp/blueforce-mcp-server.js"
      ]
    }
  }
}
```

## Tools exposed

- `get_vehicle_summary`
- `compare_pathways`
- `get_carbon_credit_summary`
- `get_maintenance_methodology`
- `get_ev_policy_sources`
- `get_model_checks`

## Important scope note

This MCP server does not change model logic. It only exposes existing exported results and methodology in a structured way for AI tools.
