(function (global) {
  "use strict";

  const STORAGE_KEY = "investment-plan-settings-v2";
  const DATA_VERSION = 23;
  const DIVIDEND_NET_FACTOR = 0.8;
  const SYMBOLS = ["VOO", "NVDA", "0050", "0056", "00919", "00631L"];

  const holdings = [
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", market: "US", unitSize: 1, group: "US", payoutMonths: [3, 6, 9, 12] },
    { symbol: "NVDA", name: "NVIDIA", market: "US", unitSize: 1, group: "US", payoutMonths: [3, 6, 9, 12], dividendEstimateMode: "latestRunRate" },
    { symbol: "0050", name: "元大台灣50", market: "TW", unitSize: 1000, group: "CORE", payoutMonths: [2, 8] },
    { symbol: "0056", name: "元大高股息", market: "TW", unitSize: 1000, group: "DIVIDEND", payoutMonths: [1, 4, 7, 10] },
    { symbol: "00919", name: "群益台灣精選高息", market: "TW", unitSize: 1000, group: "DIVIDEND", payoutMonths: [3, 6, 9, 12] },
    { symbol: "00631L", name: "元大台灣50正2", market: "TW", unitSize: 1000, group: "LEVERAGED", payoutMonths: [] }
  ];

  function buildManualPlans() {
    const plans = {};
    for (let year = 2026; year <= 2048; year += 1) {
      let plan;
      if (year <= 2027) plan = { VOO: 200, NVDA: 600, "0050": 60000, "0056": 0, "00919": 0, "00631L": 0 };
      else if (year <= 2030) plan = { VOO: 250, NVDA: 200, "0050": 10000, "0056": 0, "00919": 0, "00631L": 0 };
      else if (year <= 2032) plan = { VOO: 250, NVDA: 200, "0050": 20000, "0056": 0, "00919": 0, "00631L": 0 };
      else if (year === 2033) plan = { VOO: 250, NVDA: 200, "0050": 40000, "0056": 0, "00919": 0, "00631L": 0 };
      else if (year <= 2035) plan = { VOO: 350, NVDA: 300, "0050": 40000, "0056": 0, "00919": 0, "00631L": 0 };
      else if (year <= 2038) plan = { VOO: 350, NVDA: 300, "0050": 40000, "0056": 10000, "00919": 10000, "00631L": 0 };
      else if (year <= 2042) plan = { VOO: 350, NVDA: 300, "0050": 50000, "0056": 10000, "00919": 10000, "00631L": 0 };
      else plan = { VOO: 350, NVDA: 300, "0050": 15000, "0056": 40000, "00919": 40000, "00631L": 0 };
      plans[year] = plan;
    }
    return plans;
  }

  const defaults = {
    dataVersion: DATA_VERSION,
    startYear: 2026,
    startAge: 43,
    endAge: 65,
    autoRollFirstYearMonths: true,
    firstYearMonths: 5,
    fxRate: 31.81999969482422,
    twPriceGrowth: 6,
    usPriceGrowth: 6.5,
    twDividendGrowth: 3,
    usDividendGrowth: 5,
    monthlySalary: 68000,
    salaryGrowth: 3,
    familyMonthly: 20000,
    leisureMonthly: 10000,
    fixedMonthly: 22000,
    expenseInflation: 2.5,
    annualSalaryMonths: 14,
    twdDeposit: 1352808,
    foreignDepositTwd: 143707,
    bankMinimum: 650000,
    cashTargetBefore61: 800000,
    cashTargetAfter61: 1500000,
    carYear: 2030,
    carPrice: 2000000,
    carDownPaymentRate: 50,
    carLoanRate: 0,
    carLoanMonths: 40,
    annualVehicleCost: 75000,
    homeYear: 0,
    homePrice: 0,
    homeDownPaymentRate: 0,
    homeLoanRate: 0,
    homeLoanMonths: 0,
    annualHomeCost: 0,
    safeWithdrawalRate: 4,
    investmentMode: "manual",
    updatedAt: "2026-08-22T10:46:54+08:00",
    quoteStatus: "最新收盤價與配息資料（已折減 20%）",
    quoteDates: { TW: "2026-08-21", US: "2026-08-21", FX: "2026-08-21" },
    holdingSettings: {
      VOO: { units: 17.86984, cost: 577.151, price: 703.7100219726562, annualDividend: 6.13536 },
      NVDA: { units: 115.95353, cost: 151.826, price: 214.72000122070312, annualDividend: 0.8 },
      "0050": { units: 40.895, cost: 42.8, price: 104.65, annualDividend: 1.28 },
      "0056": { units: 32, cost: 31.03, price: 52.4, annualDividend: 3.4304 },
      "00919": { units: 51, cost: 23.48, price: 30.8, annualDividend: 2.848 },
      "00631L": { units: 0, cost: 34.56, price: 34.84, annualDividend: 0 }
    },
    manualPlans: buildManualPlans()
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hydrateSettings(saved) {
    if (!saved || Number(saved.dataVersion) !== DATA_VERSION) return clone(defaults);
    return {
      ...clone(defaults),
      ...saved,
      dataVersion: DATA_VERSION,
      quoteDates: { ...defaults.quoteDates, ...(saved.quoteDates || {}) },
      holdingSettings: Object.fromEntries(SYMBOLS.map((symbol) => [
        symbol,
        { ...defaults.holdingSettings[symbol], ...((saved.holdingSettings || {})[symbol] || {}) }
      ])),
      manualPlans: { ...clone(defaults.manualPlans), ...(saved.manualPlans || {}) }
    };
  }

  function loadSettings() {
    try {
      return hydrateSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch (_error) {
      return clone(defaults);
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, dataVersion: DATA_VERSION }));
  }

  function formatTwd(value) {
    return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function formatUsd(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  function formatNumber(value, digits = 0) {
    return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: digits }).format(Number(value) || 0);
  }

  function formatPercent(value, digits = 1) {
    return `${(Number(value) * 100).toFixed(digits)}%`;
  }

  function holdingMeta(symbol) {
    return holdings.find((item) => item.symbol === symbol);
  }

  function nativeToTwd(meta, value, fx) {
    return Number(value) * (meta.market === "US" ? fx : 1);
  }

  function unitValueTwd(meta, price, fx) {
    return nativeToTwd(meta, price * meta.unitSize, fx);
  }

  function portfolio(settings) {
    const fx = Number(settings.fxRate) || defaults.fxRate;
    const items = holdings.map((meta) => {
      const item = settings.holdingSettings[meta.symbol] || defaults.holdingSettings[meta.symbol];
      const units = Number(item.units) || 0;
      const cost = Number(item.cost) || 0;
      const price = Number(item.price) || 0;
      const annualDividend = Number(item.annualDividend) || 0;
      const marketValueTwd = units * unitValueTwd(meta, price, fx);
      const costTwd = units * unitValueTwd(meta, cost, fx);
      const dividendTwd = units * nativeToTwd(meta, annualDividend * meta.unitSize, fx);
      return {
        ...meta, units, cost, price, annualDividend, marketValueTwd, costTwd,
        profit: marketValueTwd - costTwd,
        profitRate: costTwd ? (marketValueTwd - costTwd) / costTwd : 0,
        dividendTwd,
        yieldRate: marketValueTwd ? dividendTwd / marketValueTwd : 0
      };
    });
    const totalMarketValue = items.reduce((sum, item) => sum + item.marketValueTwd, 0);
    return items.map((item) => ({ ...item, weight: totalMarketValue ? item.marketValueTwd / totalMarketValue : 0 }));
  }

  function currentSummary(settings) {
    const items = portfolio(settings);
    const cash = Number(settings.twdDeposit) + Number(settings.foreignDepositTwd);
    const twStocks = items.filter((item) => item.market === "TW").reduce((sum, item) => sum + item.marketValueTwd, 0);
    const usStocks = items.filter((item) => item.market === "US").reduce((sum, item) => sum + item.marketValueTwd, 0);
    const dividends = items.reduce((sum, item) => sum + item.dividendTwd, 0);
    const cost = items.reduce((sum, item) => sum + item.costTwd, 0);
    const profit = items.reduce((sum, item) => sum + item.profit, 0);
    return { cash, twStocks, usStocks, stockValue: twStocks + usStocks, dividends, cost, profit, total: cash + twStocks + usStocks };
  }

  function effectiveFirstYearMonths(settings) {
    if (!settings.autoRollFirstYearMonths) return Math.max(0, Math.min(12, Number(settings.firstYearMonths) || 0));
    const now = new Date();
    const startYear = Number(settings.startYear);
    if (now.getFullYear() < startYear) return 12;
    if (now.getFullYear() > startYear) return 0;
    return Math.max(0, 13 - (now.getMonth() + 1));
  }

  function loanPayment(principal, annualRatePercent, months) {
    const amount = Math.max(0, Number(principal) || 0);
    const term = Math.max(0, Number(months) || 0);
    if (!amount || !term) return 0;
    const monthlyRate = Number(annualRatePercent || 0) / 100 / 12;
    if (!monthlyRate) return amount / term;
    return amount * monthlyRate * Math.pow(1 + monthlyRate, term) / (Math.pow(1 + monthlyRate, term) - 1);
  }

  function loanDetails(price, downPaymentRate, annualRate, months) {
    const downPayment = Number(price || 0) * Number(downPaymentRate || 0) / 100;
    const principal = Math.max(0, Number(price || 0) - downPayment);
    const monthlyPayment = loanPayment(principal, annualRate, months);
    const repaymentTotal = monthlyPayment * Number(months || 0);
    return { downPayment, principal, monthlyPayment, repaymentTotal, totalInterest: repaymentTotal - principal };
  }

  function projectedMarket(settings, year) {
    const startYear = Number(settings.startYear);
    const elapsed = Math.max(0, Number(year) - startYear);
    return Object.fromEntries(holdings.map((meta) => {
      const current = settings.holdingSettings[meta.symbol];
      const priceGrowth = Number(meta.market === "US" ? settings.usPriceGrowth : settings.twPriceGrowth) / 100;
      const dividendGrowth = Number(meta.market === "US" ? settings.usDividendGrowth : settings.twDividendGrowth) / 100;
      return [meta.symbol, {
        price: Number(current.price) * Math.pow(1 + priceGrowth, elapsed),
        annualDividend: Number(current.annualDividend) * Math.pow(1 + dividendGrowth, elapsed)
      }];
    }));
  }

  function manualInvestmentPlan(settings, year, months) {
    const plan = settings.manualPlans[year] || settings.manualPlans[String(year)] || {};
    const fx = Number(settings.fxRate);
    const annual = {};
    SYMBOLS.forEach((symbol) => {
      const meta = holdingMeta(symbol);
      const monthlyNative = Number(plan[symbol]) || 0;
      annual[symbol] = monthlyNative * months * (meta.market === "US" ? fx : 1);
    });
    return annual;
  }

  function autoWeights(settings) {
    const items = portfolio(settings);
    const usVoo = items.find((item) => item.symbol === "VOO").marketValueTwd;
    const usNvda = items.find((item) => item.symbol === "NVDA").marketValueTwd;
    const dividend0056 = items.find((item) => item.symbol === "0056").marketValueTwd;
    const dividend00919 = items.find((item) => item.symbol === "00919").marketValueTwd;
    return {
      vooShare: usVoo + usNvda ? usVoo / (usVoo + usNvda) : 0.5,
      dividend0056Share: dividend0056 + dividend00919 ? dividend0056 / (dividend0056 + dividend00919) : 0.5
    };
  }

  function allocationForAge(settings, age, amount) {
    const split = autoWeights(settings);
    const result = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, 0]));
    if (age >= 61) {
      const investableRatio = 0.95;
      result["0050"] = amount * 0.20 / investableRatio;
      const dividend = amount * 0.60 / investableRatio;
      result["0056"] = dividend * split.dividend0056Share;
      result["00919"] = dividend * (1 - split.dividend0056Share);
      result.VOO = amount * 0.15 / investableRatio;
      return result;
    }
    const investableRatio = 0.95;
    result["0050"] = amount * 0.50 / investableRatio;
    result["00631L"] = amount * 0.10 / investableRatio;
    const dividend = amount * 0.15 / investableRatio;
    result["0056"] = dividend * split.dividend0056Share;
    result["00919"] = dividend * (1 - split.dividend0056Share);
    const us = amount * 0.20 / investableRatio;
    result.VOO = us * split.vooShare;
    result.NVDA = us * (1 - split.vooShare);
    return result;
  }

  function forecast(settings) {
    const fx = Number(settings.fxRate);
    const startYear = Number(settings.startYear);
    const finalYear = Math.max(startYear, startYear + (Number(settings.endAge) - Number(settings.startAge)));
    const firstYearMonths = effectiveFirstYearMonths(settings);
    const initial = portfolio(settings);
    const positions = Object.fromEntries(initial.map((item) => [item.symbol, item.units]));
    const costBasis = Object.fromEntries(initial.map((item) => [item.symbol, item.costTwd]));
    const rows = [];
    const summary = currentSummary(settings);
    let cash = summary.cash;
    let previousTotal = summary.total;

    function positionValue(symbol, market) {
      const meta = holdingMeta(symbol);
      return positions[symbol] * unitValueTwd(meta, market[symbol].price, fx);
    }

    function sell(symbol, requestedTwd, market) {
      const value = positionValue(symbol, market);
      const soldValue = Math.max(0, Math.min(value, Number(requestedTwd) || 0));
      if (!soldValue || !value) return 0;
      const ratio = soldValue / value;
      positions[symbol] *= 1 - ratio;
      costBasis[symbol] *= 1 - ratio;
      return soldValue;
    }

    function buy(symbol, amountTwd, market) {
      const amount = Math.max(0, Number(amountTwd) || 0);
      const meta = holdingMeta(symbol);
      const perUnit = unitValueTwd(meta, market[symbol].price, fx);
      if (!amount || !perUnit) return;
      positions[symbol] += amount / perUnit;
      costBasis[symbol] += amount;
    }

    function sellForCash(requestedTwd, market, preferred = []) {
      let remaining = Math.max(0, requestedTwd);
      let proceeds = 0;
      const order = [...preferred, "00919", "0056", "0050", "00631L", "NVDA", "VOO"].filter((symbol, index, list) => list.indexOf(symbol) === index);
      order.forEach((symbol) => {
        if (remaining <= 0) return;
        const sold = sell(symbol, remaining, market);
        proceeds += sold;
        remaining -= sold;
      });
      cash += proceeds;
      return proceeds;
    }

    for (let year = startYear; year <= finalYear; year += 1) {
      const age = Number(settings.startAge) + (year - startYear);
      const activeMonths = year === startYear ? firstYearMonths : 12;
      const salaryMonths = year === startYear
        ? activeMonths
        : (age < Number(settings.endAge) ? Number(settings.annualSalaryMonths) : 0);
      const market = projectedMarket(settings, year);
      const openingCash = cash;
      let stockSales = 0;
      let transitionSale = 0;

      if (age === 61 && settings.investmentMode === "auto") {
        transitionSale += sell("00631L", positionValue("00631L", market), market);
        transitionSale += sell("NVDA", positionValue("NVDA", market), market);
        const reinvestment = allocationForAge(settings, age, transitionSale);
        Object.entries(reinvestment).forEach(([symbol, amount]) => buy(symbol, amount, market));
      }

      const openingPositions = { ...positions };
      const salaryGrowth = Math.pow(1 + Number(settings.salaryGrowth) / 100, year - startYear);
      const inflation = Math.pow(1 + Number(settings.expenseInflation) / 100, year - startYear);
      const salary = Number(settings.monthlySalary) * salaryMonths * salaryGrowth;
      const dividendsBySymbol = {};
      SYMBOLS.forEach((symbol) => {
        const meta = holdingMeta(symbol);
        dividendsBySymbol[symbol] = openingPositions[symbol] * nativeToTwd(meta, market[symbol].annualDividend * meta.unitSize, fx) * activeMonths / 12;
      });
      const dividendIncome = Object.values(dividendsBySymbol).reduce((sum, value) => sum + value, 0);
      const family = Number(settings.familyMonthly) * activeMonths * inflation;
      const leisure = Number(settings.leisureMonthly) * activeMonths * inflation;
      const fixed = Number(settings.fixedMonthly) * activeMonths * inflation;

      const car = loanDetails(settings.carPrice, settings.carDownPaymentRate, settings.carLoanRate, settings.carLoanMonths);
      const carOffset = year - Number(settings.carYear);
      const carLoanPaidBefore = Math.max(0, carOffset * 12);
      const carLoanPaymentMonths = Number(settings.carYear) > 0 && carOffset >= 0
        ? Math.max(0, Math.min(12, Number(settings.carLoanMonths) - carLoanPaidBefore))
        : 0;
      const carLoan = car.monthlyPayment * carLoanPaymentMonths;
      const carDownPayment = year === Number(settings.carYear) ? car.downPayment : 0;
      const carDownPaymentFromPriorCash = Math.min(openingCash, carDownPayment);
      const carDownPaymentShortfall = Math.max(0, carDownPayment - openingCash);
      const vehicleCost = Number(settings.carYear) > 0 && year >= Number(settings.carYear) ? Number(settings.annualVehicleCost) : 0;

      const home = loanDetails(settings.homePrice, settings.homeDownPaymentRate, settings.homeLoanRate, settings.homeLoanMonths);
      const homeOffset = year - Number(settings.homeYear);
      const homeLoanPaidBefore = Math.max(0, homeOffset * 12);
      const homeLoanPaymentMonths = Number(settings.homeYear) > 0 && homeOffset >= 0
        ? Math.max(0, Math.min(12, Number(settings.homeLoanMonths) - homeLoanPaidBefore))
        : 0;
      const homeLoan = home.monthlyPayment * homeLoanPaymentMonths;
      const homeDownPayment = year === Number(settings.homeYear) ? home.downPayment : 0;
      const homeCost = Number(settings.homeYear) > 0 && year >= Number(settings.homeYear) ? Number(settings.annualHomeCost) : 0;

      cash += salary + dividendIncome;
      cash -= family + leisure + fixed + carLoan + carDownPayment + vehicleCost + homeLoan + homeDownPayment + homeCost;

      let investments;
      if (settings.investmentMode === "auto" && year >= 2028) {
        const cashTarget = age >= 61 ? Number(settings.cashTargetAfter61) : Number(settings.cashTargetBefore61);
        investments = allocationForAge(settings, age, Math.max(0, cash - cashTarget));
      } else {
        investments = manualInvestmentPlan(settings, year, activeMonths);
      }
      const plannedInvestment = Object.values(investments).reduce((sum, value) => sum + value, 0);
      cash -= plannedInvestment;
      Object.entries(investments).forEach(([symbol, amount]) => buy(symbol, amount, market));

      const cashWithoutCarDownPayment = cash + carDownPayment;
      if (cashWithoutCarDownPayment < Number(settings.bankMinimum)) {
        stockSales += sellForCash(Number(settings.bankMinimum) - cashWithoutCarDownPayment, market);
      }

      const securityRows = SYMBOLS.map((symbol) => {
        const meta = holdingMeta(symbol);
        const marketValueTwd = positionValue(symbol, market);
        return {
          ...meta,
          openingUnits: openingPositions[symbol],
          addedUnits: positions[symbol] - openingPositions[symbol],
          units: positions[symbol],
          price: market[symbol].price,
          annualDividend: market[symbol].annualDividend,
          marketValueTwd,
          costBasisTwd: costBasis[symbol],
          profit: marketValueTwd - costBasis[symbol],
          dividendTwd: dividendsBySymbol[symbol]
        };
      });
      const stockValue = securityRows.reduce((sum, item) => sum + item.marketValueTwd, 0);
      securityRows.forEach((item) => { item.weight = stockValue ? item.marketValueTwd / stockValue : 0; });
      const twStocks = securityRows.filter((item) => item.market === "TW").reduce((sum, item) => sum + item.marketValueTwd, 0);
      const usStocks = securityRows.filter((item) => item.market === "US").reduce((sum, item) => sum + item.marketValueTwd, 0);
      const income = salary + dividendIncome;
      const expense = family + leisure + fixed + carLoan + carDownPayment + vehicleCost + homeLoan + homeDownPayment + homeCost;
      const netCashFlow = income + stockSales - expense - plannedInvestment;
      const total = cash + stockValue;
      const growthAmount = total - previousTotal;
      const growthRate = previousTotal ? growthAmount / previousTotal : 0;
      const monthlyDividends = Array.from({ length: 12 }, () => 0);
      const monthlyDividendBySymbol = Object.fromEntries(SYMBOLS.map((symbol) => [symbol, Array.from({ length: 12 }, () => 0)]));
      securityRows.forEach((item) => {
        const frequency = item.payoutMonths.length;
        if (!frequency) return;
        item.payoutMonths.forEach((month) => {
          const value = item.dividendTwd / frequency;
          monthlyDividends[month - 1] += value;
          monthlyDividendBySymbol[item.symbol][month - 1] = value;
        });
      });

      rows.push({
        year, age, activeMonths, salaryMonths, openingCash, salary, dividendIncome, income,
        family, leisure, fixed, carLoan, carLoanPaymentMonths, carDownPayment,
        carDownPaymentFromPriorCash, carDownPaymentShortfall, vehicleCost,
        homeLoan, homeLoanPaymentMonths, homeDownPayment, homeCost, expense,
        plannedInvestment, investments, stockSales, transitionSale, netCashFlow, cash,
        positions: { ...positions }, market, securities: securityRows, twStocks, usStocks, stockValue,
        costBasis: Object.values(costBasis).reduce((sum, value) => sum + value, 0),
        investmentProfit: stockValue - Object.values(costBasis).reduce((sum, value) => sum + value, 0),
        total, growthAmount, growthRate, monthlyDividends, monthlyDividendBySymbol,
        averageMonthlyDividend: dividendIncome / 12
      });
      previousTotal = total;
    }
    return rows;
  }

  function financialFreedom(settings, forecastRows) {
    const rate = Number(settings.safeWithdrawalRate) / 100;
    const startYear = Number(settings.startYear);
    const rows = forecastRows.map((row) => {
      const livingExpense = row.family + row.leisure + row.fixed + row.vehicleCost + row.homeCost;
      const annualizedLivingExpense = row.activeMonths ? livingExpense * 12 / row.activeMonths : 0;
      const requiredAssets = rate ? annualizedLivingExpense / rate : 0;
      return {
        year: row.year,
        age: row.age,
        livingExpense,
        annualizedLivingExpense,
        dividendIncome: row.dividendIncome,
        dividendCoverage: livingExpense ? row.dividendIncome / livingExpense : 0,
        dividendGap: row.dividendIncome - livingExpense,
        requiredAssets,
        totalAssets: row.total,
        achievement: requiredAssets ? row.total / requiredAssets : 0,
        realAssets: row.total / Math.pow(1 + Number(settings.expenseInflation) / 100, row.year - startYear),
        monthlyWithdrawal: row.total * rate / 12
      };
    });
    const dividendMilestone = rows.find((row) => row.dividendCoverage >= 1) || null;
    const fourPercentMilestone = rows.find((row) => row.achievement >= 1) || null;
    return { rows, dividendMilestone, fourPercentMilestone, final: rows[rows.length - 1] };
  }

  function priceDividendProjection(settings) {
    const startYear = Number(settings.startYear);
    const finalYear = Math.max(startYear, startYear + (Number(settings.endAge) - Number(settings.startAge)));
    const result = [];
    for (let year = startYear; year <= finalYear; year += 1) {
      result.push({ year, age: Number(settings.startAge) + year - startYear, securities: projectedMarket(settings, year) });
    }
    return result;
  }

  async function fetchYahoo(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&events=div`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`報價服務回應 ${response.status}`);
    const result = (await response.json()).chart.result[0];
    const quotes = result.indicators.quote[0].close;
    let index = quotes.length - 1;
    while (index >= 0 && quotes[index] == null) index -= 1;
    const dividends = Object.values((result.events && result.events.dividends) || {}).map((event) => ({ amount: event.amount, date: event.date * 1000 }));
    return { price: quotes[index], date: new Date(result.timestamp[index] * 1000), dividends };
  }

  function estimateAnnualDividend(dividends, frequency, mode) {
    if (!frequency || !dividends.length) return 0;
    const currentYear = new Date().getFullYear();
    const announced = dividends.filter((item) => new Date(item.date).getFullYear() === currentYear);
    const source = announced.length ? announced : dividends.slice(-frequency);
    if (mode === "latestRunRate") {
      const latest = source.reduce((current, item) => Number(item.date) > Number(current.date) ? item : current);
      return Number(latest.amount) * frequency;
    }
    return source.reduce((sum, item) => sum + Number(item.amount), 0) / source.length * frequency;
  }

  async function updateQuotes(settings) {
    const yahooSymbols = { VOO: "VOO", NVDA: "NVDA", "0050": "0050.TW", "0056": "0056.TW", "00919": "00919.TW", "00631L": "00631L.TW" };
    const results = await Promise.allSettled(holdings.map(async (meta) => {
      const data = await fetchYahoo(yahooSymbols[meta.symbol]);
      const grossAnnualDividend = estimateAnnualDividend(data.dividends, meta.payoutMonths.length, meta.dividendEstimateMode);
      return { symbol: meta.symbol, price: data.price, annualDividend: grossAnnualDividend * DIVIDEND_NET_FACTOR, date: data.date };
    }));
    let successCount = 0;
    let latestTwDate = null;
    let latestUsDate = null;
    results.forEach((result) => {
      if (result.status !== "fulfilled") return;
      successCount += 1;
      const value = result.value;
      settings.holdingSettings[value.symbol].price = value.price;
      settings.holdingSettings[value.symbol].annualDividend = value.annualDividend;
      if (holdingMeta(value.symbol).market === "TW") latestTwDate = value.date;
      else latestUsDate = value.date;
    });
    let fxDate = null;
    try {
      const fx = await fetchYahoo("TWD=X");
      settings.fxRate = fx.price;
      fxDate = fx.date;
    } catch (_error) {
      // Keep the latest verified exchange rate when the browser request is blocked.
    }
    if (!successCount) throw new Error("瀏覽器無法連線至報價來源，已保留上次資料。");
    const dateText = (date) => date ? date.toISOString().slice(0, 10) : null;
    settings.quoteDates = {
      TW: dateText(latestTwDate) || settings.quoteDates.TW,
      US: dateText(latestUsDate) || settings.quoteDates.US,
      FX: dateText(fxDate) || settings.quoteDates.FX
    };
    settings.updatedAt = new Date().toISOString();
    settings.quoteStatus = successCount === holdings.length ? "最新收盤價與配息資料（已折減 20%）" : `部分更新（${successCount}/${holdings.length}，配息已折減 20%）`;
    saveSettings(settings);
    return settings;
  }

  global.InvestmentCore = {
    DATA_VERSION, defaults, holdings, SYMBOLS, clone, loadSettings, saveSettings,
    formatTwd, formatUsd, formatNumber, formatPercent, portfolio, currentSummary,
    effectiveFirstYearMonths, loanDetails, projectedMarket, priceDividendProjection,
    forecast, financialFreedom, updateQuotes
  };
})(window);
