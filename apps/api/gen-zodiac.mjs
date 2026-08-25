// Generator statycznych ilustracji konstelacyjnych 12 znaków zodiaku.
// Uruchomienie: node gen-zodiac.mjs  (z katalogu apps/api)
// Wynik: public/uploads/zodiac-<slug>-profile.webp (1200x800 webp)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const W = 1200;
const H = 800;
const OUT = join(process.cwd(), 'public/uploads');
mkdirSync(OUT, { recursive: true });

const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hashStr = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

const SIGNS = {
  baran: { pts: [[.15,.62],[.38,.45],[.62,.52],[.85,.35]], chain: true },
  byk:   { pts: [[.28,.28],[.40,.50],[.50,.58],[.60,.50],[.72,.28]], chain: true },
  bliznieta: { pts: [[.35,.25],[.32,.45],[.34,.65],[.36,.82],[.63,.80],[.61,.62],[.64,.42],[.62,.22]], edges: [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[1,6]] },
  rak:   { pts: [[.35,.28],[.52,.45],[.69,.26],[.55,.66],[.75,.78]], edges: [[0,1],[2,1],[1,3],[3,4]] },
  lew:   { pts: [[.30,.30],[.24,.42],[.30,.54],[.42,.58],[.66,.50],[.72,.74]], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,3]] },
  panna: { pts: [[.25,.30],[.38,.44],[.52,.40],[.66,.52],[.62,.72],[.30,.62],[.80,.36]], edges: [[0,1],[1,2],[2,3],[3,4],[1,5],[3,6]] },
  waga:  { pts: [[.50,.25],[.34,.55],[.66,.55],[.28,.78],[.72,.78]], edges: [[0,1],[0,2],[1,2],[1,3],[2,4]] },
  skorpion: { pts: [[.25,.30],[.32,.45],[.42,.56],[.55,.63],[.68,.66],[.78,.60],[.84,.46],[.78,.36],[.16,.18],[.12,.30]], edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[0,8],[0,9]] },
  strzelec: { pts: [[.35,.40],[.52,.35],[.60,.50],[.45,.58],[.32,.52],[.70,.30],[.30,.28]], edges: [[0,1],[1,2],[2,3],[3,4],[4,0],[1,5],[0,6]] },
  koziorozec: { pts: [[.22,.35],[.38,.55],[.52,.62],[.66,.55],[.80,.32]], chain: true },
  wodnik: { pts: [[.25,.35],[.38,.42],[.50,.34],[.62,.42],[.74,.34],[.36,.66],[.64,.66]], edges: [[0,1],[1,2],[2,3],[3,4],[1,5],[3,6]] },
  ryby:  { pts: [[.22,.30],[.30,.24],[.36,.32],[.28,.40],[.66,.58],[.76,.54],[.80,.64],[.70,.70]], edges: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[3,4]] },
};

function svgFor(slug) {
  const rand = mulberry32(hashStr(slug));
  const nebula = (cx, cy, r, color, op) =>
    `<radialGradient id="n${cx}${cy}" cx="50%" cy="50%" r="50%">
       <stop offset="0%" stop-color="${color}" stop-opacity="${op}"/>
       <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
     </radialGradient>
     <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#n${cx}${cy})"/>`;

  let defs = '', bodies = '';
  // Nebule
  const nx1 = 200 + rand() * 300, ny1 = 150 + rand() * 200;
  const nx2 = 700 + rand() * 350, ny2 = 420 + rand() * 250;
  defs += `<radialGradient id="bg" cx="50%" cy="0%" r="130%"><stop offset="0%" stop-color="#231a4f"/><stop offset="45%" stop-color="#141033"/><stop offset="100%" stop-color="#070714"/></radialGradient>`;
  bodies += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
  bodies += nebula(nx1.toFixed(0), ny1.toFixed(0), 380, '#7c3aed', .16);
  bodies += nebula(nx2.toFixed(0), ny2.toFixed(0), 320, '#d4af37', .10);

  // Gwiazdy tła
  for (let i = 0; i < 110; i++) {
    const x = (rand() * W).toFixed(1), y = (rand() * H).toFixed(1);
    const r = (.5 + rand() * 1.4).toFixed(2), o = (.2 + rand() * .7).toFixed(2);
    bodies += `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${o}"/>`;
  }

  // Konstelacja
  const cfg = SIGNS[slug];
  const bx = 330, by = 190, bw = 540, bh = 400;
  const P = cfg.pts.map(([px, py]) => [bx + px * bw, by + py * bh]);
  const edges = cfg.edges ?? P.slice(0, -1).map((_, i) => [i, i + 1]);
  const linePts = edges.map(([a, b]) => `${P[a][0].toFixed(1)},${P[a][1].toFixed(1)} ${P[b][0].toFixed(1)},${P[b][1].toFixed(1)}`);
  bodies += `<polyline points="" fill="none"/>`;
  for (const pts of linePts) {
    bodies += `<polyline points="${pts}" fill="none" stroke="#e6c87a" stroke-opacity=".14" stroke-width="6"/>`;
    bodies += `<polyline points="${pts}" fill="none" stroke="#e6c87a" stroke-opacity=".55" stroke-width="1.8"/>`;
  }
  for (const [x, y] of P) {
    bodies += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#f5deb3" opacity=".16"/>`;
    bodies += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="#f5deb3" opacity=".85"/>`;
    bodies += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#ffffff"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${defs}</defs>${bodies}</svg>`;
}

const slugs = Object.keys(SIGNS);
for (const slug of slugs) {
  const out = join(OUT, `zodiac-${slug}-profile.webp`);
  await sharp(Buffer.from(svgFor(slug))).webp({ quality: 82 }).toFile(out);
  console.log('OK', out);
}
console.log('DONE', slugs.length, 'obrazów');
