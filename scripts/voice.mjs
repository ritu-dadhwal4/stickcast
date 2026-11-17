#!/usr/bin/env node
// stickcast voiceover. (c) Ritu Dadhwal — MIT
//
//   node voice.mjs voices                                   list free voices on this Mac
//   node voice.mjs samples --text "Hook line" --voices "Samantha,Daniel,Karen" --out <dir>
//   node voice.mjs make <project> --voice Samantha [--rate 180] [--gap 0.35] [--model small.en] [--no-transcribe]
//   node voice.mjs join <project>     use your own per-line files: assets/lines/01.wav, 02.wav ... (any TTS, or your own voice)
//
// make/join write assets/voice.wav, assets/lines.json (exact start/end of every scene) and,
// unless --no-transcribe, assets/transcript.json (word timings for captions) via `npx hyperframes transcribe`.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { args, loadStory, tokenize, ensureDir, writeJSON } from './lib.mjs';

const a = args();
const cmd = a._[0];
const run = (bin, argv, opt = {}) => execFileSync(bin, argv, { stdio: ['ignore', 'pipe', 'pipe'], ...opt }).toString();
const dur = (f) => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]).trim());
const clean = (s) => String(s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();

function sayTo(text, voice, rate, outWav) {
  const aiff = outWav.replace(/\.wav$/, '.aiff');
  const argv = ['-o', aiff];
  if (voice) argv.push('-v', voice);
  if (rate) argv.push('-r', String(rate));
  argv.push(clean(text));
  run('say', argv);
  toWav(aiff, outWav);
  fs.rmSync(aiff, { force: true });
}
function toWav(src, out) {
  // trim leading/trailing silence so scene timing is tight
  run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse', '-ar', '48000', '-ac', '1', out]);
}
function silence(sec, out) {
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', sec.toFixed(3), out]);
}

if (cmd === 'voices') {
  const list = run('say', ['-v', '?']).split('\n').filter((l) => /\ben_(US|GB|IN|AU|IE|ZA)\b/.test(l));
  const good = ['Samantha', 'Daniel', 'Karen', 'Rishi', 'Moira', 'Tessa', 'Flo', 'Reed', 'Eddy', 'Sandy', 'Shelley', 'Ava', 'Zoe', 'Evan', 'Nathan', 'Allison', 'Tom', 'Susan', 'Serena', 'Oliver'];
  const picked = list.map((l) => l.split(/\s{2,}/)[0].trim()).filter((n) => good.some((g) => n.startsWith(g)));
  console.log(JSON.stringify({ recommended: picked, all: list.map((l) => l.split(/\s{2,}/)[0].trim()) }, null, 1));
} else if (cmd === 'samples') {
  const out = ensureDir(path.resolve(a.out || 'voice-samples'));
  const voices = String(a.voices || 'Samantha,Daniel,Karen').split(',').map((s) => s.trim()).filter(Boolean);
  const text = a.text || 'Here is a quick idea that can change how you think about money.';
  const files = [];
  for (const v of voices) {
    const base = path.join(out, v.replace(/[^\w]+/g, '-').replace(/-+$/, '').toLowerCase());
    try {
      sayTo(text, v, a.rate, base + '.wav');
      run('ffmpeg', ['-y', '-v', 'error', '-i', base + '.wav', '-c:a', 'aac', '-b:a', '128k', base + '.m4a']);
      fs.rmSync(base + '.wav');
      files.push({ voice: v, file: base + '.m4a' });
    } catch (e) { files.push({ voice: v, error: 'voice not installed on this Mac' }); }
  }
  console.log(JSON.stringify({ ok: true, files }, null, 1));
} else if (cmd === 'make' || cmd === 'join') {
  const dir = path.resolve(a._[1] || '.');
  const story = loadStory(dir);
  const assets = ensureDir(path.join(dir, 'assets'));
  const tmp = ensureDir(path.join(dir, '.stickcast-tmp'));
  const gap = a.gap != null ? +a.gap : 0.35, lead = a.lead != null ? +a.lead : 0.35, tail = a.tail != null ? +a.tail : 0.9;
  const voice = a.voice || (story.voice && story.voice.name) || 'Samantha';
  const rate = a.rate || (story.voice && story.voice.rate) || 180;
  const parts = [], lines = [];
  let cursor = 0;
  story.scenes.forEach((sc, i) => {
    const n = String(i + 1).padStart(2, '0');
    const wav = path.join(tmp, `line-${n}.wav`);
    if (cmd === 'make') {
      if (!tokenize(sc.line).length) silence(sc.dur || 2, wav);
      else sayTo(sc.line, voice, rate, wav);
    } else {
      const src = ['wav', 'mp3', 'm4a', 'aiff'].map((e) => path.join(assets, 'lines', `${n}.${e}`)).find((f) => fs.existsSync(f));
      if (!src) throw new Error(`Missing assets/lines/${n}.wav (or .mp3/.m4a) for scene ${i + 1}`);
      toWav(src, wav);
    }
    const d = dur(wav);
    const pre = i === 0 ? lead : 0.06;
    const post = (sc.pause != null ? sc.pause : gap) + (i === story.scenes.length - 1 ? tail : 0);
    const minDur = sc.minDur || 0;
    const extra = Math.max(0, minDur - (pre + d + post));
    const s0 = path.join(tmp, `pre-${n}.wav`), s1 = path.join(tmp, `post-${n}.wav`);
    silence(pre, s0); silence(post + extra, s1);
    parts.push(s0, wav, s1);
    const start = cursor, speechStart = cursor + pre, speechEnd = speechStart + d, end = speechEnd + post + extra;
    lines.push({ scene: sc.id || `s${i + 1}`, start: +start.toFixed(3), speechStart: +speechStart.toFixed(3), speechEnd: +speechEnd.toFixed(3), end: +end.toFixed(3) });
    cursor = end;
  });
  const list = path.join(tmp, 'concat.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  const voiceWav = path.join(assets, 'voice.wav');
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ar', '48000', '-ac', '1', voiceWav]);
  writeJSON(path.join(assets, 'lines.json'), { voice: cmd === 'make' ? voice : 'own files', rate: cmd === 'make' ? +rate : null, duration: +dur(voiceWav).toFixed(3), lines });
  fs.rmSync(tmp, { recursive: true, force: true });
  let transcript = null;
  if (!a['no-transcribe']) {
    try {
      run('npx', ['-y', 'hyperframes', 'transcribe', 'assets/voice.wav', '--model', a.model || 'small.en', '--json'], { cwd: dir, timeout: 900000 });
      transcript = fs.existsSync(path.join(assets, 'transcript.json')) ? 'assets/transcript.json' : null;
    } catch (e) { transcript = null; console.error('transcribe failed; captions will use estimated word timing:', String(e.stderr || e.message).slice(0, 300)); }
  }
  console.log(JSON.stringify({ ok: true, voice: voiceWav, duration: +dur(voiceWav).toFixed(2), scenes: lines.length, transcript }, null, 1));
} else {
  console.log('usage: voice.mjs voices | samples | make <project> | join <project>');
  process.exit(1);
}
