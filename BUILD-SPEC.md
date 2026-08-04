# Build Spec — Migraine Companion

## Goal
A polished, **static single-page website** — an interactive migraine companion.
It visualizes the companion's hypothesis that a migraine is
initiated by an "energy force" traveling at a specific **ANGLE** through deep-brain structures
she calls the **"Prodrome Zone."** Readers explore a rotatable, stylized 3D brain and watch a
force-beam pass through specific structures at distinct angles.

## Hard constraints
- 100% static. Deployable to Netlify by dropping the folder (publish dir = repo root). **No
  backend, no build step, no bundler.**
- Vanilla HTML + CSS + **ES-module JavaScript**. Load **Three.js from a CDN** via
  `<script type="importmap">` (pin a version, e.g. `three@0.160.x`, plus `three/addons`
  OrbitControls). Nothing installed locally.
- **No external data calls.** Any state (last-viewed structure) via `localStorage` only.
- Responsive (sharp on phone + desktop). Accessible: keyboard-operable chips, aria labels,
  respects `prefers-reduced-motion` (instant final state, no auto-travel when set).
- Aesthetic: clean, **minimalist medical line-art**. White space, thin lines, restrained
  palette, **ONE accent color** for the "energy" beam (warm/electric, soft glow). Calm and
  credible, not gamey. No fear-mongering.

## File layout
- `index.html`
- `css/style.css`
- `js/data.js`   — exported `STRUCTURES` (see Data model)
- `js/brain.js`  — Three.js scene: brain volumes + markers + beam; exports an init/reveal API
- `js/ui.js`     — chips, sections, captions, scroll nav, reduced-motion, localStorage
- `js/main.js`   — bootstrap
- `assets/`      — any SVG (e.g., timeline)
- `content/*.md` — **SOURCE copy — read these for text**; do not ship raw

## Page structure (single page; sticky top nav with anchor links)
1. **HERO / INTRO** — title area (placeholder: "Migraine Companion";
   leave a clear `<!-- TODO: final title -->`), a one-paragraph thesis of
   the angle-of-force idea (framed as *the companion's theory*), and the **migraine-phases
   timeline** (reference Figure 5): Prodrome (1 hr–48 hrs) → Aura (5 min–1 hr) → Headache
   (4–72 hrs) → Resolution (1–2 days), as a clean responsive **SVG** triangle/timeline with a
   labelled arrow across the top.
2. **THE PRODROME ZONE (#1)** — the 3D brain in **OVERVIEW** mode: thalamus, hypothalamus,
   pineal gently highlighted + labeled; the "zone" softly shaded. **NO force beam here (hard
   requirement).** Free orbit. Short copy from `content/01-prodrome-zone.md`.
3. **THE STRUCTURES (#2–5)** — the **gated interactive module** (see Interaction). Chips:
   Lateral tuberal nucleus · Paraventricular nucleus · Suprachiasmatic nucleus · Pineal.
   Selecting one: reveals its marker, animates its force-beam through it, opens a circular
   **zoom "callout"** of the dotted nucleus (echoing reference Figures 3a/b/c), and updates an info
   panel (name, one-line symptom, 2–3 sentence "prodrome connection"). Default: none active.
4. **ANGLES OF FORCE (#6)** — capstone: same brain, a **"Play sequence"** that fires each
   structure's beam in turn (lateral tuberal → paraventricular → suprachiasmatic → pineal),
   each at its distinct angle, the pineal's visibly different **"special"** posterior angle.
   Also a **"Show all"** that displays every beam together as a fan. Copy from
   `content/06-angles-of-force.md`.

## 3D scene design (js/brain.js)
- ONE reusable scene, reused by sections 2/3/4 (shared canvas that reconfigures, or a light
  instance per section — your call; keep perf good and destroy/reuse cleanly).
- **Stylized translucent brain from primitives (NOT a downloaded model — licensing):**
  - Cerebrum: slightly flattened **translucent** ellipsoid (`MeshPhysicalMaterial`,
    transmission/opacity ~0.15–0.25, subtle fresnel rim). You must be able to **see inside**.
  - Cerebellum: smaller translucent ellipsoid, posterior-inferior.
  - Brainstem: tapered translucent cylinder descending from center.
  - Optional: faint mid-sagittal disc + thin great-longitudinal-fissure line to read as a
    cross-section.
- Deep structures as small translucent shapes at the coordinates below; nuclei as small
  **emissive sphere markers** (glow in the accent color when active).
- Soft lighting (hemisphere + a key light); subtle glow on active marker/beam (emissive +
  additive halo sprite; full post-processing bloom optional if perf allows).
- **OrbitControls**: damped rotate + zoom with sensible limits. Default = a flattering 3/4
  sagittal view.
- Markers are **single schematic points** (match the reference figures), NOT anatomically paired.

### Coordinate guide
Normalized space: **+X = anterior/front, +Y = superior/up, +Z = toward viewer**; midline ≈ Z 0.
Cerebrum radius ≈ 1. Tune for visual clarity.

| Structure | position (x, y, z) |
|---|---|
| Thalamus | (-0.05,  0.02, 0) |
| Hypothalamus | ( 0.05, -0.16, 0) |
| Pineal | (-0.28,  0.05, 0) |
| Lateral tuberal nucleus | ( 0.06, -0.19, 0.05) |
| Paraventricular nucleus | ( 0.03, -0.12, 0.02) |
| Suprachiasmatic nucleus | ( 0.14, -0.22, 0.02) |

### Force beam
- A glowing thin cylinder/line (accent color, additive, soft halo) traveling from **outside**
  the brain, **through** the target marker, and out the far side — animated ~1.2 s ease-in-out,
  with a small flare when it crosses the marker.
- **Each structure has a DISTINCT entry ANGLE** (the whole point). Suggested travel directions
  (unit vectors; tune for clarity):
  - Lateral tuberal — high-anterior: ~normalize( 0.5,  0.85, -0.15)
  - Paraventricular — steep/from top: ~normalize( 0.2,  0.95, -0.10)
  - Suprachiasmatic — diagonal front-top: ~normalize( 0.7,  0.70, -0.10)
  - Pineal — **SPECIAL**, from upper-BACK/posterior, visibly different: ~normalize(-0.6, 0.75, -0.2)
- Section #1 never shows a beam. Section #4 plays them in sequence and can show all at once.

## Data model (js/data.js)
Export `STRUCTURES` — array of:
```js
{
  id: 'lateral-tuberal',
  name: 'Lateral tuberal nucleus',
  nickname: 'Mystery Spot',            // optional
  symptom: 'Mood & the broad prodrome',// one line
  hook: '…',                           // from the content Hook line
  caption: '…',                        // <=160 chars, from the content Caption
  blurb: '…',                          // 2–3 sentences condensed from "The prodrome connection"
  position: [0.06, -0.19, 0.05],
  beamDir: [ /* unit vec */ ],         // omit for the overview
  noBeam: false                        // true only for prodrome-zone
}
```
Include: `prodrome-zone` (noBeam), `lateral-tuberal`, `paraventricular`, `suprachiasmatic`,
`pineal`, and capstone meta for `angles-of-force`. **Pull hook/caption/blurb by reading the
matching `content/NN-*.md`.** Keep the "established science vs. companion's hypothesis" distinction
from the source copy.

## Interaction (js/ui.js)
- **Gated, discrete controls ONLY.** The reader never free-aims the beam — they pick a chip (or
  press Play in #4). Sharp UI, and the science stays correct.
- Chip select → ease camera to that structure's framing, fade in its marker, animate its beam,
  open the zoom callout, update the info panel.
- Keyboard: chips are real `<button>`s (tab/enter/space); arrow keys cycle; visible focus.
- `prefers-reduced-motion`: skip beam travel + camera easing; show final state instantly.
- Persist last-selected structure in `localStorage`; restore on load.

## Acceptance criteria
- Loads with **NO console errors**; all deps via importmap.
- All four structure chips work; **#1 shows no beam**; #4 sequence + show-all work.
- Distinct, correct beam angles per structure; **pineal visibly "special."**
- Smooth 3D (~60fps desktop; degrade gracefully on mobile); canvas responsive; handles resize.
- Mobile: nav collapses; canvas + panel stack; touch orbit works.
- Works offline apart from the CDN.

## Non-goals (YAGNI)
No accounts, analytics, backend, CMS, or framework. No downloaded 3D models.
