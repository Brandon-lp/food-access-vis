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

function addBubbleLegend(container, radius, maximum) {
  const values = [...new Set([5000, 25000, 100000].filter((value) => value < maximum).concat(maximum))];
  const circles = values.map((value, index) => ({
    value,
    x: 20 + index * 88,
    y: 38 - radius(value)
  }));
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${Math.max(130, circles.length * 88)} 62`)
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

function addStateLegend(container, color, maximum) {
  const svg = d3.select(container).append('svg')
    .attr('viewBox', '0 0 240 42')
    .attr('role', 'img')
    .attr('aria-label', `State color scale from 0 to ${maximum.toFixed(1)} percent average county share`);
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'state-share-gradient')
    .attr('x1', '0%')
    .attr('x2', '100%');
  d3.range(0, 1.01, 0.1).forEach((value) => {
    gradient.append('stop')
      .attr('offset', `${value * 100}%`)
      .attr('stop-color', color(value * maximum));
  });
  svg.append('rect')
    .attr('x', 0)
    .attr('y', 2)
    .attr('width', 240)
    .attr('height', 10)
    .attr('rx', 3)
    .attr('fill', 'url(#state-share-gradient)');
  svg.append('text').attr('x', 0).attr('y', 31).text('0%');
  svg.append('text').attr('x', 240).attr('y', 31)
    .attr('text-anchor', 'end')
    .text(`${maximum.toFixed(1)}%`);
}

function drawCountyMap(rows, atlas) {
  const mapFrame = document.querySelector('#map-frame');
  const stateFilter = document.querySelector('#state-filter');
  const status = document.querySelector('#map-status');
  const detailName = document.querySelector('#county-name');
  const detailImpact = document.querySelector('#county-impact');
  const detailShare = document.querySelector('#county-share');
  const legend = d3.select('#map-legend');
  const strikerPuck = d3.select('#striker-puck');
  const strikerBell = d3.select('.striker-bell');
  const strikerDescription = document.querySelector('#striker-svg-description');
  const strikerStatus = document.querySelector('#striker-motion-status');
  const strikerInterpretation = document.querySelector('#striker-interpretation');
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
  const counties = rows.map((row) => {
    const feature = countyByFips.get(row.FIPS);
    if (!feature) return null;
    const [x, y] = geoPath.centroid(feature);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { ...row, feature, x, y };
  }).filter(Boolean);

  if (!counties.length) throw new Error('No county data matched the map boundaries.');

  const stateAverages = d3.rollup(
    counties.filter((county) => Number.isFinite(county.share)),
    (stateCounties) => ({
      share: d3.mean(stateCounties, (county) => county.share),
      countyCount: stateCounties.length
    }),
    (county) => county.FIPS.slice(0, 2)
  );
  const stateFoodBankTotals = d3.rollup(
    rows,
    (stateRows) => {
      const countiesWithPopulation = stateRows.filter((row) =>
        Number.isFinite(row.affected) && row.affected >= 0
      );
      const populationTotal = d3.sum(countiesWithPopulation, (row) => row.affected);
      const lowAccessPopulation = countiesWithPopulation.length === stateRows.length &&
        Number.isFinite(populationTotal)
        ? Math.round(populationTotal)
        : Number.NaN;
      const countiesWithBankCounts = stateRows.filter((row) =>
        Number.isFinite(row.foodBanks) && row.foodBanks >= 0
      );
      const reportedBankTotal = d3.sum(countiesWithBankCounts, (row) => row.foodBanks);
      const foodBankCount = countiesWithBankCounts.length === stateRows.length &&
        Number.isFinite(reportedBankTotal)
        ? reportedBankTotal
        : Number.NaN;
      const rate = lowAccessPopulation > 0 && Number.isFinite(foodBankCount)
        ? foodBankCount / lowAccessPopulation * 100000
        : Number.NaN;
      const banksPer100k = Number.isFinite(rate) ? rate : Number.NaN;
      return {
        lowAccessPopulation,
        foodBankCount,
        banksPer100k,
        availabilityScore: Number.NaN
      };
    },
    (row) => row.FIPS.slice(0, 2)
  );
  const nationalMedianBanksPer100k = d3.median(
    [...stateFoodBankTotals.values()]
      .map((state) => state.banksPer100k)
      .filter((rate) => Number.isFinite(rate) && rate >= 0)
  );
  stateFoodBankTotals.forEach((state) => {
    const relativeAvailability = state.banksPer100k / nationalMedianBanksPer100k;
    state.availabilityScore = Number.isFinite(relativeAvailability) &&
      Number.isFinite(nationalMedianBanksPer100k) &&
      nationalMedianBanksPer100k > 0
      ? Math.min(1, Math.max(0, relativeAvailability))
      : Number.NaN;
  });
  const maximumShare = d3.max([...stateAverages.values()], (state) => state.share);
  const stateColor = d3.scaleSequential()
    .domain([0, maximumShare || 1])
    .interpolator((value) => d3.interpolateRgb('#496259', '#ff765c')(value));
  const affectedMaximum = d3.max(counties, (county) => county.affected);
  const radius = d3.scaleSqrt().domain([0, affectedMaximum || 1]).range([2.5, 23]);
  const stateByFips = new Map(stateFeatures.map((feature) => [
    String(feature.id).padStart(2, '0'),
    feature
  ]));
  const fipsByState = new Map(counties.map((county) => [county.State, county.FIPS.slice(0, 2)]));
  const strikerPosition = d3.scaleLinear()
    .domain([0, 1, 2])
    .range([244, 100.5, 42])
    .clamp(true);
  const bankCountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const rateFormat = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateStriker = (stateCode) => {
    strikerPuck.interrupt();
    strikerBell.interrupt().attr('transform', 'translate(260,292)');
    document.querySelector('#striker-copy-median').textContent =
      Number.isFinite(nationalMedianBanksPer100k)
        ? rateFormat.format(nationalMedianBanksPer100k)
        : '—';
    if (!stateCode || stateCode === 'all') {
      strikerPuck.attr('transform', 'translate(0,68)');
      document.querySelector('#striker-state').textContent = 'Select a state';
      document.querySelector('#striker-low-access-population').textContent = '—';
      document.querySelector('#striker-bank-count').textContent = '—';
      document.querySelector('#striker-state-rate-label').textContent = '—';
      document.querySelector('#striker-state-rate-label').setAttribute('y', '78');
      document.querySelector('#striker-target-value').textContent =
        Number.isFinite(nationalMedianBanksPer100k)
          ? rateFormat.format(nationalMedianBanksPer100k)
          : '—';
      strikerDescription.textContent =
        'Select a state on the map to explore how its reported food-bank availability compares to its low-access population. The striker moves toward the bell based on the number of food-bank locations per 100,000 low-access residents, relative to the national median. When the striker reaches the bell, the state meets or exceeds this reference. A striker that stops short indicates lower relative availability.';
      strikerInterpretation.textContent =
        'Choose a state to see how its food-bank availability compares with the national median.';
      strikerStatus.textContent =
        'Select a state to view its availability score.';
      return;
    }

    const stateFips = fipsByState.get(stateCode);
    const totals = stateFoodBankTotals.get(stateFips);
    if (!totals) {
      strikerStatus.textContent = `No food-bank comparison data is available for ${mapStateNames.get(stateCode) || stateCode}.`;
      return;
    }
    const stateName = mapStateNames.get(stateCode) || stateCode;
    const hasAvailability = Number.isFinite(totals.availabilityScore);
    const availabilityRatio = hasAvailability && nationalMedianBanksPer100k > 0
      ? totals.banksPer100k / nationalMedianBanksPer100k
      : Number.NaN;
    const meetsReference = hasAvailability && totals.availabilityScore >= 1;
    const targetY = !hasAvailability
      ? 68
      : strikerPosition(availabilityRatio);
    document.querySelector('#striker-state').textContent = stateName;
    document.querySelector('#striker-low-access-population').textContent =
      Number.isFinite(totals.lowAccessPopulation)
        ? mapNumberFormat.format(totals.lowAccessPopulation)
        : '—';
    document.querySelector('#striker-bank-count').textContent =
      Number.isFinite(totals.foodBankCount)
        ? bankCountFormat.format(totals.foodBankCount)
        : '—';
    const stateRateLabel = document.querySelector('#striker-state-rate-label');
    stateRateLabel.textContent =
      Number.isFinite(totals.banksPer100k)
        ? rateFormat.format(totals.banksPer100k)
        : '—';
    document.querySelector('#striker-target-value').textContent =
      Number.isFinite(nationalMedianBanksPer100k)
        ? rateFormat.format(nationalMedianBanksPer100k)
        : '—';
    strikerDescription.textContent = hasAvailability
      ? `${stateName} has ${mapNumberFormat.format(totals.lowAccessPopulation)} low-income, low-access residents and ${bankCountFormat.format(totals.foodBankCount)} reported food-bank locations. The striker shows ${Math.round(totals.availabilityScore * 100)} percent of the national median rate of ${rateFormat.format(nationalMedianBanksPer100k)} locations per 100,000 low-access residents.`
      : `${stateName}: food-bank availability cannot be compared with the national median because population or food-bank data is missing or invalid.`;

    if (!hasAvailability) {
      strikerPuck.attr('transform', 'translate(0,68)');
      document.querySelector('#striker-state-rate-label').textContent = '—';
      document.querySelector('#striker-state-rate-label').setAttribute('y', '78');
      strikerInterpretation.textContent =
        `${stateName}'s relative food-bank availability cannot be calculated from the available population and food-bank data.`;
      strikerStatus.textContent = `${stateName}: availability comparison unavailable because population or food-bank data is missing or invalid.`;
      return;
    }

    strikerStatus.textContent =
      `${stateName}: ${Math.round(totals.availabilityScore * 100)}% of the national median.`;

    if (reducedMotion) {
      strikerPuck.attr('transform', `translate(0,${targetY})`);
      stateRateLabel.setAttribute('y', `${targetY + 10}`);
      return;
    }

    const currentTransform = strikerPuck.attr('transform') || '';
    const currentY = Number(currentTransform.match(/translate\(0,([-\d.]+)/)?.[1] || 68);
    const interpolateY = d3.interpolateNumber(currentY, targetY);
    strikerPuck.transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr('transform', `translate(0,${targetY})`)
      .tween('rate-label', () => (progress) =>
        stateRateLabel.setAttribute('y', `${interpolateY(progress) + 10}`)
      )
      .on('end', () => {
        if (!strikerPuck.node().isConnected) return;
        if (meetsReference) {
          strikerBell
            .transition()
            .duration(80)
            .attr('transform', 'translate(260,292) rotate(8)')
            .transition()
            .duration(80)
            .attr('transform', 'translate(260,292) rotate(-8)')
            .transition()
            .duration(80)
            .attr('transform', 'translate(260,292) rotate(6)')
            .transition()
            .duration(80)
            .attr('transform', 'translate(260,292) rotate(-6)')
            .transition()
            .duration(100)
            .attr('transform', 'translate(260,292)');
        }

        const animateBounce = (position, direction) => {
          const nextY = Math.max(42, Math.min(244, targetY + direction * 4));
          const interpolateY = d3.interpolateNumber(position, nextY);
          strikerPuck.transition()
            .duration(650)
            .ease(d3.easeSineInOut)
            .attr('transform', `translate(0,${nextY})`)
            .tween('rate-label', () => (progress) =>
              stateRateLabel.setAttribute('y', `${interpolateY(progress) + 10}`)
            )
            .on('end', () => animateBounce(nextY, -direction));
        };
        animateBounce(targetY, -1);
      });
  };

  const svg = d3.select(mapFrame).append('svg')
    .attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)
    .attr('role', 'group')
    .attr('aria-label', 'Map of average county shares by state. Select a state to explore county data.');
  const zoomLayer = svg.append('g');
  const countyLayer = zoomLayer.append('g').attr('class', 'map-counties');
  const countyShapes = countyLayer.selectAll('path')
    .data(countyFeatures)
    .join('path')
    .attr('class', 'county-shape is-hidden')
    .attr('d', geoPath);
  const stateLayer = zoomLayer.append('g').attr('class', 'map-states');
  const stateShapes = stateLayer.selectAll('path')
    .data(stateFeatures)
    .join('path')
    .attr('class', 'state-average')
    .attr('d', geoPath)
    .attr('fill', (feature) => {
      const average = stateAverages.get(String(feature.id).padStart(2, '0'));
      return average ? stateColor(average.share) : '#34413c';
    })
    .attr('tabindex', (feature) =>
      stateAverages.has(String(feature.id).padStart(2, '0')) ? 0 : -1)
    .attr('role', 'button')
    .attr('aria-label', (feature) => {
      const stateFips = String(feature.id).padStart(2, '0');
      const average = stateAverages.get(stateFips);
      const stateName = mapStateNames.get([...fipsByState].find(([, fips]) => fips === stateFips)?.[0]) || 'State';
      return average
        ? `${stateName}: ${average.share.toFixed(1)}% average county share. Select to view county bubbles.`
        : `${stateName}: no county data available.`;
    });
  const stateBorders = zoomLayer.append('path')
    .datum(topojson.mesh(atlas, atlas.objects.states, (a, b) => a !== b))
    .attr('class', 'state-boundaries')
    .attr('d', geoPath);
  const bubbles = zoomLayer.append('g').attr('class', 'map-bubbles')
    .selectAll('circle')
    .data(counties.filter((county) => Number.isFinite(county.affected) && county.affected > 0))
    .join('circle')
    .attr('class', 'map-bubble')
    .attr('cx', (county) => county.x)
    .attr('cy', (county) => county.y)
    .attr('r', (county) => radius(county.affected))
    .attr('aria-label', (county) => `${getCountyName(county)}: ${mapNumberFormat.format(county.affected)} people affected`)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('display', 'none')
    .on('mouseenter focus', (event, county) => showCountyDetails(county))
    .on('mouseleave blur', () => {
      if (selectedMapCounty) {
        showCountyDetails(selectedMapCounty);
      } else {
        detailName.textContent = mapStateNames.get(stateFilter.value) || 'Select a county';
        detailImpact.textContent = 'Select a circle for county details.';
        detailShare.textContent = '';
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
    .extent([[0, 0], [mapWidth, mapHeight]])
    .translateExtent([[0, 0], [mapWidth, mapHeight]])
    .scaleExtent([1, 8])
    .filter((event) => event.type !== 'wheel' && !event.button)
    .on('zoom', (event) => zoomLayer.attr('transform', event.transform));
  svg.call(zoom);

  const showState = (stateCode) => {
    selectedMapCounty = null;
    bubbles.classed('is-selected', false);
    if (stateCode === 'all') {
      stateShapes.attr('display', null).classed('is-selected', false);
      countyShapes.classed('is-hidden', true);
      bubbles.attr('display', 'none');
      stateBorders.attr('display', null);
      legend.classed('is-state-view', true).selectAll('svg').remove();
      legend.attr('aria-label', 'Average county share color scale');
      addStateLegend(legend.node(), stateColor, maximumShare || 1);
      detailName.textContent = 'United States';
      detailImpact.textContent = 'Select a state to explore its counties.';
      detailShare.textContent = 'State colors show the unweighted average of county population shares.';
      updateStriker('all');
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      return;
    }

    const stateFips = fipsByState.get(stateCode);
    const stateFeature = stateByFips.get(stateFips);
    if (!stateFeature) {
      throw new Error(`No map boundary found for ${mapStateNames.get(stateCode) || stateCode}.`);
    }
    const stateName = mapStateNames.get(stateCode) || stateCode;
    const stateAverage = stateAverages.get(stateFips);
    stateShapes.attr('display', 'none').classed('is-selected', false);
    countyShapes.classed('is-hidden', (feature) =>
      String(feature.id).padStart(5, '0').slice(0, 2) !== stateFips);
    bubbles.attr('display', (county) => county.State === stateCode ? null : 'none');
    stateBorders.attr('display', null);
    legend.classed('is-state-view', false).selectAll('svg').remove();
    legend.attr('aria-label', 'Bubble size legend');
    addBubbleLegend(legend.node(), radius, affectedMaximum);
    detailName.textContent = stateName;
    detailImpact.textContent = stateAverage
      ? `${stateAverage.share.toFixed(1)}% average county share across ${stateAverage.countyCount} counties.`
      : 'Average county share is not available.';
    detailShare.textContent = 'County bubbles are sized by the number of people in low-income, low-access areas.';
    updateStriker(stateCode);
    status.textContent = '';
    const [[x0, y0], [x1, y1]] = geoPath.bounds(stateFeature);
    const scale = Math.min(8, 0.88 / Math.max((x1 - x0) / mapWidth, (y1 - y0) / mapHeight));
    const transform = d3.zoomIdentity
      .translate(mapWidth / 2 - scale * (x0 + x1) / 2, mapHeight / 2 - scale * (y0 + y1) / 2)
      .scale(scale);
    const boundedTransform = zoom.constrain()(
      transform,
      [[0, 0], [mapWidth, mapHeight]],
      [[0, 0], [mapWidth, mapHeight]]
    );
    svg.transition().duration(500).call(zoom.transform, boundedTransform);
  };

  const stateCodes = [...new Set(rows.map((county) => county.State))].sort();
  stateFilter.innerHTML = '<option value="all">All states — average county share</option>' +
    stateCodes.map((code) => `<option value="${code}">${mapStateNames.get(code) || code}</option>`).join('');
  stateFilter.addEventListener('change', () => showState(stateFilter.value));
  stateShapes
    .on('mouseenter focus', (event, feature) => {
      const stateFips = String(feature.id).padStart(2, '0');
      const stateCode = [...fipsByState].find(([, fips]) => fips === stateFips)?.[0];
      const average = stateAverages.get(stateFips);
      if (!stateCode || !average) return;
      detailName.textContent = mapStateNames.get(stateCode) || stateCode;
      detailImpact.textContent = `${average.share.toFixed(1)}% average county share across ${average.countyCount} counties.`;
      detailShare.textContent = 'Select this state to see county-level circles.';
    })
    .on('mouseleave blur', () => {
      if (stateFilter.value === 'all') {
        detailName.textContent = 'United States';
        detailImpact.textContent = 'Select a state to explore its counties.';
        detailShare.textContent = 'State colors show the unweighted average of county population shares.';
      }
    })
    .on('click', (event, feature) => {
      const stateFips = String(feature.id).padStart(2, '0');
      const stateCode = [...fipsByState].find(([, fips]) => fips === stateFips)?.[0];
      if (stateCode && stateAverages.has(stateFips)) {
        stateFilter.value = stateCode;
        showState(stateCode);
      }
    })
    .on('keydown', (event, feature) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const stateFips = String(feature.id).padStart(2, '0');
        const stateCode = [...fipsByState].find(([, fips]) => fips === stateFips)?.[0];
        if (stateCode && stateAverages.has(stateFips)) {
          stateFilter.value = stateCode;
          showState(stateCode);
        }
      }
    });

  addStateLegend(legend.node(), stateColor, maximumShare || 1);
  legend.classed('is-state-view', true);
  legend.attr('aria-label', 'Average county share color scale');
  const missingValues = rows.length - rows.filter((row) => Number.isFinite(row.share)).length;
  const missingBoundaries = rows.length - counties.length;
  const caveats = [
    missingValues ? `${mapNumberFormat.format(missingValues)} counties have no share value` : '',
    missingBoundaries ? `${mapNumberFormat.format(missingBoundaries)} counties have no matching map boundary` : ''
  ].filter(Boolean);
  status.textContent = `Showing average county shares for ${stateAverages.size} states.${caveats.length ? ` ${caveats.join('; ')}.` : ''} Select a state to explore county bubbles.`;
  updateStriker('all');
}

function showMapError(error) {
  console.error('Unable to load the food access map.', error);
  const status = document.querySelector('#map-status');
  if (status) {
    status.textContent = 'The map could not be loaded. Check your connection and run this page through a local web server.';
    status.classList.add('is-error');
  }
}

document.addEventListener('sections:loaded', () => {
  if (!window.d3 || !window.topojson) {
    showMapError(new Error('Map libraries did not load.'));
    return;
  }
  Promise.all([
    d3.csv('data/food_atlas_cleaned.csv', (row) => {
      if (!row.FIPS) return null;
      const affectedValue = row['Low Income & Low Access Population 2019'];
      const shareValue = row['Pct Low Income & Low Access Population 2019'];
      const foodBankValue = row['Food Banks 2021'];
      const affected = affectedValue === '' ? Number.NaN : Number(affectedValue);
      const share = shareValue === '' ? Number.NaN : Number(shareValue);
      return {
        ...row,
        FIPS: row.FIPS.padStart(5, '0'),
        affected,
        share,
        foodBanks: foodBankValue === '' ? Number.NaN : Number(foodBankValue)
      };
    }),
    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json')
  ])
    .then(([rows, atlas]) => drawCountyMap(rows.filter(Boolean), atlas))
    .catch(showMapError);
});
