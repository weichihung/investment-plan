const DIVIDEND_NET_FACTOR = 0.8;

export const MARKET_DEFINITIONS = {
  VOO: { yahoo: "VOO", market: "US", frequency: 4 },
  NVDA: { yahoo: "NVDA", market: "US", frequency: 4, mode: "latestRunRate" },
  "0050": { yahoo: "0050.TW", market: "TW", frequency: 2 },
  "0056": { yahoo: "0056.TW", market: "TW", frequency: 4 },
  "00919": { yahoo: "00919.TW", market: "TW", frequency: 4 },
  "00631L": { yahoo: "00631L.TW", market: "TW", frequency: 0 }
};

function rounded(value, digits = 8) {
  return Number(Number(value).toFixed(digits));
}

function validNumber(value) {
  return Number.isFinite(Number(value));
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
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

export async function buildMarketSnapshot({ fetchImpl = fetch, now = new Date() } = {}) {
  const symbols = Object.keys(MARKET_DEFINITIONS);
  const [twseResult, ...yahooResults] = await Promise.allSettled([
    fetchTwse(fetchImpl),
    ...symbols.map((symbol) => fetchYahoo(fetchImpl, MARKET_DEFINITIONS[symbol].yahoo)),
    fetchYahoo(fetchImpl, "TWD=X")
  ]);
  const twse = twseResult.status === "fulfilled" ? twseResult.value : {};
  const yahooBySymbol = {};
  const failures = [];

  symbols.forEach((symbol, index) => {
    const result = yahooResults[index];
    if (result.status === "fulfilled") yahooBySymbol[symbol] = result.value;
    else failures.push(`${symbol}: ${result.reason?.message || "Yahoo failed"}`);
  });
  const fxResult = yahooResults[symbols.length];
  const fxYahoo = fxResult?.status === "fulfilled" ? fxResult.value : null;
  if (!fxYahoo) failures.push(`USD/TWD: ${fxResult?.reason?.message || "Yahoo failed"}`);
  if (twseResult.status === "rejected") failures.push(`TWSE: ${twseResult.reason?.message || "TWSE failed"}`);

  const quotes = {};
  symbols.forEach((symbol) => {
    const definition = MARKET_DEFINITIONS[symbol];
    const yahoo = yahooBySymbol[symbol];
    const official = definition.market === "TW" ? twse[symbol] : null;
    const priceSource = official || yahoo;
    if (!priceSource?.price) {
      failures.push(`${symbol}: no closing price`);
      return;
    }
    quotes[symbol] = {
      price: priceSource.price,
      date: priceSource.date,
      annualDividend: definition.frequency
        ? estimateNetAnnualDividend(yahoo?.dividends || [], definition.frequency, definition.mode, now)
        : 0,
      priceSource: official ? official.source : "Yahoo Finance",
      dividendSource: definition.frequency ? "Yahoo Finance events, net 80%" : "No distribution"
    };
  });

  if (!Object.keys(quotes).length || !fxYahoo?.price) {
    throw new Error(`Market snapshot unavailable: ${failures.join("; ")}`);
  }
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: Object.keys(quotes).length === symbols.length && !failures.length ? "complete" : "partial",
    quotes,
    fx: {
      USD_TWD: { rate: fxYahoo.price, date: fxYahoo.date, source: "Yahoo Finance" }
    },
    failures
  };
}

