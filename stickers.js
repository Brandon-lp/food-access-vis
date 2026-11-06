// Decorative produce-label stickers.
// Any <span class="sticker" data-sticker="name"> on the page is filled with that sticker's drawing,
// and STICKER_SPOTS adds stickers to text sections without editing their HTML files.
// The drawings are built here, not written in section files, because VS Code Live Server
// breaks section files that contain SVG closing tags.

const STICKER_COLORS = {
  crate: '#293379', tomato: '#b81817', citrus: '#e5a300', lettuce: '#a6af32',
  beans: '#607829', orange: '#ee7302', cream: '#f5f0e8', ink: '#1c2147'
};

// Where stickers go in sections that don't have their own placeholders. Keep them out of chart sections.
// Positions are measured from the section's edges; phone: false hides a sticker on small screens.
const STICKER_SPOTS = [
  {
    section: '.hero',
    stickers: [
      { name: 'fresh', top: '15%', left: '49%', rotate: -14, phone: false },
      { name: 'local', bottom: '8%', left: '29%', rotate: 8, phone: false }
    ]
  },
  {
    section: '#solution',
    stickers: [
      { name: 'speak', bottom: '13%', left: '6%', rotate: -9, phone: false },
      { name: 'your', bottom: '5%', left: '17%', rotate: 7, phone: false },
      { name: 'mind', bottom: '12%', left: '28%', rotate: -5, phone: false }
    ]
  }
];

const C = STICKER_COLORS;

// ---- small drawing helpers (all in a 200 x 200 box) ----

function stickerText(label, { x = 100, y = 100, size = 40, width, fill = C.cream, outline, rotate = 0 }) {
  const fit = width ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"` : '';
  const stroke = outline ? ` stroke="${outline}" stroke-width="${(size * 0.14).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"` : '';
  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="'Lilita One', 'Space Grotesk', sans-serif" font-size="${size}"${fit} fill="${fill}"${stroke} transform="rotate(${rotate} ${x} ${y})">${label}</text>`;
}

function face(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<ellipse cx="-8" cy="0" rx="3.8" ry="4.8" fill="${C.ink}"/><ellipse cx="8" cy="0" rx="3.8" ry="4.8" fill="${C.ink}"/>` +
    `<circle cx="-6.8" cy="-1.8" r="1.3" fill="#fff"/><circle cx="9.2" cy="-1.8" r="1.3" fill="#fff"/>` +
    `<path d="M -6 7 Q 0 12.5 6 7" fill="none" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/></g>`;
}

function orangeFruit(x, y, r) {
  return `<g transform="translate(${x} ${y})">` +
    `<circle r="${r}" fill="${C.orange}" stroke="#c25a00" stroke-width="3"/>` +
    `<path d="M ${r * 0.1} ${-r * 0.95} Q ${r * 0.6} ${-r * 1.5} ${r * 1.05} ${-r * 1.05} Q ${r * 0.5} ${-r * 0.7} ${r * 0.1} ${-r * 0.95} Z" fill="${C.lettuce}" stroke="${C.beans}" stroke-width="2"/>` +
    `<circle cx="${-r * 0.4}" cy="${-r * 0.4}" r="${r * 0.15}" fill="#fff" opacity=".45"/>${face(0, r * 0.1, r / 34)}</g>`;
}

function apple(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M 0 -22 Q 2 -34 8 -40" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M 6 -32 Q 22 -46 34 -36 Q 20 -24 6 -32 Z" fill="${C.beans}"/>` +
    `<path d="M 0 -22 C 18 -36 44 -24 40 6 C 37 30 18 42 0 34 C -18 42 -37 30 -40 6 C -44 -24 -18 -36 0 -22 Z" fill="${C.tomato}" stroke="#8a1110" stroke-width="2.5"/>` +
    `<ellipse cx="-20" cy="-8" rx="5" ry="9" fill="#fff" opacity=".35" transform="rotate(20 -20 -8)"/>${face(0, 6)}</g>`;
}

function strawberry(x, y, s) {
  const seeds = [[-16, -6], [16, -6], [-20, 10], [20, 10], [-8, 24], [8, 24], [0, -14]]
    .map(([sx, sy]) => `<ellipse cx="${sx}" cy="${sy}" rx="1.8" ry="2.8" fill="${C.citrus}"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M 0 40 C -30 30 -38 -5 -30 -18 C -22 -30 22 -30 30 -18 C 38 -5 30 30 0 40 Z" fill="${C.tomato}" stroke="#8a1110" stroke-width="2.5"/>` +
    `${seeds}<path d="M -24 -22 L -8 -28 L 0 -40 L 8 -28 L 24 -22 L 8 -18 L 0 -10 L -8 -18 Z" fill="${C.beans}" stroke="#3d4d18" stroke-width="2" stroke-linejoin="round"/>` +
    `${face(0, 6)}</g>`;
}

function watermelon(x, y, s) {
  const seeds = [[-22, 7], [22, 7], [-11, 22], [11, 22]]
    .map(([sx, sy]) => `<ellipse cx="${sx}" cy="${sy}" rx="2.2" ry="3.4" fill="${C.ink}"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M -44 0 A 44 44 0 0 0 44 0 Z" fill="${C.beans}"/><path d="M -38 0 A 38 38 0 0 0 38 0 Z" fill="${C.lettuce}"/>` +
    `<path d="M -33 0 A 33 33 0 0 0 33 0 Z" fill="#e2443f"/>${seeds}${face(0, 9, 0.85)}</g>`;
}

function grapes(x, y, s) {
  const spots = [[-24, -16], [0, -16], [24, -16], [-12, 5], [12, 5], [0, 26]];
  const berries = spots.map(([gx, gy]) => `<circle cx="${gx}" cy="${gy}" r="13" fill="${C.lettuce}" stroke="${C.beans}" stroke-width="2.5"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M 0 -28 Q 4 -42 14 -46" fill="none" stroke="${C.beans}" stroke-width="4" stroke-linecap="round"/>` +
    `${berries}${face(0, -15, 0.62)}${face(-12, 6, 0.55)}${face(12, 6, 0.55)}</g>`;
}

function cherries(x, y, s) {
  const cherry = (cx) => `<circle cx="${cx}" cy="18" r="17" fill="${C.tomato}" stroke="#8a1110" stroke-width="2.5"/>` +
    `<circle cx="${cx - 6}" cy="11" r="4" fill="#fff" opacity=".4"/>${face(cx, 20, 0.7)}`;
  return `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M -20 4 Q -12 -30 6 -40 M 20 4 Q 14 -24 6 -40" fill="none" stroke="${C.beans}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M 6 -40 Q 22 -52 36 -40 Q 20 -30 6 -40 Z" fill="${C.lettuce}" stroke="${C.beans}" stroke-width="2"/>` +
    `${cherry(-20)}${cherry(20)}</g>`;
}

function coin(x, y, r) {
  return `<g transform="translate(${x} ${y})">` +
    `<circle r="${r}" fill="${C.citrus}" stroke="#a87700" stroke-width="3"/><circle r="${r * 0.78}" fill="none" stroke="#a87700" stroke-width="2"/>` +
    `${stickerText('$', { x: 0, y: 2, size: r * 1.2, fill: C.crate })}</g>`;
}

// ---- the stickers ----

const STICKERS = {
  safe: () => `<rect x="18" y="18" width="164" height="164" rx="44" fill="${C.lettuce}"/>${apple(100, 82, 1.15)}` +
    stickerText('SAFE', { y: 152, size: 44, width: 118, fill: C.cream, outline: C.beans }),
  affordable: () => `<ellipse cx="100" cy="100" rx="90" ry="74" fill="${C.orange}"/>${coin(100, 72, 28)}` +
    stickerText('AFFORDABLE', { y: 128, size: 27, width: 148, fill: C.cream, outline: C.tomato }),
  nutritious: () => `<circle cx="100" cy="100" r="86" fill="${C.crate}"/>${grapes(100, 82, 0.95)}` +
    stickerText('NUTRITIOUS', { y: 142, size: 25, width: 136, fill: C.cream }),
  fresh: () => `<path d="M 26 150 C 6 120 44 46 112 28 C 150 18 176 26 184 40 C 194 64 168 136 98 166 C 62 181 36 168 26 150 Z" fill="${C.citrus}"/>` +
    `<path d="M 26 150 L 14 166 M 184 40 L 194 26" stroke="${C.citrus}" stroke-width="14" stroke-linecap="round"/>` +
    stickerText('FRESH', { y: 100, size: 50, width: 132, fill: C.crate, outline: C.cream, rotate: -34 }),
  local: () => `<ellipse cx="100" cy="100" rx="90" ry="72" fill="${C.tomato}"/>${orangeFruit(64, 118, 32)}` +
    stickerText('LOCAL!', { x: 112, y: 70, size: 40, width: 130, fill: C.citrus, outline: C.crate, rotate: -10 }),
  'in-season': () => `<circle cx="100" cy="100" r="86" fill="${C.crate}"/>` +
    stickerText('IN', { y: 50, size: 32, fill: C.cream }) + stickerText('SEASON!', { y: 86, size: 38, width: 136, fill: C.cream }) +
    watermelon(100, 118, 0.95),
  'just-picked': () => `<path d="M 100 16 C 114 16 192 150 182 168 C 175 182 25 182 18 168 C 8 150 86 16 100 16 Z" fill="${C.citrus}"/>${strawberry(100, 92, 0.95)}` +
    stickerText('JUST PICKED', { y: 156, size: 25, width: 134, fill: C.tomato, outline: C.cream }),
  speak: () => `<rect x="10" y="44" width="180" height="112" rx="30" fill="${C.tomato}"/>` +
    stickerText('SPEAK', { y: 100, size: 58, width: 150, fill: C.citrus, outline: C.crate }),
  your: () => `<ellipse cx="100" cy="100" rx="88" ry="64" fill="${C.citrus}"/>` +
    stickerText('YOUR', { y: 100, size: 58, width: 128, fill: C.crate, outline: C.cream, rotate: -8 }),
  mind: () => `<rect x="12" y="46" width="176" height="108" rx="46" fill="${C.beans}" stroke="${C.orange}" stroke-width="8"/>` +
    stickerText('MIND', { y: 100, size: 58, width: 128, fill: C.citrus, outline: C.ink }),
  crisp: () => `<ellipse cx="100" cy="100" rx="90" ry="76" fill="${C.crate}"/>` +
    stickerText('CRISP', { y: 66, size: 46, width: 126, fill: C.cream, rotate: -6 }) + grapes(100, 128, 0.82),
  'u-pick': () => `<rect x="18" y="18" width="164" height="164" rx="40" fill="${C.lettuce}"/>` +
    stickerText('U-PICK', { y: 58, size: 40, width: 128, fill: C.beans, outline: C.cream }) + cherries(100, 118, 1),
  'on-sale': () => `<circle cx="100" cy="100" r="86" fill="${C.tomato}"/>${coin(100, 70, 26)}` +
    stickerText('ON SALE!', { y: 132, size: 36, width: 140, fill: C.citrus, outline: C.crate, rotate: -6 }),
  'farm-fresh': () => `<ellipse cx="100" cy="100" rx="90" ry="74" fill="${C.lettuce}"/>${apple(100, 70, 0.95)}` +
    stickerText('FARM FRESH', { y: 134, size: 28, width: 146, fill: C.cream, outline: C.beans })
};

function stickerSvg(name) {
  const draw = STICKERS[name];
  if (!draw) return '';
  // The cream outline is drawn by stroking a copy of the shapes, so every sticker gets a die-cut edge.
  const art = draw();
  return `<svg viewBox="-12 -12 224 224" aria-hidden="true" focusable="false">` +
    `<g class="sticker-edge">${art}</g><g>${art}</g></svg>`;
}

function fillStickers(root = document) {
  root.querySelectorAll('.sticker[data-sticker]:not([data-drawn])').forEach((spot) => {
    spot.innerHTML = stickerSvg(spot.dataset.sticker);
    spot.setAttribute('aria-hidden', 'true');
    spot.dataset.drawn = 'true';
  });
}

function placeStickers() {
  STICKER_SPOTS.forEach(({ section, stickers }) => {
    const host = document.querySelector(section);
    if (!host) return;
    host.classList.add('has-stickers');
    stickers.forEach((item) => {
      const spot = document.createElement('span');
      spot.className = item.phone === false ? 'sticker sticker-spot sticker-wide-only' : 'sticker sticker-spot';
      spot.dataset.sticker = item.name;
      ['top', 'right', 'bottom', 'left'].forEach((side) => { if (item[side]) spot.style[side] = item[side]; });
      spot.style.setProperty('--rotate', `${item.rotate || 0}deg`);
      host.appendChild(spot);
    });
  });
  fillStickers();
}

// script.js announces "sections:loaded" once every section is on the page.
document.addEventListener('sections:loaded', placeStickers);
