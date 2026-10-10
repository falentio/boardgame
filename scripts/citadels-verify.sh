#!/usr/bin/env bash
# Verify one citadels unit: its own test file(s) plus a scoped typecheck of the
# game module. The repo-wide `vp check` and `shared/tsconfig.json` are red at
# baseline (unrelated formatting and pre-existing errors), so this script is the
# gate instead of a proxy that is already red.
#
# Usage: scripts/citadels-verify.sh <test-file> [<test-file> ...]
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <test-file> [<test-file>...]" >&2
  exit 2
fi

echo "== vitest =="
vp test "$@"

echo "== tsc (citadels module) =="
npx tsc -p tsconfig.citadels.json
echo "OK"
