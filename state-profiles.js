(function () {
  const sectionSelector = '#explore';
  const mapSelector = '[data-explore-map]';
  const radarSelector = '[data-explore-radar]';
  const axisConfig = [
    { label: 'All', valueKey: 'popPctOfTotalPopulation' },
    { label: 'Low-income', valueKey: 'lowiPctOfTotalPopulation' },
    { label: 'Children', valueKey: 'childPctOfTotalPopulation' },
    { label: 'Seniors', valueKey: 'seniorsPctOfTotalPopulation' },
    { label: 'Black', valueKey: 'blackPctOfTotalPopulation' }
  ];
  const stateNameMap = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
    CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
    LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
    MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
    OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
    WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
  };
  const stateFipsMap = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC',
    '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
    '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT',
    '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
    '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
    '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY'
  };
  const colorScale = d3.scaleThreshold()
    .domain([5, 10, 20, 30, 40])
    .range(['#e7e4dc', '#f0d9a0', '#e5a300', '#ee7302', '#d44a10', '#b81817']);

  function valueAvailable(state, key) {
    return state && state[key] !== null && state[key] !== undefined && state[key] !== '' && Number.isFinite(Number(state[key]));
  }

  function updateLegend() {
    const gradient = document.querySelector('.legend-gradient');
    if (gradient) gradient.style.background = `linear-gradient(90deg, ${colorScale.range().join(', ')})`;
  }

  function renderRadar(section, state) {
    const svg = d3.select(section.querySelector(radarSelector));
    const name = section.querySelector('[data-explore-state-name]');
    const summary = section.querySelector('[data-explore-state-summary]');
    const metrics = section.querySelector('[data-explore-metrics]');
    const coverage = section.querySelector('[data-explore-coverage]');
    const hasData = state && axisConfig.every((axis) => valueAvailable(state, axis.valueKey));
    const width = 340;
    const center = 170;
    const radius = 120;
    const maxValue = 50;
    const code = state && state.stateCode;

    svg.attr('viewBox', `0 0 ${width} ${width}`)
      .attr('width', width)
      .attr('height', width)
      .attr('aria-label', code ? `${stateNameMap[code] || code} radar chart` : 'State radar chart');
    svg.selectAll('*').remove();

    for (let ring = 1; ring <= 5; ring += 1) {
      const points = axisConfig.map((_, i) => {
        const angle = -Math.PI / 2 + (i / axisConfig.length) * Math.PI * 2;
        const r = radius * ring / 5;
        return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
      }).join(' ');
      svg.append('polygon').attr('points', points).attr('fill', 'none').attr('stroke', 'rgba(245, 240, 232, .18)');
    }

    axisConfig.forEach((axis, i) => {
      const angle = -Math.PI / 2 + (i / axisConfig.length) * Math.PI * 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      svg.append('line').attr('x1', center).attr('y1', center).attr('x2', x).attr('y2', y).attr('stroke', 'rgba(245, 240, 232, .25)');
      svg.append('text').attr('x', center + Math.cos(angle) * (radius + 26)).attr('y', center + Math.sin(angle) * (radius + 26))
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('fill', '#f5f0e8')
        .attr('font-family', 'DM Mono, monospace').attr('font-size', 9).text(axis.label);
    });
    [10, 20, 30, 40, 50].forEach((tick) => svg.append('text')
      .attr('x', center + 14).attr('y', center - radius * tick / maxValue + 2)
      .attr('fill', '#f5f0e8').attr('font-family', 'DM Mono, monospace').attr('font-size', 10).text(`${tick}%`));

    if (name) name.textContent = code ? (stateNameMap[code] || code) : 'State';
    if (summary) summary.textContent = hasData ? 'All percentages below are measured against the state’s total population.' : 'Data unavailable for this state.';
    if (metrics) metrics.innerHTML = hasData
      ? axisConfig.map((axis) => `<div class="metric-item"><span>${axis.label}</span><strong>${Number(state[axis.valueKey]).toFixed(1)}%</strong></div>`).join('')
      : '<div class="metric-item"><span>Data</span><strong>Unavailable</strong></div>';
    if (coverage) {
      const included = Number(state && state.countiesIncluded || 0);
      const excluded = Number(state && state.countiesExcluded || 0);
      const total = Number(state && state.counties || 0);
      coverage.textContent = hasData && total
        ? `${included} of ${total} counties are included in this state’s profile; ${excluded} county record${excluded === 1 ? '' : 's'} are excluded from the calculation.`
        : 'Data unavailable for this state’s demographic profile.';
    }
    if (hasData) {
      const points = axisConfig.map((axis, i) => {
        const angle = -Math.PI / 2 + (i / axisConfig.length) * Math.PI * 2;
        const r = radius * Number(state[axis.valueKey]) / maxValue;
        return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
      }).join(' ');
      svg.append('polygon').attr('points', points).attr('fill', 'rgba(166, 175, 50, .28)').attr('stroke', '#a6af32').attr('stroke-width', 2.5);
    }
  }

  function init() {
    const section = document.querySelector(sectionSelector);
    const mapRoot = section && section.querySelector(mapSelector);
    if (!section || !mapRoot || mapRoot.dataset.initialized) return;
    mapRoot.dataset.initialized = 'true';
    const stateByCode = new Map();

    Promise.all([fetch('data/state-profiles.json').then((r) => { if (!r.ok) throw new Error('Profiles unavailable'); return r.json(); }),
      fetch('data/us-states-10m.json').then((r) => { if (!r.ok) throw new Error('Map unavailable'); return r.json(); })])
      .then(([profiles, topology]) => {
        profiles.forEach((state) => stateByCode.set(state.stateCode, state));
        const features = topojson.feature(topology, topology.objects.states).features;
        const featureByCode = new Map(features.map((feature) => [stateFipsMap[String(feature.id).padStart(2, '0')], feature]));
        const entries = Object.entries(stateNameMap).map(([code, name]) => ({ code, name, feature: featureByCode.get(code), profile: stateByCode.get(code) || null }))
          .filter((entry) => entry.feature);
        let selectedCode = (profiles[0] && profiles[0].stateCode) || entries[0].code;
        function paintMap() {
          mapRoot.innerHTML = '';
          const svg = d3.select(mapRoot).append('svg').attr('viewBox', '0 0 720 420').attr('role', 'img').attr('aria-label', 'Interactive U.S. state map');
          const projection = d3.geoAlbersUsa().fitSize([720, 420], { type: 'Sphere' });
          const path = d3.geoPath(projection);
          svg.append('g').selectAll('path').data(entries).join('path')
            .attr('d', (entry) => path(entry.feature)).attr('class', (entry) => `state ${entry.code === selectedCode ? 'selected' : ''}`)
            .attr('fill', (entry) => {
              if (!valueAvailable(entry.profile, 'popPctOfTotalPopulation')) return '#9aa0a6';
              return colorScale(Number(entry.profile.popPctOfTotalPopulation));
            }).attr('stroke', 'rgba(28, 33, 71, .9)').attr('stroke-width', .75)
            .attr('tabindex', 0).attr('role', 'button')
            .attr('aria-label', (entry) => valueAvailable(entry.profile, 'popPctOfTotalPopulation')
              ? `${entry.name}: ${Number(entry.profile.popPctOfTotalPopulation).toFixed(1)}% of residents experiencing limited supermarket access`
              : `${entry.name}: data unavailable`)
            .on('click keydown', (event, entry) => {
              if (event.type === 'click' || event.key === 'Enter' || event.key === ' ') {
                if (event.type === 'keydown') event.preventDefault();
                selectedCode = entry.code;
                paintMap();
                renderRadar(section, entry.profile);
              }
            });
        }
        updateLegend();
        paintMap();
        renderRadar(section, stateByCode.get(selectedCode) || null);
      })
      .catch(() => {
        mapRoot.innerHTML = '<p class="load-error">The state profile map could not be loaded.</p>';
      });
  }

  document.addEventListener('sections:loaded', () => {
    updateLegend();
    init();
  });
})();
