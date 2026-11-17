#!/usr/bin/env node
// Screenshot a local HTML file with headless Chrome. Usage: node shot.mjs <file.html> <out.png> [width] [height] [waitMs]
// (c) Ritu Dadhwal — MIT
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const CHROMES = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
export function shot(file, out, w = 1280, h = 720, wait = 4000) {
  const chrome = CHROMES.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH to your Chrome or Chromium binary.');
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${h}`, `--virtual-time-budget=${wait}`, '--force-device-scale-factor=1', `--screenshot=${path.resolve(out)}`, 'file://' + path.resolve(file)], { stdio: 'pipe' });
  return path.resolve(out);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [f, o, w, h, wt] = process.argv.slice(2);
  console.log(shot(f, o, +(w || 1280), +(h || 720), +(wt || 4000)));
}
