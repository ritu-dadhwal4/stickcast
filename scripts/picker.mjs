#!/usr/bin/env node
// Build the visual theme picker page (publish it as an artifact).
// Usage: node picker.mjs [--story <project-dir>] [--scene 0] [--format landscape|portrait] [--style crew|doodle] [--out theme-picker.html]
// (c) Ritu Dadhwal — MIT
import fs from 'node:fs';
import path from 'node:path';
import { args, THEMES, RUNTIME_SRC, loadStory, resolveStory, FONT_LINK, jsonForScript, esc } from './lib.mjs';

const a = args();
let format = a.format || 'landscape', style = a.style || 'crew', cast = {}, scene, topic = '';

if (a.story) {
  const story = loadStory(a.story);
  const r = resolveStory(story, a.story);
  format = a.format || r.format; style = a.style || r.style; cast = r.cast; topic = story.title || '';
  const i = a.scene != null ? +a.scene : (story.pickerScene != null ? story.pickerScene : 0);
  scene = r.scenes[i] || r.scenes[0];
  scene = { ...scene, start: 0, end: scene.end - scene.start };
} else {
  scene = defaultScene(format);
}

function defaultScene(fmt) {
  if (fmt === 'portrait') return {
    start: 0, end: 4, bg: 'plain',
    props: [{ type: 'board', x: 0, w: 250, h: 170, lift: 160, title: 'Big Idea', lines: ['Simple', 'Fun'], in: 0 }],
    actors: [
      { id: 'a', x: -215, face: 1, pose: 'present', expr: 'happy', keys: [{ t: 1.6, pose: 'explain' }] },
      { id: 'b', x: 215, face: -1, pose: 'think', expr: 'worried', keys: [{ t: 2.2, pose: 'cheer', expr: 'laugh' }] },
    ],
    bubbles: [{ actor: 'a', text: 'Here it is!', in: 0, out: 99, size: 26, w: 220 }],
  };
  return {
    start: 0, end: 4.5, bg: 'plain',
    props: [{ type: 'board', x: 0, w: 400, h: 240, lift: 110, title: 'Your Topic', lines: ['One simple idea', 'Fun visuals', 'Real views'], in: 0 }],
    actors: [
      { id: 'd', x: -640, face: 1, pose: 'wave', expr: 'happy', color: 3 },
      { id: 'a', x: -330, face: 1, pose: 'present', expr: 'happy', color: 0, keys: [{ t: 1.5, pose: 'explain' }] },
      { id: 'b', x: 330, face: -1, pose: 'think', expr: 'worried', color: 1, keys: [{ t: 2.3, pose: 'shocked', expr: 'shocked' }] },
      { id: 'c', x: 620, face: -1, pose: 'cheer', expr: 'laugh', color: 2 },
    ],
    bubbles: [{ actor: 'a', text: "Here's the idea!", in: 0, out: 99 }],
  };
}

const themeList = THEMES.map((t) => ({ id: t.id, name: t.name, group: t.group, mode: t.mode || 'light', tags: t.tags || [], note: t.note || '', colors: t.colors || null }));
const portrait = format === 'portrait';
const out = path.resolve(a.out || 'theme-picker.html');

const html = `<title>Stickcast Theme Picker</title>
<meta name="claude:viewport-fit-sides" content="cover">
${FONT_LINK}
<style>
/* Layout: a filter bar over a wall of live preview cards; one sticky selection bar at the bottom. */
:root {
  --bg: #EEF0F3; --surface: #FFFFFF; --fg: #16181D; --muted: #5C6370; --line: #D5D9E0; --pick: #2F6BFF; --pick-soft: #E3EBFF;
  --display: 'Archivo Black', 'Arial Black', sans-serif; --body: 'Nunito', system-ui, sans-serif; --mono: ui-monospace, 'SF Mono', Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #111317; --surface: #1A1D23; --fg: #EDEFF3; --muted: #9AA3B2; --line: #2C313A; --pick: #6E9BFF; --pick-soft: #1E2A45; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #111317; --surface: #1A1D23; --fg: #EDEFF3; --muted: #9AA3B2; --line: #2C313A; --pick: #6E9BFF; --pick-soft: #1E2A45; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--body); font-size: 15px; margin: 0; }
.wrap { max-width: 1400px; margin: 0 auto; padding-block: 28px 120px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header { display: grid; gap: 10px; margin-bottom: 22px; }
.eyebrow { font-weight: 900; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
h1 { font-family: var(--display); font-weight: 400; font-size: clamp(28px, 4vw, 44px); line-height: 1.05; margin: 0; text-wrap: balance; }
.lede { color: var(--muted); max-width: 68ch; margin: 0; line-height: 1.5; font-weight: 700; }
.bar { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; margin: 6px 0 20px; }
.group { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.group > span { font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-right: 4px; }
.chip { font: inherit; font-weight: 800; font-size: 14px; color: var(--fg); background: var(--surface); border: 1.5px solid var(--line); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.chip:focus-visible, .card:focus-visible { outline: 3px solid var(--pick); outline-offset: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(${portrait ? 190 : 300}px, 1fr)); gap: 18px; }
.card { background: var(--surface); border: 2px solid var(--line); border-radius: 14px; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; text-align: left; padding: 0; font: inherit; color: inherit; }
.card[aria-checked="true"] { border-color: var(--pick); box-shadow: 0 0 0 4px var(--pick-soft); }
.card canvas { display: block; width: 100%; height: auto; aspect-ratio: ${portrait ? '9 / 16' : '16 / 9'}; max-width: 100%; }
.meta { padding: 11px 13px 13px; display: grid; gap: 7px; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.name { font-weight: 900; font-size: 16px; line-height: 1.2; }
.mode { font-size: 11px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.id { font-family: var(--mono); font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.sw { display: flex; height: 14px; border-radius: 4px; overflow: hidden; border: 1px solid var(--line); }
.sw i { flex: 1; }
.custom { border-style: dashed; padding: 18px; gap: 10px; justify-content: center; cursor: default; }
.custom code { font-family: var(--mono); font-size: 12.5px; background: var(--bg); padding: 8px 10px; border-radius: 8px; overflow-wrap: anywhere; }
.pickbar { position: fixed; left: 0; right: 0; bottom: 0; background: var(--fg); color: var(--bg); padding: 14px max(16px, env(safe-area-inset-right, 0px)) calc(14px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: center; font-weight: 800; }
.pickbar b { font-family: var(--display); font-weight: 400; }
.pickbar code { font-family: var(--mono); background: rgba(127,127,127,0.25); padding: 4px 9px; border-radius: 6px; }
.pickbar button { font: inherit; font-weight: 900; background: var(--pick); color: #fff; border: 0; border-radius: 999px; padding: 8px 18px; cursor: pointer; }
.empty { color: var(--muted); font-weight: 800; }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">stickcast · step 2 · ${portrait ? 'vertical 9:16' : 'widescreen 16:9'}${topic ? ' · ' + esc(topic) : ''}</div>
    <h1>Pick your colour theme</h1>
    <p class="lede">Every card is ${a.story ? 'a scene from your script' : 'the same sample scene'}, drawn exactly as it will look in the video: background, characters, speech bubble and caption colour. Hover a card to see it move. Click one, then tell Claude its name.</p>
  </header>
  <div class="bar">
    <div class="group" role="group" aria-label="Filter themes"><span>Show</span>
      <button class="chip" data-f="all" aria-pressed="true">All</button>
      <button class="chip" data-f="classic" aria-pressed="false">Classic looks</button>
      <button class="chip" data-f="light" aria-pressed="false">Light palettes</button>
      <button class="chip" data-f="dark" aria-pressed="false">Dark palettes</button>
      <button class="chip" data-f="bw" aria-pressed="false">Black &amp; white</button>
    </div>
    <div class="group" role="group" aria-label="Character style"><span>Characters</span>
      <button class="chip" data-s="crew" aria-pressed="${style === 'crew'}">Colour crew</button>
      <button class="chip" data-s="doodle" aria-pressed="${style === 'doodle'}">Doodle faces</button>
    </div>
  </div>
  <div class="grid" id="grid" role="radiogroup" aria-label="Themes"></div>
</div>
<div class="pickbar" id="pickbar" aria-live="polite"><span class="empty" id="pickmsg">No theme picked yet. Click a card.</span></div>

<script>${RUNTIME_SRC}</script>
<script>
const THEMES = ${jsonForScript(THEMES)};
STICK.THEMES = THEMES;
const LIST = ${jsonForScript(themeList)};
const SCENE = ${jsonForScript(scene)};
const CAST = ${jsonForScript(cast)};
const FORMAT = ${JSON.stringify(format)};
let STYLE = ${JSON.stringify(style)};
let FILTER = 'all', PICKED = null;
const W = FORMAT === 'portrait' ? 405 : 640, H = FORMAT === 'portrait' ? 720 : 360;
const DUR = Math.max(2, (SCENE.end || 4) - (SCENE.start || 0));
const REST = Math.min(DUR * 0.55, 2.2);
const grid = document.getElementById('grid');
const cards = [];

function capMock(g, th) {
  const portrait = FORMAT === 'portrait';
  const y = portrait ? H * 0.735 : H * 0.905, size = portrait ? 30 : 30;
  const words = ['THIS', 'IS', 'YOUR', 'VIDEO'];
  g.save(); g.font = '900 ' + size + 'px "Poppins", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const space = size * 0.5; const ws = words.map(w => g.measureText(w).width); const total = ws.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let x = (W - total) / 2;
  words.forEach((w, i) => { g.lineWidth = size * 0.3; g.strokeStyle = th.cap.stroke; g.strokeText(w, x, y); g.fillStyle = i === 2 ? th.cap.hi : th.cap.text; g.fillText(w, x, y); x += ws[i] + space; });
  g.restore();
}
function draw(c, t) {
  const g = c.ctx;
  STICK.drawScene(g, SCENE, t, c.theme.id, { format: FORMAT, style: STYLE, cast: CAST });
  capMock(g, STICK.makeTheme(c.theme.id));
}
function matches(t) {
  if (FILTER === 'all') return true;
  if (FILTER === 'classic') return t.group === 'classic';
  if (FILTER === 'bw') return t.tags.includes('black-white');
  return t.group === 'palette' && t.mode === FILTER;
}
function render() {
  cards.forEach(c => { c.el.hidden = !matches(c.theme); if (!c.el.hidden) draw(c, REST); });
}
LIST.forEach((t) => {
  const th = STICK.makeTheme(t.id);
  const el = document.createElement('button');
  el.className = 'card'; el.type = 'button'; el.setAttribute('role', 'radio'); el.setAttribute('aria-checked', 'false');
  el.setAttribute('aria-label', t.name + ' theme');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const sw = [th.bg, th.ink, ...th.crew.slice(0, 5)].map(x => '<i style="background:' + x + '"></i>').join('');
  el.innerHTML = '<div class="meta"><div class="row"><span class="name"></span><span class="mode"></span></div><div class="sw">' + sw + '</div><div class="id"></div></div>';
  el.prepend(cv);
  el.querySelector('.name').textContent = t.name;
  el.querySelector('.mode').textContent = t.group === 'classic' ? 'Classic' : (t.mode === 'dark' ? 'Dark' : 'Light');
  el.querySelector('.id').textContent = t.id;
  const c = { el, theme: t, ctx: cv.getContext('2d'), raf: 0 };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.addEventListener('mouseenter', () => { if (reduce) return; const t0 = performance.now(); const loop = (now) => { draw(c, ((now - t0) / 1000) % DUR); c.raf = requestAnimationFrame(loop); }; c.raf = requestAnimationFrame(loop); });
  el.addEventListener('mouseleave', () => { cancelAnimationFrame(c.raf); draw(c, REST); });
  el.addEventListener('click', () => pick(c));
  grid.appendChild(el); cards.push(c);
});
const custom = document.createElement('div');
custom.className = 'card custom';
custom.innerHTML = '<div class="name">Use your own colours</div><div class="lede" style="font-size:14px">Paste any hex colours from a brand kit or a palette site, lightest or darkest first does not matter. Add <b>:dark</b> for a dark background.</div><code>theme: #0E0E0E,#F36363,#41D2EF,#FCB404:dark</code>';
grid.appendChild(custom);

function pick(c) {
  PICKED = c;
  cards.forEach(x => x.el.setAttribute('aria-checked', String(x === c)));
  const bar = document.getElementById('pickbar');
  const reply = 'theme: ' + c.theme.id;
  bar.innerHTML = '<span>Picked <b></b></span><code></code><button type="button" id="copy">Copy reply for Claude</button>';
  bar.querySelector('b').textContent = c.theme.name;
  bar.querySelector('code').textContent = reply;
  bar.querySelector('#copy').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy reply for Claude'), 1600); };
    try { navigator.clipboard.writeText(reply).then(done, () => { selectCode(); }); } catch (err) { selectCode(); }
  });
}
function selectCode() { const code = document.querySelector('#pickbar code'); const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
document.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { FILTER = b.dataset.f; document.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render(); }));
document.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { STYLE = b.dataset.s; document.querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render(); }));
render();
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(render);
</script>
`;
fs.writeFileSync(out, html);
console.log(JSON.stringify({ ok: true, out, themes: themeList.length, format, style }));
