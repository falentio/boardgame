#!/usr/bin/env bash
# Detached proof runner. Boots nothing itself; just runs the UI proof and logs.
set -u
cd "$(dirname "$0")/.."
LOG="${1:-/tmp/proof.log}"
PORT="${2:-3000}"
{
  echo "=== run start $(date -Is) port=$PORT ==="
  node scripts/proof-ui.mjs --port "$PORT"
  echo "EXIT=$?"
  echo "=== run end $(date -Is) ==="
} >> "$LOG" 2>&1
