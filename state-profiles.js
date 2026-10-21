(function () {
  const sectionSelector = '#explore';
  const mapSelector = '[data-explore-map]';
  const radarSelector = '[data-explore-radar]';
  const stateNameSelector = '[data-explore-state-name]';
  const stateSummarySelector = '[data-explore-state-summary]';
  const metricsSelector = '[data-explore-metrics]';
  const coverageSelector = '[data-explore-coverage]';

  const axisConfig = [
    { key: 'all', label: 'All', valueKey: 'popPctOfTotalPopulation' },
    { key: 'lowIncome', label: 'Low-income', valueKey: 'lowiPctOfTotalPopulation' },
    { key: 'children', label: 'Children', valueKey: 'childPctOfTotalPopulation' },
    { key: 'seniors', label: 'Seniors', valueKey: 'seniorsPctOfTotalPopulation' },
    { key: 'black', label: 'Black', valueKey: 'blackPctOfTotalPopulation' }
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

  const stateColorScale = d3.scaleThreshold()
    .domain([5, 10, 20, 30, 40])
    .range(['#e7e4dc', '#d3d9b9', '#b7d68c', '#9bc961', '#d7f36b', '#ff765c']);

  function normalizeFeatureId(featureId) {
    if (featureId === null || featureId === undefined) {
      return null;
    }
    return String(featureId).padStart(2, '0');
  }

  function hasUsableStateValue(state, valueKey) {
    return state && state[valueKey] !== null && state[valueKey] !== undefined && state[valueKey] !== '' && Number.isFinite(Number(state[valueKey]));
  }

  function colorScale(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return '#9aa0a6';
    }
    return stateColorScale(Number(value));
  }

  function updateLegendGradient() {
    const legendGradient = document.querySelector('.legend-gradient');
    if (legendGradient) {
      legendGradient.style.background = `linear-gradient(90deg, ${stateColorScale.range().join(', ')})`;
    }
  }

  function init() {
    const section = document.querySelector(sectionSelector);
    if (!section) {
      return;
    }

    const mapRoot = section.querySelector(mapSelector);
    const radarEl = section.querySelector(radarSelector);
    if (!mapRoot || !radarEl) {
      return;
    }

    fetch('data/state-profiles.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('State profile dataset unavailable');
        }
        return response.json();
      })
      .then((data) => {
        const states = Array.isArray(data) ? data : [];
        if (!states.length) {
          mapRoot.innerHTML = '<p class="load-error">The state profile dataset could not be loaded.</p>';
          return;
        }

        const defaultStateCode = states[0].stateCode;
        const stateByCode = new Map(states.map((entry) => [entry.stateCode, entry]));
        renderMap(mapRoot, states, stateByCode, defaultStateCode);
        renderRadar(radarEl, states[0], section);
      })
      .catch(() => {
        mapRoot.innerHTML = '<p class="load-error">State profile data is unavailable. Please refresh or verify the local data file.</p>';
      });
  }

  function renderMap(mapRoot, states, stateByCode, selectedCode) {
    mapRoot.innerHTML = '';

    const section = mapRoot.closest('#explore');
    const radarEl = section ? section.querySelector(radarSelector) : null;
    const width = 720;
    const height = 420;
    const svg = d3.select(mapRoot)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Interactive U.S. state map');

    const projection = d3.geoAlbersUsa().fitSize([width, height], { type: 'Sphere' });
    const path = d3.geoPath(projection);

    fetch('data/us-states-10m.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('U.S. state geography unavailable');
        }
        return response.json();
      })
      .then((topology) => {
        const allStates = topojson.feature(topology, topology.objects.states).features;
        const featureByCode = new Map();

        allStates.forEach((feature) => {
          const normalizedId = normalizeFeatureId(feature.id);
          const stateCode = normalizedId ? stateFipsMap[normalizedId] : null;
          if (stateCode) {
            featureByCode.set(stateCode, feature);
          }
        });

        const stateEntries = Object.keys(stateNameMap)
          .map((stateCode) => {
            const profile = stateByCode.get(stateCode) || null;
            const feature = featureByCode.get(stateCode) || null;
            const value = profile && hasUsableStateValue(profile, 'popPctOfTotalPopulation') ? Number(profile.popPctOfTotalPopulation) : null;
            return { code: stateCode, name: stateNameMap[stateCode] || stateCode, feature, profile, value };
          })
          .filter((entry) => entry.feature);

        const selectedCodeValue = selectedCode || stateEntries[0].code;
        const g = svg.append('g');

        g.selectAll('path')
          .data(stateEntries)
          .join('path')
          .attr('d', (d) => path(d.feature))
          .attr('class', (d) => `state ${d.code === selectedCodeValue ? 'selected' : ''}`)
          .attr('fill', (d) => !d.profile || d.value === null || !Number.isFinite(d.value) ? '#9aa0a6' : colorScale(d.value))
          .attr('stroke', 'rgba(23, 35, 31, 0.9)')
          .attr('stroke-width', 0.75)
          .attr('tabindex', 0)
          .attr('role', 'button')
          .attr('aria-label', (d) => {
            if (!d.profile || d.value === null || !Number.isFinite(d.value)) {
              return `${d.name}: data unavailable`;
            }
            return `${d.name}: ${d.value.toFixed(1)}% of residents experiencing limited supermarket access`;
          })
          .on('click', (_, d) => {
            renderMap(mapRoot, states, stateByCode, d.code);
            renderRadar(radarEl, d.profile || null, section);
          })
          .on('keydown', function (event, d) {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              renderMap(mapRoot, states, stateByCode, d.code);
              renderRadar(radarEl, d.profile || null, section);
            }
          });

        const stateSummary = section ? section.querySelector(stateSummarySelector) : null;
        if (stateSummary) {
          stateSummary.textContent = 'All percentages below are measured against the state’s total population.';
        }
      })
      .catch(() => {
        mapRoot.innerHTML = '<p class="load-error">The geographic U.S. state map could not be loaded.</p>';
      });
  }

  function renderRadar(svg, state, section) {
    if (!svg || !section) {
      return;
    }

    const width = 340;
    const height = 340;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 120;
    const scaleMax = 50;
    const stateName = section.querySelector(stateNameSelector);
    const metricsRoot = section.querySelector(metricsSelector);
    const coverageNode = section.querySelector(coverageSelector);
    const stateSummary = section.querySelector(stateSummarySelector);
    const stateCode = state && state.stateCode ? state.stateCode : null;
    const hasUsableData = state && axisConfig.every((axis) => hasUsableStateValue(state, axis.valueKey));

    const svgSelection = d3.select(svg)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .attr('height', height)
      .attr('aria-label', stateCode ? `${stateNameMap[stateCode] || stateCode} radar chart` : 'State radar chart');

    svgSelection.selectAll('*').remove();

    const gridGroup = svgSelection.append('g');
    const axisGroup = svgSelection.append('g');
    const polygonGroup = svgSelection.append('g');

    axisConfig.forEach((axis, index) => {
      const angle = -Math.PI / 2 + (index / axisConfig.length) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const labelX = centerX + Math.cos(angle) * (radius + 26);
      const labelY = centerY + Math.sin(angle) * (radius + 26);

      gridGroup.append('line')
        .attr('x1', centerX).attr('y1', centerY).attr('x2', x).attr('y2', y)
        .attr('stroke', 'rgba(245, 240, 232, 0.25)');

      const ringValue = 20;
      const ringX = centerX + Math.cos(angle) * (radius * (ringValue / scaleMax));
      const ringY = centerY + Math.sin(angle) * (radius * (ringValue / scaleMax));
      if (index === 0) {
        axisGroup.append('line')
          .attr('x1', centerX).attr('y1', centerY).attr('x2', ringX).attr('y2', ringY)
          .attr('stroke', 'rgba(245, 240, 232, 0.2)');
      }

      axisGroup.append('text')
        .attr('x', labelX).attr('y', labelY)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#f5f0e8').attr('font-family', 'DM Mono, monospace').attr('font-size', 9)
        .text(axis.label);
    });

    for (let ring = 1; ring <= 5; ring += 1) {
      const ringPoints = axisConfig.map((axis, index) => {
        const angle = -Math.PI / 2 + (index / axisConfig.length) * Math.PI * 2;
        const value = (ring / 5) * scaleMax;
        const x = centerX + Math.cos(angle) * (radius * (value / scaleMax));
        const y = centerY + Math.sin(angle) * (radius * (value / scaleMax));
        return `${x},${y}`;
      }).join(' ');

      gridGroup.append('polygon')
        .attr('points', ringPoints).attr('fill', 'none')
        .attr('stroke', 'rgba(245, 240, 232, 0.18)');
    }

    [10, 20, 30, 40, 50].forEach((tickValue) => {
      const y = centerY - (radius * (tickValue / scaleMax));
      axisGroup.append('text')
        .attr('x', centerX + 14).attr('y', y + 2)
        .attr('fill', '#f5f0e8').attr('font-family', 'DM Mono, monospace')
        .attr('font-size', 10).attr('font-weight', 500).attr('text-anchor', 'start')
        .text(`${tickValue}%`);
    });

    if (stateName) {
      stateName.textContent = stateCode ? (stateNameMap[stateCode] || stateCode) : 'State';
    }

    if (stateSummary) {
      stateSummary.textContent = !state || !hasUsableData
        ? 'Data unavailable for this state.'
        : 'All percentages below are measured against the state’s total population.';
    }

    if (metricsRoot) {
      if (!state || !hasUsableData) {
        metricsRoot.innerHTML = '<div class="metric-item"><span>Data</span><strong>Unavailable</strong></div>';
      } else {
        metricsRoot.innerHTML = axisConfig.map((axis) => {
          const value = Number(state[axis.valueKey]);
          return `<div class="metric-item"><span>${axis.label}</span><strong>${value.toFixed(1)}%</strong></div>`;
        }).join('');
      }
    }

    if (coverageNode) {
      if (!state || !hasUsableData) {
        coverageNode.textContent = 'Data unavailable for this state’s demographic profile.';
      } else {
        const included = Number(state.countiesIncluded || 0);
        const excluded = Number(state.countiesExcluded || 0);
        const total = Number(state.counties || 0);
        if (excluded > 0 || total > 0) {
          coverageNode.textContent = `${included} of ${total} counties are included in this state’s profile; ${excluded} county record${excluded === 1 ? '' : 's'} are excluded from the calculation.`;
        } else {
          coverageNode.textContent = 'Coverage is complete for this state’s county profile.';
        }
      }
    }

    if (!state || !hasUsableData) {
      polygonGroup.append('polygon')
        .attr('points', axisConfig.map((_, index) => {
          const angle = -Math.PI / 2 + (index / axisConfig.length) * Math.PI * 2;
          return `${centerX + Math.cos(angle) * radius * 0.1},${centerY + Math.sin(angle) * radius * 0.1}`;
        }).join(' '))
        .attr('fill', 'rgba(154, 160, 166, 0.18)').attr('stroke', '#9aa0a6').attr('stroke-width', 1.5);
      return;
    }

    const polygonPoints = axisConfig.map((axis, index) => {
      const angle = -Math.PI / 2 + (index / axisConfig.length) * Math.PI * 2;
      const value = Number(state[axis.valueKey]);
      const x = centerX + Math.cos(angle) * (radius * (value / scaleMax));
      const y = centerY + Math.sin(angle) * (radius * (value / scaleMax));
      return `${x},${y}`;
    }).join(' ');

    polygonGroup.append('polygon')
      .attr('points', polygonPoints)
      .attr('fill', 'rgba(215, 243, 107, 0.28)')
      .attr('stroke', '#d7f36b')
      .attr('stroke-width', 2.5);
  }

  document.addEventListener('sections:loaded', () => {
    updateLegendGradient();
    init();
  });
})();
