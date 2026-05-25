# AutoParts Demand Intelligence

React dashboard demo for HBAAC 2026 final round.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Data

The app reads prepared CSV files from `public/data`:

- `forecast_long.csv`
- `sku_forecast_summary.csv`
- `sku_risk_table.csv`
- `recent_actuals.csv`
- `demo_metadata.json`

Inventory, lead time, stockout, and overstock signals are demo assumptions for decision support, not live ERP/WMS data.
