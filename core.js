(function (global) {
  "use strict";

  const STORAGE_KEY = "investment-plan-settings-v1";
  const DATA_VERSION = 9;
  const START_YEAR = 2026;
  const START_MONTH = 6;
  const BASE_AGE = 43;

  const holdings = [
    { symbol: "0050", name: "元大台灣50", market: "TW", units: 38927, cost: 39.82, price: 39.82, group: "0050", dividendFrequency: 2 },
    { symbol: "0056", name: "元大高股息", market: "TW", units: 32000, cost: 31.03, price: 31.03, group: "DIVIDEND", dividendFrequency: 4 },
    { symbol: "00919", name: "群益台灣精選高息", market: "TW", units: 51000, cost: 23.48, price: 23.48, group: "DIVIDEND", dividendFrequency: 4 },
    { symbol: "00631L", name: "元大台灣50正2", market: "TW", units: 1000, cost: 35.93, price: 35.93, group: "LEVERAGED", dividendFrequency: 0 },
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", market: "US", units: 17.4394, cost: 574.177, price: 574.177, group: "US", dividendFrequency: 4 },
    { symbol: "NVDA", name: "NVIDIA", market: "US", units: 112.2406, cost: 149.718, price: 149.718, group: "US", dividendFrequency: 4 }
  ];

  const defaults = {
    monthlySalary: 68000,
    dataVersion: DATA_VERSION,
    annualReturn: 6,
    years: 10,
    carPrice: 1900000,
    carYear: 2029,
    twdDeposit: 1460289,
    foreignDepositTwd: 180757,
    fxRate: 32.099,
    updatedAt: "2026-07-12T09:00:00+08:00",
    quoteStatus: "台股 2026/07/10、美股 2026/07/10、匯率 2026/07/10 最新資料",
    prices: { "0050": 105.80, "0056": 52.65, "00919": 29.97, "00631L": 36.78, VOO: 693.86, NVDA: 210.96 },
    annualDividends: { "0050": 2, "0056": 3.732, "00919": 3.56, "00631L": 0, VOO: 7.668, NVDA: 0.52 },
    holdingSettings: Object.fromEntries(holdings.map((item) => [item.symbol, { units: item.units, cost: item.cost }]))
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Number(saved.dataVersion || 0) < DATA_VERSION) {
        const holdingSettings = { ...JSON.parse(JSON.stringify(defaults.holdingSettings)), ...(saved.holdingSettings || {}) };
        ["0050", "00631L", "VOO", "NVDA"].forEach((symbol) => {
          holdingSettings[symbol] = { ...defaults.holdingSettings[symbol] };
        });
        return { ...defaults, ...saved, dataVersion: DATA_VERSION, years: defaults.years, fxRate: defaults.fxRate, updatedAt: defaults.updatedAt,
          quoteStatus: defaults.quoteStatus, prices: { ...defaults.prices }, annualDividends: { ...defaults.annualDividends },
          twdDeposit: defaults.twdDeposit, foreignDepositTwd: defaults.foreignDepositTwd, holdingSettings };
      }
      const savedQuoteTime = Date.parse(saved.updatedAt || "");
      const defaultQuoteTime = Date.parse(defaults.updatedAt);
      if (!Number.isFinite(savedQuoteTime) || savedQuoteTime < defaultQuoteTime) {
        return { ...defaults, ...saved, fxRate: defaults.fxRate, updatedAt: defaults.updatedAt,
          quoteStatus: defaults.quoteStatus, prices: { ...defaults.prices }, annualDividends: { ...defaults.annualDividends } };
      }
      return { ...defaults, ...saved };
    } catch (_error) {
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function formatTwd(value) {
    return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value || 0);
  }

  function formatUsd(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value || 0);
  }

  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: digits }).format(value || 0);
  }

  function portfolio(settings) {
    const fx = Number(settings.fxRate) || defaults.fxRate;
    return holdings.map((item) => {
      const savedHolding = (settings.holdingSettings && settings.holdingSettings[item.symbol]) || {};
      const units = Number(savedHolding.units ?? item.units);
      const cost = Number(savedHolding.cost ?? item.cost);
      const price = Number(settings.prices[item.symbol] || item.cost);
      const marketValueNative = units * price;
      const marketValueTwd = item.market === "US" ? marketValueNative * fx : marketValueNative;
      const costTwd = units * cost * (item.market === "US" ? fx : 1);
      const dividendNative = Number(settings.annualDividends[item.symbol] || 0) * units;
      const dividendTwd = dividendNative * (item.market === "US" ? fx : 1);
      return { ...item, units, cost, price, marketValueNative, marketValueTwd, costTwd, profit: marketValueTwd - costTwd, dividendTwd };
    });
  }

  function currentSummary(settings) {
    const items = portfolio(settings);
    const cash = Number(settings.twdDeposit) + Number(settings.foreignDepositTwd);
    const twStocks = items.filter((item) => item.market === "TW").reduce((sum, item) => sum + item.marketValueTwd, 0);
    const usStocks = items.filter((item) => item.market === "US").reduce((sum, item) => sum + item.marketValueTwd, 0);
    const dividends = items.reduce((sum, item) => sum + item.dividendTwd, 0);
    const profit = items.reduce((sum, item) => sum + item.profit, 0);
    return { cash, twStocks, usStocks, dividends, profit, total: cash + twStocks + usStocks };
  }

  function allocationForAge(age) {
    if (age >= 61) {
      return { cash: 0.05, etf50: 0.20, leveraged: 0, dividend: 0.60, us: 0.15 };
    }
    return { cash: 0.05, etf50: 0.50, leveraged: 0.10, dividend: 0.15, us: 0.20 };
  }

  function forecast(settings) {
    const summary = currentSummary(settings);
    const rate = Number(settings.annualReturn) / 100;
    const finalYear = START_YEAR + Number(settings.years);
    const fx = Number(settings.fxRate);
    const monthlyBaseExpense = 20000 + 22000 + 10000;
    const carDownPayment = Number(settings.carPrice) * 0.5;
    const monthlyCarRate = 0.025 / 12;
    const carLoanPrincipal = Number(settings.carPrice) * 0.5;
    const monthlyCarLoan = carLoanPrincipal > 0
      ? carLoanPrincipal * monthlyCarRate * Math.pow(1 + monthlyCarRate, 48) / (Math.pow(1 + monthlyCarRate, 48) - 1)
      : 0;
    const annualCarLoan = monthlyCarLoan * 12;
    const initialPortfolio = portfolio(settings);
    const initialUsValue = initialPortfolio.filter((x) => x.group === "US").reduce((s, x) => s + x.marketValueTwd, 0);
    const initialVoo = initialPortfolio.find((x) => x.symbol === "VOO").marketValueTwd;
    const usSplitVoo = initialUsValue > 0 ? initialVoo / initialUsValue : 0.5;
    const initial0056 = initialPortfolio.find((x) => x.symbol === "0056").marketValueTwd;
    const initial00919 = initialPortfolio.find((x) => x.symbol === "00919").marketValueTwd;
    const dividendSplit00919 = initial0056 + initial00919 > 0 ? initial00919 / (initial0056 + initial00919) : 0.5;
    const nvdaRatio = initialUsValue > 0
      ? initialPortfolio.find((x) => x.symbol === "NVDA").marketValueTwd / initialUsValue
      : 0;
    let buckets = {
      cash: summary.cash,
      etf50: initialPortfolio.filter((x) => x.group === "0050").reduce((s, x) => s + x.marketValueTwd, 0),
      leveraged: initialPortfolio.filter((x) => x.group === "LEVERAGED").reduce((s, x) => s + x.marketValueTwd, 0),
      dividend0056: initial0056,
      dividend00919: initial00919,
      us: initialUsValue
    };
    const units = Object.fromEntries(initialPortfolio.map((item) => [item.symbol, item.units]));
    const basePricesTwd = Object.fromEntries(initialPortfolio.map((item) => [
      item.symbol, item.price * (item.market === "US" ? fx : 1)
    ]));
    const rows = [];

    const now = new Date();
    const currentPlanMonth = now.getFullYear() > START_YEAR ? 12 : Math.max(START_MONTH, now.getMonth() + 1);
    for (let year = START_YEAR; year <= finalYear; year += 1) {
      const age = BASE_AGE + (year - START_YEAR);
      const activeMonths = year === START_YEAR ? Math.max(0, 12 - currentPlanMonth) : 12;
      const salaryMonths = year === START_YEAR ? activeMonths : 14;
      const projectedPrices = Object.fromEntries(Object.entries(basePricesTwd).map(([symbol, price]) => [
        symbol, price * Math.pow(1 + rate, year - START_YEAR + 1)
      ]));
      const salary = age < 65 ? Number(settings.monthlySalary) * salaryMonths : 0;
      const openingInvestments = buckets.etf50 + buckets.leveraged + buckets.dividend0056 + buckets.dividend00919 + buckets.us;
      const dividendIncome = year === START_YEAR && summary.dividends > 0
        ? summary.dividends * activeMonths / 12
        : openingInvestments * 0.025;
      const livingExpense = monthlyBaseExpense * activeMonths;
      const carLoanMonths = year === START_YEAR ? activeMonths : 12;
      const carLoan = year >= Number(settings.carYear) && year < Number(settings.carYear) + 4 ? monthlyCarLoan * carLoanMonths : 0;
      const vehicleCost = year >= Number(settings.carYear) ? 75000 * activeMonths / 12 : 0;
      let carPurchase = 0;
      let carFundingGap = 0;

      if (year === Number(settings.carYear)) {
        carPurchase = carDownPayment;
        const from00919 = Math.min(buckets.dividend00919, carDownPayment);
        buckets.dividend00919 -= from00919;
        units["00919"] = Math.max(0, units["00919"] - from00919 / projectedPrices["00919"]);
        const cashNeeded = carDownPayment - from00919;
        const cashAvailable = Math.max(0, buckets.cash - 800000);
        const fromCash = Math.min(cashNeeded, cashAvailable);
        buckets.cash -= fromCash;
        carFundingGap = cashNeeded - fromCash;
      }

      buckets.etf50 *= 1 + rate;
      buckets.leveraged *= 1 + rate;
      buckets.dividend0056 *= 1 + rate;
      buckets.dividend00919 *= 1 + rate;
      buckets.us *= 1 + rate;
      buckets.cash += salary + dividendIncome - livingExpense - carLoan - vehicleCost;

      let plannedInvestment = 0;
      const investments = { "0050": 0, "0056": 0, "00919": 0, "00631L": 0, VOO: 0, NVDA: 0 };
      if (year <= 2027) {
        const twContribution = 70000 * activeMonths;
        const vooContribution = 200 * fx * activeMonths;
        const nvdaContribution = 600 * fx * activeMonths;
        const usContribution = vooContribution + nvdaContribution;
        plannedInvestment = twContribution + usContribution;
        investments["0050"] = twContribution;
        investments.VOO = vooContribution;
        investments.NVDA = nvdaContribution;
        buckets.cash -= plannedInvestment;
        buckets.etf50 += twContribution;
        buckets.us += usContribution;
      } else {
        const cashTarget = age >= 61 ? 1500000 : 800000;
        const investable = Math.max(0, buckets.cash - cashTarget);
        plannedInvestment = investable;
        buckets.cash -= investable;
        const allocation = allocationForAge(age);
        const investedRatio = 1 - allocation.cash;
        investments["0050"] = investable * allocation.etf50 / investedRatio;
        investments["00631L"] = investable * allocation.leveraged / investedRatio;
        buckets.etf50 += investments["0050"];
        buckets.leveraged += investments["00631L"];
        const dividendContribution = investable * allocation.dividend / investedRatio;
        investments["0056"] = dividendContribution * (1 - dividendSplit00919);
        investments["00919"] = dividendContribution * dividendSplit00919;
        buckets.dividend0056 += investments["0056"];
        buckets.dividend00919 += investments["00919"];
        const usContribution = investable * allocation.us / investedRatio;
        investments.VOO = age >= 61 ? usContribution : usContribution * usSplitVoo;
        investments.NVDA = age >= 61 ? 0 : usContribution * (1 - usSplitVoo);
        buckets.us += usContribution;
      }

      Object.entries(investments).forEach(([symbol, amount]) => {
        units[symbol] += amount / projectedPrices[symbol];
      });

      if (age === 61) {
        const reallocate = buckets.leveraged + buckets.us * nvdaRatio;
        const reallocateTo0050 = reallocate * 0.20;
        const reallocateTo0056 = reallocate * 0.80 * (1 - dividendSplit00919);
        const reallocateTo00919 = reallocate * 0.80 * dividendSplit00919;
        buckets.leveraged = 0;
        buckets.us = Math.max(0, buckets.us - reallocate);
        buckets.dividend0056 += reallocateTo0056;
        buckets.dividend00919 += reallocateTo00919;
        buckets.etf50 += reallocateTo0050;
        units["00631L"] = 0;
        units.NVDA = 0;
        units["0050"] += reallocateTo0050 / projectedPrices["0050"];
        units["0056"] += reallocateTo0056 / projectedPrices["0056"];
        units["00919"] += reallocateTo00919 / projectedPrices["00919"];
      }

      if (buckets.cash < 700000 && year >= 2028) {
        const shortfall = 700000 - buckets.cash;
        const dividendTotal = buckets.dividend0056 + buckets.dividend00919;
        const sale = Math.min(shortfall, dividendTotal);
        const sale00919 = Math.min(sale, buckets.dividend00919);
        buckets.dividend00919 -= sale00919;
        buckets.dividend0056 -= sale - sale00919;
        buckets.cash += sale;
      }

      const twStocks = buckets.etf50 + buckets.leveraged + buckets.dividend0056 + buckets.dividend00919;
      const total = buckets.cash + twStocks + buckets.us;
      rows.push({
        year, age, planMonth: year === START_YEAR ? currentPlanMonth : 1, salaryMonths, activeMonths,
        salary, dividendIncome, income: salary + dividendIncome,
        family: 20000 * activeMonths, fixed: 22000 * activeMonths, leisure: 10000 * activeMonths,
        carLoan, vehicleCost, expense: livingExpense + carLoan + vehicleCost,
        carPurchase, carFundingGap, plannedInvestment, investments, investmentMonths: activeMonths,
        units: { ...units }, projectedPrices,
        cash: buckets.cash, twStocks, usStocks: buckets.us,
        investmentProfit: (buckets.etf50 + buckets.leveraged + buckets.dividend0056 + buckets.dividend00919 + buckets.us) - openingInvestments - plannedInvestment + carPurchase,
        total
      });
    }
    return rows;
  }

  async function fetchYahoo(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&events=div`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`報價服務回應 ${response.status}`);
    const result = (await response.json()).chart.result[0];
    const closes = result.indicators.quote[0].close.filter((value) => value != null);
    const dividends = Object.values((result.events && result.events.dividends) || {}).map((event) => ({ amount: event.amount, date: event.date * 1000 }));
    return { price: closes[closes.length - 1], dividends };
  }

  function estimateAnnualDividend(dividends, frequency) {
    if (!frequency || !dividends.length) return 0;
    const currentYear = new Date().getFullYear();
    const announced = dividends.filter((item) => new Date(item.date).getFullYear() === currentYear);
    const source = announced.length ? announced : dividends.slice(-frequency);
    return source.reduce((sum, item) => sum + item.amount, 0) / source.length * frequency;
  }

  async function updateQuotes(settings) {
    const symbols = { "0050": "0050.TW", "0056": "0056.TW", "00919": "00919.TW", "00631L": "00631L.TW", VOO: "VOO", NVDA: "NVDA" };
    const results = await Promise.allSettled(holdings.map(async (item) => {
      const data = await fetchYahoo(symbols[item.symbol]);
      return { symbol: item.symbol, price: data.price, dividend: estimateAnnualDividend(data.dividends, item.dividendFrequency) };
    }));
    let successes = 0;
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        successes += 1;
        settings.prices[result.value.symbol] = result.value.price;
        settings.annualDividends[result.value.symbol] = result.value.dividend;
      }
    });
    try {
      const fx = await fetchYahoo("TWD=X");
      settings.fxRate = fx.price;
    } catch (_error) {
      // Retain the last verified exchange rate if the remote service is unavailable.
    }
    if (!successes) throw new Error("瀏覽器無法連線至報價來源，已保留上次資料。正式版將改用後端代理服務。 ");
    settings.updatedAt = new Date().toISOString();
    settings.quoteStatus = successes === holdings.length ? "最新收盤資料" : `部分更新（${successes}/${holdings.length}）`;
    saveSettings(settings);
    return settings;
  }

  global.InvestmentCore = { defaults, holdings, loadSettings, saveSettings, formatTwd, formatUsd, formatNumber, portfolio, currentSummary, forecast, updateQuotes };
})(window);
