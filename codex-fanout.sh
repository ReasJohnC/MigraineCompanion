#!/usr/bin/env bash
# codex-fanout.sh — run many GPT-5.5 Codex agents in parallel, one per prompt line.
#
# Usage:   ./codex-fanout.sh prompts.txt
#          (prompts.txt = one prompt per line; blank lines skipped)
#
# Env knobs:
#   CODEX_MODEL    default gpt-5.5
#   CODEX_SANDBOX  default read-only
#                  read-only      -> safe for parallel (no file writes; analysis/research/drafting)
#                  workspace-write-> agents can edit files; DO NOT run many in one dir at once,
#                                     they will clobber each other — use git worktrees or give
#                                     each agent its own subdir. See README notes.
#
# Output (per run, timestamped under ./.codex-runs/):
#   agent-N.answer.md  = that agent's final message
#   agent-N.jsonl      = full event log
set -uo pipefail

MODEL="${CODEX_MODEL:-gpt-5.5}"
SANDBOX="${CODEX_SANDBOX:-read-only}"
ROOT="$(pwd)"
OUT="$ROOT/.codex-runs/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

pids=(); i=0
while IFS= read -r prompt || [ -n "$prompt" ]; do
  [ -z "${prompt// }" ] && continue
  i=$((i+1))
  (
    codex exec "$prompt" \
      --model "$MODEL" \
      --cd "$ROOT" \
      --sandbox "$SANDBOX" \
      --skip-git-repo-check \
      --json \
      --output-last-message "$OUT/agent-$i.answer.md" \
      </dev/null >"$OUT/agent-$i.jsonl" 2>&1
  ) &
  pids+=($!)
  echo "▶ launched agent-$i (pid $!): ${prompt:0:60}"
done < "${1:?usage: codex-fanout.sh prompts.txt}"

fail=0
for p in "${pids[@]}"; do wait "$p" || fail=$((fail+1)); done
echo "✔ done — $i agents launched, $fail failed. Results in: $OUT"
