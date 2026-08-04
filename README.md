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

## The six models
1. **Prodrome Zone** (overview — thalamus/hypothalamus/pineal, no beam)
2. **Lateral tuberal nucleus** — mood / broad prodrome
3. **Paraventricular nucleus** — fluid balance
4. **Suprachiasmatic nucleus** — sleep-wake / circadian
5. **Pineal** — melatonin timing (its beam enters at a distinct "special" angle)
6. **Angles of Force** (capstone — play the sequence or show all beams together)

## Before publishing
The copy is AI-drafted and deliberately separates established anatomy from the companion's
hypothesis, but it is **not yet fact-checked**. Each `content/*.md` ends with a "Verify" list.
Recommended: a clinician review of the anatomy/physiology wording, confirming the placeholder
site title, and confirming each marker's position against the reference figures.

## Notes
- Reader controls are intentionally **gated** (pick a structure; no free-aiming the beam) — a
  sharp UI, and the science stays correct.
- Respects `prefers-reduced-motion`; keyboard-accessible; responsive down to mobile.
- No backend, no analytics, no external data. State (last-viewed structure) is `localStorage` only.
