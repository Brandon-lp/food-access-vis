// Food sales & income section (sections/07-income_sales.html).
// Reads the two state CSVs and a U.S. map with D3, then draws a clickable map and an animated line chart.

const IS_MAP_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json';
const IS_FOOD_FILE = 'data/state-food-sales.csv';
const IS_INCOME_FILE = 'data/state-income.csv';
const IS_DEFAULT_STATE = 'Texas';

// Line colors from the sketch (checked for colorblind safety on the cream background).
const IS_FOOD_COLOR = '#eb6834';
const IS_INCOME_COLOR = '#9b2c1f';
const IS_INK = '#17231f';
const IS_MAP_RAMP = ['#cde2fb', '#104281'];
const IS_NO_DATA = '#dcd7cf';

// Chart size in SVG units; the SVG stretches to fit the page. Phones get a narrower frame so the text stays readable.
const IS_SIZES = {
  wide: { width: 640, height: 380, top: 24, right: 96, bottom: 36, left: 52, xTicks: 7 },
  compact: { width: 360, height: 300, top: 20, right: 80, bottom: 32, left: 46, xTicks: 4 }
};
// How long the lines take to draw, in milliseconds (4000 = 4 seconds).
const IS_DURATION = 4000;

// The two views. Each series is one line, read from a column worked out in isPrepare().
const IS_VIEWS = {
  growth: {
    title: (state) => `${state}: change per person since 1997`,
    axis: (value) => `${value > 0 ? '+' : ''}${value}%`,
    series: [
      { key: 'foodGrowth', name: 'Food sales', color: IS_FOOD_COLOR },
      { key: 'incomeGrowth', name: 'Income', color: IS_INCOME_COLOR }
    ]
  },
  share: {
    title: (state) => `${state}: food sales as a share of income`,
    axis: (value) => `${value}%`,
    series: [{ key: 'share', name: 'Food sales', color: IS_FOOD_COLOR }]
  }
};

const isState = { view: 'growth', selected: IS_DEFAULT_STATE, states: {}, domains: {}, chart: {} };

const isNumber = (text) => Number(String(text).replace(/[$,\s]/g, ''));
const isMoney = (value) => `$${Math.round(value).toLocaleString('en-US')}`;
const isSigned = (value) => `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
const isPercent = (value) => `${value.toFixed(1)}%`;
const isFormat = (key, value) => (key === 'share' ? isPercent(value) : isSigned(value));
const isReduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Joins the two files into { stateName: { name, fips, years: [ { year, food, income, foodGrowth, incomeGrowth, share } ] } }.
function isPrepare(foodRows, incomeRows) {
  const income = {};
  incomeRows.forEach((row) => {
    income[`${row.State}|${row.Year}`] = { value: isNumber(row['Per Capita Personal Income']), fips: row['State FIPS'].slice(0, 2) };
  });
  // Income only comes in nominal dollars, so food sales must be nominal too.
  foodRows
    .filter((row) => row['Food Purchase Type'] === 'Total food' && row['Dollar Basis'] === 'Nominal dollars')
    .forEach((row) => {
      const match = income[`${row.State}|${row.Year}`];
      if (!match) return;
      const state = isState.states[row.State] = isState.states[row.State] || { name: row.State, fips: match.fips, years: [] };
      state.years.push({ year: Number(row.Year), food: isNumber(row['Per Capita Sales']), income: match.value });
    });
  Object.values(isState.states).forEach((state) => {
    state.years.sort((a, b) => a.year - b.year);
    const first = state.years[0];
    state.years.forEach((d) => {
      d.foodGrowth = (d.food / first.food - 1) * 100;
      d.incomeGrowth = (d.income / first.income - 1) * 100;
      d.share = (d.food / d.income) * 100;
    });
  });
  // One fixed scale per view for every state, so switching states shows real differences.
  const allYears = Object.values(isState.states).flatMap((state) => state.years);
  const growthMax = d3.max(allYears, (d) => Math.max(d.foodGrowth, d.incomeGrowth));
  const growthMin = d3.min(allYears, (d) => Math.min(d.foodGrowth, d.incomeGrowth));
  isState.domains.growth = [Math.min(0, Math.floor(growthMin / 10) * 10), Math.ceil(growthMax / 50) * 50];
  isState.domains.share = [Math.floor(d3.min(allYears, (d) => d.share)), Math.ceil(d3.max(allYears, (d) => d.share))];
}

function isDrawMap(us) {
  // The map file is drawn for a 975 x 610 frame, but Alaska's islands reach a little past its left edge.
  const svg = d3.select('#is-map-box').append('svg')
    .attr('id', 'is-map')
    .attr('role', 'img')
    .attr('aria-label', 'Map of U.S. states shaded by food sales as a share of income. Use the State menu to choose a state.')
    .attr('viewBox', '-60 0 1035 610');
  const path = d3.geoPath();
  const features = topojson.feature(us, us.objects.states).features;
  const byFips = {};
  Object.values(isState.states).forEach((state) => { byFips[state.fips] = state; });
  const latestShare = (state) => state.years[state.years.length - 1].share;
  const shares = Object.values(isState.states).map(latestShare);
  const color = d3.scaleSequential(d3.interpolateRgb(...IS_MAP_RAMP)).domain(d3.extent(shares));
  const lastYear = d3.max(Object.values(isState.states), (state) => state.years[state.years.length - 1].year);

  svg.append('g')
    .selectAll('path')
    .data(features)
    .join('path')
    .attr('class', (feature) => (byFips[feature.id] ? 'is-state' : 'is-state is-no-data'))
    .attr('d', path)
    .attr('fill', (feature) => (byFips[feature.id] ? color(latestShare(byFips[feature.id])) : IS_NO_DATA))
    .on('click', (event, feature) => byFips[feature.id] && isSelect(byFips[feature.id].name))
    .on('pointermove', (event, feature) => {
      const state = byFips[feature.id];
      hoverOutline.attr('d', path(feature));
      tip.innerHTML = `<strong>${feature.properties.name}</strong>` +
        (state ? `Food sales = ${isPercent(latestShare(state))} of income in ${lastYear}` : 'No data');
      tip.hidden = false;
      // Place the label beside the pointer, flipping to the left near the right edge.
      const [pointerX, pointerY] = d3.pointer(event, box);
      const flip = pointerX + 16 + tip.offsetWidth > box.clientWidth;
      tip.style.left = `${flip ? pointerX - tip.offsetWidth - 16 : pointerX + 16}px`;
      tip.style.top = `${pointerY + 16}px`;
    })
    .on('pointerleave', () => {
      tip.hidden = true;
      hoverOutline.attr('d', null);
    });
  svg.append('path')
    .attr('class', 'is-borders')
    .attr('d', path(topojson.mesh(us, us.objects.states, (a, b) => a !== b)));
  const hoverOutline = svg.append('path').attr('class', 'is-hover-outline');
  isState.chart.outline = svg.append('path').attr('class', 'is-outline');

  // Hover label showing the state's name.
  const box = document.querySelector('#is-map-box');
  const tip = document.createElement('div');
  tip.className = 'is-map-tip';
  tip.hidden = true;
  box.appendChild(tip);
  isState.chart.features = features;
  isState.chart.mapPath = path;

  const [low, high] = d3.extent(shares);
  document.querySelector('#is-map-legend').innerHTML =
    `<span class="is-legend-title">Food sales as % of income, ${lastYear}</span>` +
    `<span class="is-ramp" style="background: linear-gradient(90deg, ${IS_MAP_RAMP[0]}, ${IS_MAP_RAMP[1]})"></span>` +
    `<span class="is-ramp-labels"><span>${isPercent(low)}</span><span>${isPercent(high)}</span></span>`;
}

function isSetupChart() {
  isState.size = document.querySelector('.is-chart').clientWidth < 500 ? IS_SIZES.compact : IS_SIZES.wide;
  const { width, height, top, right, bottom, left } = isState.size;
  const svg = d3.select('.is-chart').insert('svg', '#is-tooltip')
    .attr('id', 'is-chart')
    .attr('role', 'img')
    .attr('viewBox', `0 0 ${width} ${height}`);
  const chart = isState.chart;
  chart.x = d3.scaleLinear().range([left, width - right]);
  chart.y = d3.scaleLinear().range([height - bottom, top]);
  chart.gridGroup = svg.append('g').attr('class', 'is-grid');
  chart.xAxisGroup = svg.append('g').attr('class', 'is-axis').attr('transform', `translate(0,${height - bottom})`);
  chart.lineGroup = svg.append('g');
  chart.labelGroup = svg.append('g');
  chart.focusGroup = svg.append('g').attr('class', 'is-focus').style('display', 'none');
  chart.focusLine = chart.focusGroup.append('line').attr('y1', top).attr('y2', height - bottom);
  chart.hoverArea = svg.append('rect')
    .attr('x', left).attr('y', top).attr('width', width - left - right).attr('height', height - top - bottom)
    .attr('fill', 'transparent')
    .on('pointermove', isHover)
    .on('pointerleave', () => {
      chart.focusGroup.style('display', 'none');
      document.querySelector('#is-tooltip').hidden = true;
    });
}

function isDrawChart() {
  const view = IS_VIEWS[isState.view];
  const state = isState.states[isState.selected];
  const data = state.years;
  const chart = isState.chart;
  const { width, top, right, left, xTicks } = isState.size;
  const { x, y } = chart;
  const duration = isReduceMotion() ? 0 : IS_DURATION;
  x.domain(d3.extent(data, (d) => d.year));
  y.domain(isState.domains[isState.view]);

  chart.xAxisGroup.call(d3.axisBottom(x).ticks(xTicks).tickFormat(d3.format('d')).tickSizeOuter(0));
  chart.gridGroup.call(d3.axisLeft(y).ticks(6).tickSize(-(width - left - right)).tickFormat(view.axis))
    .attr('transform', `translate(${left},0)`)
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('.tick line').classed('is-zero', (value) => value === 0));

  const line = (series) => d3.line().x((d) => x(d.year)).y((d) => y(d[series.key]))(data);
  const paths = chart.lineGroup.selectAll('path').data(view.series, (series) => series.key)
    .join('path')
    .attr('fill', 'none')
    .attr('stroke', (series) => series.color)
    .attr('stroke-width', 2.5)
    .attr('stroke-linejoin', 'round')
    .attr('d', line);
  const markers = chart.lineGroup.selectAll('circle').data(view.series, (series) => series.key)
    .join('circle')
    .attr('r', 5)
    .attr('fill', '#f5f0e8')
    .attr('stroke', (series) => series.color)
    .attr('stroke-width', 2.5);

  // Animation: each line draws itself from 1997 to the last year, with an open circle riding on its tip.
  paths.interrupt().each(function (series) {
    const length = this.getTotalLength();
    const marker = markers.filter((item) => item.key === series.key);
    d3.select(this)
      .attr('stroke-dasharray', `${length} ${length}`)
      .attr('stroke-dashoffset', length)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .attrTween('stroke-dashoffset', () => (t) => {
        const point = this.getPointAtLength(length * t);
        marker.attr('cx', point.x).attr('cy', point.y);
        return length * (1 - t);
      });
  });

  // Labels at the end of each line, nudged apart if they would overlap.
  const last = data[data.length - 1];
  const labels = view.series.map((series) => ({ ...series, y: y(last[series.key]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i += 1) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 32);
  chart.labelGroup.selectAll('text').interrupt();
  const texts = chart.labelGroup.selectAll('text').data(labels, (series) => series.key)
    .join('text')
    .attr('class', 'is-end-label')
    .attr('x', width - right + 12)
    .attr('y', (series) => series.y - 4)
    .style('opacity', 0);
  texts.selectAll('tspan').remove();
  texts.append('tspan').attr('class', 'is-end-name').attr('x', width - right + 12).text((series) => series.name);
  texts.append('tspan').attr('class', 'is-end-value').attr('x', width - right + 12).attr('dy', 16).attr('fill', (series) => series.color).text((series) => isFormat(series.key, last[series.key]));
  texts.transition().delay(duration).duration(300).style('opacity', 1);

  chart.focusGroup.selectAll('circle').data(view.series, (series) => series.key)
    .join('circle').attr('r', 4).attr('fill', (series) => series.color);

  document.querySelector('#is-chart-title').textContent = view.title(state.name);
  document.querySelector('#is-legend').innerHTML = view.series.length > 1
    ? view.series.map((series) => `<span class="is-legend-item"><span class="is-swatch" style="background:${series.color}"></span>${series.name} per person</span>`).join('')
    : '';
  d3.select('#is-chart').attr('aria-label', `Line chart: ${view.title(state.name)}, ${data[0].year} to ${last.year}. Numbers are in the table below.`);
}

// Crosshair and tooltip for the year under the pointer.
function isHover(event) {
  const chart = isState.chart;
  const data = isState.states[isState.selected].years;
  const [pointerX] = d3.pointer(event);
  const year = Math.round(chart.x.invert(pointerX));
  const d = data.find((item) => item.year === year);
  if (!d) return;
  const x = chart.x(year);
  chart.focusGroup.style('display', null);
  chart.focusLine.attr('x1', x).attr('x2', x);
  chart.focusGroup.selectAll('circle').attr('cx', x).attr('cy', (series) => chart.y(d[series.key]));

  const tooltip = document.querySelector('#is-tooltip');
  tooltip.innerHTML = isState.view === 'growth'
    ? `<strong>${year}</strong>Food sales ${isMoney(d.food)} <span>(${isSigned(d.foodGrowth)})</span><br>Income ${isMoney(d.income)} <span>(${isSigned(d.incomeGrowth)})</span>`
    : `<strong>${year}</strong>Food sales ${isMoney(d.food)}<br>Income ${isMoney(d.income)}<br>Food = <span>${isPercent(d.share)}</span> of income`;
  tooltip.hidden = false;
  const box = document.querySelector('.is-chart');
  const scale = box.clientWidth / isState.size.width;
  const pointX = x * scale;
  // Show the tooltip right of the crosshair, or left of it near the right edge.
  const tooltipLeft = pointX + 14 + tooltip.offsetWidth > box.clientWidth ? pointX - tooltip.offsetWidth - 14 : pointX + 14;
  tooltip.style.left = `${Math.max(0, tooltipLeft)}px`;
  tooltip.style.top = `${isState.size.top * scale}px`;
}

function isDescribe() {
  const state = isState.states[isState.selected];
  const first = state.years[0];
  const last = state.years[state.years.length - 1];
  const faster = last.foodGrowth > last.incomeGrowth ? 'faster' : 'more slowly';
  document.querySelector('#is-summary').innerHTML =
    `<div><p class="is-summary-label">${state.name}, ${first.year}&ndash;${last.year}</p>` +
    `<p>Food sales per person grew <strong>${isSigned(last.foodGrowth)}</strong> (${isMoney(first.food)} &rarr; ${isMoney(last.food)}), ${faster} than income per person, which grew <strong>${isSigned(last.incomeGrowth)}</strong> (${isMoney(first.income)} &rarr; ${isMoney(last.income)}).</p></div>` +
    `<div><p class="is-summary-label">Food sales as a share of income</p>` +
    `<p><strong>${isPercent(first.share)}</strong> in ${first.year} &rarr; <strong>${isPercent(last.share)}</strong> in ${last.year}</p></div>`;
}

function isRenderTable() {
  const state = isState.states[isState.selected];
  const rows = state.years.map((d) => `<tr><th scope="row">${d.year}</th><td>${isMoney(d.food)}</td><td>${isSigned(d.foodGrowth)}</td><td>${isMoney(d.income)}</td><td>${isSigned(d.incomeGrowth)}</td><td>${isPercent(d.share)}</td></tr>`).join('');
  document.querySelector('#is-table').innerHTML =
    `<table><caption>${state.name}, per person</caption><thead><tr><th scope="col">Year</th><th scope="col">Food sales</th><th scope="col">Since 1997</th><th scope="col">Income</th><th scope="col">Since 1997</th><th scope="col">Food as % of income</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function isSelect(name) {
  isState.selected = name;
  document.querySelector('#is-state-select').value = name;
  const feature = isState.chart.features.find((item) => item.id === isState.states[name].fips);
  isState.chart.outline.attr('d', feature ? isState.chart.mapPath(feature) : null);
  isDrawChart();
  isDescribe();
  isRenderTable();
}

function isShowError(message) {
  document.querySelector('#income-sales .is-shell').innerHTML = `<p class="load-error">${message}</p>`;
}

function isInit() {
  if (!document.querySelector('#income-sales')) return;
  if (typeof d3 === 'undefined' || typeof topojson === 'undefined') {
    isShowError('The chart libraries could not be loaded. Check your internet connection and reload the page.');
    return;
  }
  Promise.all([d3.csv(IS_FOOD_FILE), d3.csv(IS_INCOME_FILE), d3.json(IS_MAP_URL)])
    .then(([foodRows, incomeRows, us]) => {
      isPrepare(foodRows, incomeRows);
      isDrawMap(us);
      isSetupChart();

      const select = document.querySelector('#is-state-select');
      select.innerHTML = Object.keys(isState.states).sort().map((name) => `<option value="${name}">${name}</option>`).join('');
      select.addEventListener('change', () => isSelect(select.value));
      document.querySelectorAll('#income-sales .is-button[data-view]').forEach((button) => {
        button.addEventListener('click', () => {
          isState.view = button.dataset.view;
          document.querySelectorAll('#income-sales .is-button[data-view]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
          isDrawChart();
        });
      });
      document.querySelector('#is-replay').addEventListener('click', isDrawChart);

      isSelect(isState.states[IS_DEFAULT_STATE] ? IS_DEFAULT_STATE : Object.keys(isState.states)[0]);
    })
    .catch((error) => {
      console.error(error);
      isShowError('The food sales and income data could not be loaded. Use a local server such as VS Code Live Server to run this project.');
    });
}

// script.js announces "sections:loaded" once every section is on the page.
document.addEventListener('sections:loaded', isInit);
