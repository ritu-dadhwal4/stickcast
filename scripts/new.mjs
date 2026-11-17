#!/usr/bin/env node
// Create a new stickcast video project (a HyperFrames project with a story.json).
// Usage: node new.mjs <dir> [--format landscape|portrait] [--title "..."]
// (c) Ritu Dadhwal — MIT
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { args, writeJSON } from './lib.mjs';

const a = args();
const dir = path.resolve(a._[0] || 'stickcast-video');
const format = a.format === 'portrait' ? 'portrait' : 'landscape';
if (fs.existsSync(path.join(dir, 'story.json'))) { console.log(JSON.stringify({ ok: true, dir, note: 'project already exists' })); process.exit(0); }
fs.mkdirSync(path.dirname(dir), { recursive: true });
if (!fs.existsSync(path.join(dir, 'hyperframes.json'))) {
  execFileSync('npx', ['-y', 'hyperframes', 'init', path.basename(dir), '--example', 'blank', '--non-interactive', '--skip-skills', '--resolution', format === 'portrait' ? 'portrait' : 'landscape'], { cwd: path.dirname(dir), stdio: 'pipe' });
}
const story = {
  title: a.title || 'Untitled stick video',
  format, style: 'crew', theme: 'classic-crew', captions: { style: 'pop' },
  voice: { name: 'Samantha', rate: 180 },
  cast: { hero: { color: 0 } },
  scenes: [{ id: 's1', line: 'Write the first line of the script here.', bg: 'plain', actors: [{ id: 'hero', x: 0, pose: 'wave', expr: 'happy' }] }],
};
writeJSON(path.join(dir, 'story.json'), story);
console.log(JSON.stringify({ ok: true, dir, format }));
