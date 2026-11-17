// Caption styles shared by the caption picker and the final render. (c) Ritu Dadhwal — MIT

export const CAPTION_STYLES = {
  pop: { name: 'Bold Pop', words: [2, 3], about: 'Big uppercase words, thick outline, the spoken word lights up and bounces. The classic Shorts look.' },
  boxed: { name: 'Color Box', words: [3, 4], about: 'Words sit on a rounded box in your theme colour and appear one by one as they are spoken.' },
  karaoke: { name: 'Karaoke Line', words: [4, 6], about: 'A full short line stays up, and each word turns your highlight colour when it is spoken.' },
  subtitle: { name: 'Clean Subtitle', words: [6, 9], about: 'Calm sentence-case subtitles on a soft dark strip. Best for long explainers.' },
  none: { name: 'No captions', words: [0, 0], about: 'Just the animation and the voice.' },
};

const textOn = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff';
};

/** CSS for every caption style. `sel` scopes it (".cap" in the render, per-card in the picker). */
export function captionCSS(theme, format, sel = '.cap') {
  const portrait = format === 'portrait';
  const c = theme.cap;
  const pos = portrait ? 'top: 1360px;' : 'bottom: 72px;';
  const max = portrait ? 940 : 1640;
  return `
${sel} { position:absolute; left:0; right:0; ${pos} display:flex; justify-content:center; text-align:center; pointer-events:none; overflow:visible; }
${sel} .cgi { display:inline-flex; flex-wrap:wrap; justify-content:center; align-items:baseline; column-gap:0.4em; max-width:${max}px; overflow:visible; }
${sel} .w { display:inline-block; }
${sel}.pop .cgi { font-family:'Poppins', sans-serif; font-weight:900; font-size:${portrait ? 82 : 88}px; line-height:1.05; text-transform:uppercase; letter-spacing:0.01em; color:${c.text}; -webkit-text-stroke:${portrait ? 14 : 15}px ${c.stroke}; paint-order:stroke fill; filter: drop-shadow(0 6px 0 rgba(0,0,0,0.25)); }
${sel}.boxed .cgi { font-family:'Poppins', sans-serif; font-weight:800; font-size:${portrait ? 66 : 70}px; line-height:1.15; color:${c.boxText}; background:${c.box}; padding:14px 34px 18px; border-radius:26px; border:5px solid ${theme.ink === c.box ? '#111' : theme.ink}; box-shadow:0 8px 0 rgba(0,0,0,0.18); }
${sel}.boxed .w { opacity:0.28; }
${sel}.karaoke .cgi { font-family:'Poppins', sans-serif; font-weight:800; font-size:${portrait ? 64 : 68}px; line-height:1.15; color:${c.text}; -webkit-text-stroke:11px ${c.stroke}; paint-order:stroke fill; }
${sel}.subtitle .cgi { font-family:'Nunito', sans-serif; font-weight:800; font-size:${portrait ? 50 : 52}px; line-height:1.25; color:#ffffff; background:rgba(10,10,12,0.62); padding:10px 26px 12px; border-radius:14px; }
`;
}

/** Split scene words into caption groups. words: [{text,start,end}] in story time. */
export function groupWords(scenes, style) {
  const spec = CAPTION_STYLES[style] || CAPTION_STYLES.pop;
  if (!spec.words[1]) return [];
  const [lo, hi] = spec.words;
  const groups = [];
  for (const sc of scenes) {
    let cur = [];
    const flush = () => { if (cur.length) groups.push(cur); cur = []; };
    sc.words.forEach((w, i) => {
      cur.push(w);
      const next = sc.words[i + 1];
      const endSentence = /[.!?…:;]$/.test(w.text) || (/,$/.test(w.text) && cur.length >= lo);
      const pause = next && next.start - w.end >= 0.15 && cur.length >= lo;
      if (cur.length >= hi || endSentence || pause) flush();
    });
    flush();
  }
  return groups.map((ws, i) => {
    const start = Math.max(0.12, ws[0].start - 0.04);
    const nextStart = i + 1 < groups.length ? Math.max(0.12, groups[i + 1][0].start - 0.04) : Infinity;
    const end = Math.min(Math.max(ws[ws.length - 1].end + 0.2, start + 0.5), nextStart);
    return { start: +start.toFixed(3), end: +end.toFixed(3), words: ws };
  });
}

export const displayWord = (t, style) => (style === 'pop' ? t.replace(/[.,;:]+$/g, '') : t);

/** The captions sub-composition (HyperFrames scene file). */
export function captionsComposition({ groups, style, theme, format, W, H, duration }) {
  const css = captionCSS(theme, format, '.cap');
  let html = '', js = '';
  groups.forEach((g, gi) => {
    const id = `cg${gi}`;
    const dur = +(g.end - g.start).toFixed(3);
    html += `    <div id="${id}" class="clip cap ${style}" data-start="${g.start}" data-duration="${dur}" data-track-index="0"><span class="cgi" id="${id}i">` +
      g.words.map((w, wi) => `<span class="w" id="${id}w${wi}">${escapeHtml(displayWord(w.text, style))}</span>`).join('') +
      `</span></div>\n`;
    const s = g.start;
    if (style === 'pop') js += `  tl.fromTo('#${id}i',{scale:0.72,opacity:0},{scale:1,opacity:1,duration:0.16,ease:'back.out(2.4)'},${s});\n`;
    else if (style === 'boxed') js += `  tl.fromTo('#${id}i',{y:24,opacity:0},{y:0,opacity:1,duration:0.18,ease:'power3.out'},${s});\n`;
    else js += `  tl.fromTo('#${id}i',{opacity:0},{opacity:1,duration:0.14,ease:'power2.out'},${s});\n`;
    g.words.forEach((w, wi) => {
      const nx = g.words[wi + 1];
      const ws = Math.max(s, w.start), we = Math.max(ws + 0.05, Math.min(w.end, nx ? nx.start : w.end, g.end - 0.02));
      const sel = `'#${id}w${wi}'`;
      if (style === 'pop') {
        js += `  tl.set(${sel},{color:'${theme.cap.hi}'},${ws.toFixed(3)}).fromTo(${sel},{y:0},{y:-9,duration:0.08,ease:'power2.out'},${ws.toFixed(3)}).to(${sel},{y:0,duration:0.12,ease:'power2.in'},${(ws + 0.08).toFixed(3)}).set(${sel},{color:'${theme.cap.text}'},${we.toFixed(3)});\n`;
      } else if (style === 'boxed') {
        js += `  tl.fromTo(${sel},{opacity:0.28},{opacity:1,duration:0.08},${ws.toFixed(3)});\n`;
      } else if (style === 'karaoke') {
        js += `  tl.set(${sel},{color:'${theme.cap.hi}'},${ws.toFixed(3)});\n`;
      }
    });
    js += `  tl.to('#${id}i',{opacity:0,duration:0.1,ease:'power2.in'},${Math.max(s, g.end - 0.1).toFixed(3)});\n`;
  });
  return `<template>
  <style>
    #captions { position:absolute; inset:0; }
${css}
  </style>
  <div id="captions" data-composition-id="captions" data-start="0" data-duration="${duration}" data-width="${W}" data-height="${H}">
${html}  </div>
  <script>
  const tl = gsap.timeline({ paused: true });
${js}  window.__timelines["captions"] = tl;
  </script>
</template>
`;
}

export function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export { textOn };
