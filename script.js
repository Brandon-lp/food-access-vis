const chartElement = document.querySelector('#chart');
const countySelect = document.querySelector('#county-select');
const detailElement = document.querySelector('#chart-detail');

const fallbackData = [
  { county: 'Cook County, IL', distance: 3.1, lowAccess: 8.4, noCar: 21.2 },
  { county: 'Hidalgo County, TX', distance: 8.7, lowAccess: 18.9, noCar: 12.4 },
  { county: 'Fresno County, CA', distance: 6.2, lowAccess: 14.6, noCar: 10.8 },
  { county: 'Jefferson County, AL', distance: 5.4, lowAccess: 12.1, noCar: 15.6 },
  { county: 'Multnomah County, OR', distance: 2.2, lowAccess: 6.8, noCar: 18.7 }
];

function parseCsv(text) {
  const rows = text.trim().split('\n').slice(1);
  return rows.map((row) => {
    const [county, distance, lowAccess, noCar] = row.split(',');
    return { county, distance: Number(distance), lowAccess: Number(lowAccess), noCar: Number(noCar) };
  });
}

function drawChart(data, selectedCounty) {
  const selected = data.find((item) => item.county === selectedCounty) || data[0];
  const width = 640;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 44, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxDistance = Math.max(...data.map((item) => item.distance), 10);
  const x = (value) => padding.left + (value / maxDistance) * chartWidth;
  const y = (value) => padding.top + chartHeight - (value / 25) * chartHeight;
  const points = data.map((item, index) => {
    const pointX = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    return `${pointX},${y(item.lowAccess)}`;
  }).join(' ');
  const bars = data.map((item, index) => {
    const pointX = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const active = item.county === selected.county;
    return `<line x1="${pointX}" y1="${y(item.lowAccess)}" x2="${pointX}" y2="${y(0)}" stroke="${active ? '#d7f36b' : '#5b8cff'}" stroke-width="${active ? 16 : 10}" opacity="${active ? 1 : .65}" />`;
  }).join('');
  const labels = data.map((item, index) => {
    const pointX = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    return `<text x="${pointX}" y="${height - 13}" text-anchor="middle" fill="#f5f0e8" font-family="DM Mono" font-size="10">${item.county.split(' ')[0]}</text>`;
  }).join('');
  chartElement.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Low access percentage by county"><line x1="${padding.left}" y1="${y(0)}" x2="${width - padding.right}" y2="${y(0)}" stroke="#f5f0e8" opacity=".4" /><line x1="${padding.left}" y1="${y(25)}" x2="${width - padding.right}" y2="${y(25)}" stroke="#f5f0e8" opacity=".15" /><polyline points="${points}" fill="none" stroke="#ff765c" stroke-width="2" />${bars}${labels}<text x="${padding.left}" y="${y(25) - 8}" fill="#f5f0e8" opacity=".5" font-family="DM Mono" font-size="10">25%</text><text x="${padding.left}" y="${y(0) - 8}" fill="#f5f0e8" opacity=".5" font-family="DM Mono" font-size="10">0%</text></svg>`;
  detailElement.querySelector('h3').textContent = selected.county;
  detailElement.querySelector('.detail-copy').textContent = `${selected.distance} miles average distance. ${selected.lowAccess}% of residents live in a low-access area; ${selected.noCar}% of households have no car.`;
}

function setup(data) {
  countySelect.innerHTML = data.map((item) => `<option value="${item.county}">${item.county}</option>`).join('');
  countySelect.addEventListener('change', () => drawChart(data, countySelect.value));
  drawChart(data, data[0].county);
}

fetch('data/food-access.csv')
  .then((response) => response.ok ? response.text() : Promise.reject(new Error('CSV unavailable')))
  .then(parseCsv)
  .then(setup)
  .catch(() => setup(fallbackData));