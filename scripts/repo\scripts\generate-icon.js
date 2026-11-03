'use strict';

/**
 * Generates the Marketplace icon (media/icon.png) from the project's SVG
 * (media/bookmark.svg). The Marketplace / vsce reject SVG for the `icon`
 * field, so the SVG stays the single source asset and this PNG is derived
 * from it on every `vsce package` / `vsce publish` (via `vscode:prepublish`).
 *
 * The Activity Bar SVG is light grey (#C5C5C5) on transparent, which would be
 * nearly invisible on the Marketplace's white page, so it is rendered onto a
 * dark rounded plate (matching galleryBanner.color in package.json).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let Resvg;
try {
  ({ Resvg } = require('@resvg/resvg-js'));
} catch {
  // Not installed (npm install was not run). Keep the committed PNG instead of failing the packaging.
  if (fs.existsSync(path.join(root, 'media', 'icon.png'))) {
    console.warn('generate-icon: @resvg/resvg-js not installed; keeping the existing media/icon.png (run npm install to regenerate it from the SVG).');
    process.exit(0);
  }
  throw new Error('generate-icon: run "npm install" first (needs @resvg/resvg-js to render media/icon.png from media/bookmark.svg).');
}
const svgPath = path.join(root, 'media', 'bookmark.svg');
const pngPath = path.join(root, 'media', 'icon.png');

const SIZE = 256; // Marketplace minimum is 128x128; 256 keeps it sharp on HiDPI
const PLATE = '#1e1e1e';
const PADDING = 0.16; // fraction of the canvas left empty around the glyph

const source = fs.readFileSync(svgPath, 'utf8');
const inner = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const viewBox = (source.match(/viewBox="([^"]+)"/) || [, '0 0 24 24'])[1].split(/\s+/).map(Number);
const [vx, vy, vw, vh] = viewBox;

const pad = SIZE * PADDING;
const scale = (SIZE - 2 * pad) / Math.max(vw, vh);
const tx = (SIZE - vw * scale) / 2 - vx * scale;
const ty = (SIZE - vh * scale) / 2 - vy * scale;

const composed =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
  `<rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 0.18}" fill="${PLATE}"/>` +
  `<g transform="translate(${tx} ${ty}) scale(${scale})">${inner}</g></svg>`;

const png = new Resvg(composed, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();
fs.writeFileSync(pngPath, png);
console.log(`Generated ${path.relative(root, pngPath)} (${SIZE}x${SIZE}, ${png.length} bytes) from ${path.relative(root, svgPath)}`);
