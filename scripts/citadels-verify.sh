#!/usr/bin/env bash
# Verify one citadels unit: its own test file(s) plus a scoped typecheck.
#
# Why this script exists rather than a bare \`vp check\`:
#   - The repo-wide \`vp check\` and \`shared/tsconfig.json\` are red at baseline
#     (unrelated formatting plus 5 pre-existing failures), so they cannot gate.
#   - \`tsc -p tsconfig.citadels.json\` type-checks the whole module, and
#     characters/index.ts imports every character file, so one worker's in-flight
#     type error would fail every sibling's verify.
# The script fails only on errors in the source files this unit owns, and reports
# a sibling's errors as noise.
#
# Usage: scripts/citadels-verify.sh <test-file> [<test-file> ...] [--own <src> ...]
#
# Owned sources: pass --own explicitly for every source file your unit edits. That
# is the reliable form. Without --own, the script derives the source path from the
# test path by string surgery; a NEW test whose source already exists derives
# fine, and a test with no source of its own (a pure integration test) owns
# nothing, so only its own test failure gates. CITADELS_OWN (colon list) overrides.
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
    src="${t/tests\/lockstep\/citadels\//lockstep\/games\/citadels\/}"
    src="${src%.test.ts}.ts"
    if [ "$src" != "$t" ] && [ -f "$src" ]; then
      OWN+=("$src")
    fi
  done
fi

if [ "${#OWN[@]}" -eq 0 ]; then
  echo "note: no owned source derived; only a test failure will gate this run."
  echo "      pass --own <path> for every source file your unit edits."
fi

echo "== vitest (the gate) =="
if ! vp test "${TESTS[@]}"; then
  echo "VERIFY FAILED: vitest" >&2
  exit 1
fi

echo "== tsc (whole module; only your own paths gate) =="
TSC_LOG="$(mktemp)"
npx tsc -p tsconfig.citadels.json > "$TSC_LOG" 2>&1
TSC_RC=$?
if [ "$TSC_RC" -eq 0 ]; then
  echo "tsc OK"
  rm -f "$TSC_LOG"
  echo "OK"
  exit 0
fi

MINE=0
while IFS= read -r line; do
  for own in "${OWN[@]}"; do
    case "$line" in
      "$own"*|*"/$own"*) echo "TSC ERROR (yours): $line"; MINE=1 ;;
    esac
  done
done < "$TSC_LOG"

if [ "$MINE" -eq 1 ]; then
  echo "VERIFY FAILED: tsc reported an error in a path you own." >&2
  rm -f "$TSC_LOG"
  exit 1
fi

NOISE="$(grep -c "lockstep/games/citadels/" "$TSC_LOG" || true)"
if [ "${NOISE:-0}" -gt 0 ]; then
  echo "tsc reports $NOISE error line(s) under the citadels module, none in your paths."
  echo "A sibling is mid-edit or broken. Your unit is green; report it and continue."
  grep "lockstep/games/citadels/" "$TSC_LOG" | head -5
  rm -f "$TSC_LOG"
  echo "OK"
  exit 0
fi

echo "tsc failed for a reason outside the citadels module; treating as a real failure." >&2
head -20 "$TSC_LOG" >&2
rm -f "$TSC_LOG"
exit 1
