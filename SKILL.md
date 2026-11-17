---
name: stickcast
description: Make faceless, narrated stick-figure videos for YouTube, Shorts, Reels and TikTok - explainers, money and science lessons, relatable comedy, versus fights and story shorts - from a topic to a finished MP4 and thumbnail. Walks the user through script, colour theme (58 visual themes, including Figma palettes and black & white), optional storyboard, voice, captions, animation, HyperFrames render and thumbnail, with an approval at every step. Use when someone asks for a stick figure video, stickman animation, faceless video, explainer video with stick figures, "/stickcast", or a video "like those stickman channels".
---

# stickcast

Faceless stick-figure videos, narrated. By Ritu Dadhwal.

A short line of script becomes one scene: coloured stick characters act it out with props, speech bubbles and emotes, a voice reads it, captions pop word by word, and HyperFrames renders the MP4. Everything on screen is drawn by `runtime/stick.js` as a pure function of time, so the theme picker, the storyboard, the thumbnail and the final render all look exactly the same.

## Files

- `runtime/stick.js` - the engine: figures, 37 poses, 13 expressions, accessories, held items, 46 props, backgrounds, bubbles, emotes, camera, themes. Never edit it per video.
- `themes/themes.json` - 10 classic looks (black & white, chalkboard, blueprint, neon...) and 48 palette themes from Figma's colour palette collection. Any id takes `:dark` / `:light`, or pass a hex list.
- `docs/story-format.md` - **read before writing story.json**: every scene field, pose, expression, prop and background, with examples.
- `scripts/` - one job each, all print JSON:
  - `new.mjs <dir>` - new project (a HyperFrames project plus `story.json`)
  - `picker.mjs --story <dir>` - theme picker page
  - `storyboard.mjs <dir>` - storyboard page
  - `voice.mjs voices | samples | make <dir> | join <dir>` - voice samples, the full voiceover, scene timing and word timing
  - `caption-picker.mjs <dir>` - caption style page
  - `build.mjs <dir>` - writes the HyperFrames composition
  - `thumbnail.mjs <dir>` - thumbnail PNG
  - `shot.mjs` - screenshot any page with Chrome
- `examples/ai-assistants/` - a finished 35 s vertical Short ("What are ChatGPT, Claude and Gemini?", doodle style): `story.json`, MP4, both thumbnails.

`<skill>` below means the folder this file is in. Videos go in `~/Desktop/stickcast-videos/<slug>/` unless the user names another place.

Needs: Node 18+, ffmpeg, Google Chrome, macOS `say` for free voices (or any other TTS through `voice.mjs join`), and `npx hyperframes` (the `/hyperframes` skills cover its rules).

## The flow: one approval per step

Do the steps in this order. Stop and wait at every **Stop**. Never skip ahead because a later step "looks obvious", and never redo an approved step unless the user asks.

### Step 1 - Script (in chat)

Ask nothing first unless the topic is missing. Write the script straight into chat:

- A **hook** in the first line (a question, a surprising number or a "POV:"), then one idea per line, then a short call to action.
- Each line becomes one scene, so keep lines to 6-16 words. A 60 s Short is about 12-16 lines; a 5 min explainer is about 60-80 lines.
- Under the script, state in one line what you assumed: format (16:9 long video, 9:16 Short, or both), length, character style (colour crew or doodle faces) and the cast (2-3 named characters). The user changes any of these in their reply.
- The script must be original. Rewrite facts in your own words and check numbers you state.

**Stop:** wait for "approved" or edits.

### Step 2 - Colour theme (artifact)

1. `node <skill>/scripts/new.mjs ~/Desktop/stickcast-videos/<slug> --format <landscape|portrait> --title "<title>"`
2. Write `story.json` with every scene staged (see `docs/story-format.md`): cast, actors, poses, props, bubbles. Put actions on words with `"@word"` times. Set `pickerScene` to the most typical scene.
3. `node <skill>/scripts/picker.mjs --story <project> --out <project>/theme-picker.html`
4. Publish the page with the Artifact tool (icon `palette`). Each card draws a scene from **their own script** in that theme, with a sample caption, so they see the real look. The page has filters (classic, light, dark, black & white) and a crew/doodle switch.

Tell them they can also give their own hex colours (`theme: #111,#F36363,#41D2EF:dark`).

**Stop:** wait for a theme name. Save it as `"theme"` in story.json (and `"style"` if they switched).

### Step 3 - Storyboard? (optional)

Ask one question: "Do you want a storyboard to check each scene before I add voice and motion?"

- **Yes:** `node <skill>/scripts/storyboard.mjs <project>`, publish `storyboard.html` (icon `film`). Each card shows the scene drawn in their theme with its line and what happens. **Stop:** wait for approval or scene changes; apply changes and republish to the same artifact.
- **No:** go straight to step 4.

### Step 4 - Voiceover

1. `node <skill>/scripts/voice.mjs voices` lists the good free voices on this Mac.
2. Pick 3 that suit the tone (calm explainer: Samantha, Daniel, Karen; Indian English: Rishi; playful: Flo, Reed, Sandy) and make samples of the hook line:
   `node <skill>/scripts/voice.mjs samples --text "<hook>" --voices "Samantha,Daniel,Karen" --out <project>/voice-samples`
3. Send the samples with SendUserFile, say which one you recommend and why in one line.
4. Mention the other options: their own recorded voice, or an AI voice from HeyGen or ElevenLabs (`/media-use`). For those, put one file per scene in `<project>/assets/lines/01.wav, 02.wav ...` and use `voice.mjs join` instead of `make`.

**Stop:** wait for the voice. Save it in story.json `"voice": { "name": "...", "rate": 180 }`.

### Step 5 - Caption style (artifact)

`node <skill>/scripts/caption-picker.mjs <project>`, publish `caption-styles.html` (icon `text`). It plays the first line in four styles over a frame in their theme: **pop** (bold uppercase, the spoken word lights up), **boxed** (words on a colour box), **karaoke** (a full line fills in), **subtitle** (calm strip). "No captions" is also fine.

**Stop:** wait for the style. Save it as `"captions": { "style": "pop" }`.

### Step 6 - Animate

1. `node <skill>/scripts/voice.mjs make <project>` (or `join`). It writes `assets/voice.wav`, `assets/lines.json` (each scene's exact start and end) and `assets/transcript.json` (word timing). The first run downloads the Whisper model.
2. Tighten the staging now that real timings exist: every `"@word"` lands on the spoken word. Check that slow props (chart `grow`, counter `dur`) fit inside their scene.
3. `node <skill>/scripts/build.mjs <project>`.

### Step 7 - Captions

Built by `build.mjs` from the transcript, in the chosen style, into `compositions/captions.html` (one captions track). If the transcript is missing, word timing is estimated from the voice length.

### Step 8 - Render with HyperFrames

Run inside the project:

1. `npx hyperframes check --json` - fix every error. Two warnings are expected and fine: `timeline_track_too_dense` on captions.
2. `npx hyperframes snapshot --at <one time per scene, about 60% in> --no-end`, then read the contact sheet. Look for: a bubble or prop over a face, anything cut off at the edge, captions over a figure, two scenes that look the same, an action that misses its word. Fix in story.json, rebuild, snapshot again.
3. Open the Studio preview so the user can watch and tweak it: `npx hyperframes preview --background`, and tell them they can also keep editing in the HyperFrames desktop app.
4. Render: `npx hyperframes render -o renders/<slug>.mp4`.

Then send the MP4 with SendUserFile.

### Step 9 - Thumbnail

`node <skill>/scripts/thumbnail.mjs <project> --text "SHORT *PUNCHY* TEXT" --scene <i> --at <sec>`

- 3-6 words, one highlighted with `*stars*`. The text goes on one side and the figures on the other; `--side right` flips it, and `--hide counter,confetti` removes busy props.
- 9:16 projects get a 1080x1920 cover; add `--landscape` for a 1280x720 YouTube thumbnail too.

Show it with SendUserFile. **Stop:** wait for approval or changes.

When approved, finish with: the MP4 path, the thumbnail path, and a ready-to-paste YouTube title (under 60 characters), description (2-3 lines plus chapters for long videos) and 5 tags.

## Staging rules (what makes a scene read)

- **One idea per scene, shown as an action.** A figure does something (points, drops coins, gets shocked) and the scene ends on a visible result (bars grown, counter landed, tick on the board).
- **Faces stay clear.** Bubbles, signs and props never cover a head. Put boards between figures, not in front of them.
- **Safe width.** Keep figures and props within x = ±620 in 16:9 and ±280 in 9:16. Entrances start off screen (x = ±900 / ±450) and walk in.
- **Two or three characters.** Give each a crew colour and an accessory (`bun`, `cap`, `chef`, `glasses`, `crown`...) so viewers tell them apart. Keep the same cast across a series.
- **Sync to words.** Emotes, pose changes and props pop on the word that motivates them: `"t": "@shocked"`, `"in": "@money+0.2"`.
- **Vary the frame.** Change the background, camera (`cam.zoom`) or layout every 2-3 scenes; use `sunburst` or a `title` for the payoff.
- **Text on screen is short.** Board lines 2-4 words; big `text` props 1-3 words. The captions carry the sentence.
- **Original only.** No characters, logos or worlds from other creators or games (no copies of famous stick-figure series, no block-game textures, no brand mascots). Product names as plain text are fine.

## Changes the user may ask for

- "slower" / "faster": `voice.rate` (150-200), or `voice.mjs make --gap 0.5`.
- "make it vertical": set `"format": "portrait"`, pull x positions into ±280, rebuild. 9:16 places captions below the figures automatically.
- "change the colours": rerun step 2's picker, or set `"theme"` and rebuild; nothing else changes.
- "louder music": put a track at `assets/music.mp3` and set `"music": { "src": "assets/music.mp3", "volume": 0.12 }` in story.json.
- "different character look": `"style": "doodle"` (white heads with faces, ink lines) or `"crew"` (solid colour figures); `"faces": true/false`.
