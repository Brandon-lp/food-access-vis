// Food sales & income section (sections/06-economic-access.html).
// Reads the two state CSVs and a U.S. map with D3, then draws a clickable map and an animated line chart.

const IS_MAP_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json';
const IS_FOOD_FILE = 'data/state-food-sales.csv';
const IS_INCOME_FILE = 'data/state-income.csv';
// The chart opens on the U.S. average; this is its value in the State menu.
const IS_NATIONAL = 'U.S. average';

// Line colors from the produce-stand palette: Orange and Tomato Red (checked for colorblind safety on the cream background).
const IS_FOOD_COLOR = '#ee7302';
const IS_INCOME_COLOR = '#b81817';
const IS_INK = '#1c2147';
// Map ramp: light to dark Green Beans, so it doesn't compete with the orange and red lines.
const IS_MAP_RAMP = ['#eef0d2', '#4a5e1c'];
const IS_NO_DATA = '#dcd7cf';

// Chart size in SVG units; the SVG stretches to fit the page. Phones get a narrower frame so the text stays readable.
const IS_SIZES = {
  wide: { width: 640, height: 380, top: 24, right: 96, bottom: 36, left: 52, xTicks: 7 },
  compact: { width: 360, height: 300, top: 20, right: 80, bottom: 32, left: 46, xTicks: 4 }
};
// How long the lines take to draw, in milliseconds (4000 = 4 seconds).
const IS_DURATION = 4000;
// Map zoom: how long it takes (milliseconds) and the closest it gets, so tiny places like D.C. don't fill the whole map.
const IS_ZOOM_DURATION = 750;
const IS_MAX_ZOOM = 8;
const IS_MAP_FRAME = { x: -60, y: 0, width: 1035, height: 610 };

// The chart's two lines, read from columns worked out in isPrepare().
const IS_VIEW = {
  title: (state) => `${state}: change per person since 1997`,
  axis: (value) => `${value > 0 ? '+' : ''}${value}%`,
  series: [
    { key: 'foodGrowth', name: 'Food sales', color: IS_FOOD_COLOR },
    { key: 'incomeGrowth', name: 'Income', color: IS_INCOME_COLOR }
  ]
};

const isState = { selected: IS_NATIONAL, states: {}, national: null, domain: [], chart: {} };

// The place shown in the chart: the U.S. average or one state.
const isCurrent = () => (isState.selected === IS_NATIONAL ? isState.national : isState.states[isState.selected]);

const isNumber = (text) => Number(String(text).replace(/[$,\s]/g, ''));
const isMoney = (value) => `$${Math.round(value).toLocaleString('en-US')}`;
const isSigned = (value) => `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
const isPercent = (value) => `${value.toFixed(1)}%`;
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
  // U.S. average: for each year, the plain average of every state's food sales and income per person.
  const byYear = d3.group(Object.values(isState.states).flatMap((state) => state.years), (d) => d.year);
  isState.national = {
    name: IS_NATIONAL,
    fips: null,
    years: [...byYear].map(([year, rows]) => ({ year, food: d3.mean(rows, (d) => d.food), income: d3.mean(rows, (d) => d.income) }))
  };
  [...Object.values(isState.states), isState.national].forEach((state) => {
    state.years.sort((a, b) => a.year - b.year);
    const first = state.years[0];
    state.years.forEach((d) => {
      d.foodGrowth = (d.food / first.food - 1) * 100;
      d.incomeGrowth = (d.income / first.income - 1) * 100;
      d.share = (d.food / d.income) * 100;
    });
  });
  // One fixed scale for every state, so switching states shows real differences.
  const allYears = Object.values(isState.states).flatMap((state) => state.years);
  const growthMax = d3.max(allYears, (d) => Math.max(d.foodGrowth, d.incomeGrowth));
  const growthMin = d3.min(allYears, (d) => Math.min(d.foodGrowth, d.incomeGrowth));
  isState.domain = [Math.min(0, Math.floor(growthMin / 10) * 10), Math.ceil(growthMax / 50) * 50];
}

function isDrawMap(us) {
  // The map file is drawn for a 975 x 610 frame, but Alaska's islands reach a little past its left edge.
  const svg = d3.select('#is-map-box').append('svg')
    .attr('id', 'is-map')
    .attr('role', 'img')
    .attr('aria-label', 'Map of U.S. states shaded by food sales as a share of income. Use the State menu to choose a state.')
    .attr('viewBox', `${IS_MAP_FRAME.x} ${IS_MAP_FRAME.y} ${IS_MAP_FRAME.width} ${IS_MAP_FRAME.height}`);
  // Everything drawn on the map goes in this group, so the whole map can zoom in on a state.
  const zoomLayer = svg.append('g');
  const path = d3.geoPath();
  const features = topojson.feature(us, us.objects.states).features;
  const byFips = {};
  Object.values(isState.states).forEach((state) => { byFips[state.fips] = state; });
  const latestShare = (state) => state.years[state.years.length - 1].share;
  const shares = Object.values(isState.states).map(latestShare);
  const color = d3.scaleSequential(d3.interpolateRgb(...IS_MAP_RAMP)).domain(d3.extent(shares));
  const lastYear = d3.max(Object.values(isState.states), (state) => state.years[state.years.length - 1].year);

  zoomLayer.append('g')
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
  zoomLayer.append('path')
    .attr('class', 'is-borders')
    .attr('d', path(topojson.mesh(us, us.objects.states, (a, b) => a !== b)));
  const hoverOutline = zoomLayer.append('path').attr('class', 'is-hover-outline');
  isState.chart.outline = zoomLayer.append('path').attr('class', 'is-outline');
  isState.chart.zoomLayer = zoomLayer;

  // Hover label showing the state's name.
  const box = document.querySelector('#is-map-box');
  const tip = document.createElement('div');
  tip.className = 'is-map-tip';
  tip.hidden = true;
  box.appendChild(tip);

  // When zoomed in, this button goes back to the whole country (and the U.S. average).
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'is-map-reset';
  reset.textContent = 'Back to U.S. map';
  reset.hidden = true;
  reset.addEventListener('click', () => isSelect(IS_NATIONAL));
  box.appendChild(reset);
  isState.chart.mapReset = reset;
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
  const view = IS_VIEW;
  const state = isCurrent();
  const data = state.years;
  const chart = isState.chart;
  const { width, top, right, left, xTicks } = isState.size;
  const { x, y } = chart;
  const duration = isReduceMotion() ? 0 : IS_DURATION;
  x.domain(d3.extent(data, (d) => d.year));
  y.domain(isState.domain);

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
  texts.append('tspan').attr('class', 'is-end-value').attr('x', width - right + 12).attr('dy', 16).attr('fill', (series) => series.color).text((series) => isSigned(last[series.key]));
  texts.transition().delay(duration).duration(300).style('opacity', 1);

  chart.focusGroup.selectAll('circle').data(view.series, (series) => series.key)
    .join('circle').attr('r', 4).attr('fill', (series) => series.color);

  document.querySelector('#is-chart-title').textContent = view.title(state.name);
  document.querySelector('#is-legend').innerHTML = view.series
    .map((series) => `<span class="is-legend-item"><span class="is-swatch" style="background:${series.color}"></span>${series.name} per person</span>`).join('');
  d3.select('#is-chart').attr('aria-label', `Line chart: ${view.title(state.name)}, ${data[0].year} to ${last.year}. Numbers are in the table below.`);
}

// Crosshair and tooltip for the year under the pointer.
function isHover(event) {
  const chart = isState.chart;
  const data = isCurrent().years;
  const [pointerX] = d3.pointer(event);
  const year = Math.round(chart.x.invert(pointerX));
  const d = data.find((item) => item.year === year);
  if (!d) return;
  const x = chart.x(year);
  chart.focusGroup.style('display', null);
  chart.focusLine.attr('x1', x).attr('x2', x);
  chart.focusGroup.selectAll('circle').attr('cx', x).attr('cy', (series) => chart.y(d[series.key]));

  const tooltip = document.querySelector('#is-tooltip');
  tooltip.innerHTML = `<strong>${year}</strong>Food sales ${isMoney(d.food)} <span>(${isSigned(d.foodGrowth)})</span><br>Income ${isMoney(d.income)} <span>(${isSigned(d.incomeGrowth)})</span>`;
  tooltip.hidden = false;
  const box = document.querySelector('.is-chart');
  const scale = box.clientWidth / isState.size.width;
  const pointX = x * scale;
  // Show the tooltip right of the crosshair, or left of it near the right edge.
  const tooltipLeft = pointX + 14 + tooltip.offsetWidth > box.clientWidth ? pointX - tooltip.offsetWidth - 14 : pointX + 14;
  tooltip.style.left = `${Math.max(0, tooltipLeft)}px`;
  tooltip.style.top = `${isState.size.top * scale}px`;
}

function isRenderTable() {
  const state = isCurrent();
  const rows = state.years.map((d) => `<tr><th scope="row">${d.year}</th><td>${isMoney(d.food)}</td><td>${isSigned(d.foodGrowth)}</td><td>${isMoney(d.income)}</td><td>${isSigned(d.incomeGrowth)}</td><td>${isPercent(d.share)}</td></tr>`).join('');
  document.querySelector('#is-table').innerHTML =
    `<table><caption>${state.name}, per person</caption><thead><tr><th scope="col">Year</th><th scope="col">Food sales</th><th scope="col">Since 1997</th><th scope="col">Income</th><th scope="col">Since 1997</th><th scope="col">Food as % of income</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Zooms the map to fit one state with some room around it, or back out to the whole country when feature is empty.
function isZoomMap(feature) {
  let transform = 'translate(0,0) scale(1)';
  if (feature) {
    // Fit the state's main land, skipping tiny far-off islands (Alaska's Aleutians would otherwise stretch the box across the map).
    let shape = feature;
    if (feature.geometry.type === 'MultiPolygon') {
      const parts = feature.geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
      const biggest = d3.max(parts, (part) => isState.chart.mapPath.area(part));
      shape = { type: 'MultiPolygon', coordinates: parts.filter((part) => isState.chart.mapPath.area(part) > biggest * 0.02).map((part) => part.coordinates) };
    }
    const [[x0, y0], [x1, y1]] = isState.chart.mapPath.bounds(shape);
    const scale = Math.min(IS_MAX_ZOOM, 0.7 / Math.max((x1 - x0) / IS_MAP_FRAME.width, (y1 - y0) / IS_MAP_FRAME.height));
    const centerX = IS_MAP_FRAME.x + IS_MAP_FRAME.width / 2;
    const centerY = IS_MAP_FRAME.y + IS_MAP_FRAME.height / 2;
    transform = `translate(${centerX - scale * (x0 + x1) / 2},${centerY - scale * (y0 + y1) / 2}) scale(${scale})`;
  }
  isState.chart.zoomLayer.interrupt().transition()
    .duration(isReduceMotion() ? 0 : IS_ZOOM_DURATION)
    .ease(d3.easeCubicInOut)
    .attr('transform', transform);
  isState.chart.mapReset.hidden = !feature;
}

function isSelect(name) {
  isState.selected = name;
  document.querySelector('#is-state-select').value = name;
  // The U.S. average has no state to outline on the map.
  const feature = isState.chart.features.find((item) => item.id === isCurrent().fips);
  isState.chart.outline.attr('d', feature ? isState.chart.mapPath(feature) : null);
  isZoomMap(feature);
  isDrawChart();
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
      select.innerHTML = [IS_NATIONAL, ...Object.keys(isState.states).sort()].map((name) => `<option value="${name}">${name}</option>`).join('');
      select.addEventListener('change', () => isSelect(select.value));
      document.querySelector('#is-replay').addEventListener('click', isDrawChart);

      isSelect(IS_NATIONAL);
    })
    .catch((error) => {
      console.error(error);
      isShowError('The food sales and income data could not be loaded. Use a local server such as VS Code Live Server to run this project.');
    });
}

// script.js announces "sections:loaded" once every section is on the page.
document.addEventListener('sections:loaded', isInit);
