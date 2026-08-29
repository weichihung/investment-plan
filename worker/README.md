# Market API Worker

The Worker provides the GitHub Pages site with browser-safe market data:

- `GET /health`
- `GET /market/refresh`
- `GET /market/latest`

Taiwan closing prices come from TWSE OpenAPI. US prices, USD/TWD and dividend events use Yahoo Finance server-side. Annual dividends are stored after the confirmed 20% reduction.

Deploy from this directory with `npx wrangler deploy`. A `MARKET_KV` binding is optional but recommended so desktop and mobile read the same stored snapshot.

