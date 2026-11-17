# story.json reference

One file describes the whole video. `scripts/build.mjs` reads it, adds the timing from the voiceover and hands it to the runtime. A full working example is `examples/ai-assistants/story.json`.

## Top level

```json
{
  "title": "What Are ChatGPT, Claude and Gemini?",
  "format": "portrait",             // "landscape" 1920x1080 or "portrait" 1080x1920
  "style": "doodle",                // "crew" solid colour figures, "doodle" ink lines + white heads with faces
  "faces": true,                    // faces on crew figures (doodle always has faces)
  "theme": "sapphire-coral-breeze",  // any id from themes.json, "id:dark", or "#hex,#hex,#hex[:dark]"
  "captions": { "style": "pop" },   // pop | boxed | karaoke | subtitle | none
  "voice": { "name": "Samantha", "rate": 178 },
  "music": { "src": "assets/music.mp3", "volume": 0.12 },   // optional
  "cast": { "riya": { "color": 3, "acc": "pony", "shirt": true }, "claude": { "color": 0, "acc": "bun", "shirt": true } },
  "pickerScene": 3,                 // scene shown on the theme picker
  "thumbnail": { "text": "CHATGPT, CLAUDE OR *GEMINI*?", "scene": 5, "at": 2.6, "expr": "happy", "hide": ["confetti"] },
  "scenes": [ ... ]
}
```

`cast` entries: `color` (index into the theme's crew colours, 0-4, or a hex), `acc` (accessory), `scale` (1 = normal; 0.7 for a child), `shirt` (doodle only: a coloured torso).

**Accessories:** `bun` `pony` `spiky` `cap` `chef` `bow` `crown` `glasses` `headband`.

## Scenes

```json
{
  "id": "claude",
  "line": "Claude is made by Anthropic. It is popular for writing and coding.",
  "note": "The Claude character stands by a board; 'writing' and 'coding' appear as they are said.",
  "bg": "plain",
  "cam": { "zoom": [1, 1.06], "x": [0, 40] },
  "enter": "cut",
  "props": [ ... ],
  "actors": [ ... ],
  "bubbles": [ ... ],
  "title": { "text": "Step 1", "sub": "save", "in": 0.1 },
  "shake": [{ "t": "@boom", "dur": 0.35, "amp": 14 }],
  "flash": ["@boom"],
  "pause": 0.5,
  "minDur": 3.5
}
```

| Field | Meaning |
|---|---|
| `line` | What the voice says. One scene per line. |
| `note` | What happens, in words. Shown on the storyboard. |
| `bg` | `plain` `grid` `notebook` `dots` `room` `outdoor` `city` `stage` `night` `sunburst` `blueprint` `none` |
| `ground` | `false` hides the ground line and band |
| `cam` | `zoom`, `x`, `y` as `[from, to]` over the scene. A slow `zoom: [1, 1.08]` adds life. |
| `enter` | `cut` (default) `fade` `slide` `zoom` |
| `title` | Big heading at the top: `text`, `sub`, `in`, `out`, `size`, `color`, `underline: false` |
| `shake`, `flash` | Camera shake and a white flash for impacts |
| `pause` | Silence after this line (default 0.35 s) |
| `minDur` | Hold the scene at least this long, for example for an ending |
| `dur` | Only used before a voiceover exists, to estimate timing |
| `boardAt` | Which second of the scene the storyboard shows |

## Times

Every time is in seconds from the start of the scene, **or a word reference** that `build.mjs` turns into the moment that word is spoken:

- `"@money"`: when "money" starts
- `"@money+0.3"` / `"@money-0.2"`: offset from it
- `"@4"`: the 5th word of the line (0-based)

Time fields: `t`, `in`, `out`, `on`, `open`, `talk`, and the arrays `flash`, `reveal`, `check`.

## World coordinates

The ground is `y = 0` and up is negative. `x = 0` is the centre of the frame.

- **16:9:** about ±700 visible. Keep content in ±620 and start entrances at ±900.
- **9:16:** about ±330 visible. Keep content in ±280 and start entrances at ±450.
- A standing figure is about 320 tall. Its head top sits near `y = -320`.

## Actors

```json
{ "id": "riya", "x": 450, "face": -1, "pose": "stand", "expr": "neutral", "hold": null, "in": 0, "out": null,
  "keys": [
    { "t": 0.1, "x": 120 },
    { "t": "@what", "pose": "think", "expr": "worried", "emote": "?" },
    { "t": "@run", "x": -450, "run": true },
    { "t": 3, "talk": 1.5 }
  ] }
```

Keys run in time order. Each one can set:

| Key | Effect |
|---|---|
| `pose` | Blend to a pose over `ease` seconds (default 0.32) |
| `x` | Walk there (or `run: true`); `dur` overrides the speed. The figure turns to face the way it walks unless the key also sets `face`. |
| `face` | `1` faces right, `-1` faces left |
| `expr` | Change expression |
| `hold` | Put something in the front hand, or `null` to drop it |
| `emote` | Pop a symbol over the head for `edur` seconds (default 1.5) |
| `talk` | Move the mouth for this many seconds (bubbles already do this) |

**Poses (37):** `stand` `wave` `point` `pointUp` `present` `explain` `talk` `think` `cheer` `celebrate` `shrug` `facepalm` `sad` `shocked` `scared` `angry` `hold` `phone` `type` `sit` `sitThink` `sitType` `crouch` `jump` `fight` `punch` `kick` `block` `fall` `lie` `lieFront` `bow` `dance` `sleep` `lookUp` `eat` `run`

Poses that loop on their own: `wave`, `cheer`, `celebrate`, `type`, `sitType`, `talk`, `explain`, `fight`, `dance`, `eat`.

**Expressions (13):** `neutral` `happy` `laugh` `sad` `cry` `shocked` `angry` `smug` `sleepy` `worried` `love` `cool` `dead`

**Held items:** `phone` `cup` `book` `money` `coin` `bag` `sign:TEXT` `sword` `pencil` `mic` `bulb` `bowl` `flag`

**Emotes:** `?` `!` `!?` `$` `idea` `heart` `sweat` `anger` `music` `zzz`, or any short text.

## Props

```json
{ "type": "chart", "x": 60, "y": 0, "in": 0.1, "out": null, "layer": "back", "scale": 1, "values": [10, 12, 15], "grow": 2 }
```

Common fields on every prop:

| Field | Meaning |
|---|---|
| `x`, `y` | Position (bottom centre for things on the ground) |
| `in`, `out` | When it pops in (with a bounce) and out |
| `fade: true` | Fade in instead of the bounce |
| `pop: false` | Appear at once |
| `layer` | `back` (default, behind figures) or `front` |
| `scale`, `rot`, `spin` | Size, rotation, continuous spin |
| `float: true` | Bob gently |
| `moves` | `[{ "t": 1, "x": 200, "y": -100, "dur": 0.6, "arc": 120 }]`, which slides or throws the prop along an arc |
| `label` | A caption under the prop |
| `color` | A crew index (0-4), a theme name (`accent` `gold` `green` `red` `ink`) or a hex |

| Type | Extra fields | Good for |
|---|---|---|
| `board` | `title`, `lines[]`, `reveal[]` (times), `check[]` (tick times), `w`, `h`, `lift`, `size`, `noLegs` | lists, definitions, steps |
| `chart` / `bars` | `values[]`, `labels[]`, `colors[]`, `grow`, `showValues`, `prefix`, `suffix`, `trend` | comparisons, growth |
| `growth` | `down: true`, `w`, `h` | a line that shoots up (or crashes) |
| `counter` | `from`, `to`, `prefix`, `suffix`, `decimals`, `dur`, `size`, `box` | money, views, years |
| `text` | `text` (use `\n` for lines), `size`, `box`, `tilt`, `outline`, `font: "body"` | big words, stamps |
| `pill` | `text`, `size` | tags like "+5%" or "Step 2" |
| `arrow` | `from: [x, y]`, `to: [x, y]`, `bend`, `draw` | pointing, flow |
| `coin` `coins` `money` `bag` `piggy` | `n`, `grow`, `spin` | money topics |
| `desk` `table` `chair` `bed` `laptop` `computer` | `w`, `h`, `face` | home, office, school |
| `phone` | `text`, `icon` (`heart` `like` `play`), `likes` | social media |
| `bulb` | `on` (time it lights) | ideas |
| `clock` `calendar` | `speed` / `days: [1, 30]`, `flip`, `month` | time passing |
| `house` `building` `tree` `door` `stairs` `crate` | `open` (door), `n` (stairs), `label` | places, progress |
| `heart` `star` `question` `exclaim` `gem` `trophy` `target` `globe` | `s` | symbols |
| `rocket` | `tilt` (move it with `moves`) | launches, growth |
| `burst` | `text` | POW! for fights and big reveals |
| `confetti` `sparkles` | `n`, `w` | celebrations |
| `sign` | `text` | labels in the world |
| `bowl` | `s` | food, cooking |
| `cloud` `sun` | `lift` | outdoor extras |
| `pipe` | `face`, `w`, `lift` | escape and puzzle scenes |

## Bubbles

```json
{ "actor": "riya", "text": "Which one is best?", "in": "@best", "out": 99, "kind": "say", "size": 30, "w": 360, "side": -1, "fill": 2 }
```

`kind`: `say` (default), `think` (cloud), `shout` (red outline). Bubbles sit beside the speaker's head, stay inside the frame and make the speaker's mouth move. Leave `actor` out and give `x`, `y` for a floating bubble.

## Recipes

**Explainer beat:** a figure presents a board, the board lines reveal on their words, and the other figure reacts.

**Money growth:** `coins` with `grow`, then a `chart` with `grow`, then a `counter` with `prefix: "$"`, then `confetti`.

**Relatable comedy ("POV"):** a `room` background, `sit` + `phone`, a `think` bubble with the inner thought, an `!` emote on the punchline.

**Versus fight:** two figures in `fight`, the pose sequence `punch` → `block` → `kick` → `fall`, with a `burst` "POW!", a `shake` and a `flash` on the hit word.

**Escape or puzzle:** a `stage` or `plain` background, `pipe` props in crew colours, `gem` props floating, and figures walking to their colour.
