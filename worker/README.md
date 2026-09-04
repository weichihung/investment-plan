# Market API Worker

The Worker provides the GitHub Pages site with browser-safe market data:

- `GET /health`
- `GET /market/refresh`
- `GET /market/latest`

Taiwan closing prices come from TWSE OpenAPI, US closes come from Nasdaq and USD/TWD comes from ExchangeRate-API. Dividend estimates come from the daily GitHub snapshot, which combines current-year official announcements with server-side distribution events and stores annual dividends after the confirmed 20% reduction.

Production: `https://investment-plan-market-api.weichihung.workers.dev`

Deploy from this directory with `npx wrangler deploy`. A `MARKET_KV` binding is optional. Without KV, desktop and mobile still receive the same five-minute cached response and share the GitHub fallback snapshot.
