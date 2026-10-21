// SNAP demographics section (sections/06-demographics.html).
// Reads the Census CSVs in data/ with Papa Parse and draws two pies and a bar chart with Chart.js.

// Each "view" is one way of grouping households, shown as a button above the charts.
const SNAP_VIEWS = [
  {
    id: 'race', label: 'Race', file: 'data/snap-race.csv', unit: 'households',
    // These two rows overlap with the race rows, so they get their own view instead.
    exclude: ['Hispanic or Latino origin (of any race)', 'White alone, not Hispanic or Latino']
  },
  { id: 'hispanic', label: 'Hispanic origin', file: 'data/snap-race.csv', unit: 'households' },
  {
    id: 'type', label: 'Household type', file: 'data/snap-household-type.csv', unit: 'households',
    segments: [
      { id: 'All Households', label: 'All', phrase: '' },
      { id: 'With Children Under 18', label: 'With children', phrase: ' with children under 18' },
      { id: 'No Children Under 18', label: 'No children', phrase: ' without children under 18' }
    ]
  },
  { id: 'disability', label: 'Disability', file: 'data/snap-disability.csv', unit: 'households' }
];

// Shorter names for the charts. Keys are the Characteristic column, exactly as written in the CSVs.
const SNAP_LABELS = {
  'White alone': 'White',
  'Black or African American alone': 'Black',
  'American Indian and Alaska Native alone': 'American Indian & Alaska Native',
  'Asian alone': 'Asian',
  'Native Hawaiian and Other Pacific Islander alone': 'Native Hawaiian & Pacific Islander',
  'Some other race alone': 'Some other race',
  'Two or more races': 'Two or more races',
  'Hispanic or Latino origin (of any race)': 'Hispanic or Latino',
  'Married-couple family': 'Married couple',
  'Male householder, no spouse present': 'Man, no spouse',
  'Female householder, no spouse present': 'Woman, no spouse',
  'Nonfamily households': 'Nonfamily (alone or roommates)',
  'With one or more people with a disability': 'Someone has a disability',
  'With no persons with a disability': 'No one has a disability'
};

// Group colors, checked for colorblind safety on the site's cream background. A group keeps its color in every chart.
const SNAP_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
const SNAP_INK = '#17231f';
const SNAP_PAPER = '#f5f0e8';
const SNAP_BAR = '#8c9590';
const SNAP_FONT = { family: '"Space Grotesk", sans-serif', size: 13 };
const SNAP_MONO = { family: '"DM Mono", monospace', size: 11 };

const snapState = { view: SNAP_VIEWS[0], segment: 'All Households', files: {}, groups: [], sorted: [], charts: {} };

const snapNumber = (text) => Number(String(text).replace(/[,%$\s]/g, ''));
const snapCount = (value) => Math.round(value).toLocaleString('en-US');
const snapPercent = (value) => `${value.toFixed(1)}%`;

// Splits a long label into lines so it fits beside the bars, with shorter lines on phones.
function snapWrap(label) {
  const maxLength = window.innerWidth < 700 ? 14 : 24;
  return label.split(' ').reduce((lines, word) => {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= maxLength) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
    return lines;
  }, []);
}

function snapLoadCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, { download: true, header: true, skipEmptyLines: true, complete: (result) => resolve(result.data), error: reject });
  });
}

// Turns CSV rows into { segment: [ { name, label, snap, notSnap, snapMoe, notSnapMoe } ] }, keeping the file's row order.
function snapGroupRows(rows) {
  const segments = {};
  rows.forEach((row) => {
    const name = row.Characteristic.replace(/\s+/g, ' ').trim();
    const list = segments[row.Segment] = segments[row.Segment] || [];
    let group = list.find((item) => item.name === name);
    if (!group) {
      group = { name, label: SNAP_LABELS[name] || name };
      list.push(group);
    }
    const key = row['Population Group'] === 'Households receiving SNAP' ? 'snap' : 'notSnap';
    group[key] = snapNumber(row.Estimate);
    group[`${key}Moe`] = snapNumber(row['Estimate Margin of Error']);
  });
  return segments;
}

// The groups for the current view, with totals, shares and SNAP rates worked out.
function snapGroupsFor(view, segment) {
  const rows = snapState.files[view.file][view.segments ? segment : 'All Households'];
  let groups;
  if (view.id === 'hispanic') {
    const races = rows.filter((group) => !SNAP_VIEWS[0].exclude.includes(group.name));
    const hispanic = rows.find((group) => group.name === 'Hispanic or Latino origin (of any race)');
    const sum = (key) => races.reduce((total, group) => total + group[key], 0);
    groups = [
      hispanic,
      { name: 'Not Hispanic or Latino', label: 'Not Hispanic or Latino', snap: sum('snap') - hispanic.snap, notSnap: sum('notSnap') - hispanic.notSnap }
    ];
  } else {
    groups = rows.filter((group) => !(view.exclude || []).includes(group.name));
  }
  const totalSnap = groups.reduce((total, group) => total + group.snap, 0);
  const totalAll = groups.reduce((total, group) => total + group.snap + group.notSnap, 0);
  return groups.map((group, index) => {
    const total = group.snap + group.notSnap;
    return {
      ...group,
      index,
      total,
      color: SNAP_COLORS[index],
      shareAll: (total / totalAll) * 100,
      shareSnap: (group.snap / totalSnap) * 100,
      rate: (group.snap / total) * 100,
      average: (totalSnap / totalAll) * 100
    };
  });
}

function snapUniverse() {
  const segment = (snapState.view.segments || []).find((item) => item.id === snapState.segment);
  return `${snapState.view.unit}${segment ? segment.phrase : ''}`;
}

// Draws the U.S. average line and a value at the end of each bar.
const snapRateAnnotations = {
  id: 'snapRateAnnotations',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    const average = snapState.groups.length ? snapState.groups[0].average : null;
    ctx.save();
    ctx.font = `500 ${SNAP_MONO.size}px ${SNAP_MONO.family}`;
    ctx.fillStyle = SNAP_INK;
    if (average !== null) {
      const x = scales.x.getPixelForValue(average);
      ctx.strokeStyle = SNAP_INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'center';
      ctx.fillText(`Average ${snapPercent(average)}`, x, chartArea.top - 8);
    }
    // Values go on a small paper-colored patch so they stay readable where they cross the average line.
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    chart.getDatasetMeta(0).data.forEach((bar, index) => {
      const group = snapState.sorted[index];
      if (!group) return;
      const text = snapPercent(group.rate);
      ctx.fillStyle = SNAP_PAPER;
      ctx.fillRect(bar.x + 4, bar.y - 9, ctx.measureText(text).width + 8, 18);
      ctx.fillStyle = SNAP_INK;
      ctx.fillText(text, bar.x + 8, bar.y);
    });
    ctx.restore();
  }
};

function snapPieOptions(shareKey, countKey) {
  return {
    type: 'pie',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: SNAP_PAPER, borderWidth: 2, hoverOffset: 12 }] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      layout: { padding: 14 },
      plugins: {
        legend: { display: false },
        tooltip: {
          bodyFont: SNAP_FONT,
          titleFont: SNAP_FONT,
          callbacks: {
            title: (items) => snapState.groups[items[0].dataIndex].label,
            label: (item) => {
              const group = snapState.groups[item.dataIndex];
              return `${snapCount(group[countKey])} ${snapState.view.unit} (${snapPercent(group[shareKey])})`;
            }
          }
        }
      },
      onHover: (event, elements) => snapHighlight(elements.length ? elements[0].index : null)
    }
  };
}

function snapCreateCharts() {
  snapState.charts.all = new Chart(document.querySelector('#snap-pie-all'), snapPieOptions('shareAll', 'total'));
  snapState.charts.snap = new Chart(document.querySelector('#snap-pie-snap'), snapPieOptions('shareSnap', 'snap'));
  snapState.charts.rates = new Chart(document.querySelector('#snap-rates'), {
    type: 'bar',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 26 }] },
    plugins: [snapRateAnnotations],
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 28, right: 56 } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(23, 35, 31, 0.12)' },
          border: { display: false },
          ticks: { font: SNAP_MONO, color: SNAP_INK, callback: (value) => `${value}%` }
        },
        y: { grid: { display: false }, border: { color: 'rgba(23, 35, 31, 0.4)' }, ticks: { font: SNAP_FONT, color: SNAP_INK, autoSkip: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          bodyFont: SNAP_FONT,
          titleFont: SNAP_FONT,
          callbacks: {
            title: (items) => snapState.sorted[items[0].dataIndex].label,
            label: (item) => {
              const group = snapState.sorted[item.dataIndex];
              return `${snapCount(group.snap)} of ${snapCount(group.total)} ${snapState.view.unit} receive SNAP`;
            }
          }
        }
      },
      onHover: (event, elements) => snapHighlight(elements.length ? snapState.sorted[elements[0].index].index : null)
    }
  });
}

// Highlights one group (by its index) in all three charts and the legend, and describes it in the side panel.
function snapHighlight(index) {
  if (index === snapState.highlighted) return;
  snapState.highlighted = index;
  const { all, snap, rates } = snapState.charts;
  const group = index === null ? null : snapState.groups[index];
  [all, snap].forEach((chart) => {
    chart.setActiveElements(group ? [{ datasetIndex: 0, index }] : []);
    chart.update();
  });
  rates.data.datasets[0].backgroundColor = snapState.sorted.map((item) => (group && item !== group ? SNAP_BAR : item.color));
  rates.update('none');
  document.querySelectorAll('.snap-legend-item').forEach((item) => item.classList.toggle('is-dimmed', Boolean(group) && Number(item.dataset.index) !== index));
  if (group) snapDescribe(group);
}

function snapDescribe(group) {
  const detail = document.querySelector('#snap-detail');
  const universe = snapUniverse();
  const compare = group.rate >= group.average ? 'higher than' : 'lower than';
  detail.querySelector('h3').textContent = group.label;
  detail.querySelector('.detail-copy').innerHTML =
    `<strong>${snapPercent(group.rate)}</strong> of these ${snapState.view.unit} receive SNAP, ${compare} the ${snapPercent(group.average)} average.<br><br>` +
    `${snapPercent(group.shareAll)} of all U.S. ${universe}<br>${snapPercent(group.shareSnap)} of ${universe} receiving SNAP`;
}

function snapRender() {
  const view = snapState.view;
  const groups = snapState.groups = snapGroupsFor(view, snapState.segment);
  const sorted = snapState.sorted = [...groups].sort((a, b) => b.rate - a.rate);
  const universe = snapUniverse();
  const { all, snap, rates } = snapState.charts;
  snapState.highlighted = null;

  [[all, 'total'], [snap, 'snap']].forEach(([chart, key]) => {
    chart.data.labels = groups.map((group) => group.label);
    chart.data.datasets[0].data = groups.map((group) => group[key]);
    chart.data.datasets[0].backgroundColor = groups.map((group) => group.color);
    chart.setActiveElements([]);
    chart.update();
  });
  rates.data.labels = sorted.map((group) => snapWrap(group.label));
  rates.data.datasets[0].data = sorted.map((group) => group.rate);
  rates.data.datasets[0].backgroundColor = sorted.map((group) => group.color);
  rates.options.scales.x.max = Math.ceil((Math.max(...sorted.map((group) => group.rate)) * 1.15) / 10) * 10;
  document.querySelector('#snap-bars').style.height = `${sorted.length * 46 + 70}px`;
  rates.resize();
  rates.update();

  const capital = universe.charAt(0).toUpperCase() + universe.slice(1);
  document.querySelector('#snap-pie-all-title').textContent = `All U.S. ${universe}`;
  document.querySelector('#snap-pie-snap-title').textContent = `${capital} receiving SNAP`;
  document.querySelector('#snap-rates-title').textContent = `Share of ${universe} in each group receiving SNAP`;
  all.canvas.setAttribute('aria-label', `Pie chart of all U.S. ${universe} by ${view.label.toLowerCase()}. Numbers are in the table below.`);
  snap.canvas.setAttribute('aria-label', `Pie chart of ${universe} receiving SNAP by ${view.label.toLowerCase()}. Numbers are in the table below.`);
  rates.canvas.setAttribute('aria-label', `Bar chart of the share of ${universe} receiving SNAP in each group. Numbers are in the table below.`);

  const note = document.querySelector('#snap-note');
  note.hidden = !view.note;
  note.textContent = view.note || '';

  snapRenderLegend(groups);
  snapRenderTable(groups, universe);
  snapDescribe(sorted[0]);
}

function snapRenderLegend(groups) {
  const legend = document.querySelector('#snap-legend');
  legend.innerHTML = groups.map((group) =>
    `<button type="button" class="snap-legend-item" data-index="${group.index}"><span class="snap-swatch" style="background:${group.color}"></span>${group.label}</button>`
  ).join('');
  legend.querySelectorAll('.snap-legend-item').forEach((item) => {
    const index = Number(item.dataset.index);
    item.addEventListener('mouseenter', () => snapHighlight(index));
    item.addEventListener('focus', () => snapHighlight(index));
    item.addEventListener('click', () => snapHighlight(index));
    item.addEventListener('mouseleave', () => snapHighlight(null));
    item.addEventListener('blur', () => snapHighlight(null));
  });
}

function snapRenderTable(groups, universe) {
  const rows = groups.map((group) => `<tr><th scope="row">${group.label}</th><td>${snapCount(group.total)}</td><td>${snapPercent(group.shareAll)}</td><td>${snapCount(group.snap)}</td><td>${snapPercent(group.shareSnap)}</td><td>${snapPercent(group.rate)}</td></tr>`).join('');
  document.querySelector('#snap-table').innerHTML =
    `<table><thead><tr><th scope="col">Group</th><th scope="col">All ${universe}</th><th scope="col">Share</th><th scope="col">Receiving SNAP</th><th scope="col">Share</th><th scope="col">% of group receiving SNAP</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function snapRenderButtons(container, items, isPressed, onPick) {
  container.innerHTML = items.map((item) => `<button type="button" class="snap-button" data-id="${item.id}" aria-pressed="${isPressed(item)}">${item.label}</button>`).join('');
  container.querySelectorAll('.snap-button').forEach((button) => {
    button.addEventListener('click', () => {
      container.querySelectorAll('.snap-button').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      onPick(items.find((item) => item.id === button.dataset.id));
    });
  });
}

function snapShowSegments() {
  const control = document.querySelector('#snap-segment-control');
  const segments = snapState.view.segments;
  control.hidden = !segments;
  if (!segments) return;
  snapRenderButtons(document.querySelector('#snap-segments'), segments, (segment) => segment.id === snapState.segment, (segment) => {
    snapState.segment = segment.id;
    snapRender();
  });
}

function snapRenderStats() {
  const race = snapGroupsFor(SNAP_VIEWS[0], 'All Households');
  const income = snapState.files['data/snap-income.csv']['All Households'][0];
  document.querySelector('#snap-stat-rate').textContent = snapPercent(race[0].average);
  document.querySelector('#snap-stat-income-snap').textContent = `$${snapCount(income.snap)}`;
  document.querySelector('#snap-stat-income-other').textContent = `$${snapCount(income.notSnap)}`;
}

function snapShowError(message) {
  document.querySelector('#demographics .snap-shell').innerHTML = `<p class="load-error">${message}</p>`;
}

function snapInit() {
  if (!document.querySelector('#snap-pie-all')) return;
  if (typeof Chart === 'undefined' || typeof Papa === 'undefined') {
    snapShowError('The chart libraries could not be loaded. Check your internet connection and reload the page.');
    return;
  }
  const files = [...new Set(SNAP_VIEWS.map((view) => view.file)), 'data/snap-income.csv'];
  // Charts are drawn as pictures, so wait for the site's fonts before drawing.
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.all([...files.map(snapLoadCsv), fontsReady])
    .then((results) => {
      results.slice(0, files.length).forEach((rows, index) => { snapState.files[files[index]] = snapGroupRows(rows); });
      snapCreateCharts();
      snapRenderStats();
      snapRenderButtons(document.querySelector('#snap-views'), SNAP_VIEWS, (view) => view === snapState.view, (view) => {
        snapState.view = view;
        snapState.segment = 'All Households';
        snapShowSegments();
        snapRender();
      });
      snapRender();
    })
    .catch(() => snapShowError('The SNAP data could not be loaded. Use a local server such as VS Code Live Server to run this project.'));
}

// script.js announces "sections:loaded" once every section is on the page.
document.addEventListener('sections:loaded', snapInit);
