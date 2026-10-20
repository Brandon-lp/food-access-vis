const sections = [
  ['top', 'sections/01-hero.html'],
  ['top', 'sections/02-story.html'],
  ['top', 'sections/03-explore.html'],
  ['top', 'sections/04-about.html'],
  ['site-footer', 'sections/05-footer.html']
];

function drawChart(data, selectedCounty) {
  const selected = data.find((item) => item.county === selectedCounty) || data[0];
  const chart = document.querySelector('#chart');
  const detail = document.querySelector('#chart-detail');
  const width = 640;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 44, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const y = (value) => padding.top + chartHeight - (value / 25) * chartHeight;
  const points = data.map((item, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    return `${x},${y(item.lowAccess)}`;
  }).join(' ');
  const bars = data.map((item, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const active = item.county === selected.county;
    return `<line x1="${x}" y1="${y(item.lowAccess)}" x2="${x}" y2="${y(0)}" stroke="${active ? '#d7f36b' : '#5b8cff'}" stroke-width="${active ? 16 : 10}" opacity="${active ? 1 : .65}" />`;
  }).join('');
  const labels = data.map((item, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    return `<text x="${x}" y="${height - 13}" text-anchor="middle" fill="#f5f0e8" font-family="DM Mono" font-size="10">${item.county.split(' ')[0]}</text>`;
  }).join('');
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Low access percentage by county"><line x1="${padding.left}" y1="${y(0)}" x2="${width - padding.right}" y2="${y(0)}" stroke="#f5f0e8" opacity=".4" /><line x1="${padding.left}" y1="${y(25)}" x2="${width - padding.right}" y2="${y(25)}" stroke="#f5f0e8" opacity=".15" /><polyline points="${points}" fill="none" stroke="#ff765c" stroke-width="2" />${bars}${labels}<text x="${padding.left}" y="${y(25) - 8}" fill="#f5f0e8" opacity=".5" font-family="DM Mono" font-size="10">25%</text><text x="${padding.left}" y="${y(0) - 8}" fill="#f5f0e8" opacity=".5" font-family="DM Mono" font-size="10">0%</text></svg>`;
  detail.querySelector('h3').textContent = selected.county;
  detail.querySelector('.detail-copy').textContent =
    `${selected.distance} miles average distance. ${selected.lowAccess}% of residents live in a low-access area; ${selected.noCar}% of households have no car.`;
}

function setupChart(data) {
  const countySelect = document.querySelector('#county-select');
  countySelect.innerHTML = data.map((item) =>
    `<option value="${item.county}">${item.county}</option>`
  ).join('');
  countySelect.addEventListener('change', () => drawChart(data, countySelect.value));
  drawChart(data, data[0].county);
}

function loadChart() {
  return d3.csv('data/food-access.csv', (row) => ({
    county: row.county,
    distance: Number(row.distance),
    lowAccess: Number(row.lowAccess),
    noCar: Number(row.noCar)
  })).then((data) => {
    if (!data.length || data.some((item) =>
      !item.county || !Number.isFinite(item.distance) ||
      !Number.isFinite(item.lowAccess) || !Number.isFinite(item.noCar))) {
      throw new Error('The county comparison data is empty or invalid.');
    }
    setupChart(data);
  }).catch((error) => {
    console.error('Unable to load the county comparison chart.', error);
    const chart = document.querySelector('#chart');
    if (chart) chart.textContent = 'The county comparison data could not be loaded.';
  });
}

function loadSection([targetId, file]) {
  return fetch(file)
    .then((response) => {
      if (!response.ok) throw new Error(`${file} unavailable (${response.status})`);
      return response.text();
    })
    .then((markup) => ({ targetId, markup }));
}

Promise.all(sections.map(loadSection))
  .then((loadedSections) => {
    loadedSections.forEach(({ targetId, markup }) => {
      document.querySelector(`#${targetId}`).insertAdjacentHTML('beforeend', markup);
    });
    loadChart();
    document.dispatchEvent(new Event('pageSectionsLoaded'));
  })
  .catch((error) => {
    console.error('Unable to load page sections.', error);
    document.querySelector('#top').innerHTML =
      '<p class="load-error">The page sections could not be loaded. Use a local server such as VS Code Live Server to run this project.</p>';
  });
