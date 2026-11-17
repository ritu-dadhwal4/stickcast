/*!
 * stickcast runtime — faceless stick-figure video engine
 * (c) Ritu Dadhwal — MIT License
 *
 * One file, no dependencies. Draws a whole stick-figure scene on a <canvas>
 * as a pure function of time, so the same code powers the theme picker,
 * the storyboard, the thumbnail and the final HyperFrames render.
 *
 *   STICK.drawFrame(ctx, story, t)          draw the story at t seconds
 *   STICK.drawScene(ctx, scene, t, theme)   draw one scene at local time t
 *   STICK.makeTheme(idOrDef)                build a full theme from a palette
 */
(function (root) {
  'use strict';
  const STICK = {};

  /* ------------------------------------------------------------ math */
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const seg = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));
  const E = {
    linear: (k) => k,
    soft: (k) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(k)),
    out3: (k) => 1 - Math.pow(1 - clamp(k), 3),
    in2: (k) => clamp(k) * clamp(k),
    back: (k) => { k = clamp(k); const c = 1.9, x = k - 1; return 1 + (c + 1) * x * x * x + c * x * x; },
  };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const strHash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h % 997); };

  /* ---------------------------------------------------------- colour */
  function hex2rgb(h) {
    h = String(h).trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb2hex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mixc = (a, b, k) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => lerp(v, B[i], k))); };
  function lum(h) {
    const c = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const contrast = (a, b) => { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  function hsv(h) {
    const [r, g, b] = hex2rgb(h).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hue = 0;
    if (d) hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hue * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
  }
  const rgba = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };

  /* ---------------------------------------------------------- themes */
  STICK.THEMES = root.STICK_THEMES || [];
  const themeCache = new Map();

  function makeTheme(def) {
    if (def && def.__built) return def;
    const key = typeof def === 'string' ? def : JSON.stringify(def || {});
    if (themeCache.has(key)) return themeCache.get(key);
    let d = def;
    if (!d) d = 'classic-crew';
    if (typeof d === 'string') {
      let [id, mode] = d.split(':');
      const found = STICK.THEMES.find((x) => x.id === id);
      if (found) d = Object.assign({}, found, mode ? { mode } : {});
      else if (id.includes('#')) d = { id: 'custom', name: 'Custom', colors: id.split(/[,\s]+/).filter(Boolean), mode: mode || 'light' };
      else d = { colors: ['#E53935', '#1E88E5', '#43A047', '#FDD835', '#FB8C00'], mode: 'light' };
    }
    const t = Object.assign({}, d);
    const dark = t.mode === 'dark';
    if (!t.bg || !t.ink || !t.crew) {
      const cols = (t.colors || []).filter(Boolean);
      const byL = [...cols].sort((a, b) => lum(a) - lum(b));
      let bg, ink;
      if (dark) {
        bg = byL[0] || '#111111';
        if (lum(bg) > 0.025) bg = mixc(bg, '#000000', lum(bg) > 0.15 ? 0.78 : 0.55);
        ink = byL[byL.length - 1] || '#ffffff';
        ink = mixc(ink, '#ffffff', lum(ink) > 0.6 ? 0.35 : 0.75);
      } else {
        bg = byL[byL.length - 1] || '#ffffff';
        bg = mixc(bg, '#ffffff', lum(bg) > 0.7 ? 0.4 : 0.82);
        ink = byL[0] || '#111111';
        if (lum(ink) > 0.015) ink = mixc(ink, '#000000', lum(ink) > 0.1 ? 0.72 : 0.45);
      }
      let crew = cols.filter((c) => contrast(c, bg) > 1.2).sort((a, b) => hsv(b).s * hsv(b).v - hsv(a).s * hsv(a).v);
      crew = crew.map((c) => { let x = c; for (let i = 0; i < 12 && contrast(x, bg) < 2.6; i++) x = mixc(x, dark ? '#ffffff' : '#000000', 0.12); return x; });
      const uniq = [];
      crew.forEach((c) => { if (!uniq.some((u) => contrast(u, c) < 1.12 && Math.abs(hsv(u).h - hsv(c).h) < 18)) uniq.push(c); });
      crew = uniq;
      if (!crew.length) crew = [ink];
      for (let i = 0; crew.length < 5 && i < 8; i++) crew.push(mixc(crew[i % crew.length], dark ? '#ffffff' : '#000000', 0.35));
      t.bg = t.bg || bg; t.ink = t.ink || ink; t.crew = t.crew || crew;
    }
    t.mode = dark ? 'dark' : 'light';
    t.accent = t.accent || t.crew[0];
    t.ground = t.ground || mixc(t.bg, t.ink, dark ? 0.12 : 0.07);
    t.line = t.line || t.ink;
    t.paper = t.paper || (dark ? mixc('#ffffff', t.bg, 0.08) : '#ffffff');
    t.paperInk = t.paperInk || (lum(t.paper) > 0.4 ? (dark ? '#151515' : t.ink) : '#ffffff');
    t.far = t.crew.map((c) => mixc(c, t.bg, 0.38));
    t.faint = mixc(t.bg, t.ink, 0.14);
    const pickHue = (lo, hi, fb) => t.crew.find((c) => { const q = hsv(c); return q.h >= lo && q.h <= hi && q.s > 0.3; }) || fb;
    t.gold = t.gold || pickHue(32, 62, '#F2B530');
    t.green = t.green || pickHue(80, 165, '#3FA34D');
    t.red = t.red || pickHue(345, 360, null) || pickHue(0, 18, '#E2453C');
    t.font = t.font || 'Nunito';
    t.titleFont = t.titleFont || 'Archivo Black';
    const boxText = contrast(t.accent, '#ffffff') >= contrast(t.accent, '#111111') ? '#ffffff' : '#111111';
    t.cap = Object.assign({ text: '#ffffff', stroke: '#111111', hi: t.gold, box: t.accent, boxText }, t.cap || {});
    t.__built = true;
    themeCache.set(key, t);
    return t;
  }
  const col = (theme, c, fb) => {
    if (c == null) return fb != null ? fb : theme.crew[0];
    if (typeof c === 'number') return theme.crew[c % theme.crew.length];
    if (theme[c] && typeof theme[c] === 'string') return theme[c];
    return c;
  };

  /* ----------------------------------------------------------- poses */
  // Angles in radians. 0 = limb points straight down, positive = swings toward
  // the way the figure faces, PI = straight up. Elbows bend forward (+),
  // knees bend back (-). `rot` tips the whole body (PI/2 = lying on its front).
  const J = ['lean', 'head', 'aF1', 'aF2', 'aB1', 'aB2', 'lF1', 'lF2', 'lB1', 'lB2', 'rot', 'air'];
  const BASE = { lean: 0, head: 0, aF1: 0.14, aF2: 0.18, aB1: -0.12, aB2: 0.16, lF1: 0.07, lF2: 0, lB1: -0.07, lB2: 0, rot: 0, air: 0 };
  const P = (o) => Object.assign({}, BASE, o);
  const POSES = {
    stand: P({}),
    wave: P({ aF1: 2.55, aF2: 0.55, head: 0.05, osc: [['aF2', 0.45, 9]] }),
    point: P({ aF1: 1.62, aF2: 0.05, head: 0.06 }),
    pointUp: P({ aF1: 2.75, aF2: 0.1, head: -0.15 }),
    present: P({ aF1: 1.15, aF2: -0.05, aB1: -0.15, head: 0.08 }),
    think: P({ aF1: 1.0, aF2: 2.4, aB1: 0.55, aB2: 1.5, head: -0.12 }),
    cheer: P({ aF1: 2.7, aF2: 0.25, aB1: -2.7, aB2: 0.25, head: -0.1, osc: [['air', 6, 7]] }),
    shrug: P({ aF1: 0.45, aF2: 1.55, aB1: -0.45, aB2: 1.9, head: 0.18, lean: -0.04 }),
    facepalm: P({ aF1: 1.05, aF2: 2.45, head: 0.3, lean: 0.1 }),
    sad: P({ lean: 0.14, head: 0.42, aF1: 0.04, aF2: 0.05, aB1: -0.04, aB2: 0.05 }),
    shocked: P({ lean: -0.12, head: -0.15, aF1: 1.25, aF2: 1.3, aB1: 0.95, aB2: 1.5, lF1: 0.18, lB1: -0.2 }),
    scared: P({ lean: -0.18, head: 0.1, aF1: 1.0, aF2: 1.9, aB1: 0.8, aB2: 2.0, lF1: 0.12, lF2: -0.25, lB1: -0.25, lB2: -0.2 }),
    angry: P({ lean: 0.12, head: 0.1, aF1: 0.55, aF2: 0.4, aB1: -0.55, aB2: 0.4, lF1: 0.2, lB1: -0.2 }),
    hold: P({ aF1: 1.0, aF2: 0.75, aB1: 0.85, aB2: 0.9 }),
    phone: P({ aF1: 0.9, aF2: 2.0, head: 0.3, aB1: -0.1 }),
    type: P({ lean: 0.1, head: 0.15, aF1: 0.95, aF2: 0.85, aB1: 0.8, aB2: 1.05, osc: [['aF2', 0.22, 21], ['aB2', 0.22, 21, 1.6]] }),
    talk: P({ aF1: 0.7, aF2: 1.25, aB1: -0.1, osc: [['aF1', 0.18, 4.5], ['head', 0.04, 7]] }),
    explain: P({ aF1: 1.05, aF2: 0.9, aB1: 0.7, aB2: 1.1, head: 0.05, osc: [['aF1', 0.16, 3.6], ['aB1', 0.14, 3.6, 1.4]] }),
    sit: P({ lF1: 1.52, lF2: -1.52, lB1: 1.42, lB2: -1.42, aF1: 0.6, aF2: 0.6, aB1: 0.5, aB2: 0.7, lean: -0.04 }),
    sitThink: P({ lF1: 1.52, lF2: -1.52, lB1: 1.42, lB2: -1.42, aF1: 1.0, aF2: 2.4, aB1: 0.5, aB2: 1.0, head: -0.1, lean: 0.06 }),
    sitType: P({ lF1: 1.52, lF2: -1.52, lB1: 1.42, lB2: -1.42, lean: 0.1, head: 0.15, aF1: 1.1, aF2: 0.6, aB1: 1.0, aB2: 0.75, osc: [['aF2', 0.2, 21], ['aB2', 0.2, 21, 1.6]] }),
    crouch: P({ lF1: 1.1, lF2: -1.9, lB1: 0.2, lB2: -1.7, lean: 0.35, aF1: 0.9, aF2: 0.5, aB1: 0.7, aB2: 0.6 }),
    jump: P({ air: 70, lF1: 0.75, lF2: -1.3, lB1: 0.1, lB2: -1.1, aF1: 2.6, aF2: 0.2, aB1: -2.5, aB2: 0.2 }),
    fight: P({ lean: 0.08, aF1: 0.95, aF2: 1.9, aB1: 0.65, aB2: 2.05, lF1: 0.36, lF2: -0.18, lB1: -0.38, lB2: -0.12, osc: [['air', 3, 6]] }),
    punch: P({ lean: 0.22, aF1: 1.6, aF2: 0, aB1: 0.75, aB2: 2.1, lF1: 0.45, lF2: -0.1, lB1: -0.45, lB2: 0 }),
    kick: P({ lean: -0.3, aF1: 0.9, aF2: 1.3, aB1: -0.9, aB2: 0.9, lF1: 1.7, lF2: 0, lB1: -0.05, lB2: 0 }),
    block: P({ lean: -0.05, aF1: 1.6, aF2: 1.6, aB1: 1.4, aB2: 1.8, lF1: 0.25, lB1: -0.35 }),
    fall: P({ rot: -1.2, aF1: 2.4, aF2: 0.4, aB1: 2.0, aB2: 0.6, lF1: 0.9, lF2: -0.4, lB1: 0.4, lB2: -0.3, head: -0.2 }),
    lie: P({ rot: -1.5708, aF1: 0.2, aF2: 0.1, aB1: -0.2, aB2: 0.1, lF1: 0.05, lB1: -0.05 }),
    lieFront: P({ rot: 1.5708, aF1: 0.6, aF2: 0.3, aB1: -0.2, aB2: 0.1, lF1: 0.05, lB1: -0.05, head: -0.4 }),
    bow: P({ lean: 0.75, head: 0.3, aF1: 0.35, aF2: 0.1, aB1: 0.2, aB2: 0.1 }),
    dance: P({ aF1: 2.3, aF2: 0.6, aB1: 0.6, aB2: 1.2, lF1: 0.3, lB1: -0.3, osc: [['aF1', 0.5, 6], ['aB1', 0.5, 6, 3.14], ['lean', 0.12, 3], ['air', 8, 6]] }),
    sleep: P({ lean: 0.1, head: 0.6, aF1: 0.05, aF2: 0.05, aB1: -0.05, aB2: 0.05 }),
    lookUp: P({ head: -0.5, lean: -0.08, aF1: 1.0, aF2: 2.3 }),
    celebrate: P({ aF1: 2.7, aF2: 0.25, aB1: 0.3, aB2: 0.2, osc: [['aF1', 0.25, 8], ['air', 5, 8]] }),
    eat: P({ aF1: 0.95, aF2: 2.15, aB1: 0.8, aB2: 1.0, head: 0.2, osc: [['aF2', 0.25, 5]] }),
    run: P({ lean: 0.2 }),
  };
  const ARM_SWING = new Set(['stand', 'sad', 'run', 'shrug', 'talk', 'angry', 'lookUp']);
  STICK.POSES = POSES;

  function mixPose(a, b, k) {
    const o = {};
    for (const j of J) o[j] = lerp(a[j] || 0, b[j] || 0, k);
    return o;
  }

  /* ---------------------------------------------------------- figure */
  const FIG = { r: 36, torso: 105, thigh: 72, shin: 70, upper: 58, fore: 56 };

  function solveFig(pose, x, face, sc) {
    sc = sc || 1;
    const d = (a, len) => [Math.sin(a) * face * len * sc, Math.cos(a) * len * sc];
    const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
    const hip = [0, 0];
    const neck = [Math.sin(pose.lean) * face * FIG.torso * sc, -Math.cos(pose.lean) * FIG.torso * sc];
    const ha = pose.lean + pose.head;
    const head = [neck[0] + Math.sin(ha) * face * (FIG.r + 5) * sc, neck[1] - Math.cos(ha) * (FIG.r + 5) * sc];
    const sh = [lerp(neck[0], hip[0], 0.1), lerp(neck[1], hip[1], 0.1)];
    const eF = add(sh, d(pose.aF1, FIG.upper)), hF = add(eF, d(pose.aF1 + pose.aF2, FIG.fore));
    const eB = add(sh, d(pose.aB1, FIG.upper)), hB = add(eB, d(pose.aB1 + pose.aB2, FIG.fore));
    const kF = add(hip, d(pose.lF1, FIG.thigh)), fF = add(kF, d(pose.lF1 + pose.lF2, FIG.shin));
    const kB = add(hip, d(pose.lB1, FIG.thigh)), fB = add(kB, d(pose.lB1 + pose.lB2, FIG.shin));
    const pts = { hip, neck, head, sh, eF, hF, eB, hB, kF, fF, kB, fB };
    if (pose.rot) {
      const th = pose.rot * face, c = Math.cos(th), s = Math.sin(th);
      for (const k in pts) { const [px, py] = pts[k]; pts[k] = [px * c - py * s, px * s + py * c]; }
    }
    let maxY = Math.max(pts.fF[1], pts.fB[1]);
    if (Math.abs(pose.rot) > 0.3) {
      for (const k in pts) maxY = Math.max(maxY, pts[k][1]);
      maxY = Math.max(maxY, pts.head[1] + FIG.r * sc);
    }
    const oy = -maxY - (pose.air || 0) * sc;
    for (const k in pts) pts[k] = [pts[k][0] + x, pts[k][1] + oy];
    pts.r = FIG.r * sc; pts.face = face; pts.sc = sc;
    pts.top = pts.head[1] - pts.r;
    pts.mouth = [pts.head[0] + face * pts.r * 0.55, pts.head[1] + pts.r * 0.3];
    return pts;
  }

  function line(g, pts, w, c) {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }
  function circle(g, x, y, r, fill, stroke, lw) {
    g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 4; g.stroke(); }
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function box(g, x, y, w, h, r, fill, stroke, lw) {
    rr(g, x, y, w, h, r);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 4; g.stroke(); }
  }
  function text(g, s, x, y, size, c, opt) {
    opt = opt || {};
    g.font = `${opt.weight || 800} ${size}px "${opt.font || 'Nunito'}", "Nunito", system-ui, sans-serif`;
    g.textAlign = opt.align || 'center'; g.textBaseline = opt.base || 'middle';
    if (opt.stroke) { g.lineJoin = 'round'; g.strokeStyle = opt.stroke; g.lineWidth = opt.sw || size * 0.18; g.strokeText(s, x, y); }
    g.fillStyle = c; g.fillText(s, x, y);
  }
  function wrap(g, s, maxW, size, font, weight) {
    g.font = `${weight || 800} ${size}px "${font || 'Nunito'}", "Nunito", system-ui, sans-serif`;
    const words = String(s).split(/\s+/); const lines = []; let cur = '';
    for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (g.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; }
    if (cur) lines.push(cur);
    return lines;
  }

  /* faces */
  function drawFace(g, F, expr, t, seed, ink, talking, style) {
    const { head: [hx, hy], r, face } = F;
    const e1 = [hx + face * r * 0.08, hy - r * 0.12], e2 = [hx + face * r * 0.5, hy - r * 0.12];
    const m = [hx + face * r * 0.32, hy + r * 0.38];
    const lw = Math.max(2.5, r * 0.11);
    const blink = ((t + seed * 0.731) % 3.9) < 0.13;
    const dot = (p, s) => circle(g, p[0], p[1], r * (s || 0.1), ink);
    const lineEye = (p) => line(g, [[p[0] - r * 0.1, p[1]], [p[0] + r * 0.1, p[1]]], lw, ink);
    const arc = (cx, cy, rad, a0, a1) => { g.beginPath(); g.arc(cx, cy, rad, a0, a1); g.strokeStyle = ink; g.lineWidth = lw; g.lineCap = 'round'; g.stroke(); };
    const brows = (tilt) => {
      [e1, e2].forEach((p, i) => {
        const dir = i === 0 ? -1 : 1, yy = p[1] - r * 0.24;
        line(g, [[p[0] - r * 0.13, yy - tilt * dir * face * r * 0.08], [p[0] + r * 0.13, yy + tilt * dir * face * r * 0.08]], lw * 0.9, ink);
      });
    };
    const eyes = () => (blink ? (lineEye(e1), lineEye(e2)) : (dot(e1), dot(e2)));
    const open = talking && Math.sin(t * 15 + seed) > -0.1;
    switch (expr) {
      case 'happy': eyes(); arc(m[0], m[1] - r * 0.12, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); break;
      case 'laugh':
        arc(e1[0], e1[1] + r * 0.05, r * 0.1, Math.PI * 1.1, Math.PI * 1.9); arc(e2[0], e2[1] + r * 0.05, r * 0.1, Math.PI * 1.1, Math.PI * 1.9);
        g.beginPath(); g.moveTo(m[0] - r * 0.25, m[1] - r * 0.08); g.quadraticCurveTo(m[0], m[1] + r * 0.4, m[0] + r * 0.25, m[1] - r * 0.08); g.closePath();
        g.fillStyle = ink; g.fill(); break;
      case 'sad': eyes(); brows(-1); arc(m[0], m[1] + r * 0.18, r * 0.18, 1.2 * Math.PI, 1.8 * Math.PI); break;
      case 'cry': lineEye(e1); lineEye(e2); brows(-1); arc(m[0], m[1] + r * 0.18, r * 0.18, 1.2 * Math.PI, 1.8 * Math.PI);
        { const k = (t * 1.4) % 1; circle(g, e2[0] + face * r * 0.05, e2[1] + r * (0.15 + k * 0.6), r * 0.07 * (1 - k * 0.4), '#5DADEC'); } break;
      case 'shocked': circle(g, e1[0], e1[1], r * 0.14, null, ink, lw * 0.9); circle(g, e2[0], e2[1], r * 0.14, null, ink, lw * 0.9);
        dot(e1, 0.05); dot(e2, 0.05); circle(g, m[0], m[1] + r * 0.03, r * 0.12, null, ink, lw); break;
      case 'angry': eyes(); brows(1.6); arc(m[0], m[1] + r * 0.16, r * 0.16, 1.2 * Math.PI, 1.8 * Math.PI); break;
      case 'smug': line(g, [[e1[0] - r * 0.1, e1[1]], [e1[0] + r * 0.1, e1[1]]], lw, ink); line(g, [[e2[0] - r * 0.1, e2[1]], [e2[0] + r * 0.1, e2[1]]], lw, ink);
        g.beginPath(); g.moveTo(m[0] - r * 0.18, m[1]); g.quadraticCurveTo(m[0] + face * r * 0.05, m[1] + r * 0.12, m[0] + face * r * 0.24, m[1] - r * 0.1);
        g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); break;
      case 'sleepy': arc(e1[0], e1[1] - r * 0.05, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI); arc(e2[0], e2[1] - r * 0.05, r * 0.1, 0.1 * Math.PI, 0.9 * Math.PI);
        circle(g, m[0], m[1], r * 0.06, ink); break;
      case 'worried': eyes(); brows(-1.3); g.beginPath();
        for (let i = 0; i <= 8; i++) { const xx = m[0] - r * 0.2 + (r * 0.4 * i) / 8, yy = m[1] + Math.sin(i * 1.6) * r * 0.04; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
        g.strokeStyle = ink; g.lineWidth = lw; g.stroke(); break;
      case 'love': [e1, e2].forEach((p) => heart(g, p[0], p[1] + r * 0.05, r * 0.15, '#E2453C')); arc(m[0], m[1] - r * 0.12, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); break;
      case 'cool': box(g, e1[0] - r * 0.2, e1[1] - r * 0.12, r * 0.86, r * 0.26, r * 0.08, '#111111');
        arc(m[0], m[1] - r * 0.1, r * 0.18, 0.2 * Math.PI, 0.8 * Math.PI); break;
      case 'dead': [e1, e2].forEach((p) => { line(g, [[p[0] - r * 0.09, p[1] - r * 0.09], [p[0] + r * 0.09, p[1] + r * 0.09]], lw, ink); line(g, [[p[0] - r * 0.09, p[1] + r * 0.09], [p[0] + r * 0.09, p[1] - r * 0.09]], lw, ink); });
        line(g, [[m[0] - r * 0.14, m[1]], [m[0] + r * 0.14, m[1]]], lw, ink); break;
      default: eyes();
        if (open) { g.beginPath(); g.ellipse(m[0], m[1], r * 0.11, r * 0.09, 0, 0, Math.PI * 2); g.fillStyle = ink; g.fill(); }
        else line(g, [[m[0] - r * 0.12, m[1]], [m[0] + r * 0.12, m[1]]], lw, ink);
        return;
    }
    if (open && expr !== 'laugh' && expr !== 'shocked') { g.beginPath(); g.ellipse(m[0], m[1] + r * 0.02, r * 0.09, r * 0.07, 0, 0, Math.PI * 2); g.fillStyle = ink; g.fill(); }
  }

  function heart(g, x, y, s, c) {
    g.beginPath(); g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
    g.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
    g.fillStyle = c; g.fill();
  }

  function drawAccessory(g, F, acc, c, ink, theme, style) {
    if (!acc) return;
    const { head: [hx, hy], r, face } = F;
    const lw = style === 'doodle' ? 5 : 0;
    const fill = (fn, f) => { g.beginPath(); fn(); g.fillStyle = f; g.fill(); if (lw) { g.strokeStyle = ink; g.lineWidth = lw * 0.8; g.stroke(); } };
    switch (acc) {
      case 'bun': fill(() => g.arc(hx - face * r * 0.55, hy - r * 0.8, r * 0.38, 0, Math.PI * 2), c); break;
      case 'pony': fill(() => { g.ellipse(hx - face * r * 1.05, hy - r * 0.05, r * 0.25, r * 0.6, face * 0.4, 0, Math.PI * 2); }, c); break;
      case 'spiky': fill(() => { g.moveTo(hx - r * 0.9, hy - r * 0.4); for (let i = 0; i < 4; i++) { const a = -Math.PI * (0.9 - i * 0.22); g.lineTo(hx + Math.cos(a) * r * 1.45, hy + Math.sin(a) * r * 1.45); g.lineTo(hx + Math.cos(a + 0.18) * r * 0.95, hy + Math.sin(a + 0.18) * r * 0.95); } g.closePath(); }, c); break;
      case 'cap': fill(() => { g.arc(hx, hy - r * 0.15, r * 1.02, Math.PI, 0); g.closePath(); }, c);
        fill(() => rr(g, face > 0 ? hx : hx - r * 1.55, hy - r * 0.27, r * 1.55, r * 0.22, r * 0.1), c); break;
      case 'chef': fill(() => rr(g, hx - r * 0.75, hy - r * 1.6, r * 1.5, r * 0.85, r * 0.15), '#ffffff');
        fill(() => { g.arc(hx - r * 0.4, hy - r * 1.75, r * 0.45, 0, Math.PI * 2); }, '#ffffff');
        fill(() => { g.arc(hx + r * 0.35, hy - r * 1.8, r * 0.5, 0, Math.PI * 2); }, '#ffffff');
        if (!lw) { g.strokeStyle = rgba(ink, 0.25); g.lineWidth = 3; g.beginPath(); g.moveTo(hx - r * 0.75, hy - r * 0.9); g.lineTo(hx + r * 0.75, hy - r * 0.9); g.stroke(); } break;
      case 'bow': fill(() => { const bx = hx - face * r * 0.2, by = hy - r * 1.0; g.moveTo(bx, by); g.lineTo(bx - r * 0.45, by - r * 0.3); g.lineTo(bx - r * 0.45, by + r * 0.3); g.closePath(); g.moveTo(bx, by); g.lineTo(bx + r * 0.45, by - r * 0.3); g.lineTo(bx + r * 0.45, by + r * 0.3); g.closePath(); }, c); break;
      case 'crown': fill(() => { const y0 = hy - r * 0.85; g.moveTo(hx - r * 0.6, y0); g.lineTo(hx - r * 0.7, y0 - r * 0.6); g.lineTo(hx - r * 0.3, y0 - r * 0.25); g.lineTo(hx, y0 - r * 0.7); g.lineTo(hx + r * 0.3, y0 - r * 0.25); g.lineTo(hx + r * 0.7, y0 - r * 0.6); g.lineTo(hx + r * 0.6, y0); g.closePath(); }, theme.gold); break;
      case 'glasses': { const y0 = hy - r * 0.12; circle(g, hx + face * r * 0.08, y0, r * 0.2, null, ink, 3.5); circle(g, hx + face * r * 0.55, y0, r * 0.2, null, ink, 3.5); line(g, [[hx + face * r * 0.28, y0], [hx + face * r * 0.35, y0]], 3.5, ink); break; }
      case 'headband': g.save(); g.beginPath(); g.arc(hx, hy, r, 0, Math.PI * 2); g.clip(); g.fillStyle = c; g.fillRect(hx - r, hy - r * 0.62, r * 2, r * 0.3); g.restore();
        line(g, [[hx - face * r * 0.95, hy - r * 0.45], [hx - face * r * 1.5, hy - r * 0.2]], 6, c); line(g, [[hx - face * r * 0.95, hy - r * 0.45], [hx - face * r * 1.45, hy - r * 0.55]], 6, c); break;
      default: break;
    }
  }

  function drawFig(g, F, o) {
    const theme = o.theme, style = o.style || 'crew';
    if (o.alpha != null && o.alpha < 1) { g.save(); g.globalAlpha *= o.alpha; }
    if (style === 'doodle') {
      const ink = theme.ink, lw = 6.5 * F.sc;
      const shirt = o.shirt ? col(theme, o.color) : null;
      line(g, [F.hip, F.kB, F.fB], lw, ink);
      line(g, [F.sh, F.eB, F.hB], lw, ink);
      if (shirt) line(g, [F.hip, F.neck], lw * 3.2, shirt);
      line(g, [F.hip, F.neck], lw, ink);
      line(g, [F.hip, F.kF, F.fF], lw, ink);
      if (o.held) o.held(g, F);
      line(g, [F.sh, F.eF, F.hF], lw, ink);
      drawAccessoryBack(g, F, o, theme, style);
      circle(g, F.head[0], F.head[1], F.r, theme.paper, ink, 5 * F.sc);
      if (o.faces !== false) drawFace(g, F, o.expr, o.t, o.seed, theme.paperInk === '#ffffff' ? ink : theme.paperInk, o.talking, style);
      drawAccessory(g, F, o.acc, col(theme, o.color), ink, theme, style);
    } else {
      const c = col(theme, o.color), far = mixc(c, theme.bg, 0.38), lw = 17 * F.sc;
      line(g, [F.hip, F.kB, F.fB], lw, far);
      line(g, [F.sh, F.eB, F.hB], lw, far);
      line(g, [F.hip, F.neck], lw, c);
      line(g, [F.hip, F.kF, F.fF], lw, c);
      if (o.held) o.held(g, F);
      line(g, [F.sh, F.eF, F.hF], lw, c);
      drawAccessoryBack(g, F, o, theme, style);
      circle(g, F.head[0], F.head[1], F.r, c);
      if (o.faces) drawFace(g, F, o.expr, o.t, o.seed, mixc(c, '#000000', 0.72), o.talking, style);
      drawAccessory(g, F, o.acc, mixc(c, '#000000', 0.25), theme.ink, theme, style);
    }
    if (o.alpha != null && o.alpha < 1) g.restore();
  }
  function drawAccessoryBack() {}

  /* ------------------------------------------------------ actor state */
  // Resolve an actor's pose, position and expression at local time t from its keys.
  function actorState(a, t, scene) {
    const keys = (a.keys || []).slice().sort((p, q) => (p.t || 0) - (q.t || 0));
    let pose = Object.assign({}, POSES[a.pose] || POSES.stand);
    let osc = (POSES[a.pose] || {}).osc ? POSES[a.pose].osc.map((o) => [o, 1]) : [];
    let poseName = a.pose || 'stand';
    let x = a.x || 0, face = a.face || 1, expr = a.expr || 'neutral', hold = a.hold || null;
    let walk = 0, ph = 0, run = false, alpha = a.in != null ? E.soft(seg(t, a.in, a.in + 0.3)) : 1;
    if (a.out != null) alpha *= 1 - E.soft(seg(t, a.out, a.out + 0.3));
    let emote = null, talkUntil = -1;
    for (const k of keys) {
      const kt = k.t || 0;
      if (t < kt) break;
      if (k.face) face = k.face;
      if (k.x != null && k.x !== x) {
        const isRun = !!k.run;
        const dist = Math.abs(k.x - x);
        const dur = k.dur || dist / (isRun ? 520 : 240);
        const u = seg(t, kt, kt + dur);
        const eased = E.soft(u) * 0.35 + u * 0.65;
        if (!k.face) face = k.x > x ? 1 : -1;
        const nx = lerp(x, k.x, eased);
        if (u > 0 && u < 1) { walk = Math.min(1, u * 6, (1 - u) * 6); ph = (Math.abs(nx - x) / (isRun ? 150 : 100)) * Math.PI; run = isRun; }
        x = nx;
      }
      if (k.pose) {
        const target = POSES[k.pose] || POSES.stand;
        const kk = E.soft(seg(t, kt, kt + (k.ease || 0.32)));
        pose = mixPose(pose, target, kk);
        osc = osc.map(([o, w]) => [o, w * (1 - kk)]);
        if (target.osc) target.osc.forEach((o) => osc.push([o, kk]));
        if (kk > 0.5) poseName = k.pose;
      }
      if (k.expr) expr = k.expr;
      if (k.hold !== undefined) hold = k.hold;
      if (k.emote && t < kt + (k.edur || 1.5)) emote = { s: k.emote, t0: kt, dur: k.edur || 1.5 };
      if (k.talk) talkUntil = kt + k.talk;
    }
    // idle life
    const seed = strHash(a.id || 'a');
    const breath = Math.sin(t * 2.1 + seed);
    pose = Object.assign({}, pose);
    pose.lean += 0.012 * breath;
    pose.head += 0.025 * Math.sin(t * 1.3 + seed * 0.7);
    pose.aF1 += 0.025 * breath; pose.aB1 -= 0.02 * breath;
    for (const [o, w] of osc) {
      if (w <= 0.001) continue;
      const [jn, amp, f, phs] = o;
      const v = Math.sin(t * f + (phs || 0) + seed) * amp * w;
      pose[jn] += jn === 'air' ? Math.abs(v) : v;
    }
    if (walk > 0) {
      const sw = run ? 0.78 : 0.42, s = Math.sin(ph), c = Math.cos(ph);
      const wp = {
        lF1: sw * s, lB1: -sw * s,
        lF2: -(run ? 1.3 : 0.75) * Math.max(0, c) - 0.05, lB2: -(run ? 1.3 : 0.75) * Math.max(0, -c) - 0.05,
      };
      if (ARM_SWING.has(poseName)) Object.assign(wp, run
        ? { aF1: -0.9 * s + 0.4, aF2: 1.5, aB1: 0.9 * s + 0.4, aB2: 1.5 }
        : { aF1: -0.45 * s + 0.05, aF2: 0.25, aB1: 0.45 * s - 0.05, aB2: 0.25 });
      for (const j in wp) pose[j] = lerp(pose[j], wp[j], walk);
      if (run) { pose.lean = lerp(pose.lean, 0.28, walk); pose.air += walk * 9 * Math.abs(s); }
      else pose.air += walk * 3 * Math.abs(s);
    }
    let talking = t < talkUntil;
    (scene.bubbles || []).forEach((b) => { if (b.actor === a.id && b.kind !== 'think' && t >= (b.in || 0) && t < (b.out != null ? b.out : (b.in || 0) + 2.5)) talking = true; });
    return { pose, x, face, expr, hold, alpha, emote, talking, seed, poseName };
  }

  /* ----------------------------------------------------- held objects */
  function drawHeld(g, F, what, theme, t) {
    if (!what) return;
    const [hx, hy] = F.hF, f = F.face, ink = theme.ink;
    let [kind, label] = String(what).split(':');
    g.save(); g.translate(hx, hy);
    switch (kind) {
      case 'phone': g.rotate(f * -0.25); box(g, -11, -34, 22, 40, 5, '#1d1d1f'); box(g, -8, -30, 16, 30, 3, theme.accent); break;
      case 'cup': box(g, -12, -26, 24, 28, 5, theme.paper, ink, 3.5);
        for (let i = 0; i < 2; i++) { const k = (t * 0.7 + i * 0.5) % 1; g.globalAlpha = 1 - k; line(g, [[-4 + i * 8, -32 - k * 26], [-1 + i * 8, -40 - k * 26]], 3, theme.faint); }
        g.globalAlpha = 1; break;
      case 'book': g.rotate(f * -0.2); box(g, -22, -30, 44, 34, 3, col(theme, 1), ink, 3); line(g, [[0, -30], [0, 4]], 3, ink); break;
      case 'money': g.rotate(f * -0.15); for (let i = 2; i >= 0; i--) box(g, -26 + i * 3, -20 - i * 4, 52, 26, 3, mixc(theme.green, '#ffffff', 0.2 + i * 0.1), mixc(theme.green, '#000000', 0.4), 2.5);
        text(g, '$', 3, -24, 18, mixc(theme.green, '#000000', 0.5)); break;
      case 'coin': circle(g, 0, -10, 18, theme.gold, mixc(theme.gold, '#000000', 0.35), 3.5); text(g, '$', 0, -10, 18, mixc(theme.gold, '#000000', 0.45)); break;
      case 'bag': circle(g, 0, 10, 26, mixc(theme.gold, '#8B5A2B', 0.55), ink, 3.5); line(g, [[-8, -14], [8, -14]], 5, ink); text(g, '$', 0, 12, 24, theme.paper); break;
      case 'sign': { const s = label || 'HI'; g.font = `900 24px "${theme.font}"`; const w = Math.max(90, g.measureText(s).width + 32);
        line(g, [[0, 30], [0, -60]], 6, mixc('#8B5A2B', ink, 0.2)); box(g, -w / 2, -120, w, 62, 8, theme.paper, ink, 4); text(g, s, 0, -89, 24, theme.paperInk); break; }
      case 'sword': g.rotate(f * 0.9); line(g, [[0, 0], [0, -120]], 7, '#C9CED6'); line(g, [[-16, -6], [16, -6]], 7, ink); line(g, [[0, 0], [0, 16]], 7, mixc('#8B5A2B', ink, 0.3)); break;
      case 'pencil': g.rotate(f * 0.6); line(g, [[0, 8], [0, -40]], 9, theme.gold); line(g, [[0, -40], [0, -50]], 4, ink); break;
      case 'mic': circle(g, 0, -18, 10, '#333333'); line(g, [[0, -10], [0, 12]], 6, '#555555'); break;
      case 'bulb': drawBulb(g, 0, -30, 0.6, theme, true); break;
      case 'bowl': drawBowl(g, f * 6, -6, 0.7, theme, t); break;
      case 'flag': line(g, [[0, 20], [0, -110]], 5, ink); g.beginPath(); g.moveTo(0, -110); g.lineTo(f * 60, -95 + Math.sin(t * 6) * 4); g.lineTo(0, -78); g.closePath(); g.fillStyle = theme.accent; g.fill(); break;
      default: break;
    }
    g.restore();
  }

  /* ------------------------------------------------------------ props */
  function drawBulb(g, x, y, s, theme, on) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (on) { const gr = g.createRadialGradient(0, 0, 10, 0, 0, 110); gr.addColorStop(0, rgba(theme.gold, 0.55)); gr.addColorStop(1, rgba(theme.gold, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 110, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(g, [[Math.cos(a) * 62, Math.sin(a) * 62], [Math.cos(a) * 82, Math.sin(a) * 82]], 6, theme.gold); } }
    circle(g, 0, 0, 40, on ? theme.gold : theme.paper, theme.ink, 6);
    box(g, -18, 34, 36, 26, 5, mixc(theme.ink, theme.bg, 0.5), theme.ink, 5);
    g.restore();
  }
  function drawBowl(g, x, y, s, theme, t) {
    g.save(); g.translate(x, y); g.scale(s, s);
    for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i * 0.33) % 1; g.globalAlpha = (1 - k) * 0.8; g.beginPath(); g.moveTo(-18 + i * 18, -30 - k * 50); g.quadraticCurveTo(-8 + i * 18, -45 - k * 50, -18 + i * 18, -60 - k * 50); g.strokeStyle = theme.faint; g.lineWidth = 5; g.stroke(); }
    g.globalAlpha = 1;
    g.beginPath(); g.ellipse(0, -22, 52, 12, 0, 0, Math.PI * 2); g.fillStyle = theme.gold; g.fill();
    circle(g, -16, -24, 8, theme.red); circle(g, 10, -26, 7, theme.green); circle(g, 26, -22, 6, theme.paper);
    g.beginPath(); g.moveTo(-56, -22); g.quadraticCurveTo(-50, 22, 0, 22); g.quadraticCurveTo(50, 22, 56, -22); g.closePath(); g.fillStyle = theme.red; g.fill(); g.strokeStyle = theme.ink; g.lineWidth = 4; g.stroke();
    g.restore();
  }
  function starPath(g, x, y, r1, r2, n) {
    g.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath();
  }

  const PROPS = {
    desk(g, p, th) { const w = p.w || 240, h = p.h || 108; const wood = p.color ? col(th, p.color) : mixc('#B07A4A', th.bg, 0.15);
      box(g, -w / 2, -h, w, 16, 4, wood, th.ink, 4); line(g, [[-w / 2 + 16, -h + 16], [-w / 2 + 16, 0]], 9, mixc(wood, '#000000', 0.25)); line(g, [[w / 2 - 16, -h + 16], [w / 2 - 16, 0]], 9, mixc(wood, '#000000', 0.25)); },
    table(g, p, th) { PROPS.desk(g, Object.assign({ w: 320, h: 100 }, p), th); },
    laptop(g, p, th, t) { g.save(); g.scale((p.face || 1) * 1.5, 1.5);
      box(g, -44, -8, 88, 8, 3, '#9aa0a6', th.ink, 3); g.save(); g.translate(-40, -8); g.rotate(-1.35); box(g, 0, -6, 64, 8, 3, '#3a3a3c', th.ink, 3); g.restore();
      const k = 0.5 + 0.5 * Math.sin(t * 3); line(g, [[-24, -30], [-12, -36 - 4 * k]], 3, rgba(th.accent, 0.6)); line(g, [[-22, -46], [-8, -52 - 4 * k]], 3, rgba(th.accent, 0.4)); g.restore(); },
    computer(g, p, th) { box(g, -70, -150, 140, 96, 10, '#2b2b2e', th.ink, 4); box(g, -60, -140, 120, 76, 5, th.accent); line(g, [[0, -54], [0, -22]], 10, '#555555'); box(g, -36, -24, 72, 10, 4, '#555555'); },
    chair(g, p, th) { const c = p.color ? col(th, p.color) : mixc(th.ink, th.bg, 0.45); g.save(); g.scale(p.face || 1, 1);
      line(g, [[-30, -64], [30, -64]], 10, c); line(g, [[-30, -64], [-36, -140]], 9, c); line(g, [[-26, -64], [-26, 0]], 7, c); line(g, [[26, -64], [26, 0]], 7, c); g.restore(); },
    bed(g, p, th) { const w = p.w || 300; box(g, -w / 2, -70, w, 34, 8, th.paper, th.ink, 4); box(g, -w / 2, -36, w, 14, 4, mixc('#B07A4A', th.bg, 0.2), th.ink, 4); line(g, [[-w / 2, -22], [-w / 2, 0]], 8, th.ink); line(g, [[w / 2, -22], [w / 2, 0]], 8, th.ink);
      box(g, -w / 2 - 6, -130, 14, 130, 6, mixc('#B07A4A', th.bg, 0.2), th.ink, 4); box(g, -w / 2 + 14, -96, 70, 28, 12, th.paper, th.ink, 3.5); },
    board(g, p, th, t) {
      const w = p.w || 380, h = p.h || 240, top = -(p.lift || 90) - h;
      if (!p.noLegs) { line(g, [[-w / 2 + 40, top + h], [-w / 2 + 20, 0]], 6, th.ink); line(g, [[w / 2 - 40, top + h], [w / 2 - 20, 0]], 6, th.ink); }
      box(g, -w / 2, top, w, h, 10, th.paper, th.ink, 5);
      let y = top + 40;
      if (p.title) { text(g, p.title, 0, y, p.titleSize || 30, p.titleColor ? col(th, p.titleColor) : th.accent === th.paper ? th.paperInk : (contrast(th.accent, th.paper) > 2.2 ? th.accent : th.paperInk), { font: th.titleFont, weight: 400 }); y += 46; }
      (p.lines || []).forEach((s, i) => {
        const at = (p.reveal || [])[i]; if (at != null && t < at) return;
        const k = at != null ? E.out3(seg(t, at, at + 0.3)) : 1;
        g.globalAlpha = k;
        const bullet = p.bullets !== false;
        if (bullet) circle(g, -w / 2 + 34, y, 7, col(th, i % th.crew.length));
        text(g, s, bullet ? -w / 2 + 54 : 0, y, p.size || 25, th.paperInk, { align: bullet ? 'left' : 'center', weight: 800 });
        g.globalAlpha = 1; y += (p.size || 25) * 1.55;
      });
      if (p.check != null) (p.check || []).forEach((ct, i) => { if (t >= ct) { const yy = top + 40 + (p.title ? 46 : 0) + i * (p.size || 25) * 1.55; tickMark(g, w / 2 - 40, yy, E.out3(seg(t, ct, ct + 0.3)), th.green); } });
    },
    chart(g, p, th, t) {
      const vals = p.values || [2, 4, 7], w = p.w || 300, h = p.h || 230, n = vals.length, mx = p.max || Math.max(...vals);
      const grow = E.out3(seg(t, (p.in || 0) + 0.2, (p.in || 0) + 0.2 + (p.grow || 1.2)));
      line(g, [[-w / 2, -h - 20], [-w / 2, 0], [w / 2 + 10, 0]], 6, th.ink);
      const bw = (w / n) * 0.62;
      vals.forEach((v, i) => {
        const k = clamp(grow * n - i * 0.6, 0, 1), bh = (v / mx) * h * E.out3(k);
        const x = -w / 2 + (w / n) * (i + 0.5) - bw / 2;
        box(g, x, -bh, bw, bh, 6, col(th, p.colors ? p.colors[i] : (p.color != null ? p.color : i)), th.ink, 4);
        if (p.labels && p.labels[i]) text(g, p.labels[i], x + bw / 2, 26, 22, th.ink);
        if (p.showValues && k > 0.9) text(g, (p.prefix || '') + v + (p.suffix || ''), x + bw / 2, -bh - 20, 22, th.ink);
      });
      if (p.trend) { const k = grow; const pts = vals.map((v, i) => [-w / 2 + (w / n) * (i + 0.5), -(v / mx) * h - 30]); drawArrowPath(g, pts, k, th.ink, 6); }
    },
    growth(g, p, th, t) { const w = p.w || 300, h = p.h || 220; const k = E.soft(seg(t, (p.in || 0) + 0.2, (p.in || 0) + 1.6));
      line(g, [[-w / 2, -h - 20], [-w / 2, 0], [w / 2 + 10, 0]], 6, th.ink);
      const down = p.down; const pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6; const yy = down ? -h * (1 - u) + (i % 2 ? -18 : 18) : -h * u * u + (i % 2 ? 18 : 0); pts.push([-w / 2 + 20 + u * (w - 30), Math.min(-10, yy - 10)]); }
      drawArrowPath(g, pts, k, col(th, p.color != null ? p.color : (down ? 'red' : 'green')), 9); },
    coin(g, p, th, t) { const r = p.r || 40; const spin = p.spin ? Math.abs(Math.cos(t * 4)) : 1; g.save(); g.scale(Math.max(0.15, spin), 1);
      circle(g, 0, -r, r, th.gold, mixc(th.gold, '#000000', 0.4), 5); circle(g, 0, -r, r * 0.72, null, mixc(th.gold, '#000000', 0.25), 3); if (spin > 0.4) text(g, p.text || '$', 0, -r, r, mixc(th.gold, '#000000', 0.5), { font: th.titleFont, weight: 400 }); g.restore(); },
    coins(g, p, th, t) { const n = p.n || 5, r = p.r || 34; const k = p.grow ? E.out3(seg(t, p.in || 0, (p.in || 0) + p.grow)) : 1; const m = Math.max(1, Math.round(n * k));
      for (let i = 0; i < m; i++) { g.beginPath(); g.ellipse(0, -10 - i * 14, r, r * 0.35, 0, 0, Math.PI * 2); g.fillStyle = th.gold; g.fill(); g.strokeStyle = mixc(th.gold, '#000000', 0.4); g.lineWidth = 4; g.stroke(); } },
    money(g, p, th) { for (let i = 0; i < (p.n || 4); i++) { box(g, -50, -18 - i * 16, 100, 16, 3, mixc(th.green, '#ffffff', 0.15 + (i % 2) * 0.12), mixc(th.green, '#000000', 0.4), 3); } text(g, '$', 0, -26 - (p.n || 4) * 16, 34, mixc(th.green, '#000000', 0.35), { font: th.titleFont, weight: 400 }); },
    bag(g, p, th) { const s = p.s || 1; g.save(); g.scale(s, s); circle(g, 0, -55, 55, mixc(th.gold, '#8B5A2B', 0.5), th.ink, 5); g.beginPath(); g.moveTo(-22, -104); g.lineTo(-30, -124); g.lineTo(30, -124); g.lineTo(22, -104); g.closePath(); g.fillStyle = mixc(th.gold, '#8B5A2B', 0.5); g.fill(); g.stroke(); line(g, [[-24, -104], [24, -104]], 7, th.ink); text(g, '$', 0, -52, 52, th.paper, { font: th.titleFont, weight: 400 }); g.restore(); },
    piggy(g, p, th) { const c = p.color != null ? col(th, p.color) : mixc('#F4A6B8', th.bg, 0.1); g.save(); g.scale(p.face || 1, 1);
      g.beginPath(); g.ellipse(0, -60, 78, 56, 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); g.strokeStyle = th.ink; g.lineWidth = 5; g.stroke();
      box(g, 66, -74, 24, 30, 10, c, th.ink, 5); line(g, [[-40, -10], [-40, 0]], 12, th.ink); line(g, [[36, -10], [36, 0]], 12, th.ink); circle(g, 40, -82, 5, th.ink); line(g, [[-20, -114], [14, -114]], 6, th.ink); g.restore(); },
    bulb(g, p, th, t) { drawBulb(g, 0, -(p.lift || 0) - 70, p.s || 1, th, p.on == null ? true : t >= p.on); },
    clock(g, p, th, t) { const r = p.r || 70, cy = -(p.lift || 0) - r; circle(g, 0, cy, r, th.paper, th.ink, 6);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line(g, [[Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78], [Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88]], 4, th.ink); }
      const sp = p.speed || 1, a1 = t * sp * 2 - Math.PI / 2, a2 = t * sp * 0.2 - Math.PI / 2;
      line(g, [[0, cy], [Math.cos(a1) * r * 0.72, cy + Math.sin(a1) * r * 0.72]], 5, th.ink); line(g, [[0, cy], [Math.cos(a2) * r * 0.48, cy + Math.sin(a2) * r * 0.48]], 7, th.accent); circle(g, 0, cy, 6, th.ink); },
    calendar(g, p, th, t) { const w = 130, h = 140, top = -(p.lift || 0) - h; box(g, -w / 2, top, w, h, 10, th.paper, th.ink, 5); g.save(); rr(g, -w / 2, top, w, 38, 10); g.clip(); g.fillStyle = th.red; g.fillRect(-w / 2, top, w, 38); g.restore(); rr(g, -w / 2, top, w, h, 10); g.strokeStyle = th.ink; g.lineWidth = 5; g.stroke();
      const days = p.days || [1, 30]; const k = p.flip ? seg(t, (p.in || 0) + 0.3, (p.in || 0) + 0.3 + p.flip) : 1; const d = Math.round(lerp(days[0], days[1], k));
      text(g, p.month || 'DAY', 0, top + 20, 20, '#ffffff'); text(g, String(d), 0, top + 90, 56, th.paperInk, { font: th.titleFont, weight: 400 }); },
    phone(g, p, th, t) { const s = p.s || 1; g.save(); g.translate(0, -(p.lift || 0)); g.scale(s, s); box(g, -60, -230, 120, 220, 18, '#1d1d1f'); box(g, -50, -214, 100, 188, 8, th.paper);
      if (p.text) wrap(g, p.text, 84, 18, th.font).forEach((ln, i) => text(g, ln, 0, -190 + i * 24, 18, th.paperInk));
      if (p.icon === 'heart') heart(g, 0, -110, 22, th.red); if (p.icon === 'like') { text(g, '♥ ' + Math.round(lerp(0, p.likes || 999, seg(t, (p.in || 0) + 0.3, (p.in || 0) + 1.5))), 0, -60, 22, th.red); }
      if (p.icon === 'play') { g.beginPath(); g.moveTo(-14, -140); g.lineTo(18, -120); g.lineTo(-14, -100); g.closePath(); g.fillStyle = th.red; g.fill(); }
      g.restore(); },
    heart(g, p, th, t) { const s = (p.s || 1) * (1 + 0.06 * Math.sin(t * 7)); heart(g, 0, -(p.lift || 0) - 50 * s, 46 * s, p.color != null ? col(th, p.color) : th.red); },
    star(g, p, th, t) { starPath(g, 0, -(p.lift || 0) - 50, 50 * (p.s || 1), 22 * (p.s || 1), 5); g.fillStyle = p.color != null ? col(th, p.color) : th.gold; g.fill(); g.strokeStyle = th.ink; g.lineWidth = 4; g.stroke(); },
    question(g, p, th, t) { text(g, '?', 0, -(p.lift || 0) - 60 + Math.sin(t * 3) * 6, 120 * (p.s || 1), p.color != null ? col(th, p.color) : th.accent, { font: th.titleFont, weight: 400, stroke: th.bg, sw: 10 }); },
    exclaim(g, p, th, t) { text(g, '!', 0, -(p.lift || 0) - 60, 120 * (p.s || 1), p.color != null ? col(th, p.color) : th.red, { font: th.titleFont, weight: 400, stroke: th.bg, sw: 10 }); },
    text(g, p, th, t) {
      const size = p.size || 56, c = p.color != null ? col(th, p.color) : th.ink;
      const lines = String(p.text || '').split('\n'); const y0 = -(p.lift || 0) - ((lines.length - 1) * size * 1.15) / 2;
      const ff = p.font === 'body' ? th.font : th.titleFont, fw = p.font === 'body' ? 900 : 400;
      const cy = y0 + ((lines.length - 1) * size * 1.15) / 2;
      g.save(); g.translate(0, cy); g.rotate(p.tilt || 0); g.translate(0, -cy);
      if (p.box) { g.font = `${fw} ${size}px "${ff}", "Nunito", system-ui, sans-serif`; const w = Math.max(...lines.map((s) => g.measureText(s).width)) + size * 0.9, h = lines.length * size * 1.15 + size * 0.5;
        box(g, -w / 2, cy - h / 2, w, h, size * 0.25, p.box === true ? th.accent : col(th, p.box), th.ink, 5); }
      const bfill = p.box ? (p.box === true ? th.accent : col(th, p.box)) : null;
      const tc = p.box ? (p.boxText || (contrast(bfill, '#ffffff') >= contrast(bfill, '#111111') ? '#ffffff' : '#111111')) : c;
      lines.forEach((s, i) => text(g, s, 0, y0 + i * size * 1.15 + size * 0.04, size, tc, { font: ff, weight: fw, stroke: p.outline ? th.bg : null, sw: size * 0.16 }));
      g.restore();
    },
    counter(g, p, th, t) { const a = p.from || 0, b = p.to != null ? p.to : 100, k = E.out3(seg(t, (p.in || 0) + 0.15, (p.in || 0) + 0.15 + (p.dur || 1.5)));
      let v = lerp(a, b, k); v = p.decimals ? v.toFixed(p.decimals) : Math.round(v).toLocaleString('en-US');
      PROPS.text(g, Object.assign({}, p, { text: (p.prefix || '') + v + (p.suffix || '') }), th, t); },
    arrow(g, p, th, t) { const from = p.from || [-100, -150], to = p.to || [100, -150]; const k = E.out3(seg(t, (p.in || 0), (p.in || 0) + (p.draw || 0.6)));
      const bend = p.bend || 0; const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - bend]; const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([(1 - u) * (1 - u) * from[0] + 2 * u * (1 - u) * mid[0] + u * u * to[0], (1 - u) * (1 - u) * from[1] + 2 * u * (1 - u) * mid[1] + u * u * to[1]]); }
      drawArrowPath(g, pts, k, p.color != null ? col(th, p.color) : th.ink, p.lw || 7); },
    house(g, p, th) { const c = p.color != null ? col(th, p.color) : th.accent, s = p.s || 1; g.save(); g.scale(s, s); box(g, -90, -150, 180, 150, 4, th.paper, th.ink, 5); g.beginPath(); g.moveTo(-110, -146); g.lineTo(0, -240); g.lineTo(110, -146); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = th.ink; g.lineWidth = 5; g.stroke();
      box(g, -24, -80, 48, 80, 4, mixc('#B07A4A', th.bg, 0.2), th.ink, 4); box(g, -72, -126, 36, 34, 3, th.faint, th.ink, 4); box(g, 36, -126, 36, 34, 3, th.faint, th.ink, 4); g.restore(); },
    building(g, p, th) { const h = p.h || 320, w = p.w || 130, c = p.color != null ? col(th, p.color) : mixc(th.ink, th.bg, 0.65); box(g, -w / 2, -h, w, h, 4, c, th.ink, 4);
      for (let yy = -h + 22; yy < -40; yy += 44) for (let xx = -w / 2 + 18; xx < w / 2 - 20; xx += 36) box(g, xx, yy, 20, 24, 2, mixc(th.gold, th.bg, 0.3)); },
    tree(g, p, th) { const s = p.s || 1; g.save(); g.scale(s, s); line(g, [[0, 0], [0, -110]], 18, mixc('#8B5A2B', th.bg, 0.15)); circle(g, 0, -150, 62, th.green, th.ink, 4); circle(g, -42, -120, 40, th.green, th.ink, 4); circle(g, 44, -118, 42, th.green, th.ink, 4); g.restore(); },
    door(g, p, th, t) { const k = p.open != null ? E.soft(seg(t, p.open, p.open + 0.5)) : 0; box(g, -55, -200, 110, 200, 6, mixc(th.ink, th.bg, 0.75), th.ink, 5);
      g.save(); g.translate(-55, 0); g.scale(1 - k * 0.8, 1); box(g, 0, -200, 110, 200, 6, p.color != null ? col(th, p.color) : mixc('#B07A4A', th.bg, 0.1), th.ink, 5); circle(g, 92, -100, 7, th.gold); g.restore(); if (p.label) text(g, p.label, 0, -222, 26, th.ink); },
    crate(g, p, th) { const s = p.s || 90; box(g, -s / 2, -s, s, s, 6, p.color != null ? col(th, p.color) : mixc('#C68B59', th.bg, 0.15), th.ink, 5); line(g, [[-s / 2 + 6, -s + 6], [s / 2 - 6, -6]], 4, rgba(th.ink, 0.4)); if (p.label) text(g, p.label, 0, -s / 2, s * 0.26, th.ink); },
    gem(g, p, th, t) { const c = p.color != null ? col(th, p.color) : th.accent, y = -(p.lift || 0) - 40 + Math.sin(t * 3) * 6; g.beginPath(); g.moveTo(-34, y - 12); g.lineTo(-18, y - 34); g.lineTo(18, y - 34); g.lineTo(34, y - 12); g.lineTo(0, y + 30); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = th.ink; g.lineWidth = 4; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(-18, y - 30); g.lineTo(-6, y - 30); g.lineTo(-18, y - 10); g.closePath(); g.fill(); },
    trophy(g, p, th) { const c = th.gold; box(g, -40, -40, 80, 22, 5, mixc(c, '#000000', 0.2), th.ink, 4); line(g, [[0, -40], [0, -80]], 14, c); g.beginPath(); g.moveTo(-50, -160); g.lineTo(50, -160); g.quadraticCurveTo(48, -80, 0, -78); g.quadraticCurveTo(-48, -80, -50, -160); g.closePath(); g.fillStyle = c; g.fill(); g.strokeStyle = th.ink; g.lineWidth = 4; g.stroke(); starPath(g, 0, -122, 18, 8, 5); g.fillStyle = th.paper; g.fill(); },
    rocket(g, p, th, t) { g.save(); g.rotate(p.tilt || 0); const c = p.color != null ? col(th, p.color) : th.red; const fl = 0.7 + 0.3 * Math.sin(t * 30);
      g.beginPath(); g.moveTo(-16, 0); g.lineTo(0, 50 * fl); g.lineTo(16, 0); g.closePath(); g.fillStyle = th.gold; g.fill();
      g.beginPath(); g.moveTo(-26, 0); g.lineTo(-26, -90); g.quadraticCurveTo(0, -150, 26, -90); g.lineTo(26, 0); g.closePath(); g.fillStyle = th.paper; g.fill(); g.strokeStyle = th.ink; g.lineWidth = 5; g.stroke();
      circle(g, 0, -80, 11, th.accent, th.ink, 4); g.beginPath(); g.moveTo(-26, -30); g.lineTo(-46, 4); g.lineTo(-26, 0); g.closePath(); g.fillStyle = c; g.fill(); g.stroke(); g.beginPath(); g.moveTo(26, -30); g.lineTo(46, 4); g.lineTo(26, 0); g.closePath(); g.fill(); g.stroke(); g.restore(); },
    stairs(g, p, th, t) { const n = p.n || 4, sw = p.sw || 70, sh = p.sh || 45; for (let i = 0; i < n; i++) box(g, -((n * sw) / 2) + i * sw, -(i + 1) * sh, (n - i) * sw, sh, 3, mixc(col(th, p.color != null ? p.color : 1), th.bg, 0.15 + (i % 2) * 0.1), th.ink, 4); },
    bowl(g, p, th, t) { drawBowl(g, 0, -(p.lift || 0), p.s || 1, th, t); },
    sign(g, p, th) { const s = p.text || 'SIGN'; g.font = `900 30px "${th.font}"`; const w = Math.max(120, g.measureText(s).width + 40); line(g, [[0, 0], [0, -150]], 9, mixc('#8B5A2B', th.bg, 0.15)); box(g, -w / 2, -220, w, 76, 10, p.color != null ? col(th, p.color) : th.paper, th.ink, 5); text(g, s, 0, -182, 30, p.color != null ? '#ffffff' : th.paperInk); },
    burst(g, p, th, t) { const s = (p.s || 1) * (1 + 0.04 * Math.sin(t * 20)), y = -(p.lift || 0) - 110; starPath(g, 0, y, 120 * s, 75 * s, 12); g.fillStyle = p.color != null ? col(th, p.color) : th.gold; g.fill(); g.strokeStyle = th.ink; g.lineWidth = 6; g.stroke(); text(g, p.text || 'POW!', 0, y, 46 * s, th.ink, { font: th.titleFont, weight: 400 }); },
    confetti(g, p, th, t) { const t0 = p.in || 0, n = p.n || 40, w = p.w || 700; for (let i = 0; i < n; i++) { const tt = t - t0 - hash(i) * 0.4; if (tt < 0) continue; const x = (hash(i + 3) - 0.5) * w + Math.sin(tt * 3 + i) * 20, y = -520 + tt * (160 + hash(i + 9) * 160); if (y > 0) continue; g.save(); g.translate(x, y); g.rotate(tt * 5 + i); g.fillStyle = th.crew[i % th.crew.length]; g.fillRect(-7, -4, 14, 8); g.restore(); } },
    sparkles(g, p, th, t) { for (let i = 0; i < (p.n || 5); i++) { const a = (i / (p.n || 5)) * Math.PI * 2, r = (p.r || 90), k = (Math.sin(t * 5 + i * 1.7) + 1) / 2; starPath(g, Math.cos(a) * r, -(p.lift || 100) + Math.sin(a) * r * 0.7, 14 * k + 4, 5, 4); g.fillStyle = th.gold; g.fill(); } },
    cloud(g, p, th, t) { const s = p.s || 1, y = -(p.lift || 300); g.save(); g.translate(Math.sin(t * 0.3) * 10, y); g.scale(s, s); g.fillStyle = p.color != null ? col(th, p.color) : th.paper; [[-40, 0, 36], [0, -18, 46], [44, 0, 34], [10, 10, 34]].forEach(([x, yy, r]) => { g.beginPath(); g.arc(x, yy, r, 0, Math.PI * 2); g.fill(); }); g.restore(); },
    sun(g, p, th, t) { const y = -(p.lift || 380); circle(g, 0, y, 56 * (p.s || 1), th.gold); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + t * 0.3; line(g, [[Math.cos(a) * 72, y + Math.sin(a) * 72], [Math.cos(a) * 92, y + Math.sin(a) * 92]], 7, th.gold); } },
    pill(g, p, th) { const s = p.text || 'LABEL', size = p.size || 28; g.font = `900 ${size}px "${th.font}"`; const w = g.measureText(s).width + size * 1.2, h = size * 1.7, y = -(p.lift || 0) - h;
      box(g, -w / 2, y, w, h, h / 2, p.color != null ? col(th, p.color) : th.accent, th.ink, 4); const c = p.color != null ? col(th, p.color) : th.accent; text(g, s, 0, y + h / 2 + 1, size, contrast(c, '#ffffff') >= contrast(c, '#111111') ? '#ffffff' : '#111111'); },
    bars(g, p, th, t) { PROPS.chart(g, p, th, t); },
    pipe(g, p, th) { const c = p.color != null ? col(th, p.color) : th.accent, w = p.w || 120; g.save(); g.scale(p.face || 1, 1); box(g, -w / 2, -(p.lift || 300) - 60, w + 400, 60, 4, c, th.ink, 5); box(g, -w / 2 - 12, -(p.lift || 300) - 70, 30, 80, 4, mixc(c, '#000000', 0.15), th.ink, 5); g.restore(); },
    target(g, p, th) { const y = -(p.lift || 120); [70, 50, 30, 12].forEach((r, i) => circle(g, 0, y, r, i % 2 ? th.paper : th.red, th.ink, 4)); },
    globe(g, p, th, t) { const y = -(p.lift || 120), r = p.r || 80; circle(g, 0, y, r, mixc('#5DADEC', th.bg, 0.15), th.ink, 5); g.save(); g.beginPath(); g.arc(0, y, r - 3, 0, Math.PI * 2); g.clip(); const o = (t * 20) % (r * 2); g.fillStyle = th.green; [[-30, -20, 34, 24], [30, 20, 26, 30], [-10, 40, 22, 14]].forEach(([x, yy, w, h]) => { g.beginPath(); g.ellipse(((x + o + r) % (r * 2.6)) - r, y + yy, w, h, 0.3, 0, Math.PI * 2); g.fill(); }); g.restore(); },
  };

  function tickMark(g, x, y, k, c) { if (k <= 0) return; const pts = [[x - 14, y], [x - 4, y + 10], [x + 16, y - 14]]; drawPartial(g, pts, k, c, 7); }
  function drawPartial(g, pts, k, c, w) {
    let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let left = total * clamp(k); const out = [pts[0]];
    for (let i = 1; i < pts.length && left > 0; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (L <= left) { out.push(pts[i]); left -= L; } else { const u = left / L; out.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]); left = 0; } }
    if (out.length > 1) line(g, out, w, c);
    return out;
  }
  function drawArrowPath(g, pts, k, c, w) {
    if (k <= 0.01) return;
    const out = drawPartial(g, pts, k, c, w);
    if (out.length < 2) return;
    const a = out[out.length - 1], b = out[out.length - 2]; const ang = Math.atan2(a[1] - b[1], a[0] - b[0]); const L = w * 3.4;
    line(g, [[a[0] - Math.cos(ang - 0.5) * L, a[1] - Math.sin(ang - 0.5) * L], a, [a[0] - Math.cos(ang + 0.5) * L, a[1] - Math.sin(ang + 0.5) * L]], w, c);
  }

  /* -------------------------------------------------------- bubbles */
  function drawBubble(g, b, F, th, t, view) {
    const t0 = b.in || 0, t1 = b.out != null ? b.out : t0 + 2.5;
    if (t < t0 || t >= t1) return;
    const k = E.back(seg(t, t0, t0 + 0.28)) * (1 - E.in2(seg(t, t1 - 0.2, t1)));
    const size = b.size || 30, maxW = b.w || 360, font = th.font;
    const lines = wrap(g, b.text, maxW, size, font, 800);
    g.font = `800 ${size}px "${font}"`;
    const w = Math.max(...lines.map((s) => g.measureText(s).width)) + size * 1.3, h = lines.length * size * 1.25 + size * 0.9;
    const side = b.side || (F ? F.face : 1);
    const hx = F ? F.head[0] : (b.x || 0), hy = F ? F.top : (b.y || -300);
    let cx = hx + side * (w / 2 + 10), by = hy - 22;
    const half = view ? view.halfW - 20 : 900;
    cx = clamp(cx, -half + w / 2, half - w / 2);
    const topY = view ? view.topY + 20 : -1000;
    if (by - h < topY) by = topY + h;
    g.save(); g.translate(cx, by); g.scale(k, k); g.translate(-cx, -by);
    const fill = b.fill ? col(th, b.fill) : th.paper, ink = th.ink === th.paper ? '#111111' : (b.kind === 'shout' ? th.red : th.ink);
    if (b.kind === 'think') {
      box(g, cx - w / 2, by - h, w, h, h / 2, fill, ink, 4.5);
      const dx = hx + side * 18 - cx, dy = hy - by; [0.35, 0.65].forEach((u, i) => circle(g, cx + dx * (0.3 + u * 0.7), by + dy * u + 6, 9 - i * 4, fill, ink, 3.5));
    } else {
      const tx = clamp(hx + side * 26, cx - w / 2 + 22, cx + w / 2 - 22);
      rr(g, cx - w / 2, by - h, w, h, Math.min(22, h / 2));
      g.fillStyle = fill; g.fill();
      g.beginPath(); g.moveTo(tx - 16, by - 2); g.lineTo(F ? hx + side * 10 : tx, by + 22); g.lineTo(tx + 16, by - 2); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = b.kind === 'shout' ? 6 : 4.5; g.lineJoin = 'round';
      rr(g, cx - w / 2, by - h, w, h, Math.min(22, h / 2)); g.stroke();
      g.beginPath(); g.moveTo(tx - 15, by); g.lineTo(F ? hx + side * 10 : tx, by + 22); g.lineTo(tx + 15, by); g.stroke();
      g.fillStyle = fill; g.fillRect(tx - 13, by - 6, 26, 8);
    }
    const tc = b.fill ? (contrast(fill, '#ffffff') >= contrast(fill, '#111111') ? '#ffffff' : '#111111') : th.paperInk;
    lines.forEach((s, i) => text(g, s, cx, by - h + size * 0.45 + size * 0.62 + i * size * 1.25, size, tc, { font }));
    g.restore();
  }

  function drawEmote(g, em, F, th, t) {
    if (!em) return;
    const u = (t - em.t0) / em.dur; if (u < 0 || u > 1) return;
    const k = E.back(seg(u, 0, 0.18)) * (1 - E.in2(seg(u, 0.8, 1)));
    const x = F.head[0] + F.face * 30, y = F.top - 40 - u * 14;
    g.save(); g.translate(x, y); g.scale(k, k);
    const s = em.s;
    if (s === 'idea') drawBulb(g, 0, -10, 0.5, th, true);
    else if (s === 'heart') heart(g, 0, 0, 24, th.red);
    else if (s === 'sweat') { g.beginPath(); g.moveTo(30, -30); g.quadraticCurveTo(46, -6, 30, 0); g.quadraticCurveTo(14, -6, 30, -30); g.fillStyle = '#5DADEC'; g.fill(); }
    else if (s === 'anger') { const c = th.red; [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b2]) => { const sx = a ? 1 : -1, sy = b2 ? 1 : -1; line(g, [[sx * 6, sy * 18], [sx * 6, sy * 6], [sx * 18, sy * 6]], 6, c); }); }
    else if (s === 'music') { text(g, '♪', -10, 0, 50, th.accent); text(g, '♫', 22, -18, 40, th.accent); }
    else if (s === 'zzz') { text(g, 'z', 0, 0, 28, th.ink); text(g, 'z', 18, -22, 36, th.ink); text(g, 'Z', 40, -48, 46, th.ink); }
    else text(g, s, 0, 0, 64, s === '?' ? th.accent : s === '$' ? th.green : th.red, { font: th.titleFont, weight: 400, stroke: th.bg, sw: 10 });
    g.restore();
  }

  /* ---------------------------------------------------- backgrounds */
  function drawBackground(g, sc, th, view, t) {
    const { halfW, topY, botY } = view;
    const W = halfW * 2 + 400, L = -halfW - 200;
    g.fillStyle = th.bg; g.fillRect(L, topY - 200, W, botY - topY + 400);
    const bg = sc.bg || 'plain';
    if (bg === 'grid' || bg === 'blueprint') {
      g.strokeStyle = rgba(th.ink, bg === 'blueprint' ? 0.16 : 0.07); g.lineWidth = 2;
      for (let x = Math.floor(L / 60) * 60; x < L + W; x += 60) { g.beginPath(); g.moveTo(x, topY - 200); g.lineTo(x, 0); g.stroke(); }
      for (let y = 0; y > topY - 200; y -= 60) { g.beginPath(); g.moveTo(L, y); g.lineTo(L + W, y); g.stroke(); }
    } else if (bg === 'notebook') {
      g.strokeStyle = rgba('#5DADEC', 0.3); g.lineWidth = 2; for (let y = 0; y > topY - 200; y -= 48) { g.beginPath(); g.moveTo(L, y); g.lineTo(L + W, y); g.stroke(); }
      g.strokeStyle = rgba('#E2453C', 0.4); g.beginPath(); g.moveTo(-halfW + 90, topY - 200); g.lineTo(-halfW + 90, botY); g.stroke();
    } else if (bg === 'dots') {
      g.fillStyle = rgba(th.ink, 0.08); for (let x = Math.floor(L / 50) * 50; x < L + W; x += 50) for (let y = 0; y > topY - 200; y -= 50) { g.beginPath(); g.arc(x + ((y / 50) % 2 ? 25 : 0), y, 4, 0, Math.PI * 2); g.fill(); }
    } else if (bg === 'room') {
      g.fillStyle = mixc(th.bg, th.ink, 0.04); g.fillRect(L, topY - 200, W, -topY + 200);
      const wx = sc.windowX != null ? sc.windowX : halfW * 0.45; box(g, wx - 110, -420, 220, 170, 6, mixc(th.bg, '#7EC8F2', 0.35), th.ink, 5); line(g, [[wx, -420], [wx, -250]], 5, th.ink); line(g, [[wx - 110, -335], [wx + 110, -335]], 5, th.ink);
      const fx = sc.frameX != null ? sc.frameX : -halfW * 0.5; box(g, fx - 50, -400, 100, 76, 4, th.paper, th.ink, 4); circle(g, fx - 14, -366, 12, th.accent); g.beginPath(); g.moveTo(fx - 40, -334); g.lineTo(fx, -372); g.lineTo(fx + 40, -334); g.closePath(); g.fillStyle = th.green; g.fill();
    } else if (bg === 'outdoor') {
      const sx = halfW * 0.62; circle(g, sx, topY + 140, 58, mixc(th.gold, th.bg, 0.15));
      PROPS.cloud(g.__pushT(-halfW * 0.4, 0), { lift: -topY - 150, s: 1.1, color: mixc(th.paper, th.bg, 0.2) }, th, t); g.restore();
      PROPS.cloud(g.__pushT(halfW * 0.15, 0), { lift: -topY - 230, s: 0.8, color: mixc(th.paper, th.bg, 0.2) }, th, t); g.restore();
      g.fillStyle = mixc(th.green, th.bg, 0.6); g.beginPath(); g.moveTo(L, 0); for (let x = L; x <= L + W; x += 40) g.lineTo(x, -60 - Math.sin(x / 260) * 45 - Math.sin(x / 90) * 8); g.lineTo(L + W, 0); g.closePath(); g.fill();
    } else if (bg === 'city') {
      for (let i = 0; i < 18; i++) { const x = L + (i * W) / 18, h = 160 + hash(i) * 260; g.fillStyle = mixc(th.ink, th.bg, 0.86); g.fillRect(x, -h, W / 18 - 6, h); }
    } else if (bg === 'stage') {
      const gr = g.createRadialGradient(0, -200, 40, 0, -200, 700); gr.addColorStop(0, rgba(th.gold, 0.22)); gr.addColorStop(1, rgba(th.gold, 0)); g.fillStyle = gr; g.fillRect(L, topY - 200, W, -topY + 200);
      g.fillStyle = mixc(th.red, th.bg, 0.25); g.fillRect(L, topY - 200, 160 + (L + halfW + 200), -topY + 200); g.fillRect(halfW - 160, topY - 200, 400, -topY + 200);
    } else if (bg === 'night') {
      for (let i = 0; i < 40; i++) circle(g, L + hash(i) * W, topY + hash(i + 50) * (-topY - 120), 2 + hash(i + 7) * 2.5, rgba(th.ink, 0.5 + 0.4 * Math.sin(t * 2 + i)));
      circle(g, halfW * 0.6, topY + 150, 46, mixc('#ffffff', th.bg, 0.15));
    } else if (bg === 'sunburst') {
      g.save(); g.translate(0, -260); g.rotate(t * 0.15); for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 2400, (i / 16) * Math.PI * 2, ((i + 0.5) / 16) * Math.PI * 2); g.closePath(); g.fillStyle = rgba(th.accent, 0.08); g.fill(); } g.restore();
    }
    if (sc.ground !== false && bg !== 'none') {
      g.fillStyle = th.ground; g.fillRect(L, 0, W, botY + 200);
      g.strokeStyle = th.line; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(L, 0); g.lineTo(L + W, 0); g.stroke();
    }
  }

  /* ---------------------------------------------------- the view */
  function makeView(W, H, format) {
    const portrait = format === 'portrait' || H > W;
    const units = portrait ? 660 : 1400;
    const s = W / units, groundY = H * (portrait ? 0.655 : 0.79);
    return { s, groundY, W, H, portrait, halfW: units / 2, topY: -groundY / s, botY: (H - groundY) / s };
  }
  STICK.makeView = makeView;

  /* ---------------------------------------------------- draw a scene */
  function drawScene(g, sc, t, themeDef, opts) {
    opts = opts || {};
    const th = makeTheme(themeDef || opts.theme);
    const W = g.canvas.width, H = g.canvas.height;
    const v0 = makeView(W, H, opts.format);
    const dur = Math.max(0.01, (sc.end != null && sc.start != null) ? sc.end - sc.start : (sc.dur || 4));
    const u = clamp(t / dur);
    const cam = sc.cam || {};
    let zoom = lerp((cam.zoom || [1, 1])[0], (cam.zoom || [1, 1])[1], E.soft(u)) * (opts.zoom || 1);
    let cx = lerp((cam.x || [0, 0])[0], (cam.x || [0, 0])[1], E.soft(u));
    let cy = lerp((cam.y || [0, 0])[0], (cam.y || [0, 0])[1], E.soft(u));
    if (sc.enter === 'zoom') zoom *= lerp(1.18, 1, E.out3(seg(t, 0, 0.45)));
    (sc.shake || []).forEach((s) => { const k = seg(t, s.t, s.t + (s.dur || 0.35)); if (k > 0 && k < 1) { const a = (s.amp || 14) * (1 - k); cx += Math.sin(t * 90) * a; cy += Math.cos(t * 77) * a * 0.6; } });
    let slide = sc.enter === 'slide' ? (1 - E.out3(seg(t, 0, 0.4))) * v0.halfW * 2 : 0;
    const view = Object.assign({}, v0, { halfW: v0.halfW / zoom, topY: v0.topY / zoom, botY: v0.botY / zoom });
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = th.bg; g.fillRect(0, 0, W, H);
    g.setTransform(v0.s * zoom, 0, 0, v0.s * zoom, W / 2 - (cx - slide) * v0.s * zoom, v0.groundY - cy * v0.s * zoom);
    g.__pushT = (x, y) => { g.save(); g.translate(x, y); return g; };
    drawBackground(g, sc, th, { halfW: view.halfW + Math.abs(cx) + slide, topY: view.topY + cy, botY: view.botY + cy }, t);

    const style = opts.style || sc.style || 'crew';
    const faces = opts.faces != null ? opts.faces : (sc.faces != null ? sc.faces : style === 'doodle');
    const cast = opts.cast || {};

    const drawProp = (p) => {
      const fn = PROPS[p.type]; if (!fn) return;
      const tin = p.in || 0; if (t < tin) return;
      if (p.out != null && t >= p.out + 0.25) return;
      let k = p.pop === false ? 1 : E.back(seg(t, tin, tin + 0.38));
      let a = p.out != null ? 1 - E.in2(seg(t, p.out, p.out + 0.25)) : 1;
      if (p.fade) { a *= E.soft(seg(t, tin, tin + 0.35)); k = 1; }
      let x = p.x || 0, y = p.y || 0;
      (p.moves || []).forEach((m) => { if (t >= m.t) { const mk = (E[m.ease || 'soft'])(seg(t, m.t, m.t + (m.dur || 0.6))); if (m.arc) { const nx = lerp(x, m.x != null ? m.x : x, mk), ny = lerp(y, m.y != null ? m.y : y, mk) - Math.sin(Math.PI * mk) * m.arc; x = nx; y = ny; } else { x = lerp(x, m.x != null ? m.x : x, mk); y = lerp(y, m.y != null ? m.y : y, mk); } } });
      const bob = p.float ? Math.sin(t * 2.4 + (p.x || 0)) * 8 : 0;
      g.save(); g.globalAlpha *= a; g.translate(x, y + bob);
      if (p.rot) g.rotate(p.rot); if (p.spin) g.rotate(t * p.spin);
      g.scale(k * (p.scale || 1), k * (p.scale || 1));
      fn(g, p, th, t, view);
      if (p.label) text(g, p.label, 0, 34, p.labelSize || 26, th.ink);
      g.restore();
    };
    (sc.props || []).filter((p) => p.layer !== 'front').forEach(drawProp);

    const figs = {};
    (sc.actors || []).forEach((a) => {
      const st = actorState(a, t, sc);
      const c = Object.assign({}, cast[a.id] || {}, a);
      const F = solveFig(st.pose, st.x, st.face, c.scale || 1);
      figs[a.id] = { F, st };
      if (st.alpha <= 0.001) return;
      drawFig(g, F, {
        theme: th, style, faces, color: c.color != null ? c.color : 0, acc: c.acc, shirt: c.shirt,
        expr: st.expr, t, seed: st.seed, talking: st.talking, alpha: st.alpha,
        held: st.hold ? (gg, FF) => drawHeld(gg, FF, st.hold, th, t) : null,
      });
    });
    (sc.props || []).filter((p) => p.layer === 'front').forEach(drawProp);
    (sc.bubbles || []).forEach((b) => drawBubble(g, b, b.actor && figs[b.actor] ? figs[b.actor].F : null, th, t, view));
    Object.values(figs).forEach(({ F, st }) => st.alpha > 0.01 && drawEmote(g, st.emote, F, th, t));

    if (sc.title) {
      const ti = sc.title, tin = ti.in != null ? ti.in : 0.1, tout = ti.out != null ? ti.out : dur;
      if (t >= tin && t < tout) {
        const k = E.back(seg(t, tin, tin + 0.4)) * (1 - E.in2(seg(t, tout - 0.2, tout)));
        const size = ti.size || (v0.portrait ? 64 : 78), y = view.topY * 0.82 + (ti.dy || 0);
        g.save(); g.translate(cx, y); g.scale(k, k);
        const lines = wrap(g, ti.text, view.halfW * 1.7, size, th.titleFont, 400);
        lines.forEach((s, i) => text(g, s, 0, i * size * 1.1, size, ti.color != null ? col(th, ti.color) : th.ink, { font: th.titleFont, weight: 400 }));
        if (ti.sub) text(g, ti.sub, 0, lines.length * size * 1.1 + 6, size * 0.45, th.accent, { font: th.font, weight: 900 });
        if (ti.underline !== false) { const ww = Math.min(view.halfW * 1.4, lines[0].length * size * 0.32); drawPartial(g, [[-ww, size * 0.62 + (lines.length - 1) * size * 1.1], [ww, size * 0.62 + (lines.length - 1) * size * 1.1]], E.out3(seg(t, tin + 0.25, tin + 0.75)), th.accent, 10); }
        g.restore();
      }
    }
    (sc.flash || []).forEach((f) => { const k = 1 - seg(t, f, f + 0.18); if (t >= f && k > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = rgba('#ffffff', k * 0.7); g.fillRect(0, 0, W, H); g.restore(); } });
    g.restore();
    if (sc.enter === 'fade') { const k = 1 - E.soft(seg(t, 0, 0.3)); if (k > 0) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = rgba(th.bg, k); g.fillRect(0, 0, W, H); g.restore(); } }
    return { figs, view, theme: th };
  }

  /* ---------------------------------------------------- draw a story */
  function sceneAt(story, t) {
    const scs = story.scenes || [];
    for (let i = 0; i < scs.length; i++) if (t < scs[i].end || i === scs.length - 1) return scs[i];
    return scs[0];
  }
  function drawFrame(g, story, t, opts) {
    const sc = sceneAt(story, t); if (!sc) return;
    return drawScene(g, sc, t - (sc.start || 0), story.theme, Object.assign({ format: story.format, style: story.style, faces: story.faces, cast: story.cast }, opts || {}));
  }

  /* ---------------------------------------------------- exports */
  Object.assign(STICK, {
    drawScene, drawFrame, sceneAt, makeTheme, solveFig, drawFig, actorState, PROPS, E, seg, lerp, clamp, mixc, contrast, lum, hsv,
    text, box, circle, line, wrap, heart, version: '1.0.0',
  });
  root.STICK = STICK;
  if (typeof module !== 'undefined' && module.exports) module.exports = STICK;
})(typeof window !== 'undefined' ? window : globalThis);
