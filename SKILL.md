---
name: maintain-investment-plan
description: Maintain and extend this personal investment planning website, including portfolio valuation, dividend forecasts, annual cash flow, vehicle financing, projected holdings, desktop/mobile interfaces, market quote updates, and GitHub Pages deployment. Use when modifying calculations, holdings, planning parameters, reports, quote data, UI, or deployment for this investment-plan workspace.
---

# Maintain Investment Plan

## Start Here

1. Read `AGENTS.md` before changing files.
2. Inspect `shared/core.js` for financial rules and `shared/app.js` for rendering behavior.
3. Update both `web/` and `mobile/` when changing visible fields or interactions.
4. Treat `更新報價` as an end-to-end workflow: refresh market data, update shared defaults and migration version, deploy, verify both public desktop and mobile pages, then return both URLs.
5. Treat all projections as planning estimates, not guaranteed investment outcomes.

## File Ownership

- `shared/core.js`: defaults, holdings, valuation, dividends, cash flow, allocation, car loan, projected prices and units.
- `shared/app.js`: shared rendering, year selection, alerts, settings, tables and charts.
- `web/index.html`, `web/styles.css`: desktop interface.
- `mobile/index.html`, `mobile/mobile.css`: mobile-first interface.
- `deploy/`: flattened GitHub Pages output. Regenerate it after source changes.
- `AGENTS.md`: repo-level operating instructions for future agents.
- `SKILL.md`: this reusable workflow guide.

## Financial Rules

- Start planning in June 2026 at age 43.
- Use six salary and investment months in 2026; use 14 salary months from 2027 onward.
- Stop salary income before age 65.
- Use a default annual return of 6% and a default planning period of 10 years.
- Keep at least TWD 800,000 when funding the car down payment.
- Model the car loan at 2.5% annual interest over 48 monthly payments.
- Sell 00919 first for the car down payment; use only cash above TWD 800,000 for any shortfall.
- Before age 61, allocate investments according to the growth allocation in `allocationForAge()`.
- At age 61, sell all 00631L and NVDA and use the defensive allocation.
- Display Taiwan holdings in lots of 1,000 shares and US holdings in shares.
- Roll the 2026 remaining salary, expense and investment months forward automatically from the browser date.
- Persist edited holding units and cost basis in `holdingSettings` only after an explicit save action.

## Market Data

When the user requests updated quotes or dividends:

1. Browse current authoritative or primary market sources when possible.
2. Record the latest completed trading-day close and its exact date.
3. Update USD/TWD using the latest available market rate.
4. Estimate annual dividends from current-year announced distributions and expected frequency.
5. Preserve the last valid values if a remote update fails.
6. Never label cost basis as latest price.

## Quote Update Checklist

For requests like `更新報價` or `更新下述及更新報價`:

1. Apply user-provided deposits, holding units and cost basis exactly.
2. Fetch latest close prices, dividend data and USD/TWD.
3. Update `settingsDefaults` in `shared/core.js`.
4. Increment `DATA_VERSION` when browser-stored defaults must be replaced.
5. Update cache query versions in desktop and mobile HTML when scripts or defaults change.
6. Rebuild `deploy/index.html`, `deploy/mobile.html`, shared scripts and styles.
7. Validate JavaScript syntax and run forecast sanity checks.
8. Publish through the GitHub integration when available.
9. Verify the public desktop and mobile URLs after GitHub Pages updates.
10. Final response must include the two links:
    - `https://weichihung.github.io/investment-plan/`
    - `https://weichihung.github.io/investment-plan/mobile.html`

## Implementation Workflow

1. Trace the affected calculation through `forecast()` before editing the UI.
2. Store reusable yearly values on each forecast row rather than recalculating them differently in the UI.
3. Keep desktop and mobile element IDs aligned because they share `shared/app.js`.
4. Increment `DATA_VERSION` when defaults must replace previously saved browser data.
5. Do not overwrite user-adjustable settings during ordinary quote updates.

## Validation

- Parse `shared/core.js` and `shared/app.js` for syntax errors.
- Verify all forecast numeric fields are finite.
- Check at least 2026, the car-purchase year, the first post-2027 allocation year, and age 61 when included.
- Confirm yearly security investments sum to `plannedInvestment`.
- Confirm projected security market values sum to the displayed yearly stock total.
- Confirm changing TWD and foreign deposits changes cash and total assets by the same amount.
- Verify desktop and mobile pages contain every element ID used by `shared/app.js`.

## Publish

1. Copy the desktop page to `deploy/index.html` and mobile page to `deploy/mobile.html`.
2. Copy shared scripts and styles into `deploy/` and change references to flat relative paths.
3. Publish the root of the `main` branch to GitHub Pages.
4. Verify both URLs after deployment:
   - `https://weichihung.github.io/investment-plan/`
   - `https://weichihung.github.io/investment-plan/mobile.html`
