// Marisol Heat — entrypoint for make.fun's gta6-01 bounty (Node 22, standard
// library only). The game itself is this directory's game/ folder: plain static
// files a desktop browser loads fully offline (game/index.html and its ES
// modules, no library, no network request). This program hands the game in: it
// first checks the package is whole — the page, a legal set of screenshots,
// nothing oversized — then copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const SCREENSHOT_MAX_BYTES = 262144; // 256 KiB, the scorer's per-image cap.
const GAME_MAX_BYTES = 50331648; // 48 MiB, the scorer's cap on game/ in all.

function fail(message) {
  throw new Error(`marisol-heat: ${message}`);
}

/** Every file under a directory, as paths relative to it, in stable order. */
function listFiles(root, prefix = '') {
  const names = readdirSync(root, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  const files = [];
  for (const entry of names) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(join(root, entry.name), rel));
    else if (entry.isFile()) files.push(rel);
  }
  return files;
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

if (!existsSync(join(gameDir, 'index.html'))) {
  fail('game/index.html is missing — the game cannot start without its page');
}
if (!existsSync(shotsDir)) {
  fail('screenshots/ is missing — the entry must carry 3 or 4 screenshots of the game');
}

const gameFiles = listFiles(gameDir);
let gameBytes = 0;
for (const rel of gameFiles) {
  if (Buffer.byteLength(rel) > 1000) fail(`game/${rel} has a path over 1000 bytes`);
  gameBytes += statSync(join(gameDir, rel)).size;
}
if (gameFiles.length > 993) fail(`game/ holds ${gameFiles.length} files, over the 993 cap`);
if (gameBytes > GAME_MAX_BYTES) fail(`game/ totals ${gameBytes} bytes, over the 48 MiB cap`);

const shotFiles = readdirSync(shotsDir)
  .filter((name) => /\.(png|jpe?g)$/i.test(name))
  .sort();
if (shotFiles.length < 3 || shotFiles.length > 4) {
  fail(`screenshots/ must hold 3 or 4 images, found ${shotFiles.length}`);
}
for (const name of shotFiles) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > SCREENSHOT_MAX_BYTES) fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
}

console.log(`marisol-heat: game/ ${gameFiles.length} files, ${gameBytes} bytes`);
console.log(`marisol-heat: screenshots/ ${shotFiles.join(', ')}`);

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('marisol-heat: dossier.json written');
