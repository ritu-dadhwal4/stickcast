// Shared look for stickcast's review pages (storyboard, caption picker). (c) Ritu Dadhwal — MIT
import { FONT_LINK } from './lib.mjs';

export const PAGE_HEAD = (title) => `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${FONT_LINK}
<style>
/* Layout: one column of review cards, each a frame on the left and its notes on the right; stacks on phones. */
:root {
  --bg: #EEF0F3; --surface: #FFFFFF; --fg: #16181D; --muted: #5C6370; --line: #D5D9E0; --pick: #2F6BFF; --pick-soft: #E3EBFF;
  --display: 'Archivo Black', 'Arial Black', sans-serif; --body: 'Nunito', system-ui, sans-serif; --mono: ui-monospace, 'SF Mono', Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #111317; --surface: #1A1D23; --fg: #EDEFF3; --muted: #9AA3B2; --line: #2C313A; --pick: #6E9BFF; --pick-soft: #1E2A45; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #111317; --surface: #1A1D23; --fg: #EDEFF3; --muted: #9AA3B2; --line: #2C313A; --pick: #6E9BFF; --pick-soft: #1E2A45; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--body); font-size: 15px; margin: 0; }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header { display: grid; gap: 10px; margin-bottom: 24px; }
.eyebrow { font-weight: 900; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
h1 { font-family: var(--display); font-weight: 400; font-size: clamp(28px, 4vw, 44px); line-height: 1.05; margin: 0; text-wrap: balance; }
.lede { color: var(--muted); max-width: 68ch; margin: 0; line-height: 1.5; font-weight: 700; }
.facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.fact { font-weight: 800; font-size: 13px; background: var(--surface); border: 1.5px solid var(--line); border-radius: 999px; padding: 5px 12px; }
.list { display: grid; gap: 16px; }
.item { background: var(--surface); border: 1.5px solid var(--line); border-radius: 14px; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); }
.item.portrait { grid-template-columns: minmax(0, 0.55fr) minmax(0, 1fr); }
.frame { position: relative; background: #000; }
.frame canvas { display: block; width: 100%; height: auto; max-width: 100%; }
.notes { padding: 16px 18px; display: grid; gap: 10px; align-content: start; min-width: 0; }
.num { font-family: var(--display); font-weight: 400; font-size: 13px; letter-spacing: 0.06em; color: var(--muted); display: flex; gap: 10px; align-items: baseline; }
.num b { font-family: var(--body); font-weight: 900; color: var(--fg); background: var(--bg); border-radius: 6px; padding: 1px 8px; font-size: 12px; }
.say { font-size: 19px; line-height: 1.4; font-weight: 800; margin: 0; }
.what { color: var(--muted); font-weight: 700; line-height: 1.45; margin: 0; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; font-weight: 800; color: var(--muted); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; }
.foot { margin-top: 26px; color: var(--muted); font-weight: 700; }
@media (max-width: 720px) { .item, .item.portrait { grid-template-columns: minmax(0, 1fr); } .item.portrait .frame { max-width: 320px; } }
</style>`;
