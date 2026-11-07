// Generates every raster brand asset from the geometry below, so the icons in
// the extension and the README logo can never drift apart.
// Run with `pnpm brand`. Output is committed.
import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas, encodePng } from './raster.mjs';

export const BRAND = {
  name: 'YouTube Triage',
  ink: '#16161A',
  accent: '#F97316',
  light: '#FFFFFFED',
};

// A card stack: two cards peeking behind a front card that carries one accent
// dot. Same tile-plus-one-highlight construction as the sibling extensions.
const BACK = [
  { x: 38, y: 24, w: 52, h: 14, r: 6, opacity: '4D' },
  { x: 30, y: 33, w: 68, h: 14, r: 7, opacity: '99' },
];
const FRONT = { x: 22, y: 44, w: 84, h: 60, r: 12 };
const DOT = { cx: 64, cy: 74, r: 13 };

function drawMark(canvas) {
  const k = canvas.size / 128;
  canvas.roundRect(0, 0, canvas.size, canvas.size, 28.57 * k, BRAND.ink);
  for (const c of BACK)
    canvas.roundRect(c.x * k, c.y * k, c.w * k, c.h * k, c.r * k, `#FFFFFF${c.opacity}`);
  canvas.roundRect(FRONT.x * k, FRONT.y * k, FRONT.w * k, FRONT.h * k, FRONT.r * k, BRAND.light);
  canvas.circle(DOT.cx * k, DOT.cy * k, DOT.r * k, BRAND.accent);
  return canvas;
}

export function icon(size) {
  return encodePng(drawMark(createCanvas(size)).toRGBA(), size);
}

const rect = ({ x, y, w, h, r }, fill, opacity = 0.93) =>
  `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" fill-opacity="${opacity}"/>`;

export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="${BRAND.name}">
  <rect width="128" height="128" rx="28.57" fill="${BRAND.ink}"/>
${BACK.map((c) => rect(c, '#ffffff', (parseInt(c.opacity, 16) / 255).toFixed(2))).join('\n')}
${rect(FRONT, '#ffffff')}
  <circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="${BRAND.accent}"/>
</svg>
`;

const SIZES = [16, 32, 48, 128];

await mkdir('public', { recursive: true });
await mkdir('brand', { recursive: true });
for (const size of SIZES) await writeFile(`public/icon-${size}.png`, icon(size));
await writeFile('brand/logo.svg', LOGO_SVG);
console.log(`Brand assets: ${SIZES.map((s) => `icon-${s}.png`).join(', ')} + brand/logo.svg`);
