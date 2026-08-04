# Migraine Companion

A static, interactive migraine companion. It visualizes the
companion's hypothesis that a migraine can begin when an "energy force" enters a deep-brain
**Prodrome Zone** at a specific **angle** — different angles striking different structures and
producing different prodrome (pre-migraine) symptoms.

## What's here
- `index.html`, `css/`, `js/`, `assets/` — the site (100% static; Three.js loaded via CDN).
- `content/` — source draft copy per structure (the site text is built from these).
- `BUILD-SPEC.md` — the build specification the site was implemented against.
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
1. **Opening** — title, thesis, medical note, "Prodrome Zone" bullseye
2. **The Migraine Prodrome Zone** (overview — thalamus/hypothalamus/pineal, no line)
3. **Energy Impact Simulator** — Section 1 *Migraine without Aura*, Section 2 *Migraine With
   Aura*; four symptoms each, singly or in combination
4. **The Structures** — reference catalogue, symptom-first
5. **Pineal Body (Gland)** — circadian rhythm, and microcrystals as the aura mechanism
6. **Angles of Force** (capstone — play the sequence or show all lines together)

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
  keyboard-accessible; responsive down to mobile.
- No backend, no analytics, no external data. State (last selection) is `localStorage` only.
