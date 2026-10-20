const mapWidth = 1000;
const mapHeight = 600;
const mapStateNames = new Map([
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
  ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'],
  ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'],
  ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']
]);
const mapNumberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
let selectedMapCounty;

function getCountyName(county) {
  const state = mapStateNames.get(county.State) || county.State;
  return `${county.County} County, ${state}`;
}

function showCountyDetails(county) {
  document.querySelector('#county-name').textContent = getCountyName(county);
  document.querySelector('#county-impact').textContent =
    `${mapNumberFormat.format(county.affected)} people live in low-income, low-access areas.`;
  document.querySelector('#county-share').textContent =
    Number.isFinite(county.share)
      ? `${county.share.toFixed(1)}% of the county population is affected.`
      : 'Population share is not available for this county.';
}

function addMapLegend(container, radius, maximum) {
  const values = [5000, 25000, 100000].filter((value) => value < maximum);
  values.push(maximum);
  const circles = [...new Set(values)].map((value, index) => ({
    value,
    x: 17 + index * 90,
    y: 38 - radius(value)
  }));
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${Math.max(130, circles.length * 90)} 62`)
    .attr('role', 'img')
    .attr('aria-label', 'Bubble sizes are proportional to the number of people affected');
  svg.selectAll('circle')
    .data(circles)
    .join('circle')
    .attr('cx', (item) => item.x)
    .attr('cy', (item) => item.y)
    .attr('r', (item) => radius(item.value))
    .attr('fill', '#ff765c')
    .attr('fill-opacity', 0.75)
    .attr('stroke', '#f5f0e8');
  svg.selectAll('text')
    .data(circles)
    .join('text')
    .attr('x', (item) => item.x)
    .attr('y', 58)
    .attr('text-anchor', 'middle')
    .text((item) => mapNumberFormat.format(item.value));
}

function drawCountyMap(rows, atlas) {
  const mapFrame = document.querySelector('#map-frame');
  const stateFilter = document.querySelector('#state-filter');
  const status = document.querySelector('#map-status');
  const geoPath = d3.geoPath();
  const countyFeatures = topojson.feature(atlas, atlas.objects.counties).features;
  const stateFeatures = topojson.feature(atlas, atlas.objects.states).features;
  const projection = d3.geoAlbersUsa()
    .fitExtent([[16, 18], [mapWidth - 16, mapHeight - 18]], {
      type: 'FeatureCollection',
      features: countyFeatures
    });
  geoPath.projection(projection);

  const countyByFips = new Map(countyFeatures.map((feature) => [
    String(feature.id).padStart(5, '0'),
    feature
  ]));
  const validRows = rows.filter((row) => Number.isFinite(row.affected));
  const counties = validRows.map((row) => {
    const feature = countyByFips.get(row.FIPS);
    if (!feature) return null;
    const [x, y] = geoPath.centroid(feature);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { ...row, feature, x, y };
  }).filter(Boolean);

  if (!counties.length) throw new Error('No county data matched the map boundaries.');

  const affectedMaximum = d3.max(counties, (county) => county.affected);
  const radius = d3.scaleSqrt().domain([0, affectedMaximum]).range([2.5, 23]);
  const svg = d3.select(mapFrame).append('svg')
    .attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)
    .attr('role', 'group')
    .attr('aria-label', 'Map of U.S. counties with circles sized by low-income, low-access population');
  const zoomLayer = svg.append('g');
  const geographyLayer = zoomLayer.append('g').attr('class', 'map-geography');
  geographyLayer.selectAll('path')
    .data(countyFeatures)
    .join('path')
    .attr('class', 'county-shape')
    .attr('d', geoPath);
  geographyLayer.append('path')
    .datum(topojson.mesh(atlas, atlas.objects.states, (a, b) => a !== b))
    .attr('class', 'state-boundaries')
    .attr('d', geoPath);

  const bubbles = zoomLayer.append('g').attr('class', 'map-bubbles')
    .selectAll('circle')
    .data(counties.filter((county) => county.affected > 0))
    .join('circle')
    .attr('class', 'map-bubble')
    .attr('cx', (county) => county.x)
    .attr('cy', (county) => county.y)
    .attr('r', (county) => radius(county.affected))
    .attr('aria-label', (county) => `${getCountyName(county)}: ${mapNumberFormat.format(county.affected)} people affected`)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .on('mouseenter focus', (event, county) => showCountyDetails(county))
    .on('mouseleave blur', () => {
      if (selectedMapCounty) {
        showCountyDetails(selectedMapCounty);
      } else {
        document.querySelector('#county-name').textContent = 'Select a circle';
        document.querySelector('#county-impact').textContent = 'County information will appear here.';
        document.querySelector('#county-share').textContent = '';
      }
    })
    .on('click', (event, county) => {
      selectedMapCounty = county;
      showCountyDetails(county);
      bubbles.classed('is-selected', (item) => item.FIPS === county.FIPS);
    })
    .on('keydown', (event, county) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectedMapCounty = county;
        showCountyDetails(county);
        bubbles.classed('is-selected', (item) => item.FIPS === county.FIPS);
      }
    });

  const zoom = d3.zoom()
    .scaleExtent([1, 10])
    .on('zoom', (event) => zoomLayer.attr('transform', event.transform));
  svg.call(zoom);

  const stateCodes = [...new Set(rows.map((county) => county.State))].sort();
  stateFilter.innerHTML = '<option value="all">All states</option>' +
    stateCodes.map((code) => `<option value="${code}">${mapStateNames.get(code) || code}</option>`).join('');
  stateFilter.addEventListener('change', () => {
    const state = stateFilter.value;
    selectedMapCounty = null;
    bubbles.classed('is-selected', false);
    document.querySelector('#county-name').textContent = 'Select a circle';
    document.querySelector('#county-impact').textContent = 'County information will appear here.';
    document.querySelector('#county-share').textContent = '';
    bubbles.attr('display', (county) => state === 'all' || county.State === state ? null : 'none');
    if (state === 'all') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      return;
    }
    const stateFeature = stateFeatures.find((feature) => String(feature.id).padStart(2, '0') ===
      rows.find((county) => county.State === state)?.FIPS.slice(0, 2));
    if (!stateFeature) return;
    const [[x0, y0], [x1, y1]] = geoPath.bounds(stateFeature);
    const scale = Math.min(8, 0.88 / Math.max((x1 - x0) / mapWidth, (y1 - y0) / mapHeight));
    const transform = d3.zoomIdentity
      .translate(mapWidth / 2 - scale * (x0 + x1) / 2, mapHeight / 2 - scale * (y0 + y1) / 2)
      .scale(scale);
    svg.transition().duration(500).call(zoom.transform, transform);
  });

  addMapLegend(document.querySelector('#map-legend'), radius, affectedMaximum);
  const missingValues = rows.length - validRows.length;
  const missingBoundaries = validRows.length - counties.length;
  const caveats = [
    missingValues ? `${mapNumberFormat.format(missingValues)} rows have no affected-population value` : '',
    missingBoundaries ? `${mapNumberFormat.format(missingBoundaries)} counties have no matching map boundary` : ''
  ].filter(Boolean);
  status.textContent = `Showing ${mapNumberFormat.format(counties.length)} counties with data.${caveats.length ? ` ${caveats.join('; ')}.` : ''} Circle area represents affected population.`;
}

function showMapError(error) {
  console.error('Unable to load the food access map.', error);
  const status = document.querySelector('#map-status');
  if (status) {
    status.textContent = 'The map could not be loaded. Check your connection and run this page through a local web server.';
    status.classList.add('is-error');
  }
}

document.addEventListener('pageSectionsLoaded', () => {
  if (!window.d3 || !window.topojson) {
    showMapError(new Error('Map libraries did not load.'));
    return;
  }
  Promise.all([
    d3.csv('data/food_atlas_cleaned.csv', (row) => {
      if (!row.FIPS) return null;
      const affectedValue = row['Low Income & Low Access Population 2019'];
      const shareValue = row['Pct Low Income & Low Access Population 2019'];
      return {
        ...row,
        FIPS: row.FIPS.padStart(5, '0'),
        affected: affectedValue === '' ? Number.NaN : Number(affectedValue),
        share: shareValue === '' ? Number.NaN : Number(shareValue)
      };
    }),
    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json')
  ])
    .then(([rows, atlas]) => drawCountyMap(rows.filter(Boolean), atlas))
    .catch(showMapError);
});
