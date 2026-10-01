# Migraine Companion

A static, interactive migraine companion. It visualizes the
companion's hypothesis that a migraine can begin when an "energy force" enters a deep-brain
**Prodrome Zone** at a specific **angle** — different angles striking different structures and
producing different prodrome (pre-migraine) symptoms.

## What's here
- `index.html`, `css/`, `js/`, `assets/` — the site (100% static; Three.js 0.160.1 is
  vendored in `js/vendor/`, so nothing is fetched from any external host). The copy and
  controls load apart from the 3-D module, which arrives by dynamic import: they render at
  once, and keep working if the model is slow or WebGL is unavailable.
- `content/` — source draft copy per structure (the site text is built from these).
- `BUILD-SPEC.md` — the build specification, updated for the dark-instrument direction.
- `*.sh` — Codex fan-out helper scripts used during the build (not needed to run the site).

## Run locally
No build step. Serve the folder over HTTP (ES modules require http://, not file://):

```
python3 -m http.server 4173
# then open http://localhost:4173
```

## Deploy to Netlify
- Drag-and-drop this folder into the Netlify dashboard, **or** connect the git repo.
- No build command. **Publish directory: `.`** (repo root). See `netlify.toml`.

## The sections
The page numbers them 01-05, after an unnumbered opening.

- **Opening** — over-title and the author's byline, title, thesis, medical note, and the
  "Prodrome Zone" reticle laid over the model, centred on the zone itself
- **01 The Migraine Prodrome Zone** (overview — thalamus/hypothalamus/pineal, no line)
- **02 Energy Impact Simulator** — *Migraine without Aura* / *Migraine with Aura*; four
  symptoms each, singly or in combination
- **03 The Structures** — reference catalogue, symptom-first
- **04 Pineal Body (Gland)** — circadian rhythm, and microcrystals as the aura mechanism; a
  loupe magnifies the gland and its crystals beside the whole specimen
- **05 Angles of Force** (capstone — play the sequence or show all lines together)

## Symptoms and anatomy
Symptoms own the angle; structures own the position. Mood Alterations and Gut Motility both
target the **lateral tuberal nucleus** at angles 24° apart, so one nucleus can carry two
symptoms without the two selections looking identical.

| Symptom | Structure |
| --- | --- |
| Mood Alterations | Lateral tuberal nucleus ("Mystery Spot") |
| Gut Motility | Lateral tuberal nucleus ("Mystery Spot") |
| Fluid Balance | Paraventricular nucleus |
| Wakefulness | Suprachiasmatic nucleus |
| Visual Aura | Pineal gland |

**Section 1 never fires the pineal line** — an explicit requirement from the author. Its three
targets clear the pineal by 0.34–0.49 model units against a gland about 0.09 across.

## Before publishing
The on-page copy is the author's own (see `content/00-site-copy.md`). The anatomical background
in `content/01`–`06` is AI-drafted and **not fact-checked**; each ends with a "Verify" list.
Still open: an Amazon link for *On the Other Side of Migraine*, deferred by the author.

## Notes
- Reader controls are intentionally **gated** (pick a symptom; no free-aiming the line) — a
  sharp UI, and the science stays correct.
- The line is stationary and a cursor travels along it, revealing the symptom and brain region
  as it reaches the structure. It holds there briefly so the label can be read.
- Respects `prefers-reduced-motion` (label and final state appear at once, no travel);
  keyboard-accessible; responsive down to mobile. The stage window keeps
  `touch-action: pan-y` (re-asserted after OrbitControls sets `none`), so one-finger
  vertical swipes scroll the page and horizontal drags orbit. The canvas holds `100lvh`
  so mobile toolbar collapse never resizes it mid-scroll.
- Favicons: SVG for modern browsers, `/favicon.ico` for Safari (which ignores SVG icons),
  and a solid-ground `apple-touch-icon`.
- No backend, no analytics, no external data. State (last selection) is `localStorage` only.
- **One WebGL context** for the whole page: a fixed, full-bleed canvas behind the document,
  with the camera driven along a spline through per-section keyframes as you scroll.
- **The model yields to the copy**: the canvas dims toward a 0.14-opacity floor as the
  active stage window leaves the middle of the view, and returns as the next one arrives —
  so the specimen never stands at full strength behind text that has scrolled past it.
  No `backdrop-filter` anywhere: blurred surfaces over an always-animating canvas re-blur
  every frame, and were the largest scroll cost. Render resolution is capped at DPR 1.5
  (1.25 under 760px) — with MSAA the organic model shows no visible edge for it.
- **The model lives in the right-hand column** of every section. In the Simulator and the
  Structures it is sticky beside the controls, so the force plays where the reader is
  looking; in one column it sits above them, and a choice made below brings it back into
  view. Framing fits the specimen's measured extremes, so no view crops it at any size.
- The idle motion is a slow ±8° sway rather than a turn, so each section keeps the view its
  keyframe was chosen for; in the capstone it settles to rest, because the five angles are
  that section's argument.
- The force fades in from outside the head and out past the far surface; impacts are soft
  glows rather than bright discs (the readers include people with photophobia).
- The panels state the model's real numbers — target, position, entry vector, entry angle,
  and the measured pineal clearance — so the author's hard constraint is something the
  reader can watch hold rather than take on trust.
- Copy is written in the brain's voice, not the page's: it says what the force and the
  structures do, never what the site is showing. See `content/00-site-copy.md` for what was
  deliberately left in the page's voice and why.
