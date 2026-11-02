(function (global) {
  "use strict";

  const colours = {
    navy: "var(--chart-1)",
    blue: "var(--chart-3)",
    teal: "var(--chart-2)",
    mint: "var(--chart-2)",
    gold: "var(--chart-4)",
    coral: "var(--negative)",
    violet: "var(--chart-3)",
    ink: "var(--text)",
    muted: "var(--muted)",
    grid: "var(--line)"
  };
  const securityColours = {
    VOO: "var(--chart-3)",
    NVDA: "var(--chart-4)",
    "0050": "var(--chart-1)",
    "0056": "var(--chart-2)",
    "00919": "var(--chart-3)",
    "00631L": "var(--chart-4)"
  };

  function ready(container) {
    const element = typeof container === "string" ? document.querySelector(container) : container;
    if (!element) return null;
    if (!global.d3) {
      element.innerHTML = '<p class="chart-fallback">圖表載入中，表格資料仍可正常查看。</p>';
      return null;
    }
    return element;
  }

  function tooltip() {
    let node = document.querySelector(".chart-tooltip");
    if (!node) {
      node = document.createElement("div");
      node.className = "chart-tooltip";
      document.body.appendChild(node);
    }
    return global.d3.select(node);
  }

  function frame(container, ariaLabel, height = 340, minWidth = 720) {
    const element = ready(container);
    if (!element) return null;
    element.innerHTML = "";
    const width = Math.max(minWidth, element.clientWidth || minWidth);
    const svg = global.d3.select(element).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("role", "img")
      .attr("aria-label", ariaLabel);
    svg.append("title").text(ariaLabel);
    return { element, svg, width, height };
  }

  function moneyAxis(value) {
    const amount = Number(value) || 0;
    if (Math.abs(amount) >= 1000000) return `${(amount / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
    if (Math.abs(amount) >= 1000) return `${Math.round(amount / 1000)}K`;
    return String(Math.round(amount));
  }

  function showTooltip(event, html) {
    tooltip().html(html)
      .style("opacity", 1)
      .style("left", `${event.pageX + 14}px`)
      .style("top", `${event.pageY - 16}px`);
  }

  function hideTooltip() {
    tooltip().style("opacity", 0);
  }

  function assetTrend(container, rows, selectedYear, onSelect) {
    const chart = frame(container, "逐年總資產、股票市值與銀行存款長條圖", 430, 1200);
    if (!chart || !rows.length) return;
    const { svg, width, height } = chart;
    const margin = { top: 54, right: 20, bottom: 75, left: 62 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = global.d3.scaleBand().domain(rows.map((row) => row.year)).range([0, innerWidth]).padding(0.22);
    const seriesX = global.d3.scaleBand().domain(["total", "stockValue", "cash"]).range([0, x.bandwidth()]).padding(0.08);
    const minimum = Math.min(0, global.d3.min(rows, (row) => row.cash) || 0);
    const y = global.d3.scaleLinear().domain([minimum, global.d3.max(rows, (row) => row.total) * 1.15]).nice().range([innerHeight, 0]);
    const series = [
      { key: "total", colour: colours.navy, label: "總資產" },
      { key: "stockValue", colour: colours.teal, label: "股票市值" },
      { key: "cash", colour: colours.blue, label: "銀行存款" }
    ];

    g.append("g").attr("class", "chart-grid").call(global.d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
    g.append("g").attr("class", "chart-axis").attr("transform", `translate(0,${innerHeight})`)
      .call(global.d3.axisBottom(x).tickSize(0).tickFormat((year) => String(year)));
    g.append("g").attr("class", "chart-axis").call(global.d3.axisLeft(y).ticks(5).tickFormat(moneyAxis));
    const yearGroups = g.selectAll(".asset-year").data(rows).join("g")
      .attr("class", (row) => `asset-year${row.year === selectedYear ? " selected" : ""}`)
      .attr("transform", (row) => `translate(${x(row.year)},0)`)
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", (row) => `${row.year} 年，${row.age} 歲，總資產 ${Math.round(row.total)} 元，年增 ${(row.growthRate * 100).toFixed(1)}%`)
      .on("mousemove", (event, row) => showTooltip(event, `<strong>${row.year} 年 · ${row.age} 歲</strong><span>總資產 ${moneyAxis(row.total)}</span><span>年增 ${(row.growthRate * 100).toFixed(1)}%</span><span>股票市值 ${moneyAxis(row.stockValue)}</span><span>銀行存款 ${moneyAxis(row.cash)}</span>`))
      .on("mouseout", hideTooltip).on("click", (_event, row) => onSelect(row.year))
      .on("keydown", (event, row) => { if (event.key === "Enter" || event.key === " ") onSelect(row.year); });
    series.forEach((item) => yearGroups.append("rect")
      .attr("x", seriesX(item.key)).attr("width", seriesX.bandwidth())
      .attr("y", (row) => y(Math.max(0, row[item.key])))
      .attr("height", (row) => Math.abs(y(row[item.key]) - y(0)))
      .attr("fill", item.colour).attr("rx", 2));
    yearGroups.append("text").attr("class", "asset-value-label")
      .attr("x", seriesX("total") + seriesX.bandwidth() / 2).attr("y", (row) => y(row.total) - 21)
      .attr("text-anchor", "middle")
      .each(function (row) {
        const label = global.d3.select(this);
        label.append("tspan").attr("x", seriesX("total") + seriesX.bandwidth() / 2).text(moneyAxis(row.total));
        label.append("tspan").attr("x", seriesX("total") + seriesX.bandwidth() / 2).attr("dy", 11).attr("class", "asset-growth-label").text(`${row.growthRate >= 0 ? "+" : ""}${(row.growthRate * 100).toFixed(1)}%`);
      });
    yearGroups.append("text").attr("class", "asset-age-label").attr("x", x.bandwidth() / 2)
      .attr("y", innerHeight + 29).attr("text-anchor", "middle").text((row) => `${row.age} 歲`);

    const legend = svg.append("g").attr("class", "chart-legend-svg").attr("transform", `translate(${margin.left},${height - 12})`);
    series
      .forEach((item, index) => {
        const group = legend.append("g").attr("transform", `translate(${index * 126},0)`);
        group.append("rect").attr("width", 14).attr("height", 10).attr("y", -8).attr("rx", 2).attr("fill", item.colour);
        group.append("text").attr("x", 30).attr("y", 4).text(item.label);
      });
  }

  function freedom(container, rows, selectedYear, onSelect) {
    const chart = frame(container, "股利覆蓋率與 4% 法則達成率", 330);
    if (!chart || !rows.length) return;
    const { svg, width, height } = chart;
    const margin = { top: 24, right: 28, bottom: 52, left: 64 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const x = global.d3.scalePoint().domain(rows.map((row) => row.year)).range([0, innerWidth]).padding(0.3);
    const y = global.d3.scaleLinear().domain([0, Math.max(1.2, global.d3.max(rows, (row) => Math.max(row.dividendCoverage, row.achievement)) * 1.08)]).nice().range([innerHeight, 0]);
    g.append("g").attr("class", "chart-grid").call(global.d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
    g.append("g").attr("class", "chart-axis").attr("transform", `translate(0,${innerHeight})`).call(global.d3.axisBottom(x).tickValues(rows.filter((_r, i) => i % 2 === 0).map((r) => r.year)));
    g.append("g").attr("class", "chart-axis").call(global.d3.axisLeft(y).ticks(5).tickFormat((value) => `${Math.round(value * 100)}%`));
    g.append("line").attr("x2", innerWidth).attr("y1", y(1)).attr("y2", y(1)).attr("class", "target-line");
    g.append("text").attr("x", innerWidth - 4).attr("y", y(1) - 7).attr("text-anchor", "end").attr("class", "target-label").text("100% 達成線");
    [
      { key: "dividendCoverage", colour: colours.teal, label: "股利覆蓋率" },
      { key: "achievement", colour: colours.blue, label: "4% 法則達成率" }
    ].forEach((series) => {
      const line = global.d3.line().x((row) => x(row.year)).y((row) => y(row[series.key])).curve(global.d3.curveMonotoneX);
      g.append("path").datum(rows).attr("class", "chart-line").attr("d", line).attr("stroke", series.colour).attr("stroke-width", 3);
    });
    g.selectAll(".freedom-hit").data(rows).join("circle").attr("class", "freedom-hit")
      .attr("cx", (row) => x(row.year)).attr("cy", (row) => y(row.achievement)).attr("r", (row) => row.year === selectedYear ? 7 : 4)
      .attr("fill", (row) => row.year === selectedYear ? colours.gold : colours.blue)
      .on("mousemove", (event, row) => showTooltip(event, `<strong>${row.year} 年 · ${row.age} 歲</strong><span>股利覆蓋 ${(row.dividendCoverage * 100).toFixed(1)}%</span><span>4% 法則 ${(row.achievement * 100).toFixed(1)}%</span><span>每月可提領 ${moneyAxis(row.monthlyWithdrawal)}</span>`))
      .on("mouseout", hideTooltip).on("click", (_event, row) => onSelect(row.year));
  }

  function allocationDonut(container, items) {
    const chart = frame(container, "目前持股配置比例", 300);
    if (!chart || !items.length) return;
    const { svg, width, height } = chart;
    const radius = Math.min(width * 0.26, height * 0.38);
    const g = svg.append("g").attr("transform", `translate(${Math.min(width * 0.3, 250)},${height / 2})`);
    const pie = global.d3.pie().value((item) => item.marketValueTwd).sort(null);
    const arc = global.d3.arc().innerRadius(radius * 0.58).outerRadius(radius);
    g.selectAll("path").data(pie(items)).join("path").attr("d", arc)
      .attr("fill", (item) => securityColours[item.data.symbol])
      .attr("stroke", "#fff").attr("stroke-width", 2)
      .on("mousemove", (event, item) => showTooltip(event, `<strong>${item.data.symbol}</strong><span>${moneyAxis(item.data.marketValueTwd)}</span><span>${(item.data.weight * 100).toFixed(1)}%</span>`))
      .on("mouseout", hideTooltip);
    g.append("text").attr("class", "donut-label").attr("text-anchor", "middle").attr("y", -4).text("股票市值");
    g.append("text").attr("class", "donut-value").attr("text-anchor", "middle").attr("y", 22).text(moneyAxis(global.d3.sum(items, (item) => item.marketValueTwd)));
    const legend = svg.append("g").attr("transform", `translate(${Math.min(width * 0.56, 500)},${42})`);
    items.forEach((item, index) => {
      const row = legend.append("g").attr("transform", `translate(0,${index * 36})`);
      row.append("circle").attr("r", 6).attr("fill", securityColours[item.symbol]);
      row.append("text").attr("x", 16).attr("y", 4).text(item.symbol);
      row.append("text").attr("x", 84).attr("y", 4).attr("class", "legend-value").text(`${(item.weight * 100).toFixed(1)}%`);
    });
  }

  function stackedBars(container, rows, valueAccessor, ariaLabel) {
    const chart = frame(container, ariaLabel, 340);
    if (!chart || !rows.length) return;
    const { svg, width, height } = chart;
    const margin = { top: 24, right: 24, bottom: 52, left: 68 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const data = rows.map((row) => ({ year: row.year, ...valueAccessor(row) }));
    const keys = Object.keys(valueAccessor(rows[0]));
    const stack = global.d3.stack().keys(keys)(data);
    const x = global.d3.scaleBand().domain(data.map((row) => row.year)).range([0, innerWidth]).padding(0.22);
    const y = global.d3.scaleLinear().domain([0, global.d3.max(stack, (series) => global.d3.max(series, (item) => item[1])) || 1]).nice().range([innerHeight, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    g.append("g").attr("class", "chart-grid").call(global.d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
    g.append("g").attr("class", "chart-axis").attr("transform", `translate(0,${innerHeight})`).call(global.d3.axisBottom(x).tickValues(rows.filter((_r, i) => i % 2 === 0).map((r) => r.year)));
    g.append("g").attr("class", "chart-axis").call(global.d3.axisLeft(y).ticks(5).tickFormat(moneyAxis));
    g.selectAll("g.stack").data(stack).join("g").attr("class", "stack").attr("fill", (series) => securityColours[series.key])
      .selectAll("rect").data((series) => series.map((item) => ({ ...item, key: series.key }))).join("rect")
      .attr("x", (item) => x(item.data.year)).attr("y", (item) => y(item[1]))
      .attr("height", (item) => Math.max(0, y(item[0]) - y(item[1]))).attr("width", x.bandwidth())
      .on("mousemove", (event, item) => showTooltip(event, `<strong>${item.data.year} 年 · ${item.key}</strong><span>${moneyAxis(item.data[item.key])}</span>`))
      .on("mouseout", hideTooltip);
  }

  function investment(container, rows) {
    stackedBars(container, rows, (row) => row.investments, "各年度投資金額與標的組成");
  }

  function holdingsValue(container, rows) {
    stackedBars(container, rows, (row) => Object.fromEntries(row.securities.map((item) => [item.symbol, item.marketValueTwd])), "各年度持股市值與標的組成");
  }

  function monthlyDividend(container, row) {
    const chart = frame(container, `${row.year} 年每月配息預估`, 330);
    if (!chart) return;
    const { svg, width, height } = chart;
    const margin = { top: 20, right: 20, bottom: 46, left: 64 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const data = Array.from({ length: 12 }, (_value, index) => ({
      month: index + 1,
      ...Object.fromEntries(Object.entries(row.monthlyDividendBySymbol).map(([symbol, values]) => [symbol, values[index]]))
    }));
    const keys = global.InvestmentCore.SYMBOLS.filter((symbol) => global.d3.sum(data, (item) => item[symbol]) > 0);
    const stack = global.d3.stack().keys(keys)(data);
    const x = global.d3.scaleBand().domain(data.map((item) => item.month)).range([0, innerWidth]).padding(0.24);
    const y = global.d3.scaleLinear().domain([0, global.d3.max(stack, (series) => global.d3.max(series, (item) => item[1])) || 1]).nice().range([innerHeight, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    g.append("g").attr("class", "chart-grid").call(global.d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
    g.append("g").attr("class", "chart-axis").attr("transform", `translate(0,${innerHeight})`).call(global.d3.axisBottom(x).tickFormat((month) => `${month}月`));
    g.append("g").attr("class", "chart-axis").call(global.d3.axisLeft(y).ticks(5).tickFormat(moneyAxis));
    g.selectAll("g.month-stack").data(stack).join("g").attr("fill", (series) => securityColours[series.key])
      .selectAll("rect").data((series) => series.map((item) => ({ ...item, key: series.key }))).join("rect")
      .attr("x", (item) => x(item.data.month)).attr("y", (item) => y(item[1])).attr("width", x.bandwidth())
      .attr("height", (item) => Math.max(0, y(item[0]) - y(item[1])))
      .on("mousemove", (event, item) => showTooltip(event, `<strong>${item.data.month} 月 · ${item.key}</strong><span>${moneyAxis(item.data[item.key])}</span>`))
      .on("mouseout", hideTooltip);
  }

  function priceProjection(container, rows, symbol, metric) {
    const label = metric === "price" ? "股價" : "每股年配息";
    const chart = frame(container, `${symbol} ${label}推估`, 310);
    if (!chart || !rows.length) return;
    const { svg, width, height } = chart;
    const margin = { top: 24, right: 28, bottom: 48, left: 64 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const data = rows.map((row) => ({ year: row.year, age: row.age, value: row.securities[symbol][metric] }));
    const x = global.d3.scalePoint().domain(data.map((item) => item.year)).range([0, innerWidth]).padding(0.3);
    const y = global.d3.scaleLinear().domain([0, global.d3.max(data, (item) => item.value) * 1.08 || 1]).nice().range([innerHeight, 0]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    g.append("g").attr("class", "chart-grid").call(global.d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));
    g.append("g").attr("class", "chart-axis").attr("transform", `translate(0,${innerHeight})`).call(global.d3.axisBottom(x).tickValues(data.filter((_r, i) => i % 2 === 0).map((r) => r.year)));
    g.append("g").attr("class", "chart-axis").call(global.d3.axisLeft(y).ticks(5));
    const line = global.d3.line().x((item) => x(item.year)).y((item) => y(item.value)).curve(global.d3.curveMonotoneX);
    g.append("path").datum(data).attr("class", "chart-line").attr("stroke", securityColours[symbol]).attr("stroke-width", 3).attr("d", line);
    g.selectAll("circle").data(data).join("circle").attr("cx", (item) => x(item.year)).attr("cy", (item) => y(item.value)).attr("r", 4).attr("fill", securityColours[symbol])
      .on("mousemove", (event, item) => showTooltip(event, `<strong>${item.year} 年 · ${item.age} 歲</strong><span>${symbol} ${label} ${item.value.toFixed(4)}</span>`)).on("mouseout", hideTooltip);
  }

  global.InvestmentCharts = { colours, securityColours, assetTrend, freedom, allocationDonut, investment, holdingsValue, monthlyDividend, priceProjection };
})(window);
