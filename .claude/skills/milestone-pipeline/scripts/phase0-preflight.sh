#!/usr/bin/env bash
# phase0-preflight.sh — pipeline-readiness check.
# Distinct from .claude/scripts/release-preflight.sh; that runs at the END.
# This runs at the START.
#
# Usage: phase0-preflight.sh [--needs-aws] [--needs-tools bun,bats,jq,...]

set -uo pipefail

NEEDS_AWS=0
NEEDS_TOOLS="bun,bats,jq,yq,python3,git,gpg"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --needs-aws) NEEDS_AWS=1; shift ;;
    --needs-tools) NEEDS_TOOLS="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then :; else
  echo "FAIL — not inside a git repo" >&2; exit 1
fi

PASS=0; FAIL=0
ok()  { echo "PASS — $1"; PASS=$((PASS+1)); }
bad() { echo "FAIL — $1"; FAIL=$((FAIL+1)); }
warn(){ echo "WARN — $1"; }

# 1. clean tree
if [[ -z "$(git -C "$REPO_ROOT" status --porcelain | grep -v '^??' || true)" ]]; then
  ok "git tree clean (untracked allowed)"
else
  bad "git tree dirty — commit or stash before starting a milestone"
fi

# 2. on main
BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
if [[ "$BRANCH" == "main" ]]; then ok "on main"; else warn "on $BRANCH (this project commits to main)"; fi

# 3. tools on PATH
IFS=',' read -ra tools <<< "$NEEDS_TOOLS"
for t in "${tools[@]}"; do
  if command -v "$t" >/dev/null 2>&1; then ok "tool $t present"; else bad "tool $t missing"; fi
done

# 4. GPG agent (commit signing) — only check if commit.gpgsign is true
if [[ "$(git -C "$REPO_ROOT" config commit.gpgsign 2>/dev/null)" == "true" ]]; then
  if echo test | gpg --clearsign >/dev/null 2>&1; then
    ok "gpg-agent responsive (signing enabled)"
  else
    bad "gpg-agent not responsive — try: gpg-connect-agent reloadagent /bye"
  fi
else
  warn "commit.gpgsign is not true; signing is the project default"
fi

# 5. AWS env vars (only if --needs-aws)
if [[ "$NEEDS_AWS" -eq 1 ]]; then
  for v in AWS_PROFILE AWS_REGION PULUMI_CONFIG_PASSPHRASE; do
    if [[ -n "${!v:-}" ]]; then ok "env $v set"; else bad "env $v missing (--needs-aws)"; fi
  done
fi

# 6. milestone lock
LOCK="$REPO_ROOT/.claude/notes/milestones/.lock"
if [[ -f "$LOCK" ]]; then
  pid="$(cut -d: -f1 < "$LOCK")"
  locked_id="$(cut -d: -f2 < "$LOCK")"
  if kill -0 "$pid" 2>/dev/null; then
    bad "milestone lock held by pid $pid (id=$locked_id) — use --resume or wait"
  else
    warn "stale lock from dead pid $pid — clear via: init-state.sh <id> --release-lock"
  fi
else
  ok "no milestone lock held"
fi

echo
echo "preflight: $PASS pass, $FAIL fail"
[[ "$FAIL" -eq 0 ]] || exit 1
