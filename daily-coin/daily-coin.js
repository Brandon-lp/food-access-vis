(() => {
  'use strict';

  const CONFIG = {
    dataUrl: 'data/precious/daily-dollar.json',
    pricesUrl: 'data/precious/item-prices.json',
    maxIcons: 9 // most pictures shown for one item before showing "+"
  };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v, d = 2) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(d);
  const int = (n) => Math.round(n).toLocaleString('en-US');
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const S = { data: null, items: [], place: 'ALL', period: 'year', order: [] };

  /* ---------- boot ---------- */
  const getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u + ' HTTP ' + r.status))));
  Promise.all([getJson(CONFIG.dataUrl), getJson(CONFIG.pricesUrl)])
    .then(([data, prices]) => start(data, prices))
    .catch((err) => {
      console.error(err);
      $('#dc-error').hidden = false;
    });

  function start(data, prices) {
    S.data = data;
    S.items = prices.items.slice().sort((a, b) => a.yearAvg - b.yearAvg);
    S.byName = new Map(data.agencies.map((a) => [a.name, a]));

    const want = new URLSearchParams(location.search).get('place');
    if (want && S.byName.has(want)) S.place = want;

    populatePlaces();
    populatePeriods();
    wire();
    render(false);
  }

  /* ---------- data helpers ---------- */
  function coinFor(place, period) {
    const days = S.data.meta.daysPerMonth;
    if (place === 'ALL') return period === 'year' ? S.data.national.perDay : S.data.national.monthly[period] / days;
    const a = S.byName.get(place);
    if (period === 'year') return a.perDay;
    const v = a.monthly[period];
    return v == null ? null : v / days;
  }
  function priceFor(item, period) {
    return period === 'year' || !item.monthly ? item.yearAvg : item.monthly[period];
  }
  function periodWord(period) {
    return period === 'year' ? 'year average' : S.data.meta.months[period];
  }
  function placeLabel(place) { return place === 'ALL' ? 'All agencies (national average)' : place; }

  /* ---------- controls ---------- */
  function populatePlaces() {
    const ag = S.data.agencies;
    const groups = [['State', 'States and DC'], ['Territory', 'Territories'], ['Tribal', 'Tribal organizations']];
    S.order = ['ALL'];
    let html = '<option value="ALL">National average (all agencies)</option>';
    groups.forEach(([t, label]) => {
      const list = ag.filter((a) => a.type === t).sort((x, y) => x.name.localeCompare(y.name));
      list.forEach((a) => S.order.push(a.name));
      html += '<optgroup label="' + label + '">' + list.map((a) => '<option value="' + esc(a.name) + '">' + esc(a.name) + '</option>').join('') + '</optgroup>';
    });
    $('#dc-place').innerHTML = html;
  }
  function populatePeriods() {
    $('#dc-period').innerHTML = '<option value="year">Year average</option>' +
      S.data.meta.months.map((m, i) => '<option value="' + i + '">' + esc(m) + '</option>').join('');
  }
  function wire() {
    $('#dc-place').addEventListener('change', (e) => { S.place = e.target.value; render(true); });
    $('#dc-period').addEventListener('change', (e) => { S.period = e.target.value === 'year' ? 'year' : Number(e.target.value); render(false); });
    const step = (d) => { const i = S.order.indexOf(S.place); S.place = S.order[(i + d + S.order.length) % S.order.length]; render(true); };
    $('#dc-prev').addEventListener('click', () => step(-1));
    $('#dc-next').addEventListener('click', () => step(1));
    $('#dc-random').addEventListener('click', () => {
      const pool = S.order.filter((p) => p !== S.place && p !== 'ALL');
      S.place = pool[Math.floor(Math.random() * pool.length)];
      render(true);
    });
    const cards = $('#dc-cards');
    const show = (e) => {
      const c = e.target.closest('.dc-card'); if (c) $('#dc-readout').textContent = c.dataset.detail;
    };
    cards.addEventListener('mouseover', show);
    cards.addEventListener('focusin', show);
    cards.addEventListener('mouseleave', () => { $('#dc-readout').textContent = defaultReadout; });
  }

  /* ---------- drawing ---------- */
  let defaultReadout = '';
  function coinHTML(value) {
    const d = 230;
    return '<div class="dc-coin" style="--d:' + d + 'px" role="img" aria-label="' + esc(money(value) + ' per participant per day') + '">' +
      '<div class="dc-coin-face"><span class="dc-coin-top">per day</span><span class="dc-coin-num">' + money(value) + '</span></div></div>';
  }
  function icon(id, partial, idx) {
    const sym = '<use href="#ic-' + id + '"/>';
    const anim = reduceMotion ? '' : ' is-new" style="--i:' + idx;
    if (partial == null) return '<span class="dc-ico' + anim + '"><svg viewBox="0 0 64 64" aria-hidden="true">' + sym + '</svg></span>';
    const cut = Math.max(0, Math.min(100, 100 - partial * 100));
    return '<span class="dc-ico' + anim + '"><svg class="ghost" viewBox="0 0 64 64" aria-hidden="true">' + sym + '</svg>' +
      '<svg viewBox="0 0 64 64" aria-hidden="true" style="clip-path:inset(0 ' + cut.toFixed(1) + '% 0 0)">' + sym + '</svg></span>';
  }
  function iconsFor(id, k) {
    if (k < 1) return icon(id, k, 0);
    const whole = Math.floor(k), shown = Math.min(whole, CONFIG.maxIcons);
    let h = '';
    for (let i = 0; i < shown; i++) h += icon(id, null, i);
    if (whole > CONFIG.maxIcons) return h + '<span class="dc-more">+' + (whole - CONFIG.maxIcons) + ' more</span>';
    const rem = k - whole;
    if (rem >= 0.05) h += icon(id, rem, shown);
    return h;
  }

  function render(doFlip) {
    const coin = coinFor(S.place, S.period);
    $('#dc-place').value = S.place;
    $('#dc-period').value = String(S.period);
    $('#dc-place-name').textContent = placeLabel(S.place);

    const wrap = $('#dc-coin-wrap');
    const cards = $('#dc-cards');
    const readout = $('#dc-readout');

    if (!(coin > 0)) {
      wrap.innerHTML = '';
      $('#dc-h1-num').textContent = 'n/a';
      $('#dc-place-sub').textContent = periodWord(S.period);
      $('#dc-hook').textContent = '';
      cards.innerHTML = '<p class="dc-msg">There is no usable program value for ' + esc(placeLabel(S.place)) + ' in ' + esc(periodWord(S.period)) + ' (the source cell is negative or empty), so nothing can be compared. Choose another month or the year average.</p>';
      readout.textContent = '';
      defaultReadout = '';
      return;
    }

    $('#dc-h1-num').textContent = money(coin);
    wrap.innerHTML = coinHTML(coin);
    if (doFlip && !reduceMotion) { const c = $('.dc-coin', wrap); c.classList.add('is-flipping'); }

    // sub line under the name
    let sub = periodWord(S.period);
    if (S.place === 'ALL') {
      sub += ' · ' + S.data.meta.agencyCount + ' agencies · ' + int(S.data.national.avgParticipants) + ' participants a month';
    } else {
      const nat = coinFor('ALL', S.period);
      const vsNat = (coin / nat - 1) * 100;
      sub += ' · ' + money(coin * S.data.meta.daysPerMonth) + ' a month · ' + Math.abs(vsNat).toFixed(0) + '% ' + (vsNat >= 0 ? 'above' : 'below') + ' national';
    }
    $('#dc-place-sub').textContent = sub;

    // cards
    const rows = S.items.map((it) => ({ it, price: priceFor(it, S.period) })).filter((r) => r.price > 0).sort((x, y) => x.price - y.price);
    cards.innerHTML = rows.map((r) => {
      const k = coin / r.price, covered = k >= 1;
      const big = covered ? k.toFixed(1) + '×' : Math.round(k * 100) + '%';
      const note = r.it.samePeriod ? '' : ' (' + r.it.periodLabel + ')';
      const detail = r.it.name + ' (' + r.it.unit + '): ' + money(r.price) + ', ' +
        (r.it.samePeriod ? periodWord(S.period) : r.it.periodLabel + ' national average') + '. ' +
        (covered ? 'The coin buys ' + k.toFixed(1) + ' times that amount.' : 'The coin covers ' + Math.round(k * 100) + '% of one.');
      return '<article class="dc-card' + (covered ? ' is-covered' : '') + '" tabindex="0" data-detail="' + esc(detail) + '" aria-label="' + esc(detail) + '">' +
        '<div class="dc-icons">' + iconsFor(r.it.id, k) + '</div>' +
        '<div class="dc-meta"><span class="dc-big">' + big + (covered ? '' : '<small>of one</small>') + '</span>' +
        '<span class="dc-what">' + esc(r.it.name) + '</span>' +
        '<span class="dc-price">' + esc(r.it.unit) + ' · ' + money(r.price) + esc(note) + '</span></div></article>';
    }).join('');

    // hook sentence: cheapest item the coin covers most, and the priciest item shown
    const cheap = rows[0], dear = rows[rows.length - 1];
    const kc = coin / cheap.price, kd = coin / dear.price;
    const cheapTxt = (kc >= 1 ? '<b>' + kc.toFixed(1) + '</b> ' : '<b>' + Math.round(kc * 100) + '%</b> of ') + esc(cheap.it.unit.replace(/^1 /, '')) + ' of ' + esc(cheap.it.name.toLowerCase());
    const dearTxt = (kd >= 1 ? '<b>' + kd.toFixed(1) + '</b> ' : '<b>' + Math.round(kd * 100) + '%</b> of ') + (kd >= 1 ? esc(dear.it.unit.replace(/^1 /, '')) + ' of ' : 'a ' + esc(dear.it.unit.replace(/^1 /, '')) + ' of ') + esc(dear.it.name.toLowerCase());
    $('#dc-hook').innerHTML = 'This coin buys ' + cheapTxt + ', or ' + dearTxt + '.';

    defaultReadout = 'Hover or focus a card for its price and source.';
    readout.textContent = defaultReadout;
  }
})();