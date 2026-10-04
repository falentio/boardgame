#!/usr/bin/env bash
# Mutation-proof for shared/core/tests/lockstep/g54/matrix.test.ts.
#
# For each mutation it breaks one rule in the g54 engine, runs ONLY the matrix
# test, and asserts the matrix goes RED. A mutation the matrix survives is a
# coverage hole: the matrix would pass a broken game. The file is restored after
# every mutation via the trap, so a Ctrl-C or a crash never leaves the tree dirty.
#
# Usage: bash shared/core/tests/lockstep/g54/mutation-proof.sh
# Exit 0 = every mutation was caught. Exit 1 = at least one hole.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
cd "$ROOT"
MATRIX="shared/core/tests/lockstep/g54/matrix.test.ts"
EFFECTS="shared/core/lockstep/games/g54/effects.ts"
ROLES="shared/core/lockstep/games/g54/roles.ts"
[ -f "$MATRIX" ] && [ -f "$EFFECTS" ] && [ -f "$ROLES" ] || {
  echo "mutation-proof: run from the repo (could not resolve $MATRIX)"; exit 2;
}
BACKUP="$(mktemp)"

cp "$EFFECTS" "$BACKUP"
cp "$ROLES" "$BACKUP.r"
trap 'cp "$BACKUP" "$EFFECTS"; cp "$BACKUP.r" "$ROLES"; rm -f "$BACKUP" "$BACKUP.r"' EXIT

# Each entry: <label>|<file>|<sed expression>. The sed must change exactly one rule.
MUTATIONS=(
  "banker pays 1 not 3|$EFFECTS|s/gainFromTreasury(ctx.state, ctx.claim.claimant, 3)/gainFromTreasury(ctx.state, ctx.claim.claimant, 1)/"
  "speculator cap 2 not 5|$EFFECTS|s/Math.min(playerOf(ctx.state, ctx.claim.claimant).coins, 5)/Math.min(playerOf(ctx.state, ctx.claim.claimant).coins, 2)/"
  "politician steals 1 not 2|$EFFECTS|s/transferCoins(ctx.state, ctx.claim.target, ctx.claim.claimant, 2)/transferCoins(ctx.state, ctx.claim.target, ctx.claim.claimant, 1)/"
  "farmer gives to itself not target|$EFFECTS|s/transferCoins(next, ctx.claim.claimant, ctx.claim.target, 1)/transferCoins(next, ctx.claim.claimant, ctx.claim.claimant, 1)/"
  "capitalist takes 3 not 4|$EFFECTS|s/gainFromTreasury(ctx.state, ctx.claim.claimant, 4)/gainFromTreasury(ctx.state, ctx.claim.claimant, 3)/"
  "mercenary token lasts 2 turns|$EFFECTS|s/{ target: ctx.claim.target, turns: 1 }/{ target: ctx.claim.target, turns: 2 }/"
  "communist steals 2 not 3|$EFFECTS|s/transferCoins(ctx.state, target, poorestSeat, 3)/transferCoins(ctx.state, target, poorestSeat, 2)/"
  "communist skips the actor as poorest|$EFFECTS|s/const poorestSeat = poorest(ctx.state, ctx.state.active, aliveSeats(ctx.state))/const poorestSeat = poorest(ctx.state, ctx.state.active, otherAlive(ctx.state, ctx.state.active))/"
  "priest collects 2 not 1|$EFFECTS|s/transferCoins(ctx.state, ctx.claim.target, ctx.claim.claimant, 1)/transferCoins(ctx.state, ctx.claim.target, ctx.claim.claimant, 2)/"
  "spy takes 2 not 1|$EFFECTS|s/gainFromTreasury(ctx.state, ctx.claim.claimant, 1), \[/{ gainFromTreasury(ctx.state, ctx.claim.claimant, 2), [/"
  "consular treaty names the wrong seat|$EFFECTS|s/treaty: \[ctx.claim.claimant, ctx.claim.target\]/treaty: [ctx.claim.target, ctx.claim.target]/"
  "guerrilla loses its blockRole|$ROLES|s/blockRole: \"guerrilla\"/blockRole: null/"
)

pass=0
fail=0
for entry in "${MUTATIONS[@]}"; do
  label="${entry%%|*}"
  rest="${entry#*|}"
  file="${rest%%|*}"
  expr="${rest#*|}"
  cp "$BACKUP" "$EFFECTS"; cp "$BACKUP.r" "$ROLES"
  sed -i "$expr" "$file"
  case "$file" in
    *roles.ts) pristine="$BACKUP.r" ;;
    *) pristine="$BACKUP" ;;
  esac
  if diff -q "$pristine" "$file" >/dev/null 2>&1; then
    echo "SKIP  sed did not change the source for: $label"; fail=$((fail + 1))
    continue
  fi
  if npx vitest run "$MATRIX" >/tmp/mutation-out.txt 2>&1; then
    echo "HOLE  matrix stayed GREEN under: $label"
    fail=$((fail + 1))
  else
    echo "caught  $label"
    pass=$((pass + 1))
  fi
  cp "$BACKUP" "$EFFECTS"; cp "$BACKUP.r" "$ROLES"
done

echo "----"
echo "caught: $pass  holes: $fail"
[ "$fail" -eq 0 ]
