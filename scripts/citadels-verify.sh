#!/usr/bin/env bash
# Verify one citadels unit: its own test file(s) plus a scoped typecheck.
#
# Why this script exists rather than a bare \`vp check\`:
#   - The repo-wide \`vp check\` and \`shared/tsconfig.json\` are red at baseline
#     (unrelated formatting plus 5 pre-existing failures), so they cannot gate.
#   - \`tsc -p tsconfig.citadels.json\` type-checks the whole module, and
#     characters/index.ts imports every character file, so one worker's in-flight
#     type error would fail every sibling's verify. The script therefore fails only
#     on errors in the paths this unit owns, and reports siblings' errors as noise.
#
# Usage: scripts/citadels-verify.sh <test-file> [<test-file> ...]
# Owned source paths default to the test file's path with .test.ts -> .ts, plus
# any path passed after a literal --own. Override with CITADELS_OWN (colon list).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <test-file> [<test-file>...] [--own <path>...]" >&2
  exit 2
fi

TESTS=()
OWN=()
mode=tests
for arg in "$@"; do
  if [ "$arg" = "--own" ]; then mode=own; continue; fi
  if [ "$mode" = tests ]; then TESTS+=("$arg"); else OWN+=("$arg"); fi
done

if [ -n "${CITADELS_OWN:-}" ]; then
  IFS=':' read -r -a OWN <<< "$CITADELS_OWN"
fi
if [ "${#OWN[@]}" -eq 0 ]; then
  for t in "${TESTS[@]}"; do
    OWN+=("${t/.test.ts/.ts}")
  done
fi

echo "== vitest (the gate) =="
if ! vp test "${TESTS[@]}"; then
  echo "VERIFY FAILED: vitest" >&2
  exit 1
fi

echo "== tsc (whole module; only your own paths gate) =="
npx tsc -p tsconfig.citadels.json > /tmp/citadels-tsc.$$ 2>&1
TSC_RC=$?
if [ "$TSC_RC" -eq 0 ]; then
  echo "tsc OK"
  rm -f /tmp/citadels-tsc.$$
  echo "OK"
  exit 0
fi

MINE=0
while IFS= read -r line; do
  for own in "${OWN[@]}"; do
    case "$line" in
      "$own"*) echo "TSC ERROR (yours): $line"; MINE=1 ;;
    esac
  done
done < /tmp/citadels-tsc.$$

if [ "$MINE" -eq 1 ]; then
  echo "VERIFY FAILED: tsc reported an error in a path you own." >&2
  rm -f /tmp/citadels-tsc.$$
  exit 1
fi

echo "tsc reports errors, but none in your paths (a sibling is mid-edit or broken)."
echo "Your unit is green. Report the sibling's errors and continue."
rm -f /tmp/citadels-tsc.$$
echo "OK"
exit 0
