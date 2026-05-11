#!/usr/bin/env bash
# cleanup-aborted-worktrees.sh — remove worktrees from aborted milestone phases.
#
# Trust the platform default for clean exits (worktrees with no changes are
# auto-cleaned). This script handles dirty worktrees from aborted runs.
# Stashes any changes to .claude/notes/milestones/<id>/aborted-worktrees/<branch>.patch
# before removing.
#
# Usage: cleanup-aborted-worktrees.sh <id>

set -uo pipefail

ID="$1"

if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then :; else
  echo "not in a git repo" >&2; exit 1
fi

WT_BASE="$REPO_ROOT/.claude/worktrees"
SAVE_DIR="$REPO_ROOT/.claude/notes/milestones/$ID/aborted-worktrees"

if [[ ! -d "$WT_BASE" ]]; then
  echo "no worktrees base dir; nothing to clean"
  exit 0
fi

mkdir -p "$SAVE_DIR"

cleaned=0
saved=0
for wt in "$WT_BASE"/*"$ID"*; do
  [[ -d "$wt" ]] || continue
  echo "inspecting $wt"
  branch="$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  base="$(git -C "$wt" merge-base "$branch" main 2>/dev/null || echo "")"

  if [[ -n "$base" ]] && diff_out="$(git -C "$wt" diff "$base..HEAD" 2>/dev/null)" && [[ -n "$diff_out" ]]; then
    patch_file="$SAVE_DIR/${branch//\//_}.patch"
    git -C "$wt" diff "$base..HEAD" > "$patch_file"
    echo "  saved diff -> $patch_file"
    saved=$((saved+1))
  fi

  # Stage any uncommitted local changes too
  if [[ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]]; then
    patch_file="$SAVE_DIR/${branch//\//_}.uncommitted.patch"
    git -C "$wt" diff > "$patch_file"
    echo "  saved uncommitted -> $patch_file"
    saved=$((saved+1))
  fi

  # Remove worktree (force, since we've saved patches)
  if git -C "$REPO_ROOT" worktree remove --force "$wt" 2>/dev/null; then
    echo "  removed worktree"
    cleaned=$((cleaned+1))
  else
    rm -rf "$wt"
    git -C "$REPO_ROOT" worktree prune 2>/dev/null || true
    echo "  force-removed (worktree command failed)"
    cleaned=$((cleaned+1))
  fi

  # Remove the branch if no longer reachable
  if [[ "$branch" != "main" && "$branch" != "unknown" ]]; then
    git -C "$REPO_ROOT" branch -D "$branch" 2>/dev/null && echo "  deleted branch $branch" || true
  fi
done

echo "cleanup: removed=$cleaned, patches saved=$saved"
