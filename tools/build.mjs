// Packt das ganze Spiel in eine Datei: dist/hort.html (doppelklicken und spielen)
// und dist/artifact.html (dasselbe ohne Dokumentgerüst, zum Veröffentlichen als Claude-Artifact).
// Dazu dist/desktop/ für die Desktop-Fassung: Schriften liegen bei, nichts kommt aus dem Netz.

import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rel = (p) => path.join(root, p);

const between = (text, name) => {
  const start = text.indexOf(`<!-- ${name}:start -->`);
  const end = text.indexOf(`<!-- ${name}:end -->`);
  if (start < 0 || end < 0) throw new Error(`Markierung ${name} fehlt in index.html`);
  return text.slice(start + name.length + 15, end).trim();
};

const result = await build({
  entryPoints: [rel('src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  write: false,
  logLevel: 'warning',
});
const bundle = result.outputFiles[0].text;
const js = bundle.replace(/<\/script/gi, '<\\/script');
const css = await readFile(rel('src/style.css'), 'utf8');
const index = await readFile(rel('index.html'), 'utf8');

const head = `${between(index, 'head')}\n<style>\n${css}</style>`;
const body = `${between(index, 'markup')}\n<script>\n${js}</script>`;

await mkdir(rel('dist'), { recursive: true });
await writeFile(rel('dist/artifact.html'), `${head}\n${body}\n`);
await writeFile(
  rel('dist/hort.html'),
  `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);
console.log(`dist/hort.html gebaut (${Math.round((head.length + body.length) / 1024)} KB)`);

// ── Desktop ──

const FONTS = [
  ['Pixelify Sans', 'pixelify-sans', 400, 'normal'],
  ['Pixelify Sans', 'pixelify-sans', 500, 'normal'],
  ['Pixelify Sans', 'pixelify-sans', 600, 'normal'],
  ['Pixelify Sans', 'pixelify-sans', 700, 'normal'],
  ['Jacquard 24', 'jacquard-24', 400, 'normal'],
];
const desk = rel('dist/desktop');
await rm(desk, { recursive: true, force: true });
await mkdir(path.join(desk, 'fonts'), { recursive: true });
let faces = '';
for (const [family, pkg, weight, style] of FONTS) {
  const file = `${pkg}-latin-${weight}-${style}.woff2`;
  await copyFile(rel(`node_modules/@fontsource/${pkg}/files/${file}`), path.join(desk, 'fonts', file));
  faces += `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url("fonts/${file}") format("woff2"); }\n`;
}
// Strenge Regeln: nur eigene Dateien, Bilder aus dem Code (data:), kein Netz.
// style-src-attr erlaubt nur style-Attribute (Fortschrittsbalken, Farbmuster), kein eingebettetes CSS.
const csp = "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'";
const title = between(index, 'head').match(/<title>.*?<\/title>/)[0];
await writeFile(path.join(desk, 'hort.js'), bundle);
await writeFile(path.join(desk, 'hort.css'), `${faces}\n${css}`);
await writeFile(
  path.join(desk, 'index.html'),
  `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${title}\n<link rel="stylesheet" href="hort.css">\n</head>\n<body>\n${between(index, 'markup')}\n<script src="hort.js"></script>\n</body>\n</html>\n`,
);
console.log('dist/desktop/ gebaut');
