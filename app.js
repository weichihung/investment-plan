(function () {
  "use strict";

  const core = window.InvestmentCore;
  const charts = window.InvestmentCharts;
  const titles = {
    overview: "逐年財務總表",
    freedom: "財務自由檢視",
    settings: "參數設定",
    portfolio: "持股現況",
    plan: "投資計畫",
    market: "價格與配息",
    holdings: "持股推估",
    dividends: "月配息"
  };
  let settings = core.loadSettings();
  let holdingDraft = core.clone(settings.holdingSettings);
  let selectedYear = Number(settings.startYear);
  let currentPage = "overview";
  let marketSymbol = "0050";
  let marketMetric = "price";
  let calculated = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const money = core.formatTwd;
  const number = core.formatNumber;
  const percent = core.formatPercent;
  const signedMoney = (value) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
  const unitLabel = (item) => item.market === "TW" ? "張" : "股";
  const nativeMoney = (item, value) => item.market === "US" ? core.formatUsd(value) : money(value);
  const compactMoney = (value) => {
    const amount = Math.abs(Number(value) || 0);
    if (amount >= 1000000) return `${(value / 1000000).toFixed(amount >= 10000000 ? 1 : 2).replace(/\.0+$/, "")}M`;
    if (amount >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return number(value);
  };

  function pageMarkup() {
    return `
      <section class="page active" data-page-panel="overview">
        <div class="page-heading"><div><p class="eyebrow">YEARLY MASTER PLAN</p><h2>逐年財務試算總表</h2><p>從 2026 年 43 歲到 2048 年 65 歲，整合收入、支出、持股與資產。</p></div><select class="year-select" id="overviewYearSelect" aria-label="選擇年度"></select></div>
        <div class="hero-grid">
          <article class="hero-card"><span>目前總資產</span><strong id="currentTotal">—</strong><small id="currentProfit">—</small></article>
          <article class="metric-card"><span>銀行存款</span><strong id="currentCash">—</strong><small id="cashSafety">—</small></article>
          <article class="metric-card"><span>股票市值</span><strong id="currentStocks">—</strong><small id="stockSplit">—</small></article>
          <article class="metric-card"><span>目前預估年股利</span><strong id="currentDividend">—</strong><small>依最新配息資料年化</small></article>
        </div>
        <article class="panel chart-panel"><div class="panel-head"><div><span class="kicker">ASSET TRAJECTORY</span><h3>資產成長軌跡</h3></div><div class="panel-pills"><span>期末 <b id="finalAsset">—</b></span><span>累計成長 <b id="totalGrowth">—</b></span></div></div><div class="chart-box wide" id="assetTrendChart"></div><p class="chart-note">點選圖上的年份，可同步切換各年度明細。</p></article>
        <div class="two-column overview-detail">
          <article class="panel"><div class="panel-head"><div><span class="kicker">SELECTED YEAR</span><h3 id="selectedYearTitle">年度摘要</h3></div><span class="age-chip" id="selectedAge">—</span></div><div class="summary-grid" id="yearSummary"></div><div class="detail-grid" id="yearDetail"></div></article>
          <article class="panel"><div class="panel-head"><div><span class="kicker">PLANNING NOTES</span><h3>規劃提醒</h3></div></div><div class="notice-list" id="planningNotes"></div></article>
        </div>
        <article class="panel"><div class="panel-head"><div><span class="kicker">FULL SCHEDULE</span><h3>2026—2048 年度總表</h3></div><span class="table-hint">點擊資料列查看該年度</span></div><div class="table-scroll"><table class="data-table yearly-table"><thead><tr><th>年度</th><th>年齡</th><th>月數</th><th>薪資</th><th>股利</th><th>收入合計</th><th>股票投入</th><th>生活支出</th><th>車／房支出</th><th>年度淨現金流</th><th>銀行期初</th><th>賣股補現金</th><th>銀行期末</th><th>股票市值</th><th>總資產</th><th>年增率</th><th>平均月股利</th></tr></thead><tbody id="yearlyRows"></tbody></table></div></article>
      </section>

      <section class="page" data-page-panel="freedom">
        <div class="page-heading"><div><p class="eyebrow">FINANCIAL INDEPENDENCE</p><h2>股利何時養得起生活？</h2><p>同時檢視股利覆蓋率、4% 法則、實質購買力與每月可提領金額。</p></div><select class="year-select" id="freedomYearSelect" aria-label="選擇年度"></select></div>
        <div class="milestone-grid">
          <article><span>股利首次覆蓋生活</span><strong id="dividendMilestone">—</strong><small id="dividendMilestoneAge">—</small></article>
          <article><span>4% 法則首次達成</span><strong id="fourPercentMilestone">—</strong><small id="fourPercentMilestoneAge">—</small></article>
          <article><span>65 歲每月可提領</span><strong id="finalWithdrawal">—</strong><small>安全提領率 <b id="withdrawalRate">—</b></small></article>
          <article><span>65 歲實質購買力</span><strong id="finalRealAsset">—</strong><small>按支出通膨率折現</small></article>
        </div>
        <article class="panel chart-panel"><div class="panel-head"><div><span class="kicker">PROGRESS</span><h3>財務自由達成進度</h3></div><span class="target-badge">100% 目標線</span></div><div class="chart-box" id="freedomChart"></div></article>
        <article class="panel"><div class="panel-head"><div><span class="kicker">YEARLY REVIEW</span><h3>財務自由逐年檢視</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>年度</th><th>年齡</th><th>年生活開銷</th><th>年股利收入</th><th>股利覆蓋率</th><th>結餘／缺口</th><th>4% 所需資產</th><th>當年總資產</th><th>達成率</th><th>實質總資產</th><th>可提領／月</th></tr></thead><tbody id="freedomRows"></tbody></table></div><p class="panel-footnote">生活開銷包含孝親、享樂、固定開銷、車輛及房屋持有成本，不含股票投入與貸款本息。</p></article>
      </section>

      <section class="page" data-page-panel="settings">
        <div class="page-heading"><div><p class="eyebrow">SCENARIO SETTINGS</p><h2>投資試算參數設定</h2><p>黃底欄位皆可調整，變更後所有分頁會立即連動並儲存在目前瀏覽器。</p></div><button class="button ghost" id="resetSettings">還原附檔預設</button></div>
        <form id="settingsForm" class="settings-layout">
          <fieldset class="setting-card"><legend><b>一</b>期間與年齡</legend><div class="field-grid">
            <label>起始年度<input name="startYear" type="number" min="2026" max="2048"></label><label>起始年齡<input name="startAge" type="number" min="18" max="80"></label><label>試算到幾歲<input name="endAge" type="number" min="18" max="100"></label><label>首年計入月數<input name="firstYearMonths" type="number" min="0" max="12"></label>
          </div><label class="toggle-row"><input name="autoRollFirstYearMonths" type="checkbox"><span>依目前月份自動滾動首年計入月數</span></label><div class="derived-line"><span>目前有效首年月數</span><strong id="effectiveMonths">—</strong></div></fieldset>
          <fieldset class="setting-card"><legend><b>二</b>市場假設</legend><div class="field-grid">
            <label>美元匯率<input name="fxRate" type="number" min="0" step="0.001"></label><label>台股股價年成長 %<input name="twPriceGrowth" type="number" step="0.1"></label><label>美股股價年成長 %<input name="usPriceGrowth" type="number" step="0.1"></label><label>台股配息年成長 %<input name="twDividendGrowth" type="number" step="0.1"></label><label>美股配息年成長 %<input name="usDividendGrowth" type="number" step="0.1"></label><label>安全提領率 %<input name="safeWithdrawalRate" type="number" min="0" step="0.1"></label>
          </div></fieldset>
          <fieldset class="setting-card"><legend><b>三</b>每月收入與支出</legend><div class="field-grid">
            <label>薪資收入<input name="monthlySalary" type="number" min="0" step="1000"></label><label>薪資年成長 %<input name="salaryGrowth" type="number" step="0.1"></label><label>孝親<input name="familyMonthly" type="number" min="0" step="1000"></label><label>特別預算／享樂<input name="leisureMonthly" type="number" min="0" step="1000"></label><label>固定開銷<input name="fixedMonthly" type="number" min="0" step="1000"></label><label>支出通膨 %<input name="expenseInflation" type="number" step="0.1"></label><label>完整年度年薪月數<input name="annualSalaryMonths" type="number" min="0" step="0.5"></label>
          </div></fieldset>
          <fieldset class="setting-card"><legend><b>四</b>銀行存款</legend><div class="field-grid">
            <label>台幣存款<input name="twdDeposit" type="number" min="0" step="1000"></label><label>外幣存款（折台幣）<input name="foreignDepositTwd" type="number" min="0" step="1000"></label><label>銀行存款年底下限<input name="bankMinimum" type="number" min="0" step="10000"></label><label>60 歲前現金目標<input name="cashTargetBefore61" type="number" min="0" step="10000"></label><label>61 歲後現金目標<input name="cashTargetAfter61" type="number" min="0" step="10000"></label>
          </div><div class="derived-line"><span>銀行期初合計</span><strong id="bankTotal">—</strong></div></fieldset>
          <fieldset class="setting-card"><legend><b>五</b>購車與車貸</legend><div class="field-grid">
            <label>購車年份<input name="carYear" type="number" min="0" max="2100"></label><label>購車總價<input name="carPrice" type="number" min="0" step="10000"></label><label>頭期款比例 %<input name="carDownPaymentRate" type="number" min="0" max="100" step="1"></label><label>貸款年利率 %<input name="carLoanRate" type="number" min="0" step="0.1"></label><label>貸款期數（月）<input name="carLoanMonths" type="number" min="0"></label><label>車保養＋保險／年<input name="annualVehicleCost" type="number" min="0" step="1000"></label>
          </div><div class="derived-grid"><span>頭期款<strong id="carDownPayment">—</strong></span><span>貸款金額<strong id="carPrincipal">—</strong></span><span>每月還款<strong id="carMonthlyPayment">—</strong></span><span>貸款總利息<strong id="carInterest">—</strong></span></div></fieldset>
          <fieldset class="setting-card"><legend><b>六</b>購屋與房貸</legend><div class="field-grid">
            <label>購屋年份（0＝不購屋）<input name="homeYear" type="number" min="0" max="2100"></label><label>房屋總價<input name="homePrice" type="number" min="0" step="10000"></label><label>頭期款比例 %<input name="homeDownPaymentRate" type="number" min="0" max="100" step="1"></label><label>房貸年利率 %<input name="homeLoanRate" type="number" min="0" step="0.1"></label><label>貸款期數（月）<input name="homeLoanMonths" type="number" min="0"></label><label>房屋持有成本／年<input name="annualHomeCost" type="number" min="0" step="1000"></label>
          </div><div class="derived-grid"><span>頭期款<strong id="homeDownPayment">—</strong></span><span>貸款金額<strong id="homePrincipal">—</strong></span><span>每月還款<strong id="homeMonthlyPayment">—</strong></span><span>貸款總利息<strong id="homeInterest">—</strong></span></div></fieldset>
        </form>
        <div class="save-status" id="settingsStatus">設定變更會自動保存</div>
      </section>

      <section class="page" data-page-panel="portfolio">
        <div class="page-heading"><div><p class="eyebrow">CURRENT HOLDINGS</p><h2>持股現況</h2><p>成本與持有數量可修改；最新報價、配息、市值、損益與配置會自動計算。</p></div><div class="heading-actions"><span id="holdingSaveStatus">尚未修改</span><button class="button primary" id="saveHoldings">保存持股設定</button></div></div>
        <div class="two-column portfolio-top"><article class="panel"><div class="panel-head"><div><span class="kicker">ALLOCATION</span><h3>目前持股配置</h3></div></div><div class="chart-box donut" id="allocationChart"></div></article><article class="panel"><div class="panel-head"><div><span class="kicker">PORTFOLIO SUMMARY</span><h3>投資組合摘要</h3></div></div><div class="portfolio-summary" id="portfolioSummary"></div></article></div>
        <article class="panel"><div class="panel-head"><div><span class="kicker">POSITIONS</span><h3>標的明細</h3></div></div><div class="table-scroll"><table class="data-table holdings-table"><thead><tr><th>標的</th><th>市場</th><th>單位成本</th><th>最新報價</th><th>持有數量</th><th>目前市值</th><th>成本</th><th>投資損益</th><th>盈虧比</th><th>預估年股利</th><th>殖利率</th><th>持股占比</th><th>配息月份</th></tr></thead><tbody id="portfolioRows"></tbody></table></div></article>
      </section>

      <section class="page" data-page-panel="plan">
        <div class="page-heading"><div><p class="eyebrow">INVESTMENT SCHEDULE</p><h2>每月投資計畫</h2><p>可採附檔逐年手動金額，或切換為 2028 年起依現金目標與配置比例自動投入。</p></div><select class="year-select" id="planYearSelect" aria-label="選擇年度"></select></div>
        <div class="mode-switch" role="radiogroup" aria-label="投資模式"><label><input type="radio" name="investmentMode" value="manual"><span>附檔手動計畫</span></label><label><input type="radio" name="investmentMode" value="auto"><span>現金目標自動配置</span></label></div>
        <div class="two-column"><article class="panel"><div class="panel-head"><div><span class="kicker">MONTHLY INPUT</span><h3 id="planInputTitle">年度每月投入</h3></div><strong id="planAnnualTotal">—</strong></div><div class="investment-inputs" id="planInputs"></div><p class="panel-footnote" id="planModeNote">—</p></article><article class="panel"><div class="panel-head"><div><span class="kicker">SELECTED ALLOCATION</span><h3>當年投入配置</h3></div></div><div class="allocation-bars" id="planAllocation"></div></article></div>
        <article class="panel chart-panel"><div class="panel-head"><div><span class="kicker">CONTRIBUTION TREND</span><h3>逐年投資組成</h3></div></div><div class="chart-box" id="investmentChart"></div></article>
        <article class="panel"><div class="panel-head"><div><span class="kicker">FULL PLAN</span><h3>逐年投入明細</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>年度</th><th>年齡</th><th>月數</th><th>VOO</th><th>NVDA</th><th>0050</th><th>0056</th><th>00919</th><th>00631L</th><th>年度合計</th></tr></thead><tbody id="planRows"></tbody></table></div></article>
      </section>

      <section class="page" data-page-panel="market">
        <div class="page-heading"><div><p class="eyebrow">PRICE & DISTRIBUTION</p><h2>價格與配息</h2><p>最新收盤價作為起點，再依台／美股成長假設推估各年度股價與每股配息。</p></div><div class="market-controls"><select id="marketSymbolSelect" aria-label="選擇標的"></select><select id="marketMetricSelect" aria-label="選擇指標"><option value="price">預估股價</option><option value="annualDividend">每股年配息</option></select></div></div>
        <div class="quote-grid" id="quoteCards"></div>
        <article class="panel chart-panel"><div class="panel-head"><div><span class="kicker">PROJECTED MARKET DATA</span><h3 id="marketChartTitle">價格推估</h3></div></div><div class="chart-box" id="marketChart"></div></article>
        <article class="panel"><div class="panel-head"><div><span class="kicker">YEARLY PROJECTION</span><h3>逐年價格與配息推估</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>年度</th><th>年齡</th><th>預估股價</th><th>每股年配息</th><th>股價累計成長</th><th>配息累計成長</th></tr></thead><tbody id="marketRows"></tbody></table></div></article>
      </section>

      <section class="page" data-page-panel="holdings">
        <div class="page-heading"><div><p class="eyebrow">HOLDINGS FORECAST</p><h2>各年度持股推估</h2><p>持股數量、市值、占比與股利皆會反映投入、賣股補現金及購車資金需求。</p></div><select class="year-select" id="holdingsYearSelect" aria-label="選擇年度"></select></div>
        <article class="panel chart-panel"><div class="panel-head"><div><span class="kicker">MARKET VALUE MIX</span><h3>持股市值成長與組成</h3></div><span class="panel-total">選定年度股票總值 <b id="holdingYearTotal">—</b></span></div><div class="chart-box" id="holdingsChart"></div></article>
        <article class="panel"><div class="panel-head"><div><span class="kicker">SELECTED YEAR POSITIONS</span><h3 id="holdingYearTitle">年度持股明細</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>標的</th><th>當年新增</th><th>年末持有</th><th>預估股價</th><th>年末市值</th><th>持股占比</th><th>當年股利</th><th>投資損益</th></tr></thead><tbody id="holdingForecastRows"></tbody></table></div></article>
      </section>

      <section class="page" data-page-panel="dividends">
        <div class="page-heading"><div><p class="eyebrow">MONTHLY DISTRIBUTION</p><h2>各年度月配息</h2><p>依各標的配息月份，把保守估計的年度股利分配至 12 個月。</p></div><select class="year-select" id="dividendYearSelect" aria-label="選擇年度"></select></div>
        <div class="dividend-kpis"><article><span>年度股利合計</span><strong id="dividendYearTotal">—</strong></article><article><span>平均每月股利</span><strong id="dividendMonthlyAverage">—</strong></article><article><span>最高配息月份</span><strong id="dividendPeakMonth">—</strong></article></div>
        <article class="panel chart-panel"><div class="panel-head"><div><span class="kicker">MONTHLY INCOME</span><h3 id="monthlyDividendTitle">月配息組成</h3></div></div><div class="chart-box" id="monthlyDividendChart"></div></article>
        <article class="panel"><div class="panel-head"><div><span class="kicker">MONTHLY DETAIL</span><h3>每月標的配息明細</h3></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>月份</th><th>VOO</th><th>NVDA</th><th>0050</th><th>0056</th><th>00919</th><th>00631L</th><th>月合計</th></tr></thead><tbody id="monthlyDividendRows"></tbody></table></div></article>
      </section>`;
  }

  function calculate() {
    const portfolio = core.portfolio(settings);
    const summary = core.currentSummary(settings);
    const forecast = core.forecast(settings);
    const freedom = core.financialFreedom(settings, forecast);
    const market = core.priceDividendProjection(settings);
    if (!forecast.some((row) => row.year === selectedYear)) selectedYear = forecast[0].year;
    calculated = { portfolio, summary, forecast, freedom, market };
  }

  function yearOptions() {
    return calculated.forecast.map((row) => `<option value="${row.year}" ${row.year === selectedYear ? "selected" : ""}>${row.year} 年 · ${row.age} 歲</option>`).join("");
  }

  function selectedRow() {
    return calculated.forecast.find((row) => row.year === selectedYear) || calculated.forecast[0];
  }

  function renderShell() {
    $("#fxBadge").textContent = `USD/TWD ${Number(settings.fxRate).toFixed(3)}`;
    const dates = settings.quoteDates || {};
    $("#quoteMeta").textContent = `${settings.quoteStatus}｜台股 ${dates.TW || "—"}・美股 ${dates.US || "—"}`;
    $("#pageTitle").textContent = titles[currentPage];
  }

  function renderOverview() {
    const { summary, forecast } = calculated;
    const row = selectedRow();
    const final = forecast[forecast.length - 1];
    $("#currentTotal").textContent = money(summary.total);
    $("#currentProfit").textContent = `目前投資損益 ${signedMoney(summary.profit)}`;
    $("#currentCash").textContent = money(summary.cash);
    $("#cashSafety").textContent = `年底下限 ${money(settings.bankMinimum)}`;
    $("#currentStocks").textContent = money(summary.stockValue);
    $("#stockSplit").textContent = `台股 ${compactMoney(summary.twStocks)}・美股 ${compactMoney(summary.usStocks)}`;
    $("#currentDividend").textContent = money(summary.dividends);
    $("#finalAsset").textContent = money(final.total);
    $("#totalGrowth").textContent = percent(final.total / summary.total - 1, 0);
    $("#selectedYearTitle").textContent = `${row.year} 年度摘要`;
    $("#selectedAge").textContent = `${row.age} 歲`;
    $("#yearSummary").innerHTML = [
      ["收入合計", row.income, "positive"], ["支出合計", row.expense, "negative"],
      ["股票投入", row.plannedInvestment, ""], ["銀行期末", row.cash, row.cash < settings.bankMinimum ? "negative" : ""],
      ["股票市值", row.stockValue, ""], ["總資產", row.total, "accent"]
    ].map(([label, value, className]) => `<div class="${className}"><span>${label}</span><strong>${money(value)}</strong></div>`).join("");
    $("#yearDetail").innerHTML = [
      ["薪資收入", row.salary], ["股利收入", row.dividendIncome], ["孝親", -row.family], ["享樂預算", -row.leisure],
      ["固定開銷", -row.fixed], ["購車頭期＋車貸", -(row.carDownPayment + row.carLoan)], ["車輛持有成本", -row.vehicleCost],
      ["購屋頭期＋房貸", -(row.homeDownPayment + row.homeLoan)], ["房屋持有成本", -row.homeCost], ["賣股補現金", row.stockSales]
    ].map(([label, value]) => `<div><span>${label}</span><strong class="${value < 0 ? "negative-text" : ""}">${value < 0 ? `−${money(Math.abs(value))}` : money(value)}</strong></div>`).join("");

    const notes = [];
    notes.push(`${row.year} 年採用${settings.investmentMode === "manual" ? "附檔手動投入計畫" : "現金目標自動配置"}，年度投入 ${money(row.plannedInvestment)}。`);
    if (row.year === Number(settings.startYear)) notes.push(`首年計入 ${row.activeMonths} 個月，薪資、支出、投入及股利均按此期間估算。`);
    if (row.carLoanPaymentMonths > 0) notes.push(`本年計入 ${row.carLoanPaymentMonths} 個月車貸，共 ${money(row.carLoan)}。`);
    if (row.carDownPayment > 0) notes.push(`購車頭期款 ${money(row.carDownPayment)}，先出售 00919，差額由現金支應。`);
    if (row.stockSales > 0) notes.push(`為維持銀行存款下限，本年共出售持股 ${money(row.stockSales)}；持股與後續股利已同步減少。`);
    if (row.cash <= Number(settings.bankMinimum) + 1) notes.push(`銀行期末接近 ${money(settings.bankMinimum)} 下限，投資與大型支出需持續留意。`);
    $("#planningNotes").innerHTML = notes.map((text, index) => `<div><span>${index + 1}</span><p>${text}</p></div>`).join("");

    $("#yearlyRows").innerHTML = forecast.map((item) => {
      const living = item.family + item.leisure + item.fixed;
      const carHome = item.carDownPayment + item.carLoan + item.vehicleCost + item.homeDownPayment + item.homeLoan + item.homeCost;
      return `<tr data-select-year="${item.year}" class="${item.year === selectedYear ? "selected" : ""}"><td><strong>${item.year}</strong></td><td>${item.age}</td><td>${item.activeMonths}</td><td>${money(item.salary)}</td><td>${money(item.dividendIncome)}</td><td>${money(item.income)}</td><td>${money(item.plannedInvestment)}</td><td>${money(living)}</td><td>${money(carHome)}</td><td class="${item.netCashFlow < 0 ? "negative-text" : "positive-text"}">${signedMoney(item.netCashFlow)}</td><td>${money(item.openingCash)}</td><td>${money(item.stockSales)}</td><td>${money(item.cash)}</td><td>${money(item.stockValue)}</td><td><strong>${money(item.total)}</strong></td><td class="${item.growthRate < 0 ? "negative-text" : "positive-text"}">${percent(item.growthRate)}</td><td>${money(item.averageMonthlyDividend)}</td></tr>`;
    }).join("");
  }

  function renderFreedom() {
    const { freedom } = calculated;
    const dividendMilestone = freedom.dividendMilestone;
    const fourPercent = freedom.fourPercentMilestone;
    $("#dividendMilestone").textContent = dividendMilestone ? `${dividendMilestone.year} 年` : "試算期內未達成";
    $("#dividendMilestoneAge").textContent = dividendMilestone ? `${dividendMilestone.age} 歲` : "—";
    $("#fourPercentMilestone").textContent = fourPercent ? `${fourPercent.year} 年` : "試算期內未達成";
    $("#fourPercentMilestoneAge").textContent = fourPercent ? `${fourPercent.age} 歲` : "—";
    $("#finalWithdrawal").textContent = money(freedom.final.monthlyWithdrawal);
    $("#withdrawalRate").textContent = `${settings.safeWithdrawalRate}%`;
    $("#finalRealAsset").textContent = money(freedom.final.realAssets);
    $("#freedomRows").innerHTML = freedom.rows.map((row) => `<tr data-select-year="${row.year}" class="${row.year === selectedYear ? "selected" : ""}"><td><strong>${row.year}</strong></td><td>${row.age}</td><td>${money(row.livingExpense)}</td><td>${money(row.dividendIncome)}</td><td class="${row.dividendCoverage >= 1 ? "target-met" : ""}">${percent(row.dividendCoverage)}</td><td class="${row.dividendGap < 0 ? "negative-text" : "positive-text"}">${signedMoney(row.dividendGap)}</td><td>${money(row.requiredAssets)}</td><td>${money(row.totalAssets)}</td><td class="${row.achievement >= 1 ? "target-met" : ""}">${percent(row.achievement)}</td><td>${money(row.realAssets)}</td><td>${money(row.monthlyWithdrawal)}</td></tr>`).join("");
  }

  function fillSettings() {
    $$("#settingsForm [name]").forEach((input) => {
      if (document.activeElement === input) return;
      if (input.type === "checkbox") input.checked = Boolean(settings[input.name]);
      else input.value = settings[input.name];
    });
    const firstMonthsInput = $("#settingsForm [name='firstYearMonths']");
    firstMonthsInput.disabled = Boolean(settings.autoRollFirstYearMonths);
    $("#effectiveMonths").textContent = `${core.effectiveFirstYearMonths(settings)} 個月`;
    $("#bankTotal").textContent = money(Number(settings.twdDeposit) + Number(settings.foreignDepositTwd));
    const car = core.loanDetails(settings.carPrice, settings.carDownPaymentRate, settings.carLoanRate, settings.carLoanMonths);
    $("#carDownPayment").textContent = money(car.downPayment);
    $("#carPrincipal").textContent = money(car.principal);
    $("#carMonthlyPayment").textContent = money(car.monthlyPayment);
    $("#carInterest").textContent = money(car.totalInterest);
    const home = core.loanDetails(settings.homePrice, settings.homeDownPaymentRate, settings.homeLoanRate, settings.homeLoanMonths);
    $("#homeDownPayment").textContent = money(home.downPayment);
    $("#homePrincipal").textContent = money(home.principal);
    $("#homeMonthlyPayment").textContent = money(home.monthlyPayment);
    $("#homeInterest").textContent = money(home.totalInterest);
  }

  function renderPortfolio() {
    const { portfolio, summary } = calculated;
    $("#portfolioSummary").innerHTML = [
      ["股票市值", summary.stockValue], ["投入成本", summary.cost], ["投資損益", summary.profit], ["預估年股利", summary.dividends]
    ].map(([label, value]) => `<div><span>${label}</span><strong class="${label === "投資損益" ? (value >= 0 ? "positive-text" : "negative-text") : ""}">${label === "投資損益" ? signedMoney(value) : money(value)}</strong></div>`).join("");
    $("#portfolioRows").innerHTML = portfolio.map((item) => {
      const draft = holdingDraft[item.symbol] || item;
      const payout = item.payoutMonths.length ? item.payoutMonths.map((month) => `<i>${month}月</i>`).join("") : "—";
      return `<tr><td><strong>${item.symbol}</strong><small>${item.name}</small></td><td>${item.market}</td><td><input class="table-input" data-holding="${item.symbol}" data-field="cost" type="number" min="0" step="0.0001" value="${draft.cost}"></td><td>${nativeMoney(item, item.price)}</td><td><input class="table-input" data-holding="${item.symbol}" data-field="units" type="number" min="0" step="0.00001" value="${draft.units}"><small>${unitLabel(item)}</small></td><td>${money(item.marketValueTwd)}</td><td>${money(item.costTwd)}</td><td class="${item.profit >= 0 ? "positive-text" : "negative-text"}">${signedMoney(item.profit)}</td><td>${percent(item.profitRate)}</td><td>${money(item.dividendTwd)}</td><td>${percent(item.yieldRate, 2)}</td><td><strong>${percent(item.weight)}</strong></td><td><span class="month-badges">${payout}</span></td></tr>`;
    }).join("");
  }

  function renderPlan() {
    const row = selectedRow();
    $$('[name="investmentMode"]').forEach((input) => { input.checked = input.value === settings.investmentMode; });
    $("#planInputTitle").textContent = `${row.year} 年每月投入`;
    $("#planAnnualTotal").textContent = `年度合計 ${money(row.plannedInvestment)}`;
    const manual = settings.manualPlans[row.year] || {};
    $("#planInputs").innerHTML = core.holdings.map((item) => {
      const value = Number(manual[item.symbol]) || 0;
      const calculatedMonthly = row.investments[item.symbol] / Math.max(1, row.activeMonths) / (item.market === "US" ? Number(settings.fxRate) : 1);
      const shown = settings.investmentMode === "manual" ? value : calculatedMonthly;
      return `<label><span><b>${item.symbol}</b><small>${item.market === "US" ? "USD／月" : "TWD／月"}</small></span><input data-plan-symbol="${item.symbol}" type="number" min="0" step="${item.market === "US" ? "1" : "1000"}" value="${shown.toFixed(item.market === "US" ? 2 : 0)}" ${settings.investmentMode === "auto" ? "disabled" : ""}></label>`;
    }).join("");
    $("#planModeNote").textContent = settings.investmentMode === "manual"
      ? "目前採用附檔逐年金額；美股欄位以美元輸入，年度合計會依匯率換算為台幣。"
      : "2026～2027 沿用附檔金額；2028 年起把超出現金目標的資金依年齡配置自動投入。";
    const max = Math.max(...Object.values(row.investments), 1);
    $("#planAllocation").innerHTML = core.SYMBOLS.map((symbol) => `<div><span><b>${symbol}</b><small>${money(row.investments[symbol])}</small></span><i><em style="width:${row.investments[symbol] / max * 100}%"></em></i></div>`).join("");
    $("#planRows").innerHTML = calculated.forecast.map((item) => `<tr data-select-year="${item.year}" class="${item.year === selectedYear ? "selected" : ""}"><td><strong>${item.year}</strong></td><td>${item.age}</td><td>${item.activeMonths}</td>${core.SYMBOLS.map((symbol) => `<td>${money(item.investments[symbol])}</td>`).join("")}<td><strong>${money(item.plannedInvestment)}</strong></td></tr>`).join("");
  }

  function renderMarket() {
    const base = calculated.portfolio;
    $("#marketSymbolSelect").innerHTML = base.map((item) => `<option value="${item.symbol}" ${item.symbol === marketSymbol ? "selected" : ""}>${item.symbol}・${item.name}</option>`).join("");
    $("#marketMetricSelect").value = marketMetric;
    $("#quoteCards").innerHTML = base.map((item) => `<article class="${item.symbol === marketSymbol ? "selected" : ""}" data-market-symbol="${item.symbol}"><span>${item.market}</span><h3>${item.symbol}</h3><strong>${nativeMoney(item, item.price)}</strong><small>年配息 ${nativeMoney(item, item.annualDividend)}・殖利率 ${percent(item.yieldRate, 2)}</small></article>`).join("");
    const item = base.find((entry) => entry.symbol === marketSymbol);
    $("#marketChartTitle").textContent = `${marketSymbol} ${marketMetric === "price" ? "股價" : "每股年配息"}推估`;
    const first = calculated.market[0].securities[marketSymbol];
    $("#marketRows").innerHTML = calculated.market.map((row) => {
      const data = row.securities[marketSymbol];
      return `<tr><td><strong>${row.year}</strong></td><td>${row.age}</td><td>${nativeMoney(item, data.price)}</td><td>${nativeMoney(item, data.annualDividend)}</td><td>${percent(data.price / first.price - 1)}</td><td>${first.annualDividend ? percent(data.annualDividend / first.annualDividend - 1) : "—"}</td></tr>`;
    }).join("");
  }

  function renderHoldingsForecast() {
    const row = selectedRow();
    $("#holdingYearTotal").textContent = money(row.stockValue);
    $("#holdingYearTitle").textContent = `${row.year} 年 · ${row.age} 歲持股明細`;
    $("#holdingForecastRows").innerHTML = row.securities.map((item) => `<tr><td><strong>${item.symbol}</strong><small>${item.name}</small></td><td class="${item.addedUnits < 0 ? "negative-text" : "positive-text"}">${item.addedUnits >= 0 ? "+" : ""}${number(item.addedUnits, item.market === "US" ? 4 : 3)} ${unitLabel(item)}</td><td>${number(item.units, item.market === "US" ? 4 : 3)} ${unitLabel(item)}</td><td>${nativeMoney(item, item.price)}</td><td>${money(item.marketValueTwd)}</td><td><strong>${percent(item.weight)}</strong></td><td>${money(item.dividendTwd)}</td><td class="${item.profit >= 0 ? "positive-text" : "negative-text"}">${signedMoney(item.profit)}</td></tr>`).join("");
  }

  function renderDividends() {
    const row = selectedRow();
    const peak = row.monthlyDividends.reduce((best, value, index) => value > best.value ? { value, month: index + 1 } : best, { value: -1, month: 1 });
    $("#dividendYearTotal").textContent = money(row.dividendIncome);
    $("#dividendMonthlyAverage").textContent = money(row.averageMonthlyDividend);
    $("#dividendPeakMonth").textContent = `${peak.month} 月・${money(peak.value)}`;
    $("#monthlyDividendTitle").textContent = `${row.year} 年每月配息組成`;
    $("#monthlyDividendRows").innerHTML = Array.from({ length: 12 }, (_value, index) => `<tr><td><strong>${index + 1} 月</strong></td>${core.SYMBOLS.map((symbol) => `<td>${money(row.monthlyDividendBySymbol[symbol][index])}</td>`).join("")}<td><strong>${money(row.monthlyDividends[index])}</strong></td></tr>`).join("");
  }

  function renderActiveChart() {
    if (!charts) return;
    const row = selectedRow();
    if (currentPage === "overview") charts.assetTrend("#assetTrendChart", calculated.forecast, selectedYear, selectYear);
    if (currentPage === "freedom") charts.freedom("#freedomChart", calculated.freedom.rows, selectedYear, selectYear);
    if (currentPage === "portfolio") charts.allocationDonut("#allocationChart", calculated.portfolio);
    if (currentPage === "plan") charts.investment("#investmentChart", calculated.forecast);
    if (currentPage === "market") charts.priceProjection("#marketChart", calculated.market, marketSymbol, marketMetric);
    if (currentPage === "holdings") charts.holdingsValue("#holdingsChart", calculated.forecast);
    if (currentPage === "dividends") charts.monthlyDividend("#monthlyDividendChart", row);
  }

  function renderAll() {
    calculate();
    const options = yearOptions();
    $$(".year-select").forEach((select) => { select.innerHTML = options; });
    renderShell();
    renderOverview();
    renderFreedom();
    fillSettings();
    renderPortfolio();
    renderPlan();
    renderMarket();
    renderHoldingsForecast();
    renderDividends();
    requestAnimationFrame(renderActiveChart);
  }

  function selectYear(year) {
    selectedYear = Number(year);
    renderAll();
  }

  function showPage(page, shouldScroll = true) {
    if (!titles[page]) return;
    currentPage = page;
    $$("[data-page-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.pagePanel === page));
    $$("[data-page]").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
    $("#pageTitle").textContent = titles[page];
    if (shouldScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(renderActiveChart);
  }

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("show"), 2600);
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const pageButton = event.target.closest("[data-page]");
      if (pageButton) {
        event.preventDefault();
        showPage(pageButton.dataset.page);
        return;
      }
      const yearRow = event.target.closest("[data-select-year]");
      if (yearRow) selectYear(yearRow.dataset.selectYear);
      const marketCard = event.target.closest("[data-market-symbol]");
      if (marketCard) {
        marketSymbol = marketCard.dataset.marketSymbol;
        renderMarket();
        renderActiveChart();
      }
    });

    $("#appPages").addEventListener("change", (event) => {
      const changedPlanInput = event.target.closest("[data-plan-symbol]");
      if (changedPlanInput) {
        settings.manualPlans[selectedYear][changedPlanInput.dataset.planSymbol] = Number(changedPlanInput.value);
        core.saveSettings(settings);
        renderAll();
        toast("年度投資金額已保存");
        return;
      }
      if (event.target.classList.contains("year-select")) {
        selectYear(event.target.value);
        return;
      }
      if (event.target.name === "investmentMode") {
        settings.investmentMode = event.target.value;
        core.saveSettings(settings);
        renderAll();
        toast("投資模式已更新");
        return;
      }
      if (event.target.id === "marketSymbolSelect") {
        marketSymbol = event.target.value;
        renderMarket();
        renderActiveChart();
        return;
      }
      if (event.target.id === "marketMetricSelect") {
        marketMetric = event.target.value;
        renderMarket();
        renderActiveChart();
      }
    });

    $("#appPages").addEventListener("input", (event) => {
      const settingInput = event.target.closest("#settingsForm [name]");
      if (settingInput) {
        settings[settingInput.name] = settingInput.type === "checkbox" ? settingInput.checked : Number(settingInput.value);
        core.saveSettings(settings);
        renderAll();
        $("#settingsStatus").textContent = `已自動保存・${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
        return;
      }
      const holdingInput = event.target.closest("[data-holding]");
      if (holdingInput) {
        holdingDraft[holdingInput.dataset.holding][holdingInput.dataset.field] = Number(holdingInput.value);
        $("#holdingSaveStatus").textContent = "尚未保存";
        return;
      }
      const planInput = event.target.closest("[data-plan-symbol]");
      if (planInput) {
        settings.manualPlans[selectedYear][planInput.dataset.planSymbol] = Number(planInput.value);
        core.saveSettings(settings);
      }
    });

    $("#appPages").addEventListener("click", (event) => {
      if (event.target.closest("#saveHoldings")) {
        settings.holdingSettings = core.clone(holdingDraft);
        core.saveSettings(settings);
        renderAll();
        $("#holdingSaveStatus").textContent = "已保存，後續更新將沿用";
        toast("持股設定已保存");
      }
      if (event.target.closest("#resetSettings")) {
        settings = core.clone(core.defaults);
        holdingDraft = core.clone(settings.holdingSettings);
        selectedYear = settings.startYear;
        core.saveSettings(settings);
        renderAll();
        toast("已還原附檔預設值");
      }
    });

    $("#updateQuotes").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      const original = button.innerHTML;
      button.textContent = "更新中…";
      try {
        settings = await core.updateQuotes(settings);
        holdingDraft = core.clone(settings.holdingSettings);
        renderAll();
        toast("報價、匯率與配息已更新");
      } catch (error) {
        toast(error.message);
      } finally {
        button.disabled = false;
        button.innerHTML = original;
      }
    });
  }

  $("#appPages").innerHTML = pageMarkup();
  bind();
  renderAll();
  showPage("overview", false);
})();
