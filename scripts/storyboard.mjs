#!/usr/bin/env node
// Optional step: a storyboard page (one card per scene) drawn in the chosen theme.
// Usage: node storyboard.mjs <project> [--out storyboard.html]
// (c) Ritu Dadhwal — MIT
import fs from 'node:fs';
import path from 'node:path';
import { args, loadStory, resolveStory, RUNTIME_SRC, jsonForScript, esc, THEMES } from './lib.mjs';
import { PAGE_HEAD } from './pages.mjs';

const a = args();
const dir = path.resolve(a._[0] || '.');
const story = loadStory(dir);
const r = resolveStory(story, dir);
const portrait = r.format === 'portrait';
const themeName = (THEMES.find((t) => t.id === r.themeId) || { name: 'Custom colours' }).name;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const cards = r.scenes.map((sc, i) => {
  const d = sc.end - sc.start;
  const what = sc.note || autoNote(sc);
  const tags = [sc.bg && sc.bg !== 'plain' ? sc.bg : null, ...(sc.props || []).map((p) => p.type)].filter(Boolean);
  return `<article class="item${portrait ? ' portrait' : ''}">
  <div class="frame"><canvas data-i="${i}" width="${portrait ? 540 : 960}" height="${portrait ? 960 : 540}" aria-label="Scene ${i + 1} frame"></canvas></div>
  <div class="notes">
    <div class="num">SCENE ${i + 1}<b>${fmt(sc.start)}–${fmt(sc.end)} · ${d.toFixed(1)}s</b></div>
    <p class="say">“${esc(sc.line || '(no narration)')}”</p>
    <p class="what">${esc(what)}</p>
    ${tags.length ? `<div class="tags">${[...new Set(tags)].map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
  </div>
</article>`;
}).join('\n');

function autoNote(sc) {
  const who = (sc.actors || []).map((x) => x.id).join(', ');
  const bub = (sc.bubbles || []).map((b) => `${b.actor || 'someone'} says “${b.text}”`).join('; ');
  return [who && `On screen: ${who}.`, bub].filter(Boolean).join(' ');
}

const total = r.duration;
const html = `${PAGE_HEAD(esc((story.title || 'Video') + ' Storyboard'))}
<div class="wrap">
  <header>
    <div class="eyebrow">stickcast · optional step · storyboard</div>
    <h1>${esc(story.title || 'Your video')}</h1>
    <p class="lede">One card per scene, drawn in your theme. Times are ${fs.existsSync(path.join(dir, 'assets/lines.json')) ? 'from the voiceover' : 'estimated until the voiceover is made'}. Tell Claude “approved”, or say which scene to change and how.</p>
    <div class="facts"><span class="fact">${r.scenes.length} scenes</span><span class="fact">about ${fmt(total)}</span><span class="fact">${portrait ? 'Vertical 9:16' : 'Widescreen 16:9'}</span><span class="fact">Theme: ${esc(themeName)}</span><span class="fact">${r.style === 'doodle' ? 'Doodle faces' : 'Colour crew'}</span></div>
  </header>
  <div class="list">
${cards}
  </div>
  <p class="foot">Frames show each scene at its main moment. Motion, voice and captions come after approval.</p>
</div>
<script>${RUNTIME_SRC}</script>
<script>
const STORY = ${jsonForScript(r)};
function paint() {
  document.querySelectorAll('canvas[data-i]').forEach((cv) => {
    const sc = STORY.scenes[+cv.dataset.i];
    const local = sc.boardAt != null ? sc.boardAt : Math.min((sc.end - sc.start) * 0.62, 3.2);
    STICK.drawScene(cv.getContext('2d'), sc, local, STORY.theme, { format: STORY.format, style: STORY.style, faces: STORY.faces, cast: STORY.cast });
  });
}
paint();
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(paint);
</script>
`;
const out = path.resolve(a.out || path.join(dir, 'storyboard.html'));
fs.writeFileSync(out, html);
console.log(JSON.stringify({ ok: true, out, scenes: r.scenes.length, duration: +total.toFixed(1) }));
