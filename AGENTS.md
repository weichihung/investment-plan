# Investment Plan Workspace Instructions

## User Context

- The user is an audit analyst who prefers structured, concise and traceable reporting.
- The user invests in stocks and uses this system to plan long-term assets and cash flow.
- Respond in Traditional Chinese unless the user requests another language.

## Project Goal

Maintain a personal investment-planning system that provides:

- Current portfolio value, profit and estimated dividends.
- Annual income, expenses, investments, cash and total assets.
- Adjustable salary, return, planning years, car assumptions and deposits.
- Suggested monthly investments by security.
- Projected yearly holdings, market values and holding percentages.
- Separate desktop and mobile experiences.

## Engineering Rules

- Read `SKILL.md` before implementing investment-system changes.
- Keep financial calculations in `shared/core.js` and display logic in `shared/app.js`.
- Keep desktop and mobile element IDs compatible with the shared application script.
- Update both interfaces for user-visible changes.
- Use structured calculations; do not duplicate financial formulas in HTML.
- Preserve browser-stored user settings unless a deliberate data migration is required.
- Increment `DATA_VERSION` for migrations that must replace old defaults.
- Do not silently change holdings, costs, salary, deposits or planning assumptions.

## Data Accuracy

- Browse the web when updating quotes, distributions, exchange rates or other current market data.
- Prefer official exchange, fund issuer and investor-relations sources; use market aggregators only as a fallback.
- Show the exact latest trading date and distinguish cost basis from market price.
- State assumptions for estimated dividends and projected returns.
- This system provides planning estimates, not financial guarantees or personalized investment advice.

## Current Confirmed Assumptions

- Planning starts in June 2026 at age 43.
- Default planning period is 10 years.
- Default annual return is 6%.
- Salary is counted for six months in 2026 and 14 months annually from 2027, ending before age 65.
- The 2026 forecast rolls monthly: June uses six remaining months, July uses five, and the count decreases through year-end.
- Holding cost and quantity edits are persisted only when the user presses the save-holdings button.
- Car financing uses 2.5% annual interest and 48 monthly payments.
- The car down payment sells 00919 first and must leave at least TWD 800,000 cash.
- Taiwan holdings are displayed in lots; US holdings are displayed in shares.

## Quote Update Workflow

When the user requests `更新報價` or asks to update holdings plus quotes:

- Refresh latest completed close prices for 0050, 0056, 00919, 00631L, VOO and NVDA.
- Refresh USD/TWD using the latest available market rate.
- Refresh or estimate annual dividends from the latest available distribution data.
- Update user-provided deposits, units and cost basis exactly as stated.
- Increment cache/version values when needed so both published pages load fresh files.
- Rebuild the deploy files for both desktop and mobile.
- Publish to GitHub Pages through the GitHub integration when available.
- Verify both public URLs after deployment.
- In the final response, always include both public links:
  - Desktop: `https://weichihung.github.io/investment-plan/`
  - Mobile: `https://weichihung.github.io/investment-plan/mobile.html`

## Verification

- Validate syntax after JavaScript changes.
- Test key forecast years and ensure numeric outputs remain finite.
- Confirm investment allocations, holdings and displayed totals reconcile.
- Verify both desktop and mobile interfaces after material UI changes.
- After deployment, test the public GitHub Pages desktop and mobile URLs.

## Deployment

- Repository: `weichihung/investment-plan`
- Desktop: `https://weichihung.github.io/investment-plan/`
- Mobile: `https://weichihung.github.io/investment-plan/mobile.html`
- Publish from the `main` branch root through GitHub Pages.
