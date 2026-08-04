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
- Aesthetic: a **dark, advanced-biotechnology instrument**. Superseded the original
  "minimalist medical line-art, white space" brief on 2026-08-04; see
  `ai/plans/2026-08-03-audit-and-biotech-redesign.md` §C0 for why, and what survived.
  - **Two hues, one rule.** WARM (`--accent` #ff7a45) is the hypothesised force. COOL
    (`--bio` #41d4c8) is the instrument measuring it: readouts, angles, section indices.
    Nothing measured is ever warm, and the force is never cool. That rule is what keeps a
    high-contrast presentation from making an unproven theory look like settled science.
  - Hairlines at low alpha, 4-6px radii, an 8px dot grid on panels, corner ticks rather
    than frames. Elevation from border luminance and backdrop blur; **no drop shadows**.
  - Data is set in mono. Precision, real numbers and controlled motion belong to the
    *instrument* — never to the *claims*.
  - Still true: calm and credible, not gamey. No fear-mongering. The medical disclaimer
    and the "theory, not established fact" framing are MORE prominent than before, not
    less.

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

Shipped numbering is the hero (unnumbered) plus **01 Prodrome Zone · 02 Energy Impact
Simulator · 03 The Structures · 04 Pineal Body · 05 Angles of Force**. The `#1`-`#6`
scheme below is the original draft's and is kept only for the structure notes.

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
- **ONE WebGL context for the whole page.** A fixed, full-bleed canvas sits behind the
  document; each section declares a camera keyframe and scroll runs the camera along a
  spline through them. Sections carry transparent `.stage-window` elements that reserve
  the layout space the model is framed into and take the keyboard; a separate hit area
  tracks the active window for pointer orbit. There is never more than one scene.
- **Stylized translucent brain from primitives (NOT a downloaded model — licensing):**
  - Cerebrum: a smooth base whose sulci are a displacement field evaluated in a GLSL
    vertex shader, shaded as a **fresnel scan shell** — near-transparent face-on so the
    deep structures genuinely read through it, bright at grazing angles. Normals come from
    the field's gradient, not `computeVertexNormals()`. **The geometry must be indexed**
    (`mergeVertices`): `IcosahedronGeometry` ships non-indexed, and displacing along
    per-face normals tears the mesh open along every edge.
  - Cerebellum: smaller translucent ellipsoid, posterior-inferior.
  - Brainstem: tapered translucent cylinder descending from center.
  - Optional: faint mid-sagittal disc + thin great-longitudinal-fissure line to read as a
    cross-section.
- Deep structures as small translucent shapes at the coordinates below; nuclei as small
  **emissive sphere markers** (glow in the accent color when active).
- Soft lighting (hemisphere + a key light). Markers are layered points: a struck nucleus
  burns warm and breathes, unstruck ones hold as dim cool points so the reader can see what
  the force did *not* reach. Scene fog grades depth. Post-processing bloom is **not**
  shipped — a full-bleed canvas over the document needs its alpha intact.
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
- A shader trace whose brightness peaks along the tube's centre line rather than its
  silhouette, so it reads as a filament. A gaussian travelling its length is the charge, and
  it exists only while the force is in flight. An **entry ring** blooms where the line
  crosses the cortical hull, so the force visibly enters from outside; a flare and a
  shockwave mark the nucleus. Travel ends at the **far cortical surface**, never in open
  space beyond the head.
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
Measured, not asserted: `node ai/verify/geometry.mjs` and `node ai/verify/check.mjs`.
See `ai/verify/README.md`.

- Loads with **NO console errors or warnings**, on load and through every interaction.
- All four structure chips work; **#1 shows no beam**; #4 sequence + show-all work.
- Distinct, correct beam angles per structure; **pineal visibly "special."**
- Smooth 3D (~60fps desktop; degrade gracefully on mobile); canvas responsive; handles resize.
- Mobile: nav collapses; canvas + panel stack; touch orbit works.
- Works offline apart from the CDN.

## Non-goals (YAGNI)
No accounts, analytics, backend, CMS, or framework. No downloaded 3D models.
