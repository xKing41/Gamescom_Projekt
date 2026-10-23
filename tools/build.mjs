// Packt das ganze Spiel in eine Datei: dist/hort.html (doppelklicken und spielen)
// und dist/artifact.html (dasselbe ohne Dokumentgerüst, zum Veröffentlichen als Claude-Artifact).

import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
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
