#!/usr/bin/env node
// YouTube thumbnail (1280x720, or 1080x1920 cover for Shorts) drawn in the video's theme.
// Usage: node thumbnail.mjs <project> --text "I SAVED *$10,000*" [--scene 2] [--at 2.5] [--zoom 1.35] [--x 0] [--y 0] [--expr shocked] [--hide counter] [--side left|right] [--landscape] [--out thumbnail.png]
// Wrap a word in *stars* to colour it with the theme highlight.
// (c) Ritu Dadhwal — MIT
import fs from 'node:fs';
import path from 'node:path';
import { args, loadStory, resolveStory, RUNTIME_SRC, jsonForScript, esc, FONT_LINK } from './lib.mjs';
import { shot } from './shot.mjs';

const a = args();
const dir = path.resolve(a._[0] || '.');
const story = loadStory(dir);
const r = resolveStory(story, dir);
const th = story.thumbnail || {};
const portrait = a.portrait != null ? true : (r.format === 'portrait' && th.portrait !== false && a.landscape == null);
const W = portrait ? 1080 : 1280, H = portrait ? 1920 : 720;
const si = +(a.scene ?? th.scene ?? 0);
const sc = r.scenes[si] || r.scenes[0];
const at = +(a.at ?? th.at ?? Math.min((sc.end - sc.start) * 0.6, 3));
const zoom = +(a.zoom ?? th.zoom ?? (portrait ? 1.1 : 1.15));
const side = a.side || th.side || 'left';
const camX = +(a.x ?? th.x ?? (portrait ? 0 : side === 'left' ? -300 : 300));
const camY = +(a.y ?? th.y ?? (portrait ? -330 : 30));
const exprAll = a.expr || th.expr || null;
const hide = String(a.hide ?? (th.hide || []).join(',')).split(',').filter(Boolean);
const raw = String(a.text || th.text || story.title || 'WATCH THIS');
const textHtml = esc(raw).replace(/\*(.+?)\*/g, '<em>$1</em>');
const t = r.theme;
const plain = raw.replace(/\*/g, '');
const fsz = Math.round(Math.max(portrait ? 90 : 68, Math.min(portrait ? 130 : 110, (portrait ? 170 : 150) - plain.length * 1.7)));
const scene = { ...sc, props: (sc.props || []).filter((p) => !hide.includes(p.type)), bubbles: a.bubbles === 'off' ? [] : sc.bubbles, start: 0, end: sc.end - sc.start, title: undefined, cam: { zoom: [zoom, zoom], x: [camX, camX], y: [camY, camY] } };
if (exprAll) scene.actors = (scene.actors || []).map((x) => ({ ...x, expr: exprAll, keys: (x.keys || []).map((k) => ({ ...k, expr: undefined })) }));

const html = `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}
<style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${t.bg}}
canvas{position:absolute;inset:0}
.t{position:absolute;${portrait ? 'left:60px;right:60px;top:120px;text-align:center' : side === 'left' ? 'left:56px;top:48px;width:620px;text-align:left' : 'right:56px;top:48px;width:620px;text-align:right'};
font-family:'Archivo Black',sans-serif;font-size:${fsz}px;line-height:0.98;text-transform:uppercase;color:${t.cap.text};
-webkit-text-stroke:${portrait ? 22 : 18}px ${t.cap.stroke};paint-order:stroke fill;filter:drop-shadow(0 10px 0 rgba(0,0,0,0.28));letter-spacing:-0.01em}
.t em{font-style:normal;color:${t.cap.hi}}
</style></head><body>
<canvas id="c" width="${W}" height="${H}"></canvas>
<div class="t">${textHtml}</div>
<script>${RUNTIME_SRC}</script>
<script>
const S=${jsonForScript(scene)}, TH=${jsonForScript(t)}, O=${jsonForScript({ format: portrait ? 'portrait' : 'landscape', style: r.style, faces: r.faces, cast: r.cast })};
function p(){STICK.drawScene(document.getElementById('c').getContext('2d'),S,${at},TH,O);}
p(); document.fonts.ready.then(p);
</script></body></html>`;
const htmlOut = path.join(dir, 'thumbnail.html');
fs.writeFileSync(htmlOut, html);
const png = path.resolve(a.out || path.join(dir, 'thumbnail.png'));
shot(htmlOut, png, W, H, 5000);
console.log(JSON.stringify({ ok: true, png, html: htmlOut, size: `${W}x${H}` }));
