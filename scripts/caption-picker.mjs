#!/usr/bin/env node
// Caption style picker page: the same frame with each caption style playing over it, in the chosen theme.
// Usage: node caption-picker.mjs <project> [--out caption-styles.html]
// (c) Ritu Dadhwal — MIT
import fs from 'node:fs';
import path from 'node:path';
import { args, loadStory, resolveStory, RUNTIME_SRC, jsonForScript, esc, dims } from './lib.mjs';
import { CAPTION_STYLES, captionCSS, displayWord } from './captions.mjs';
import { PAGE_HEAD } from './pages.mjs';

const a = args();
const dir = path.resolve(a._[0] || '.');
const story = loadStory(dir);
const r = resolveStory(story, dir);
const { W, H } = dims(r.format);
const portrait = r.format === 'portrait';
const styles = ['pop', 'boxed', 'karaoke', 'subtitle'];
const sc = r.scenes[0];
const words = (sc.words || []).slice(0, 9).map((w) => w.text);
if (!words.length) words.push('This', 'is', 'how', 'your', 'captions', 'will', 'look');

const css = styles.map((s) => captionCSS(r.theme, r.format, `.f-${s} .cap`)).join('\n');
const cards = styles.map((s, i) => {
  const spec = CAPTION_STYLES[s];
  return `<article class="item${portrait ? ' portrait' : ''}">
  <div class="frame f-${s}" data-style="${s}">
    <div class="inner" style="width:${W}px;height:${H}px">
      <canvas width="${W}" height="${H}" aria-hidden="true"></canvas>
      <div class="cap ${s}"><span class="cgi"></span></div>
    </div>
  </div>
  <div class="notes">
    <div class="num">OPTION ${i + 1}<b>${esc(s)}</b></div>
    <p class="say">${esc(spec.name)}</p>
    <p class="what">${esc(spec.about)}</p>
    <div class="tags"><span class="tag">${spec.words[0]}–${spec.words[1]} words at a time</span></div>
  </div>
</article>`;
}).join('\n');

const html = `${PAGE_HEAD(esc((story.title || 'Video') + ' Caption Styles'))}
<style>
.frame { overflow: hidden; aspect-ratio: ${portrait ? '9 / 16' : '16 / 9'}; max-width: 100%; }
.frame .inner { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.frame canvas { position: absolute; inset: 0; width: ${W}px; height: ${H}px; }
${css}
</style>
<div class="wrap">
  <header>
    <div class="eyebrow">stickcast · step 5 · captions</div>
    <h1>Pick a caption style</h1>
    <p class="lede">Each frame plays the first line of your script in that style, in your theme colours. Tell Claude the option name, for example “captions: pop”, or say “no captions”.</p>
  </header>
  <div class="list">
${cards}
  </div>
</div>
<script>${RUNTIME_SRC}</script>
<script>
const STORY = ${jsonForScript(r)};
const WORDS = ${jsonForScript(words)};
const GROUP = { pop: 3, boxed: 4, karaoke: 6, subtitle: 9 };
const HI = ${JSON.stringify(r.theme.cap.hi)}, TXT = ${JSON.stringify(r.theme.cap.text)};
const disp = (w, s) => s === 'pop' ? w.replace(/[.,;:]+$/g, '') : w;
const frames = [...document.querySelectorAll('.frame')];
function fit() { frames.forEach((f) => { const k = f.clientWidth / ${W}; f.querySelector('.inner').style.transform = 'scale(' + k + ')'; }); }
function paint() {
  const sc = STORY.scenes[0];
  const t = Math.min((sc.end - sc.start) * 0.6, 3);
  frames.forEach((f) => STICK.drawScene(f.querySelector('canvas').getContext('2d'), sc, t, STORY.theme, { format: STORY.format, style: STORY.style, faces: STORY.faces, cast: STORY.cast }));
}
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let tick = 0;
function step() {
  frames.forEach((f) => {
    const s = f.dataset.style, n = GROUP[s], groups = [];
    for (let i = 0; i < WORDS.length; i += n) groups.push(WORDS.slice(i, i + n));
    const total = WORDS.length + groups.length;
    const k = tick % total;
    let acc = 0, gi = 0, wi = 0;
    for (gi = 0; gi < groups.length; gi++) { if (k < acc + groups[gi].length + 1) { wi = k - acc; break; } acc += groups[gi].length + 1; }
    gi = Math.min(gi, groups.length - 1);
    const el = f.querySelector('.cgi');
    el.innerHTML = '';
    groups[gi].forEach((w, j) => {
      const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = disp(w, s);
      const active = reduce ? j === 1 : j === wi, past = reduce ? j < 1 : j < wi;
      if (s === 'pop' && active) { sp.style.color = HI; sp.style.transform = 'translateY(-6px)'; }
      if (s === 'boxed') sp.style.opacity = (active || past) ? 1 : 0.28;
      if (s === 'karaoke' && (active || past)) sp.style.color = HI;
      el.appendChild(sp);
    });
  });
  tick++;
}
fit(); paint(); step();
window.addEventListener('resize', fit);
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { paint(); fit(); });
if (!reduce) setInterval(step, 380);
</script>
`;
const out = path.resolve(a.out || path.join(dir, 'caption-styles.html'));
fs.writeFileSync(out, html);
console.log(JSON.stringify({ ok: true, out, styles }));
