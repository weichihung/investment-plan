const assert = require("node:assert/strict");
const test = require("node:test");

global.window = global;
let saved = null;
global.localStorage = {
  getItem: () => null,
  setItem: (_key, value) => { saved = JSON.parse(value); }
};
global.INVESTMENT_MARKET_CONFIG = {
  apiBaseUrl: "",
  fallbackUrl: "https://snapshot.test/market-data.json"
};
require("../shared/core.js");

const core = global.InvestmentCore;

test("applies a normalized remote market snapshot", async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      schemaVersion: 1,
      generatedAt: "2026-08-29T08:00:00Z",
      quotes: {
        VOO: { price: 710, date: "2026-08-28", annualDividend: 6 },
        NVDA: { price: 228, date: "2026-08-28", annualDividend: 0.8 },
        "0050": { price: 107, date: "2026-08-29", annualDividend: 1.28 },
        "0056": { price: 54, date: "2026-08-29", annualDividend: 3.4 },
        "00919": { price: 31.5, date: "2026-08-29", annualDividend: 2.848 },
        "00631L": { price: 36.4, date: "2026-08-29", annualDividend: 0 }
      },
      fx: { USD_TWD: { rate: 31.7, date: "2026-08-29" } }
    })
  });
  const settings = await core.updateQuotes(core.clone(core.defaults));
  assert.equal(settings.fxRate, 31.7);
  assert.equal(settings.holdingSettings.VOO.price, 710);
  assert.equal(settings.holdingSettings.NVDA.annualDividend, 0.8);
  assert.equal(settings.quoteDates.TW, "2026-08-29");
  assert.match(settings.quoteStatus, /GitHub 每日備援/);
  assert.ok(saved);
});

test("forecast remains finite after the quote integration", () => {
  const rows = core.forecast(core.clone(core.defaults));
  assert.equal(rows.length, 23);
  assert.ok(rows.every((row) => Object.values(row)
    .filter((value) => typeof value === "number")
    .every(Number.isFinite)));
  assert.equal(rows.find((row) => row.year === 2030).stockSales, 0);
});

