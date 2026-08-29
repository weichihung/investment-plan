import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketSnapshot, estimateNetAnnualDividend, rocDateToIso } from "../src/market.js";

const closeTimestamp = Date.UTC(2026, 7, 28, 20, 0, 0) / 1000;

function response(value) {
  return { ok: true, status: 200, json: async () => value };
}

function yahooPayload(price, dividends = []) {
  return {
    chart: {
      result: [{
        timestamp: [closeTimestamp],
        indicators: { quote: [{ close: [price] }] },
        events: {
          dividends: Object.fromEntries(dividends.map((amount, index) => [String(index), {
            amount,
            date: Date.UTC(2026, index * 2, 15) / 1000
          }]))
        }
      }]
    }
  };
}

test("skips zero placeholder closes", async () => {
  const payload = yahooPayload(100);
  payload.chart.result[0].timestamp.push(closeTimestamp + 86400);
  payload.chart.result[0].indicators.quote[0].close.push(0);
  const { parseYahooChart } = await import("../src/market.js");
  assert.equal(parseYahooChart(payload).price, 100);
});

test("converts ROC market dates", () => {
  assert.equal(rocDateToIso("1150828"), "2026-08-28");
});

test("applies the 20 percent dividend reduction", () => {
  const dividends = [1, 2].map((amount, index) => ({ amount, date: Date.UTC(2026, index, 1) }));
  assert.equal(estimateNetAnnualDividend(dividends, 4, null, new Date("2026-08-29T00:00:00Z")), 4.8);
  assert.equal(estimateNetAnnualDividend(dividends, 4, "latestRunRate", new Date("2026-08-29T00:00:00Z")), 6.4);
});

test("builds one normalized snapshot and prefers TWSE closes", async () => {
  const fakeFetch = async (url) => {
    if (url.includes("openapi.twse.com.tw")) {
      return response([
        { Date: "1150828", Code: "0050", ClosingPrice: "106.95" },
        { Date: "1150828", Code: "0056", ClosingPrice: "53.85" },
        { Date: "1150828", Code: "00919", ClosingPrice: "31.44" },
        { Date: "1150828", Code: "00631L", ClosingPrice: "36.30" }
      ]);
    }
    const symbol = decodeURIComponent(new URL(url).pathname.split("/").pop());
    const data = {
      VOO: yahooPayload(708.75, [1, 2]),
      NVDA: yahooPayload(227.98, [0.005, 0.01]),
      "0050.TW": yahooPayload(99, [0.8, 0.8]),
      "0056.TW": yahooPayload(49, [1, 1, 1, 1]),
      "00919.TW": yahooPayload(29, [0.8, 0.8, 0.8, 0.8]),
      "00631L.TW": yahooPayload(35),
      "TWD=X": yahooPayload(31.8)
    };
    return response(data[symbol]);
  };
  const snapshot = await buildMarketSnapshot({ fetchImpl: fakeFetch, now: new Date("2026-08-29T00:00:00Z") });
  assert.equal(snapshot.status, "complete");
  assert.equal(snapshot.quotes["0050"].price, 106.95);
  assert.equal(snapshot.quotes["0050"].priceSource, "TWSE OpenAPI");
  assert.equal(snapshot.quotes.NVDA.annualDividend, 0.032);
  assert.equal(snapshot.fx.USD_TWD.rate, 31.8);
});

