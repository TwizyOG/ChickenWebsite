# Event Card Backgrounds Implementation Plan

> **Status: ✅ Shipped & verified (2026-07-16).** All 4 tasks landed on branch `events-backgrounds` (commits `d170d9e`, `9ec3bac`, `f146fee`, plus verification-polish `6f1f48b`). Gates: `npm run build` success, `npx vitest run` → 36 passing, no new lint errors in `EventCard.tsx`/`events.ts`. Preview review at card aspect confirmed both scenes render, animate, and frame correctly (no console errors; both SVGs 200). Two refinements were made during Task 4 review — prison razor wire became an overlapping bladed coil, and the RV X birds were recolored to a visible dusk-silhouette tone.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the two Events-hub card backgrounds — polish the existing RV X animated scene (`roadtrip.svg`) and give the Deepak Prison Stream card its own hand-authored, self-contained animated SVG scene (`prison.svg`) instead of the missing `/deepak-prison-stream.jpg` poster that currently falls back to a flat gradient.

**Architecture:** Backgrounds are static, self-contained SVG files in `public/`, rendered by [`EventCard`](../../../src/components/EventCard.tsx) as an `<img>` layered under a black legibility gradient (no client JS, no external assets — CSS-keyframe animation lives inside each SVG). Today `EventCard` hard-codes `scene === "roadtrip"` and only ever loads `/roadtrip.svg`; this plan generalizes it to render `/{scene}.svg` for any declared scene, then adds the `prison` scene and repoints the Deepak event at it. The RV X polish is additive edits to the existing SVG (new gradient/glow/bird/headlight layers), preserving every current animation.

**Tech Stack:** SVG 1.1 + CSS `@keyframes` (self-contained, `preserveAspectRatio` slice), Next.js 16.2.10 App Router static asset serving, React 19 presentational component, TypeScript. No new dependencies.

---

## Context for the executor (read first)

- **No real-person likeness.** The Deepak scene is *architecture and light only* — a night prison yard (wall, razor wire, guard tower, sweeping searchlight, barred cell windows, moon, fog). It depicts no person, no face, no name-as-portrait. This is deliberate and must stay that way.
- **Why SVG, not a photo:** `EventCard` was written (commit `95dfb10`) so a missing poster silently shows the hue gradient — no broken image. The RV X card already proves the self-contained animated-SVG approach (`roadtrip.svg`, commit `95dfb10`). We match that approach for Deepak rather than sourcing a photo.
- **Framing math (matters for element placement):** `EventCard` renders the scene as `<img class="object-cover">` in a box that is full card width × `h-28` (112px) / `sm:h-32` (128px). In a 2-column grid on a `max-w-5xl` page each card is ≈ 460–490px wide. `object-cover` **centers** (object-position 50% 50%), so the vertically-visible band of the 1200×360 viewBox is roughly **y ≈ 20 → 340** — the extreme top and bottom rows get cropped. **Keep hero elements between y≈70 and y≈320.** The SVG's own `preserveAspectRatio` is a secondary safety net; the `object-cover` box fit dominates. Always confirm visually in the preview (Task 4) and nudge Y positions if anything important is clipped.
- **Legibility overlay:** `EventCard` paints `bg-gradient-to-t from-black/80 via-black/25 to-black/40` over the scene, plus a white uppercase title bottom-left and an "Upcoming"/"Live now" badge top-left. So: the **bottom ~30% is heavily darkened** (fine — put ground/wall base there), the **top is only lightly dimmed** (put the moon, tower, beam up high so they read through). Keep the bottom-left corner uncluttered behind the title, and don't rely on fine detail surviving in the darkened bottom band.
- **No unit tests for this work.** vitest here runs in the bare Node environment (`vitest.config.ts` has no jsdom/testing-library), so there is no component-render harness and adding one is out of scope (YAGNI). SVGs are static assets and `EventCard` is presentational. Verification = the build typechecks the component/data change, lint stays clean on touched files, the existing 36 vitest tests stay green, **and** the preview browser shows both scenes animating and framed correctly (Task 4 — this is the real proof).
- **Gates before every commit:** `npm run lint` (repo baseline is 12 pre-existing `react-hooks/set-state-in-effect` errors in unrelated files — the gate is *zero new errors in files this plan touches*: `EventCard.tsx`, `events.ts`), `npm run build` (must succeed), `npx vitest run` (36 passing). Static-only tasks (1, 2) can't break lint/vitest but must still `npm run build` clean.
- **Dev server:** `.claude/launch.json` already defines `chickenweb` (`npm run dev`, port 3000). Preview route: `http://localhost:3000/events`.
- **Commit style:** one commit per task, message given in the task. End every commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

### File map

| File | Task | Change |
|---|---|---|
| `public/roadtrip.svg` | 1 | Modify — add sunset-glow radial, horizon haze band, drifting birds, RV headlight glow (keep all existing layers/animations) |
| `public/prison.svg` | 2 | Create — new self-contained night-prison-yard animated scene |
| `src/components/EventCard.tsx` | 3 | Modify — generalize `scene` handling to render `/{scene}.svg` for any scene |
| `src/lib/events.ts` | 3 | Modify — widen `scene` type to `"roadtrip" \| "prison"`; repoint Deepak event from `image` to `scene: "prison"` |
| (verification only) | 4 | Preview `/events`, confirm both cards, screenshot |

---

### Task 1: Polish the RV X scene (`roadtrip.svg`)

**Files:**
- Modify: `public/roadtrip.svg`

The current file is a single-line minified SVG: a dusk parallax scene (sky gradient + sun, clouds, stars, far mountains, mid-ground buildings/trees/signs, scrolling road with animated dashes, near-ground bushes/fence, and an animated RV that bobs, spins its wheels, and puffs exhaust). **Do not remove or restructure any of it.** These edits only *add* four tasteful layers. Because the file is minified, apply each edit as a precise find-and-insert against the anchor strings below.

- [x] **Step 1: Add two new gradients to `<defs>`**

Find the sun gradient's closing tag (anchor — it appears once):

```
<stop offset="1" stop-color="#C75B28"></stop></linearGradient>
```

Immediately after it, insert:

```xml
<radialGradient id="rt-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#F2A65A" stop-opacity="0.5"></stop><stop offset="0.5" stop-color="#C75B28" stop-opacity="0.16"></stop><stop offset="1" stop-color="#C75B28" stop-opacity="0"></stop></radialGradient><radialGradient id="rt-head" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FBE2A0" stop-opacity="0.85"></stop><stop offset="1" stop-color="#FBE2A0" stop-opacity="0"></stop></radialGradient>
```

- [x] **Step 2: Add the sunset glow + horizon haze behind the sun**

Find the sun circle (anchor):

```
<circle cx="330" cy="252" r="46" fill="url(#rt-sun)" opacity="0.85"></circle>
```

Replace it with the glow rect + haze band + the original sun circle (glow behind, sun in front):

```xml
<rect x="150" y="120" width="360" height="260" fill="url(#rt-glow)"></rect><rect x="0" y="244" width="1200" height="24" fill="#C75B28" opacity="0.10"></rect><circle cx="330" cy="252" r="46" fill="url(#rt-sun)" opacity="0.85"></circle>
```

- [x] **Step 3: Add bird + beam animations to the `<style>` block**

Find the last keyframe in the style block (anchor):

```
@keyframes rt-puff{0%{opacity:.4;transform:translate(0,0) scale(.5)}100%{opacity:0;transform:translate(-30px,-16px) scale(1.6)}}
```

Immediately after it (before `</style>`), insert:

```css
.rt-birds{animation:rt-scroll 120s linear infinite}
.rt-head{animation:rt-flicker 3.4s ease-in-out infinite}
@keyframes rt-flicker{0%,100%{opacity:.85}50%{opacity:.62}}
```

(The birds reuse the existing `rt-scroll` keyframe at a slow rate for far-parallax drift; the headlight reuses a new gentle flicker.)

- [x] **Step 4: Add drifting birds above the horizon**

Find the far-parallax layer group (anchor — the mountains layer):

```
<g class="rt-far"><use href="#rt-far-set"></use><use href="#rt-far-set" x="1200"></use></g>
```

Immediately **before** it, insert a birds layer (small dark silhouettes at y≈150, safely inside the visible band, drifting slowly; two copies offset by 1200 for a seamless loop):

```xml
<g class="rt-birds" fill="none" stroke="#1A140E" stroke-width="1.5" stroke-linecap="round" opacity="0.7"><g id="rt-bird-set"><path d="M150 150 q5 -5 10 0 q5 -5 10 0"></path><path d="M240 138 q4 -4 8 0 q4 -4 8 0"></path><path d="M330 158 q4 -4 8 0 q4 -4 8 0"></path><path d="M470 146 q5 -5 10 0 q5 -5 10 0"></path><path d="M690 152 q4 -4 8 0 q4 -4 8 0"></path></g><use href="#rt-bird-set" x="1200"></use></g>
```

- [x] **Step 5: Add the RV headlight glow**

Find the front headlight detail inside the RV body (anchor — the small warm headlight rect):

```
<rect x="111.5" y="39.5" width="3.4" height="4" rx="1.2" fill="#FBE2A0"></rect>
```

Immediately after it, insert a soft warm glow halo over the headlight (local RV coords; the RV group is `scale(2)` so this stays proportional):

```xml
<ellipse class="rt-head" cx="114" cy="41" rx="11" ry="7" fill="url(#rt-head)"></ellipse>
```

- [x] **Step 6: Verify the file is still valid XML and renders**

Run:

```bash
node -e "const s=require('fs').readFileSync('public/roadtrip.svg','utf8'); const o=(s.match(/<[a-zA-Z]/g)||[]).length, c=(s.match(/<\//g)||[]).length, sc=(s.match(/\/>/g)||[]).length; console.log('opens',o,'closes',c,'selfclose',sc); if(!s.includes('rt-glow')||!s.includes('rt-birds')||!s.includes('rt-head'))throw new Error('missing added layer');"
npm run build
```

Expected: the node check prints tag counts and throws nothing (all three new ids present); `npm run build` succeeds (static asset, so build is unaffected but confirms nothing else broke). Visual confirmation happens in Task 4.

- [x] **Step 7: Commit**

```bash
git add public/roadtrip.svg
git commit -m "$(cat <<'EOF'
Events: polish RV X scene (sunset glow, horizon haze, drifting birds, headlight)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create the Deepak Prison Stream scene (`prison.svg`)

**Files:**
- Create: `public/prison.svg`

A self-contained night prison-yard scene: deep-indigo sky with twinkling stars and a soft moon; a cell-block silhouette whose barred windows peek over a concrete perimeter wall topped with concertina razor wire; a guard tower on the right with a lit control room, a blinking red beacon, and a **searchlight beam that sweeps across the yard**; drifting ground fog; a faint light pool on the yard floor. Cool steel-blue/indigo palette (reads as night, complements the card's violet `hue: 265` fallback). Architecture and light only — no figures. Same `viewBox="0 0 1200 360"` as `roadtrip.svg` so `EventCard` framing is identical.

- [x] **Step 1: Create `public/prison.svg` with this exact content**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice">
<style>
.pz-beam{transform-box:view-box;transform-origin:1096px 108px;animation:pz-sweep 7s ease-in-out infinite alternate}
.pz-fog{animation:pz-drift 46s linear infinite}
.pz-beacon{animation:pz-blink 2.4s steps(1,end) infinite}
.pz-win-a{animation:pz-flick 5s ease-in-out infinite}
.pz-win-b{animation:pz-flick 3.7s ease-in-out infinite .9s}
.pz-star{animation:pz-tw 4s ease-in-out infinite}
.pz-star--2{animation-delay:1.3s}
.pz-star--3{animation-delay:2.6s}
@keyframes pz-sweep{0%{transform:rotate(-20deg)}100%{transform:rotate(15deg)}}
@keyframes pz-drift{to{transform:translateX(-600px)}}
@keyframes pz-blink{0%,58%{opacity:1}59%,100%{opacity:.15}}
@keyframes pz-flick{0%,100%{opacity:.9}45%{opacity:.5}72%{opacity:.95}}
@keyframes pz-tw{0%,100%{opacity:.75}50%{opacity:.18}}
</style>
<defs>
<linearGradient id="pz-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070B16"/><stop offset="0.55" stop-color="#111A2E"/><stop offset="1" stop-color="#1C2743"/></linearGradient>
<radialGradient id="pz-moon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#D9E0EE" stop-opacity="0.9"/><stop offset="0.5" stop-color="#AEB9D2" stop-opacity="0.25"/><stop offset="1" stop-color="#AEB9D2" stop-opacity="0"/></radialGradient>
<linearGradient id="pz-beamgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6F3DC" stop-opacity="0.32"/><stop offset="1" stop-color="#F6F3DC" stop-opacity="0"/></linearGradient>
<radialGradient id="pz-lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFF6D8"/><stop offset="1" stop-color="#FFF6D8" stop-opacity="0"/></radialGradient>
<radialGradient id="pz-pool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#C9D2E6" stop-opacity="0.12"/><stop offset="1" stop-color="#C9D2E6" stop-opacity="0"/></radialGradient>
<g id="pz-window"><rect width="26" height="34" rx="1" fill="#0C1220"/><path d="M8.7 0V34M17.3 0V34M0 11.3H26M0 22.6H26" stroke="#3A445E" stroke-width="1.5"/></g>
</defs>

<rect width="1200" height="360" fill="url(#pz-sky)"/>

<g fill="#DCE3F2">
<circle class="pz-star" cx="150" cy="46" r="1.3"/><circle class="pz-star pz-star--2" cx="380" cy="30" r="1"/><circle class="pz-star pz-star--3" cx="560" cy="58" r="1.2"/><circle class="pz-star pz-star--2" cx="720" cy="26" r="1"/><circle class="pz-star" cx="880" cy="50" r="1.1"/><circle class="pz-star pz-star--3" cx="1000" cy="34" r="1"/>
<circle cx="70" cy="84" r="0.9"/><circle cx="450" cy="98" r="0.9"/><circle cx="640" cy="112" r="0.8"/><circle cx="820" cy="90" r="0.8"/>
</g>

<circle cx="330" cy="86" r="62" fill="url(#pz-moon)"/>
<circle cx="330" cy="86" r="27" fill="#E4E9F4"/>
<circle cx="322" cy="80" r="4" fill="#C4CCDE" opacity="0.6"/><circle cx="340" cy="94" r="5" fill="#C4CCDE" opacity="0.5"/><circle cx="336" cy="78" r="3" fill="#C4CCDE" opacity="0.5"/>

<!-- cell block behind the wall; one row of barred windows peeks over the wall -->
<g>
<rect x="-10" y="150" width="880" height="120" fill="#141C2E"/>
<rect x="-10" y="150" width="880" height="5" fill="#20293E"/>
<g transform="translate(40 166)"><rect x="-3" y="-3" width="32" height="40" fill="#B47A2E" opacity="0.0"/><use href="#pz-window"/></g>
<g transform="translate(118 166)"><rect class="pz-win-a" x="1" y="1" width="24" height="32" fill="#E8B45A"/><use href="#pz-window"/></g>
<g transform="translate(196 166)"><use href="#pz-window"/></g>
<g transform="translate(274 166)"><use href="#pz-window"/></g>
<g transform="translate(352 166)"><rect x="1" y="1" width="24" height="32" fill="#E8B45A" opacity="0.55"/><use href="#pz-window"/></g>
<g transform="translate(430 166)"><use href="#pz-window"/></g>
<g transform="translate(508 166)"><rect class="pz-win-b" x="1" y="1" width="24" height="32" fill="#E8B45A"/><use href="#pz-window"/></g>
<g transform="translate(586 166)"><use href="#pz-window"/></g>
<g transform="translate(664 166)"><use href="#pz-window"/></g>
<g transform="translate(742 166)"><use href="#pz-window"/></g>
</g>

<!-- perimeter wall -->
<rect x="0" y="206" width="1200" height="130" fill="#232C3E"/>
<rect x="0" y="206" width="1200" height="4" fill="#33405A"/>
<g stroke="#1A2233" stroke-width="2" opacity="0.7"><path d="M110 210V336"/><path d="M250 210V336"/><path d="M390 210V336"/><path d="M530 210V336"/><path d="M670 210V336"/><path d="M810 210V336"/><path d="M950 210V336"/></g>

<!-- concertina razor wire along the wall top -->
<g fill="none" stroke="#4C566C" stroke-width="1.6" opacity="0.85">
<circle cx="30" cy="200" r="9"/><circle cx="90" cy="200" r="9"/><circle cx="150" cy="200" r="9"/><circle cx="210" cy="200" r="9"/><circle cx="270" cy="200" r="9"/><circle cx="330" cy="200" r="9"/><circle cx="390" cy="200" r="9"/><circle cx="450" cy="200" r="9"/><circle cx="510" cy="200" r="9"/><circle cx="570" cy="200" r="9"/><circle cx="630" cy="200" r="9"/><circle cx="690" cy="200" r="9"/><circle cx="750" cy="200" r="9"/><circle cx="810" cy="200" r="9"/><circle cx="870" cy="200" r="9"/><circle cx="930" cy="200" r="9"/><circle cx="990" cy="200" r="9"/><circle cx="1050" cy="200" r="9"/><circle cx="1110" cy="200" r="9"/><circle cx="1170" cy="200" r="9"/>
<path d="M0 200H1200"/>
</g>

<!-- guard tower (right) -->
<g>
<path d="M1028 132L1010 330M1112 132L1130 330" stroke="#10151F" stroke-width="8" stroke-linecap="round"/>
<path d="M1022 196L1118 196M1018 250L1122 250M1024 172L1116 250M1116 172L1024 250" stroke="#10151F" stroke-width="4"/>
<path d="M998 88L1070 66L1142 88Z" fill="#10151F"/>
<rect x="1006" y="88" width="128" height="50" fill="#1A2234"/>
<rect x="1018" y="98" width="104" height="30" fill="#2A3550"/>
<rect class="pz-win-a" x="1018" y="98" width="104" height="30" fill="#E8B45A" opacity="0.5"/>
<path d="M1018 98H1122M1052 98V128M1088 98V128" stroke="#10151F" stroke-width="2"/>
<path d="M1006 138H1134M1014 138V150M1070 138V150M1126 138V150" stroke="#10151F" stroke-width="3"/>
<circle class="pz-beacon" cx="1070" cy="62" r="3.6" fill="#FF4D4D"/><circle class="pz-beacon" cx="1070" cy="62" r="7" fill="#FF4D4D" opacity="0.25"/>
<circle cx="1096" cy="108" r="18" fill="url(#pz-lamp)"/><circle cx="1096" cy="108" r="5" fill="#FFF6D8"/>
</g>

<!-- searchlight beam -->
<path class="pz-beam" d="M1096 108L1046 332L1148 332Z" fill="url(#pz-beamgrad)"/>

<!-- yard floor + light pool -->
<rect x="0" y="300" width="1200" height="60" fill="#0D1322"/>
<rect x="0" y="300" width="1200" height="3" fill="#1B263F" opacity="0.7"/>
<ellipse cx="560" cy="332" rx="220" ry="30" fill="url(#pz-pool)"/>

<!-- drifting ground fog -->
<g class="pz-fog" fill="#8290A8" opacity="0.06">
<ellipse cx="120" cy="312" rx="150" ry="16"/><ellipse cx="380" cy="320" rx="180" ry="18"/><ellipse cx="640" cy="310" rx="160" ry="15"/><ellipse cx="900" cy="320" rx="170" ry="17"/>
<ellipse cx="720" cy="312" rx="150" ry="16"/><ellipse cx="980" cy="320" rx="180" ry="18"/><ellipse cx="1240" cy="310" rx="160" ry="15"/><ellipse cx="1500" cy="320" rx="170" ry="17"/>
</g>
</svg>
```

- [x] **Step 2: Verify the file is well-formed and self-contained**

Run:

```bash
node -e "const s=require('fs').readFileSync('public/prison.svg','utf8'); if(/https?:\/\//.test(s.replace('http://www.w3.org/2000/svg',''))) throw new Error('external ref'); for (const id of ['pz-beam','pz-sweep','pz-window','pz-beacon','pz-fog']) if(!s.includes(id)) throw new Error('missing '+id); console.log('prison.svg ok, bytes', s.length);"
```

Expected: prints `prison.svg ok, bytes <n>` and throws nothing (no external URL besides the SVG namespace; all key ids present).

- [x] **Step 3: Commit**

```bash
git add public/prison.svg
git commit -m "$(cat <<'EOF'
Events: hand-authored night-prison-yard scene for Deepak card (prison.svg)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire the scene into EventCard and the Deepak event

**Files:**
- Modify: `src/components/EventCard.tsx`
- Modify: `src/lib/events.ts`

Generalize `EventCard` so any `scene` value loads `/{scene}.svg` (today it hard-codes `roadtrip`), then widen the `SiteEvent.scene` type and repoint the Deepak event from the missing poster to the new scene.

- [x] **Step 1: Generalize the scene check in `EventCard.tsx`**

In `src/components/EventCard.tsx`, find:

```tsx
  const hasScene = event.scene === "roadtrip";
```

Replace with:

```tsx
  const hasScene = Boolean(event.scene);
```

- [x] **Step 2: Make the `<img>` load the scene-specific file**

In the same file, find:

```tsx
        {hasScene && (
          <img
            src="/roadtrip.svg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
```

Replace with:

```tsx
        {hasScene && (
          <img
            src={`/${event.scene}.svg`}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
```

- [x] **Step 3: Widen the `scene` type in `events.ts`**

In `src/lib/events.ts`, find:

```ts
  scene?: "roadtrip"; // animated scene used as the card banner background
```

Replace with:

```ts
  scene?: "roadtrip" | "prison"; // animated scene used as the card banner background
```

- [x] **Step 4: Repoint the Deepak event from the missing poster to the scene**

In the same file, find the Deepak event's background field:

```ts
    host: "Ice Poseidon",
    hue: 265,
    image: "/deepak-prison-stream.jpg",
  },
```

Replace with (drop the never-present poster; keep `hue: 265` as the fallback if the SVG ever fails to load):

```ts
    host: "Ice Poseidon",
    hue: 265,
    scene: "prison",
  },
```

- [x] **Step 5: Run the gates**

```bash
npm run lint
npm run build
npx vitest run
```

Expected: `npm run build` succeeds; `npx vitest run` → 36 passing; `npm run lint` shows **no new errors in `EventCard.tsx` or `events.ts`** (only the 12 pre-existing baseline errors in unrelated files may appear). If `events.ts` or `EventCard.tsx` show a NEW error, fix it before continuing.

- [x] **Step 6: Commit**

```bash
git add src/components/EventCard.tsx src/lib/events.ts
git commit -m "$(cat <<'EOF'
Events: Deepak card uses the prison.svg scene; EventCard renders any scene

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Visual verification in the preview browser

**Files:** none (verification only)

This is the real proof for visual assets — do not skip it.

- [x] **Step 1: Start the dev server**

Use the preview tool with `{name: "chickenweb"}` (defined in `.claude/launch.json`, port 3000). Then navigate to `http://localhost:3000/events`.

- [x] **Step 2: Confirm both cards render their scenes**

- Read the page / screenshot the `/events` route.
- **RV X card ("Happening now"):** the dusk scene shows the RV, road, mountains — plus the new sunset glow around the sun, faint drifting birds above the horizon, and a warm headlight glow. Nothing important is clipped by the `object-cover` crop.
- **Deepak Prison Stream card ("Upcoming"):** the night-prison scene shows the moon, cell-block barred windows over the wall, razor wire, the guard tower with its lit room and red beacon, and the searchlight beam sweeping. The white "DEEPAK PRISON STREAM" title and "Upcoming" badge stay legible over it.

- [x] **Step 3: Check the console for asset/render errors**

Use `read_console_messages` — expect no 404 for `/prison.svg` or `/roadtrip.svg` and no SVG parse errors.

- [x] **Step 4: Framing fix loop (only if needed)**

If a hero element is clipped or a scene reads poorly at card size: adjust the offending Y coordinates in the SVG (keep hero content y≈70–320 per the framing note), reload, and re-check. Because HMR doesn't reprocess `public/` assets on some setups, hard-reload the route (`navigate` to the same URL) after editing an SVG. If you change an SVG here, amend or add a follow-up commit with the tweak.

- [x] **Step 5: Capture proof**

Take a screenshot of `/events` showing both finished cards and share it as the completion evidence.

---

## Self-Review

**Spec coverage** (the two AskUserQuestion decisions that drive this plan):
- *Deepak = hand-authored SVG scene, no real-person likeness* → Task 2 creates `prison.svg` (architecture/light only). ✓
- *RV X = polish the existing scene (detail/animation/framing)* → Task 1 adds four tasteful layers without a rewrite. ✓
- *Wiring so the new scene actually shows* → Task 3 generalizes `EventCard` + repoints the Deepak event. ✓
- *Proof it works* → Task 4 preview + screenshot. ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N" — every SVG and diff is shown in full. ✓

**Type consistency:** `scene` is widened to `"roadtrip" | "prison"` in Task 3 Step 3; the Deepak event sets `scene: "prison"` (Step 4) — a member of that union; `EventCard` reads `event.scene` into a template string (Step 2). Consistent. The `image` field stays on the type (still used by the fallback branch / future posters) — only the Deepak *instance* stops using it. ✓
