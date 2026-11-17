// stickcast shared helpers (Node 18+). (c) Ritu Dadhwal — MIT
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

export const THEMES = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'themes/themes.json'), 'utf8')).themes;
globalThis.STICK_THEMES = THEMES;
export const STICK = require(path.join(SKILL_DIR, 'runtime/stick.js'));
STICK.THEMES = THEMES;
export const RUNTIME_SRC = fs.readFileSync(path.join(SKILL_DIR, 'runtime/stick.js'), 'utf8');

export function args(argv = process.argv.slice(2)) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) o[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
      else o[k] = true;
    } else o._.push(a);
  }
  return o;
}

export const readJSON = (p, fb) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fb);
export const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));

export function loadStory(dir) {
  const p = path.join(dir, 'story.json');
  if (!fs.existsSync(p)) throw new Error(`No story.json in ${dir}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Build a plain theme object (serialisable) from an id, "id:dark", a hex list or an object. */
export function themeFor(def) {
  const t = STICK.makeTheme(def || 'classic-crew');
  const o = { ...t };
  delete o.__built;
  return o;
}

export const tokenize = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9%$]/g, '');

/** Words per second used before a voiceover exists. */
export const WPS = 2.6;

/**
 * Timings for each scene: { start, end, words:[{text,start,end}] } in story time.
 * Uses assets/lines.json (+ assets/transcript.json) when present, otherwise estimates.
 */
export function sceneTimings(story, dir) {
  const linesFile = dir && readJSON(path.join(dir, 'assets/lines.json'));
  const trans = dir && loadTranscript(dir);
  const out = [];
  let cursor = 0;
  story.scenes.forEach((sc, i) => {
    const words = tokenize(sc.line);
    let start, end;
    if (linesFile && linesFile.lines && linesFile.lines[i]) {
      start = linesFile.lines[i].start; end = linesFile.lines[i].end;
    } else {
      const d = sc.dur || Math.max(2.2, words.length / WPS + 0.6);
      start = cursor; end = cursor + d;
    }
    cursor = end;
    // word timing inside the scene's speech window
    const sp0 = linesFile && linesFile.lines && linesFile.lines[i] ? linesFile.lines[i].speechStart : start + 0.15;
    const sp1 = linesFile && linesFile.lines && linesFile.lines[i] ? linesFile.lines[i].speechEnd : end - 0.35;
    let wt = null;
    if (trans && trans.length) {
      const inLine = trans.filter((w) => w.start >= sp0 - 0.12 && w.start < sp1 + 0.05);
      if (inLine.length) {
        wt = words.map((text, j) => {
          const idx = Math.min(inLine.length - 1, Math.round((j * (inLine.length - 1)) / Math.max(1, words.length - 1)));
          // exact positional match when counts agree
          const tw = inLine.length === words.length ? inLine[j] : inLine[idx];
          return { text, start: tw.start, end: tw.end };
        });
        for (let j = 1; j < wt.length; j++) if (wt[j].start < wt[j - 1].start) wt[j].start = wt[j - 1].start + 0.01;
        for (let j = 0; j < wt.length; j++) if (wt[j].end <= wt[j].start) wt[j].end = (wt[j + 1] ? wt[j + 1].start : wt[j].start + 0.3);
      }
    }
    if (!wt) {
      const chars = words.map((w) => w.length + 2), total = chars.reduce((a, b) => a + b, 0) || 1;
      let acc = 0;
      wt = words.map((text, j) => {
        const a = sp0 + ((sp1 - sp0) * acc) / total; acc += chars[j];
        const b = sp0 + ((sp1 - sp0) * acc) / total;
        return { text, start: a, end: b };
      });
    }
    out.push({ start, end, words: wt });
  });
  return out;
}

export function loadTranscript(dir) {
  const p = path.join(dir, 'assets/transcript.json');
  if (!fs.existsSync(p)) return null;
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  let words = Array.isArray(raw) ? raw : raw.words || (raw.segments || []).flatMap((s) => s.words || []);
  return words
    .map((w) => ({ text: String(w.text ?? w.word ?? '').trim(), start: +(w.start ?? w.from ?? 0), end: +(w.end ?? w.to ?? 0) }))
    .filter((w) => w.text && !/^[♪�\[\(]/.test(w.text));
}

/** Resolve "@word", "@word+0.4", "@3" (word index) time references into numbers (scene-local seconds). */
function resolveRef(v, words, scStart) {
  if (typeof v !== 'string' || !v.startsWith('@')) return v;
  const m = v.slice(1).match(/^([^+\-]+)([+\-][\d.]+)?$/);
  if (!m) return 0;
  const [, ref, off] = m;
  let w;
  if (/^\d+$/.test(ref)) w = words[+ref];
  else {
    const n = norm(ref);
    w = words.find((x) => norm(x.text) === n) || words.find((x) => norm(x.text).startsWith(n));
  }
  const base = w ? w.start - scStart : 0;
  return Math.max(0, +(base + (off ? parseFloat(off) : 0)).toFixed(3));
}
const TIME_KEYS = new Set(['t', 'in', 'out', 'on', 'open', 'talk']);
function walk(o, fn) {
  if (Array.isArray(o)) return o.map((x) => walk(x, fn));
  if (o && typeof o === 'object') {
    const r = {};
    for (const k in o) r[k] = TIME_KEYS.has(k) ? fn(o[k]) : walk(o[k], fn);
    if (Array.isArray(o.flash)) r.flash = o.flash.map(fn);
    if (Array.isArray(o.reveal)) r.reveal = o.reveal.map(fn);
    if (Array.isArray(o.check)) r.check = o.check.map(fn);
    return r;
  }
  return o;
}

/** A render-ready story: numeric scene start/end, numeric times, built theme. */
export function resolveStory(story, dir) {
  const tim = sceneTimings(story, dir);
  const scenes = story.scenes.map((sc, i) => {
    const T = tim[i];
    const r = walk(sc, (v) => resolveRef(v, T.words, T.start));
    r.start = +T.start.toFixed(3); r.end = +T.end.toFixed(3);
    r.words = T.words.map((w) => ({ text: w.text, start: +w.start.toFixed(3), end: +w.end.toFixed(3) }));
    return r;
  });
  const duration = scenes.length ? scenes[scenes.length - 1].end : 5;
  return {
    title: story.title, format: story.format || 'landscape', style: story.style || 'crew',
    faces: story.faces, cast: story.cast || {}, theme: themeFor(story.theme), themeId: typeof story.theme === 'string' ? story.theme : 'custom',
    captions: story.captions || { style: 'pop' }, scenes, duration: +duration.toFixed(3),
  };
}

export function dims(format) {
  return format === 'portrait' ? { W: 1080, H: 1920 } : { W: 1920, H: 1080 };
}

export const FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Nunito:wght@600;700;800;900&family=Poppins:wght@600;700;800;900&display=swap" rel="stylesheet">';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const jsonForScript = (d) => JSON.stringify(d).replace(/</g, '\\u003c');

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
