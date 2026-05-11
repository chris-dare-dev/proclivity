#!/usr/bin/env bash
# check-rect-tests.sh — assert that the rect commit's diff includes a test-file
# delta whenever it changes production code.
#
# Doc-only commits (changes only under *.md) are exempt.
#
# Usage: check-rect-tests.sh [<commit-sha>]   # default: HEAD

set -uo pipefail

SHA="${1:-HEAD}"
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Files changed by the commit
FILES="$(git -C "$REPO_ROOT" show --name-only --pretty=format: "$SHA" | grep -v '^$' || true)"

# Strip *.md (docs are exempt — but a *.md only commit is doc-only, not the test exempt)
PROD_FILES="$(echo "$FILES" | grep -vE '\.(md|test\.[a-z]+|spec\.[a-z]+|bats)$|_test\.go$|test_.*\.py$' || true)"
TEST_FILES="$(echo "$FILES" | grep -E '\.(test\.[a-z]+|spec\.[a-z]+|bats)$|_test\.go$|test_.*\.py$' || true)"
DOC_FILES="$(echo "$FILES" | grep -E '\.md$' || true)"

# Doc-only commit: all files are *.md and nothing else changed
NON_DOC="$(echo "$FILES" | grep -vE '\.md$' || true)"
if [[ -z "$NON_DOC" ]]; then
  echo "OK — doc-only commit, regression-test check exempt"
  exit 0
fi

if [[ -z "$PROD_FILES" ]]; then
  echo "OK — no production code changed (only docs and/or tests)"
  exit 0
fi

if [[ -z "$TEST_FILES" ]]; then
  echo "FAIL — production code changed but no test deltas in $SHA"
  echo "Production files:"
  echo "$PROD_FILES" | sed 's/^/  /'
  echo
  echo "Add a regression test/assert/snapshot for the fixed finding(s),"
  echo "then amend or recommit. NEVER bypass with --no-verify."
  exit 1
fi

echo "OK — $SHA includes test deltas alongside production code"
echo "Test files:"
echo "$TEST_FILES" | sed 's/^/  /'
exit 0
