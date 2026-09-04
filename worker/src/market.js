const DIVIDEND_NET_FACTOR = 0.8;
const MARKET_SNAPSHOT_URL = "https://raw.githubusercontent.com/weichihung/investment-plan/main/market-data.json";

export const MARKET_DEFINITIONS = {
  VOO: {
    yahoo: "VOO", market: "US", frequency: 4,
    officialDividends: [
      { amount: 1.8724, date: Date.UTC(2026, 2, 27) },
      { amount: 1.9622, date: Date.UTC(2026, 5, 26) }
    ],
    dividendSource: "Vanguard distributions, net 80%"
  },
  NVDA: {
    yahoo: "NVDA", market: "US", frequency: 4, mode: "latestRunRate",
    officialDividends: [{ amount: 0.25, date: Date.UTC(2026, 5, 26) }],
    dividendSource: "NVIDIA quarterly dividend run rate, net 80%"
  },
  "0050": {
    yahoo: "0050.TW", market: "TW", frequency: 2,
    officialDividends: [
      { amount: 1, date: Date.UTC(2026, 0, 22) },
      { amount: 0.6, date: Date.UTC(2026, 6, 21) }
    ],
    dividendSource: "TWSE distributions, net 80%"
  },
  "0056": {
    yahoo: "0056.TW", market: "TW", frequency: 4,
    officialDividends: [
      { amount: 0.866, date: Date.UTC(2026, 0, 22) },
      { amount: 1, date: Date.UTC(2026, 3, 23) },
      { amount: 1.35, date: Date.UTC(2026, 6, 21) }
    ],
    dividendSource: "TWSE distributions, net 80%"
  },
  "00919": {
    yahoo: "00919.TW", market: "TW", frequency: 4,
    officialDividends: [
      { amount: 0.78, date: Date.UTC(2026, 2, 17) },
      { amount: 1, date: Date.UTC(2026, 5, 16) },
      { amount: 1.1, date: Date.UTC(2026, 8, 16) }
    ],
    dividendSource: "Capital Investment Trust announcement, net 80%"
  },
  "00631L": { yahoo: "00631L.TW", market: "TW", frequency: 0 }
};

function rounded(value, digits = 8) {
  return Number(Number(value).toFixed(digits));
}

function validNumber(value) {
  return Number.isFinite(Number(value));
}

async function fetchJson(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, {
    ...init,
    headers: { Accept: "application/json", ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

export function rocDateToIso(value) {
  const text = String(value || "").trim();
  if (!/^\d{7}$/.test(text)) return null;
  const year = Number(text.slice(0, 3)) + 1911;
  return `${year}-${text.slice(3, 5)}-${text.slice(5, 7)}`;
}

export function estimateNetAnnualDividend(dividends, frequency, mode, now = new Date()) {
  if (!frequency) return 0;
  const available = dividends.filter((item) => validNumber(item.amount) && validNumber(item.date));
  if (!available.length) return null;
  const currentYear = now.getUTCFullYear();
  const announced = available.filter((item) => new Date(Number(item.date)).getUTCFullYear() === currentYear);
  const source = announced.length ? announced : available.slice(-frequency);
  let grossAnnual;
  if (mode === "latestRunRate") {
    const latest = source.reduce((current, item) => Number(item.date) > Number(current.date) ? item : current);
    grossAnnual = Number(latest.amount) * frequency;
  } else {
    grossAnnual = source.reduce((sum, item) => sum + Number(item.amount), 0) / source.length * frequency;
  }
  return rounded(grossAnnual * DIVIDEND_NET_FACTOR);
}

function selectedDividendEvents(definition, yahooDividends, now) {
  const currentYear = now.getUTCFullYear();
  const official = (definition.officialDividends || []).filter(
    (item) => new Date(Number(item.date)).getUTCFullYear() === currentYear
  );
  return official.length ? official : yahooDividends;
}

export function parseYahooChart(payload) {
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo response did not contain chart data");
  const quotes = result.indicators?.quote?.[0]?.close || [];
  const timestamps = result.timestamp || [];
  let index = quotes.length - 1;
  while (index >= 0 && (!validNumber(quotes[index]) || Number(quotes[index]) <= 0)) index -= 1;
  if (index < 0 || !validNumber(timestamps[index])) throw new Error("Yahoo response did not contain a closing price");
  const dividends = Object.values(result.events?.dividends || {}).map((event) => ({
    amount: Number(event.amount),
    date: Number(event.date) * 1000
  }));
  return {
    price: rounded(quotes[index]),
    date: new Date(Number(timestamps[index]) * 1000).toISOString().slice(0, 10),
    dividends
  };
}

async function fetchYahoo(fetchImpl, yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d&events=div`;
  return parseYahooChart(await fetchJson(fetchImpl, url));
}

async function fetchTwse(fetchImpl) {
  const rows = await fetchJson(fetchImpl, "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL");
  return Object.fromEntries(rows
    .filter((row) => MARKET_DEFINITIONS[row.Code]?.market === "TW" && validNumber(row.ClosingPrice))
    .map((row) => [row.Code, {
      price: rounded(row.ClosingPrice),
      date: rocDateToIso(row.Date),
      source: "TWSE OpenAPI"
    }]));
}

export function parseNasdaqInfo(payload) {
  const primary = payload?.data?.primaryData;
  const secondary = payload?.data?.secondaryData;
  const quote = /^Closed at\s/i.test(String(secondary?.lastTradeTimestamp || ""))
    ? secondary
    : primary;
  const price = Number(String(quote?.lastSalePrice || "").replace(/[$,]/g, ""));
  const dateMatch = String(quote?.lastTradeTimestamp || "").match(/([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/);
  const monthIndex = dateMatch
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(dateMatch[1])
    : -1;
  if (!validNumber(price) || price <= 0 || !dateMatch || monthIndex < 0) {
    throw new Error("Nasdaq response did not contain a valid closing price");
  }
  return {
    price: rounded(price),
    date: `${dateMatch[3]}-${String(monthIndex + 1).padStart(2, "0")}-${String(dateMatch[2]).padStart(2, "0")}`,
    source: "Nasdaq"
  };
}

async function fetchNasdaq(fetchImpl, symbol, assetClass) {
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/info?assetclass=${assetClass}`;
  const payload = await fetchJson(fetchImpl, url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: "https://www.nasdaq.com",
      Referer: "https://www.nasdaq.com/",
      "User-Agent": "Mozilla/5.0"
    }
  });
  return parseNasdaqInfo(payload);
}

async function fetchOpenExchangeRate(fetchImpl) {
  const payload = await fetchJson(fetchImpl, "https://open.er-api.com/v6/latest/USD");
  const rate = Number(payload?.rates?.TWD);
  const parsedDate = new Date(payload?.time_last_update_utc || "");
  if (!validNumber(rate) || rate <= 0 || Number.isNaN(parsedDate.getTime())) {
    throw new Error("Exchange-rate response did not contain USD/TWD");
  }
  return {
    rate: rounded(rate),
    date: parsedDate.toISOString().slice(0, 10),
    source: "ExchangeRate-API"
  };
}

async function fetchMarketBaseline(fetchImpl, now) {
  return fetchJson(fetchImpl, `${MARKET_SNAPSHOT_URL}?ts=${now.getTime()}`);
}

function rejectionMessage(result, fallback) {
  return result?.status === "rejected" ? result.reason?.message || fallback : fallback;
}

export async function buildWorkerMarketSnapshot({ fetchImpl = fetch, now = new Date() } = {}) {
  const [twseResult, vooResult, nvdaResult, fxResult, baselineResult] = await Promise.allSettled([
    fetchTwse(fetchImpl),
    fetchNasdaq(fetchImpl, "VOO", "etf"),
    fetchNasdaq(fetchImpl, "NVDA", "stocks"),
    fetchOpenExchangeRate(fetchImpl),
    fetchMarketBaseline(fetchImpl, now)
  ]);
  const twse = twseResult.status === "fulfilled" ? twseResult.value : {};
  const baseline = baselineResult.status === "fulfilled" ? baselineResult.value : {};
  const usQuotes = {
    VOO: vooResult.status === "fulfilled" ? vooResult.value : null,
    NVDA: nvdaResult.status === "fulfilled" ? nvdaResult.value : null
  };
  const fx = fxResult.status === "fulfilled" ? fxResult.value : baseline?.fx?.USD_TWD;
  const failures = [];
  const quotes = {};

  Object.keys(MARKET_DEFINITIONS).forEach((symbol) => {
    const definition = MARKET_DEFINITIONS[symbol];
    const baselineQuote = baseline?.quotes?.[symbol];
    const latestQuote = definition.market === "TW" ? twse[symbol] : usQuotes[symbol];
    const priceSource = latestQuote || baselineQuote;
    if (!priceSource?.price || !priceSource?.date) {
      failures.push(`${symbol}: no closing price`);
      return;
    }
    const baselineDividend = Number(baselineQuote?.annualDividend);
    if (definition.frequency && !validNumber(baselineDividend)) {
      failures.push(`${symbol}: no dividend baseline`);
    }
    quotes[symbol] = {
      price: Number(priceSource.price),
      date: priceSource.date,
      annualDividend: definition.frequency && validNumber(baselineDividend) ? baselineDividend : 0,
      priceSource: latestQuote?.source || baselineQuote?.priceSource || "GitHub daily snapshot",
      dividendSource: definition.frequency
        ? baselineQuote?.dividendSource || "GitHub daily snapshot, net 80%"
        : "No distribution"
    };
  });

  if (twseResult.status === "rejected" && !Object.keys(twse).length) {
    failures.push(`TWSE: ${rejectionMessage(twseResult, "TWSE failed")}`);
  }
  if (vooResult.status === "rejected" && !usQuotes.VOO) {
    failures.push(`VOO: ${rejectionMessage(vooResult, "Nasdaq failed")}`);
  }
  if (nvdaResult.status === "rejected" && !usQuotes.NVDA) {
    failures.push(`NVDA: ${rejectionMessage(nvdaResult, "Nasdaq failed")}`);
  }
  if (fxResult.status === "rejected" && !fx) {
    failures.push(`USD/TWD: ${rejectionMessage(fxResult, "exchange-rate service failed")}`);
  }
  if (baselineResult.status === "rejected") {
    failures.push(`GitHub baseline: ${rejectionMessage(baselineResult, "snapshot failed")}`);
  }
  if (Object.keys(quotes).length !== Object.keys(MARKET_DEFINITIONS).length || !fx?.rate) {
    throw new Error(`Market snapshot unavailable: ${failures.join("; ")}`);
  }
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: failures.length ? "partial" : "complete",
    quotes,
    fx: { USD_TWD: fx },
    failures
  };
}

export async function buildMarketSnapshot({ fetchImpl = fetch, now = new Date() } = {}) {
  const symbols = Object.keys(MARKET_DEFINITIONS);
  const [twseResult, vooResult, nvdaResult, fxOfficialResult, ...yahooResults] = await Promise.allSettled([
    fetchTwse(fetchImpl),
    fetchNasdaq(fetchImpl, "VOO", "etf"),
    fetchNasdaq(fetchImpl, "NVDA", "stocks"),
    fetchOpenExchangeRate(fetchImpl),
    ...symbols.map((symbol) => fetchYahoo(fetchImpl, MARKET_DEFINITIONS[symbol].yahoo)),
    fetchYahoo(fetchImpl, "TWD=X")
  ]);
  const twse = twseResult.status === "fulfilled" ? twseResult.value : {};
  const usQuotes = {
    VOO: vooResult.status === "fulfilled" ? vooResult.value : null,
    NVDA: nvdaResult.status === "fulfilled" ? nvdaResult.value : null
  };
  const yahooBySymbol = {};
  const failures = [];

  symbols.forEach((symbol, index) => {
    const result = yahooResults[index];
    if (result.status === "fulfilled") yahooBySymbol[symbol] = result.value;
    else failures.push(`${symbol}: ${result.reason?.message || "Yahoo failed"}`);
  });
  const fxResult = yahooResults[symbols.length];
  const fxYahoo = fxResult?.status === "fulfilled" ? fxResult.value : null;
  const fxOfficial = fxOfficialResult.status === "fulfilled" ? fxOfficialResult.value : null;
  const fxError = fxResult?.status === "rejected" ? fxResult.reason?.message : "Yahoo failed";
  if (!fxOfficial && !fxYahoo) failures.push(`USD/TWD: ${fxError}`);
  if (twseResult.status === "rejected") failures.push(`TWSE: ${twseResult.reason?.message || "TWSE failed"}`);
  if (vooResult.status === "rejected") failures.push(`VOO Nasdaq: ${vooResult.reason?.message || "Nasdaq failed"}`);
  if (nvdaResult.status === "rejected") failures.push(`NVDA Nasdaq: ${nvdaResult.reason?.message || "Nasdaq failed"}`);
  if (fxOfficialResult.status === "rejected") failures.push(`USD/TWD primary: ${fxOfficialResult.reason?.message || "exchange-rate service failed"}`);

  const quotes = {};
  symbols.forEach((symbol) => {
    const definition = MARKET_DEFINITIONS[symbol];
    const yahoo = yahooBySymbol[symbol];
    const official = definition.market === "TW" ? twse[symbol] : usQuotes[symbol];
    const priceSource = official || yahoo;
    if (!priceSource?.price) {
      failures.push(`${symbol}: no closing price`);
      return;
    }
    quotes[symbol] = {
      price: priceSource.price,
      date: priceSource.date,
      annualDividend: definition.frequency
        ? estimateNetAnnualDividend(
          selectedDividendEvents(definition, yahoo?.dividends || [], now),
          definition.frequency,
          definition.mode,
          now
        )
        : 0,
      priceSource: official?.source || "Yahoo Finance",
      dividendSource: definition.frequency
        ? definition.dividendSource || "Yahoo Finance events, net 80%"
        : "No distribution"
    };
  });

  if (!Object.keys(quotes).length || (!fxOfficial?.rate && !fxYahoo?.price)) {
    throw new Error(`Market snapshot unavailable: ${failures.join("; ")}`);
  }
  const fx = fxOfficial || { rate: fxYahoo.price, date: fxYahoo.date, source: "Yahoo Finance" };
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: Object.keys(quotes).length === symbols.length && !failures.length ? "complete" : "partial",
    quotes,
    fx: {
      USD_TWD: fx
    },
    failures
  };
}
