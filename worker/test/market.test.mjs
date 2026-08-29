import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketSnapshot,
  buildWorkerMarketSnapshot,
  estimateNetAnnualDividend,
  parseNasdaqInfo,
  rocDateToIso
} from "../src/market.js";

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

test("parses Nasdaq closing prices", () => {
  const quote = parseNasdaqInfo({
    data: { primaryData: { lastSalePrice: "$707.24", lastTradeTimestamp: "Aug 27, 2026" } }
  });
  assert.deepEqual(quote, { price: 707.24, date: "2026-08-27", source: "Nasdaq" });
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

test("builds the Worker snapshot from official quotes and the daily dividend baseline", async () => {
  const baseline = {
    schemaVersion: 1,
    quotes: Object.fromEntries(Object.entries({
      VOO: 6.1,
      NVDA: 0.8,
      "0050": 1.28,
      "0056": 3.43,
      "00919": 2.85,
      "00631L": 0
    }).map(([symbol, annualDividend]) => [symbol, {
      price: 1,
      date: "2026-08-27",
      annualDividend,
      dividendSource: "daily"
    }])),
    fx: { USD_TWD: { rate: 31.5, date: "2026-08-28", source: "daily" } }
  };
  const fakeFetch = async (url) => {
    if (url.includes("openapi.twse.com.tw")) {
      return response([
        { Date: "1150828", Code: "0050", ClosingPrice: "106.95" },
        { Date: "1150828", Code: "0056", ClosingPrice: "53.85" },
        { Date: "1150828", Code: "00919", ClosingPrice: "31.44" },
        { Date: "1150828", Code: "00631L", ClosingPrice: "36.30" }
      ]);
    }
    if (url.includes("api.nasdaq.com") && url.includes("VOO")) {
      return response({ data: { primaryData: { lastSalePrice: "$707.24", lastTradeTimestamp: "Aug 27, 2026" } } });
    }
    if (url.includes("api.nasdaq.com") && url.includes("NVDA")) {
      return response({ data: { primaryData: { lastSalePrice: "$217.55", lastTradeTimestamp: "Aug 27, 2026" } } });
    }
    if (url.includes("open.er-api.com")) {
      return response({
        rates: { TWD: 31.656126 },
        time_last_update_utc: "Sat, 29 Aug 2026 00:02:31 +0000"
      });
    }
    return response(baseline);
  };
  const snapshot = await buildWorkerMarketSnapshot({
    fetchImpl: fakeFetch,
    now: new Date("2026-08-29T00:00:00Z")
  });
  assert.equal(snapshot.status, "complete");
  assert.equal(snapshot.quotes.VOO.price, 707.24);
  assert.equal(snapshot.quotes.VOO.annualDividend, 6.1);
  assert.equal(snapshot.quotes["0050"].price, 106.95);
  assert.equal(snapshot.fx.USD_TWD.rate, 31.656126);
});
