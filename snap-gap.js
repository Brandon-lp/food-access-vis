// Main message line chart (sections/07-main-message.html):
// average monthly SNAP benefit per person vs. average monthly food spending per person, 2011–2019.
// Drawn with D3. The SVG is created here, not written in the section file, because VS Code Live Server
// breaks section files that contain SVG closing tags.

const SG_SNAP_FILE = 'data/snap-state-annual-totals-fy2011-fy2019.csv';
const SG_FOOD_FILE = 'data/historical-food-expense.csv';

// Tomato Red for food spending, a lighter Blue Crate for SNAP (checked for colorblind safety on the cream background).
const SG_FOOD_COLOR = '#b81817';
const SG_SNAP_COLOR = '#3b48a3';
const SG_INK = '#1c2147';
const SG_DURATION = 2200;

const SG_SIZES = {
  wide: { width: 900, height: 380, top: 24, right: 150, bottom: 36, left: 56, everyYear: 1 },
  compact: { width: 360, height: 320, top: 20, right: 96, bottom: 32, left: 46, everyYear: 2 }
};

const sgMoney = (value) => `$${Math.round(value).toLocaleString('en-US')}`;
const sgNumber = (text) => Number(String(text).replace(/[$,\s]/g, ''));

// Average benefit per person across the 50 states and D.C., weighted by how many people each state serves.
function sgSnapByYear(rows) {
  const years = {};
  rows
    .filter((row) => row['Geography Type'] === 'State' || row['Geography Type'] === 'District')
    .forEach((row) => {
      const persons = sgNumber(row['Average Monthly Persons Participation']);
      const benefit = sgNumber(row['Average Monthly Benefit per Person (USD)']);
      if (!persons || Number.isNaN(benefit)) return; // e.g. North Carolina 2018–2019 is blank ("--") in the data
      const year = years[row['Fiscal Year']] = years[row['Fiscal Year']] || { persons: 0, dollars: 0 };
      year.persons += persons;
      year.dollars += persons * benefit;
    });
  return Object.entries(years).map(([year, y]) => ({ year: Number(year), snap: y.dollars / y.persons }));
}

function sgPrepare(snapRows, foodRows) {
  const food = {};
  foodRows.forEach((row) => { food[Number(row.Year)] = sgNumber(row['Monthly expense per person']); });
  return sgSnapByYear(snapRows)
    .filter((d) => food[d.year])
    .map((d) => ({ ...d, food: food[d.year], gap: food[d.year] - d.snap, covered: (d.snap / food[d.year]) * 100 }))
    .sort((a, b) => a.year - b.year);
}

function sgDraw(data) {
  const box = document.querySelector('#sg-chart');
  // Phones get the compact frame. (The chart box can also be narrow on short laptop screens, so check the window instead.)
  const size = window.innerWidth < 700 ? SG_SIZES.compact : SG_SIZES.wide;
  const { width, height, top, right, bottom, left } = size;
  const first = data[0];
  const last = data[data.length - 1];

  const x = d3.scaleLinear().domain([first.year, last.year]).range([left, width - right]);
  const y = d3.scaleLinear().domain([0, Math.ceil(d3.max(data, (d) => d.food) / 100) * 100]).nice().range([height - bottom, top]);

  const svg = d3.select(box).insert('svg', '#sg-tooltip')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', `Line chart, ${first.year} to ${last.year}: average monthly food spending per person rose from ${sgMoney(first.food)} to ${sgMoney(last.food)}, while the average monthly SNAP benefit per person went from ${sgMoney(first.snap)} to ${sgMoney(last.snap)}. Numbers are in the table below.`);

  svg.append('g').attr('class', 'sg-grid')
    .attr('transform', `translate(${left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickSize(-(width - left - right)).tickFormat((v) => `$${v}`))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'sg-axis')
    .attr('transform', `translate(0,${height - bottom})`)
    .call(d3.axisBottom(x).tickValues(data.map((d) => d.year).filter((yr, i) => i % size.everyYear === 0 || yr === last.year)).tickFormat(d3.format('d')).tickSizeOuter(0));

  // The shaded gap between the two lines is what SNAP leaves uncovered.
  const gapArea = svg.append('path')
    .datum(data)
    .attr('class', 'sg-gap')
    .attr('d', d3.area().x((d) => x(d.year)).y0((d) => y(d.snap)).y1((d) => y(d.food)))
    .style('opacity', 0);
  const gapMid = data[Math.floor(data.length * 0.62)];
  const gapLabel = svg.append('text')
    .attr('class', 'sg-gap-label')
    .attr('x', x(gapMid.year))
    .attr('y', (y(gapMid.food) + y(gapMid.snap)) / 2)
    .attr('text-anchor', 'middle')
    .style('opacity', 0);
  gapLabel.append('tspan').attr('x', x(gapMid.year)).text('The gap:');
  gapLabel.append('tspan').attr('x', x(gapMid.year)).attr('dy', 18).text(`${sgMoney(last.gap)} a month by ${last.year}`);

  const series = [
    { key: 'food', name: 'Food spending', color: SG_FOOD_COLOR },
    { key: 'snap', name: 'SNAP benefit', color: SG_SNAP_COLOR }
  ];
  const lines = series.map((s) => svg.append('path')
    .datum(data)
    .attr('class', 'sg-line')
    .attr('stroke', s.color)
    .attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d[s.key]))));
  const dots = series.map((s) => svg.append('g').selectAll('circle').data(data).join('circle')
    .attr('class', 'sg-dot')
    .attr('cx', (d) => x(d.year))
    .attr('cy', (d) => y(d[s.key]))
    .attr('r', 4)
    .attr('fill', s.color)
    .style('opacity', 0));
  const endLabels = svg.append('g').style('opacity', 0);
  series.forEach((s) => {
    const label = endLabels.append('text').attr('class', 'sg-end-label').attr('x', width - right + 12).attr('y', y(last[s.key]) - 4);
    label.append('tspan').attr('x', width - right + 12).text(s.name);
    label.append('tspan').attr('class', 'sg-end-value').attr('fill', s.color).attr('x', width - right + 12).attr('dy', 18).text(sgMoney(last[s.key]));
  });

  // Hover: a crosshair and a tooltip for the nearest year.
  const focus = svg.append('g').attr('class', 'sg-focus').style('display', 'none');
  focus.append('line').attr('y1', top).attr('y2', height - bottom);
  const tooltip = document.querySelector('#sg-tooltip');
  svg.append('rect')
    .attr('x', left).attr('y', top).attr('width', width - left - right).attr('height', height - top - bottom)
    .attr('fill', 'transparent')
    .on('pointermove', (event) => {
      const year = Math.round(x.invert(d3.pointer(event)[0]));
      const d = data.find((item) => item.year === year);
      if (!d) return;
      focus.style('display', null).select('line').attr('x1', x(year)).attr('x2', x(year));
      tooltip.innerHTML = `<strong>${year}</strong>Food spending ${sgMoney(d.food)}<br>SNAP benefit ${sgMoney(d.snap)}<br>SNAP covers <span>${Math.round(d.covered)}%</span>`;
      tooltip.hidden = false;
      const scale = box.clientWidth / width;
      const pointX = x(year) * scale;
      const flip = pointX + 14 + tooltip.offsetWidth > box.clientWidth;
      tooltip.style.left = `${Math.max(0, flip ? pointX - tooltip.offsetWidth - 14 : pointX + 14)}px`;
      tooltip.style.top = `${top * scale}px`;
    })
    .on('pointerleave', () => {
      focus.style('display', 'none');
      tooltip.hidden = true;
    });

  // Animation: the lines draw themselves from 2011 to 2019 when the chart scrolls into view, then the gap appears.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = () => {
    const duration = reduceMotion ? 0 : SG_DURATION;
    lines.forEach((line) => {
      const length = line.node().getTotalLength();
      line.attr('stroke-dasharray', `${length} ${length}`).attr('stroke-dashoffset', length)
        .transition().duration(duration).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0);
    });
    dots.forEach((dot) => dot.transition().delay((d, i) => (duration * i) / data.length).duration(200).style('opacity', 1));
    [gapArea, gapLabel, endLabels].forEach((part) => part.transition().delay(duration).duration(500).style('opacity', 1));
  };
  lines.forEach((line) => { const length = line.node().getTotalLength(); line.attr('stroke-dasharray', `${length} ${length}`).attr('stroke-dashoffset', length); });
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); reveal(); }
    }, { threshold: 0.4 });
    observer.observe(box);
  } else {
    reveal();
  }

  document.querySelector('#sg-legend').innerHTML = series
    .map((s) => `<span class="sg-legend-item"><span class="sg-swatch" style="background:${s.color}"></span>${s.name} per person, per month</span>`).join('');
}

function sgRenderStats(data) {
  const first = data[0];
  const last = data[data.length - 1];
  const change = (a, b) => `${b >= a ? '+' : '−'}${Math.abs(Math.round((b / a - 1) * 100))}%`;
  document.querySelector('#sg-stats').innerHTML =
    `<div class="stat"><strong>${Math.round(first.covered)}% &rarr; ${Math.round(last.covered)}%</strong><span>share of a month's food SNAP covered, ${first.year} &rarr; ${last.year}</span></div>` +
    `<div class="stat"><strong>${change(first.food, last.food)}</strong><span>food spending per person</span></div>` +
    `<div class="stat"><strong>${change(first.snap, last.snap)}</strong><span>SNAP benefit per person</span></div>`;
}

function sgRenderTable(data) {
  const rows = data.map((d) => `<tr><th scope="row">${d.year}</th><td>${sgMoney(d.food)}</td><td>${sgMoney(d.snap)}</td><td>${sgMoney(d.gap)}</td><td>${Math.round(d.covered)}%</td></tr>`).join('');
  document.querySelector('#sg-table').innerHTML =
    `<table><thead><tr><th scope="col">Year</th><th scope="col">Food spending per person, per month</th><th scope="col">SNAP benefit per person, per month</th><th scope="col">Gap</th><th scope="col">SNAP covers</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function sgInit() {
  if (!document.querySelector('#sg-chart')) return;
  if (typeof d3 === 'undefined') {
    document.querySelector('#sg-chart').innerHTML = '<p class="load-error">The chart library could not be loaded. Check your internet connection and reload the page.</p>';
    return;
  }
  Promise.all([d3.csv(SG_SNAP_FILE), d3.csv(SG_FOOD_FILE)])
    .then(([snapRows, foodRows]) => {
      const data = sgPrepare(snapRows, foodRows);
      sgDraw(data);
      sgRenderStats(data);
      sgRenderTable(data);
    })
    .catch((error) => {
      console.error(error);
      document.querySelector('#sg-chart').innerHTML = '<p class="load-error">The SNAP and food spending data could not be loaded. Use a local server such as VS Code Live Server to run this project.</p>';
    });
}

// script.js announces "sections:loaded" once every section is on the page.
document.addEventListener('sections:loaded', sgInit);
