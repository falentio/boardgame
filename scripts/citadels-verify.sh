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
# Owned sources are derived from each test path by the rule below, unless --own
# or CITADELS_OWN (colon list) is given.
#
# Derivation: shared/core/tests/lockstep/citadels/characters/x.test.ts
#          -> shared/core/lockstep/games/citadels/characters/x.ts
# i.e. swap \`tests/\` for \`games/\` after the lockstep segment, and drop \`.test\`.
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

# Derive the owned source path for a test path, by string surgery that must
# actually match a file on disk. A derivation that produces nothing is a bug in
# this script, so it fails loudly rather than silently matching no error line.
derive_own() {
  local t="$1"
  local src
  src="${t/tests\/lockstep\/citadels\//lockstep\/games\/citadels\/}"
  src="${src%.test.ts}.ts"
  if [ "$src" = "$t" ] || [ ! -f "$src" ]; then
    echo "cannot derive an owned source for $t; pass --own explicitly" >&2
    return 1
  fi
  printf '%s\n' "$src"
}

if [ -n "${CITADELS_OWN:-}" ]; then
  IFS=':' read -r -a OWN <<< "$CITADELS_OWN"
fi
if [ "${#OWN[@]}" -eq 0 ]; then
  for t in "${TESTS[@]}"; do
    derived="$(derive_own "$t")" || exit 2
    OWN+=("$derived")
  done
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

# Fail if any error line names a path this unit owns.
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

# No error in an owned path. A tsc error anywhere under the citadels module that
# is not ours means a sibling is mid-edit; that is not this unit's failure.
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
