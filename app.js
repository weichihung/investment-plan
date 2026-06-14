(function () {
  "use strict";
  const core = window.InvestmentCore;
  let settings = core.loadSettings();
  let holdingDraft = JSON.parse(JSON.stringify(settings.holdingSettings || core.defaults.holdingSettings));
  let selectedYear = 2026;

  const $ = (selector) => document.querySelector(selector);
  const money = core.formatTwd;
  const compactMoney = (value) => {
    const amount = Math.abs(value);
    if (amount >= 1000000) return `${(value / 1000000).toFixed(2).replace(/\.00$/, "")}M`;
    if (amount >= 1000) return `${(value / 1000).toFixed(amount >= 100000 ? 0 : 1).replace(/\.0$/, "")}K`;
    return core.formatNumber(value, 0);
  };

  function render() {
    const summary = core.currentSummary(settings);
    const portfolio = core.portfolio(settings);
    const forecast = core.forecast(settings);
    const row = forecast.find((item) => item.year === selectedYear) || forecast[0];
    const firstTotal = forecast[0].total;
    const maxTotal = Math.max(...forecast.map((item) => item.total));

    $("#totalAsset").textContent = money(summary.total);
    $("#totalAssetDelta").textContent = `投資損益 ${money(summary.profit)}`;
    $("#cashAsset").textContent = money(summary.cash);
    $("#stockAsset").textContent = money(summary.twStocks + summary.usStocks);
    $("#dividendAsset").textContent = money(summary.dividends);
    $("#quoteMeta").textContent = settings.updatedAt
      ? `${settings.quoteStatus} · ${new Date(settings.updatedAt).toLocaleString("zh-TW")}`
      : `${settings.quoteStatus} · 尚未取得市場資料`;
    $("#fxBadge").textContent = `USD/TWD ${Number(settings.fxRate).toFixed(2)}`;

    $("#portfolioRows").innerHTML = portfolio.map((item) => `
      <tr>
        <td><strong>${item.symbol}</strong><small>${item.name}</small></td>
        <td><input class="holding-input" data-holding-symbol="${item.symbol}" data-holding-field="cost" type="number" min="0" step="0.0001" value="${holdingDraft[item.symbol].cost}"></td>
        <td>${item.market === "US" ? core.formatUsd(item.price) : money(item.price)}</td>
        <td><input class="holding-input" data-holding-symbol="${item.symbol}" data-holding-field="units" type="number" min="0" step="0.00001" value="${holdingDraft[item.symbol].units}"></td>
        <td>${money(item.marketValueTwd)}</td>
        <td class="${item.profit >= 0 ? "positive" : "negative"}">${money(item.profit)}</td>
        <td>${money(item.dividendTwd)}</td>
      </tr>`).join("");
    $("#holdingYearSelect").innerHTML = forecast.map((item) => `<option value="${item.year}" ${item.year === selectedYear ? "selected" : ""}>${item.year} 年 · ${item.age} 歲</option>`).join("");
    let holdingStockTotal = 0;
    const holdingValues = core.holdings.map((item) => {
      const unitValue = row.units[item.symbol];
      const display = item.market === "TW" ? `${core.formatNumber(unitValue / 1000, 3)} 張` : `${core.formatNumber(unitValue, 3)} 股`;
      const latestPrice = Number(settings.prices[item.symbol]);
      const marketValueTwd = unitValue * latestPrice * (item.market === "US" ? Number(settings.fxRate) : 1);
      holdingStockTotal += marketValueTwd;
      return { item, display, latestPrice, marketValueTwd };
    });
    $("#holdingRows").innerHTML = holdingValues.map(({ item, display, latestPrice, marketValueTwd }) => {
      const priceDisplay = item.market === "US" ? core.formatUsd(latestPrice) : money(latestPrice);
      const weight = holdingStockTotal > 0 ? marketValueTwd / holdingStockTotal * 100 : 0;
      return `<tr><td><strong>${item.symbol}</strong><small>${item.name}</small></td><td>${display}</td><td>${priceDisplay}</td><td>${money(marketValueTwd)}</td><td><strong>${weight.toFixed(1)}%</strong></td></tr>`;
    }).join("");
    $("#holdingStockTotal").textContent = money(holdingStockTotal);

    $("#yearSelect").innerHTML = forecast.map((item) => `<option value="${item.year}" ${item.year === selectedYear ? "selected" : ""}>${item.year} 年 · ${item.age} 歲</option>`).join("");
    $("#yearIncome").textContent = money(row.income);
    $("#yearExpense").textContent = money(row.expense);
    $("#yearInvestment").textContent = money(row.plannedInvestment);
    $("#yearEnding").textContent = money(row.total);
    $("#yearCash").textContent = money(row.cash);
    $("#cashflowPeriod").textContent = row.year === 2026 ? `資料基準：2026 年 ${row.planMonth} 月｜剩餘 ${row.activeMonths} 個月` : `${row.year} 年完整年度`;
    $("#yearDetails").innerHTML = [
      ["薪資收入", row.salary], ["股利收入", row.dividendIncome], ["孝親費", -row.family], ["固定支出", -row.fixed],
      ["特別預算", -row.leisure], ["車貸支出", -row.carLoan], ["車輛持有成本", -row.vehicleCost], ["購車頭期款", -row.carPurchase]
    ].map(([label, value]) => `<div><span>${label}</span><strong class="${value < 0 ? "negative" : ""}">${money(value)}</strong></div>`).join("");

    $("#forecastChart").innerHTML = forecast.map((item, index) => {
      const height = Math.max(8, item.total / maxTotal * 100);
      const previous = index > 0 ? forecast[index - 1].total : firstTotal;
      const growth = index > 0 ? (item.total / previous - 1) * 100 : 0;
      return `<div class="chart-col" title="${item.year} 年（${item.age} 歲）: ${money(item.total)}">
        <div class="chart-value" style="bottom:calc(${height}% + 5px)"><b>${compactMoney(item.total)}</b><em>${index ? `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%` : "起始"}</em></div>
        <span style="height:${height}%"></span><small>${item.year}<i>${item.age} 歲</i></small></div>`;
    }).join("");
    $("#forecastStart").textContent = money(firstTotal);
    $("#forecastEnd").textContent = money(forecast[forecast.length - 1].total);
    $("#forecastGrowth").textContent = `${((forecast[forecast.length - 1].total / firstTotal - 1) * 100).toFixed(0)}%`;

    ["monthlySalary", "annualReturn", "years", "carPrice", "carYear", "twdDeposit", "foreignDepositTwd"].forEach((key) => {
      const input = $(`#${key}`);
      if (input && document.activeElement !== input) input.value = settings[key];
    });
    renderAlerts(forecast);
  }

  function renderAlerts(forecast) {
    const warnings = [];
    const row = forecast.find((item) => item.year === selectedYear) || forecast[0];
    const monthlyInvestments = Object.entries(row.investments).map(([symbol, annual]) => {
      const monthlyTwd = annual / Math.max(1, row.investmentMonths);
      const display = ["VOO", "NVDA"].includes(symbol)
        ? `${money(monthlyTwd)}（約 ${core.formatUsd(monthlyTwd / Number(settings.fxRate))}）`
        : money(monthlyTwd);
      return `<div class="investment-item"><strong>${symbol}</strong><span>${display}<small>／月</small></span></div>`;
    }).join("");
    $("#monthlyPlan").innerHTML = `<div class="plan-heading"><strong>${row.year} 年每月建議投入</strong><span>年度合計 ${money(row.plannedInvestment)}</span></div><div class="investment-grid">${monthlyInvestments}</div>`;
    const lowCash = row.cash < 700000;
    if (lowCash) warnings.push(`${row.year} 年現金低於 70 萬安全線，需降低投入或調整購車條件。`);
    const carStart = Number(settings.carYear);
    if (row.year >= carStart && row.year < carStart + 4) {
      warnings.push(`${row.year} 年車貸支出約 ${money(row.carLoan)}，貸款期間為 ${carStart}～${carStart + 3} 年。`);
    }
    if (row.year === carStart) warnings.push(`${row.year} 年購車頭期款 ${money(row.carPurchase)}，優先出售 00919 並保留現金 80 萬。`);
    if (row.year === carStart && row.carFundingGap > 0) warnings.push(`購車資金仍缺 ${money(row.carFundingGap)}；需延後購車或調高貸款成數。`);
    if (row.year === 2026) warnings.push(`2026 年收入、支出與投資僅計入目前至年底剩餘 ${row.activeMonths} 個月；預估年股利亦按 ${row.activeMonths}/12 比例計入。`);
    $("#alerts").innerHTML = warnings.map((text, index) => `<div class="alert ${index === 0 && lowCash ? "alert-warn" : ""}"><span>${index + 1}</span><p>${text}</p></div>`).join("");
  }

  function bind() {
    $("#yearSelect").addEventListener("change", (event) => { selectedYear = Number(event.target.value); render(); });
    $("#holdingYearSelect").addEventListener("change", (event) => { selectedYear = Number(event.target.value); render(); });
    $("#settingsForm").addEventListener("input", (event) => {
      if (!event.target.name) return;
      settings[event.target.name] = Number(event.target.value);
      core.saveSettings(settings);
      render();
    });
    $("#portfolioRows").addEventListener("input", (event) => {
      const input = event.target.closest("[data-holding-symbol]");
      if (!input) return;
      holdingDraft[input.dataset.holdingSymbol][input.dataset.holdingField] = Number(input.value);
      $("#holdingSaveStatus").textContent = "尚未保存";
    });
    $("#saveHoldings").addEventListener("click", () => {
      settings.holdingSettings = JSON.parse(JSON.stringify(holdingDraft));
      core.saveSettings(settings);
      $("#holdingSaveStatus").textContent = "已保存，後續更新將沿用";
      render();
    });
    $("#resetSettings").addEventListener("click", () => {
      settings = { ...core.defaults, prices: { ...core.defaults.prices }, annualDividends: { ...core.defaults.annualDividends }, holdingSettings: JSON.parse(JSON.stringify(core.defaults.holdingSettings)) };
      holdingDraft = JSON.parse(JSON.stringify(settings.holdingSettings));
      core.saveSettings(settings);
      render();
    });
    $("#updateQuotes").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "更新中…";
      try {
        settings = await core.updateQuotes(settings);
        render();
      } catch (error) {
        $("#quoteMeta").textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = "更新報價";
      }
    });
    document.querySelectorAll("[data-scroll]").forEach((button) => button.addEventListener("click", () => $(button.dataset.scroll).scrollIntoView({ behavior: "smooth" })));
  }

  bind();
  render();
})();
