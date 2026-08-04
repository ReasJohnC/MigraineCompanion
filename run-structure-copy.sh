#!/usr/bin/env bash
# run-structure-copy.sh
# Fan out 6 GPT-5.5 (xhigh) Codex agents in parallel — one per Prodrome-Zone structure —
# each drafting reader-facing site copy to content/<slug>.md. Read-only sandbox (agents
# produce text only; no file collisions). Logs -> .codex-runs/structure-copy-<ts>/.
set -uo pipefail

ROOT="$(pwd)"
CONTENT="$ROOT/content"
LOGS="$ROOT/.codex-runs/structure-copy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$CONTENT" "$LOGS"

read -r -d '' PREAMBLE <<'P'
You are drafting reader-facing website copy for an interactive 3D web companion to the book
"On the Other Side of Migraine." The site shows a rotatable 3D mid-sagittal cross-section of
the brain and visualizes the author's central hypothesis.

THE AUTHOR'S HYPOTHESIS — present as HER theory, never as established fact: a migraine is
initiated by an "energy force" traveling at a specific ANGLE through a small cluster of
deep-brain structures she calls the "Prodrome Zone" (thalamus, hypothalamus, pineal).
Different angles strike different structures, producing different prodrome (pre-migraine)
symptoms.

RULES:
- Sharply separate (a) ESTABLISHED neuroanatomy/physiology, which MUST be medically accurate,
  from (b) the author's angle-of-force hypothesis, which you clearly label as her theory.
- Do NOT invent citations, study names, or statistics. Put anything uncertain or checkable in
  a final "Verify" list.
- Audience: intelligent lay readers (migraine sufferers and the curious). Warm, precise, no
  fear-mongering.
- Output GitHub-flavored Markdown with EXACTLY these sections:
  # <Structure name>
  **Hook:** one vivid line (used as the model's title caption)
  ## Where it is
  (2-4 sentences; describe its position in a mid-sagittal cross-section precisely enough to
   place a marker in a 3D model)
  ## What it does
  (2-4 sentences)
  ## The prodrome connection
  (how it links to its specific prodrome symptom; blend established science with the author's
   angle-of-force hypothesis, each clearly labeled)
  ## Caption
  (one line, <=160 characters, shown under the interactive model)
  ## Verify
  (bullets the author should fact-check before publishing, or "None")
- ~200-350 words total. Tight, not padded.
P

PIDS=()
run() {
  local slug="$1" task="$2"
  codex exec "$PREAMBLE

STRUCTURE TO WRITE:
$task" \
    --model gpt-5.5 --sandbox read-only --skip-git-repo-check --json \
    --output-last-message "$CONTENT/$slug.md" \
    </dev/null >"$LOGS/$slug.jsonl" 2>&1 &
  PIDS+=($!)
  echo "launched $slug (pid $!)"
}

run 01-prodrome-zone   "The Prodrome Zone — OVERVIEW model, NO force beam. The deep-brain region spanning the thalamus, hypothalamus, and pineal. Name the three structures and their rough mid-sagittal positions, explain why the author calls it the Prodrome Zone, and introduce the angle-of-force hypothesis at a high level. (Book Figure 1, p.166.) No single associated symptom — this is orientation."
run 02-lateral-tuberal "Lateral tuberal nucleus — the author nicknames it the 'Mystery Spot' — within the hypothalamus. Associated prodrome symptom: mood changes / irritability and the broad prodrome. (Book Figure 3a, p.86.)"
run 03-paraventricular "Paraventricular nucleus of the hypothalamus. Associated prodrome symptom: fluid balance (thirst, urination, fluid shifts). (Book Figure 3b, p.91.)"
run 04-suprachiasmatic "Suprachiasmatic nucleus of the hypothalamus — the body's master circadian clock. Associated prodrome symptom: wakefulness / sleep disruption / circadian changes (fatigue, listlessness, insomnia a day or two before an attack). (Book Figure 3c, p.93.)"
run 05-pineal          "The pineal gland (pineal organ), sitting posteriorly behind/below the thalamus. Produces melatonin; governs day/night rhythm. Associated prodrome symptom: wakefulness via melatonin / circadian rhythm. In the author's capstone it receives a distinct 'special' force angle. (Book Figure 4, p.94.)"
run 06-angles-of-force "'The Different Angles of Force' — CAPSTONE synthesis (Book Figure, p.176), not a single structure. Explain how, in the author's hypothesis, different force angles pass through different Prodrome-Zone structures to produce different prodrome symptom profiles, tying together the lateral tuberal, paraventricular, and suprachiasmatic nuclei plus the pineal (special angle). You may note the thalamus/pulvinar link to visual aura. Keep established science vs. hypothesis clearly separated."

fail=0
for p in "${PIDS[@]}"; do wait "$p" || fail=$((fail+1)); done
echo "done — 6 agents, $fail failed."
echo "copy:  $CONTENT"
echo "logs:  $LOGS"
ls -la "$CONTENT" 2>/dev/null
