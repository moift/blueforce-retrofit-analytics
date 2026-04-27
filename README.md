# BlueForce Retrofit Analytics Dashboard

Client-facing React dashboard for the BCIT BlueForce Energy capstone forecasting model.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL Vite prints in the terminal.

## Production Build

```bash
npm run build
```

Vercel can deploy this project directly from GitHub using the default Vite settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Data

The dashboard reads exported forecasting data from:

```text
assets/scenario-data.json
```

The app UI should not change model logic or source data structures without sponsor/team review.
