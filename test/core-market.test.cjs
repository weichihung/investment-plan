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
  assert.equal(settings.foreignDepositTwd, settings.foreignDepositUsd * 31.7);
  assert.match(settings.quoteStatus, /GitHub 每日備援/);
  assert.ok(saved);
});

test("prefers newer exchange dates from the GitHub snapshot over a stale Worker", async () => {
  global.INVESTMENT_MARKET_CONFIG.apiBaseUrl = "https://worker.test";
  global.fetch = async (url) => ({
    ok: true,
    json: async () => ({
      schemaVersion: 1,
      generatedAt: url.includes("worker.test") ? "2026-10-01T09:00:00Z" : "2026-10-01T10:00:00Z",
      quotes: {
        "0050": url.includes("worker.test")
          ? { price: 112.05, date: "2026-09-30", annualDividend: 1.28 }
          : { price: 112.9, date: "2026-10-01", annualDividend: 1.28 },
        VOO: {
          price: url.includes("worker.test") ? 703.1226 : 700.86,
          date: "2026-09-30", annualDividend: 6.03434667
        }
      },
      fx: { USD_TWD: { rate: 31.908932, date: "2026-10-01" } }
    })
  });
  try {
    const settings = await core.updateQuotes(core.clone(core.defaults));
    assert.equal(settings.holdingSettings["0050"].price, 112.9);
    assert.equal(settings.holdingSettings.VOO.price, 700.86);
    assert.equal(settings.quoteDates.TW, "2026-10-01");
    assert.match(settings.quoteStatus, /比對/);
  } finally {
    global.INVESTMENT_MARKET_CONFIG.apiBaseUrl = "";
  }
});

test("forecast remains finite after the quote integration", () => {
  const rows = core.forecast(core.clone(core.defaults));
  assert.equal(rows.length, 23);
  assert.ok(rows.every((row) => Object.values(row)
    .filter((value) => typeof value === "number")
    .every(Number.isFinite)));
  assert.equal(rows.find((row) => row.year === 2030).stockSales, 0);
});
