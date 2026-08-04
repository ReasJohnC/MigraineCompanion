#!/usr/bin/env bash
# codex-fanout-worktrees.sh
# Parallel Codex agents that EDIT code, each isolated in its own git worktree + branch so
# concurrent writes never collide. Review each branch's diff, then merge the good ones.
#
# Usage: ./codex-fanout-worktrees.sh tasks.txt      (one task per line; blanks skipped)
# Env:   CODEX_MODEL   (default gpt-5.5)
#        BASE_BRANCH   (default: current branch)
#        CODEX_WT_DIR  (default: $HOME/.codex-worktrees — kept OUTSIDE the repo/vault)
set -uo pipefail
command -v git >/dev/null 2>&1 || { echo "git is required"; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Not a git repo. Run: git init && git add -A && git commit -m init"; exit 1; }

MODEL="${CODEX_MODEL:-gpt-5.5}"
ROOT="$(git rev-parse --show-toplevel)"
BASE="${BASE_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
WTBASE="${CODEX_WT_DIR:-$HOME/.codex-worktrees}/$(basename "$ROOT")"
LOGS="$ROOT/.codex-runs/worktrees-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$WTBASE" "$LOGS"

PIDS=(); i=0
while IFS= read -r task || [ -n "$task" ]; do
  [ -z "${task// }" ] && continue
  i=$((i+1))
  branch="codex/agent-$i"; wt="$WTBASE/agent-$i"
  git worktree add -B "$branch" "$wt" "$BASE" >/dev/null 2>&1 || { echo "worktree add failed for agent-$i"; continue; }
  (
    codex exec "$task" \
      --model "$MODEL" --cd "$wt" --sandbox workspace-write --skip-git-repo-check --json \
      --output-last-message "$LOGS/agent-$i.answer.md" \
      </dev/null >"$LOGS/agent-$i.jsonl" 2>&1
    git -C "$wt" add -A >/dev/null 2>&1 && git -C "$wt" commit -m "codex agent-$i: ${task:0:60}" >/dev/null 2>&1 || true
  ) &
  PIDS+=($!); echo "launched agent-$i on $branch  (worktree: $wt)"
done < "${1:?usage: codex-fanout-worktrees.sh tasks.txt}"

fail=0; for p in "${PIDS[@]}"; do wait "$p" || fail=$((fail+1)); done
echo "done — $i agents, $fail failed."
echo "review branches : git branch --list 'codex/*'"
echo "see a diff      : git diff $BASE..codex/agent-N"
echo "merge one       : git merge codex/agent-N"
echo "remove worktree : git worktree remove $WTBASE/agent-N   (repeat per agent)"
echo "logs            : $LOGS"
