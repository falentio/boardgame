# Unit: engine-hooks (SERIALIZED shared-file change)

## GOAL
Wire the engine call sites that let a character act outside its own turn, and
declare the few window purposes those call sites need. After this unit, every
character worker is a single-file writer.

## WHY THIS UNIT EXISTS
The scaffold resolves a character only inside its own turn window. Four
characters act across turns and have no call site today:
- Thief names a character; the engine must open a window when that character is
  later called, so the Thief takes the owner's gold.
- Witch bewitches a character; the engine must open a window when that character
  is called, so the Witch takes over the turn.
- Blackmailer threatens characters; the engine must open a resolution window at
  the start of a threatened player's turn.
- Tax Collector charges every player who builds, and Magistrate confiscates on
  the target's build; both need a call site inside the build path.

## PRECONDITION
The unit `engine-seams` must have landed first: it adds `robbed`, `bewitched`,
`threats`, `warrants`, and `taxPot` to CitadelsState. Read state.ts to confirm
those fields exist before you start. If they do not, stop and report.

## READ FIRST
- shared/core/lockstep/games/citadels/helpers.ts (applyCall, tryBuild, resolveTurn)
- shared/core/lockstep/games/citadels/windows.ts (stepState, the resolver dispatch)
- shared/core/lockstep/games/citadels/state.ts (the WindowPurpose union, WINDOW_KIND)
- shared/core/lockstep/games/citadels/characters/index.ts (CHARACTER_RESOLVERS)
- shared/core/lockstep/games/citadels/characters/{thief,witch,blackmailer,magistrate,tax-collector}.ts (the stubs)
- docs/design/citadels-catalog.md

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/helpers.ts
- shared/core/lockstep/games/citadels/state.ts (only the WindowPurpose union + WINDOW_KIND)
- shared/core/lockstep/games/citadels/characters/index.ts (only CHARACTER_RESOLVERS entries)
- shared/core/tests/lockstep/citadels/hooks.test.ts (NEW)

## WHAT TO ADD

### 1. New window purposes (add to the union and to WINDOW_KIND)
- `thief-rob`: oneOf, owed by the Thief's owner. Opened when the named character
  is called, before that character's turn window.
- `witch-takeover`: oneOf, owed by the Witch's owner. Opened when the bewitched
  character is called, before that character's turn window.
- `blackmailer-threat`: oneOf, owed by the threatened player. Opened at the very
  start of that player's turn, before their turn window.
- `armory-destroy`: oneOf, owed by the Armory's owner, on their own turn.
- `theatre-swap`: oneOf, owed by the Theater's owner, at the start of the round.

These five are the only additions. Do not add others.

### 2. Call site in `applyCall`
Before opening a character's `turn` window, inspect the persistent state and
push the cross-turn window(s) above it, in this order:
1. If `state.bewitched === character`, push `witch-takeover` for the Witch's
   owner and suppress this character's own turn (the Witch plays it).
2. Else if `state.robbed === character`, push `thief-rob` for the Thief's owner,
   then the character's normal turn window.
3. If the called character's owner is in `state.threats`, push
   `blackmailer-threat` for that owner, then the rest.
Order matters: bewitch beats rob beats the normal turn. A killed (`isSkipped`)
character opens nothing, exactly as today.

### 3. Call site in `tryBuild`
After a successful build, before returning:
- charge the Tax Collector: if the cast includes `tax-collector`, add 1 gold from
  the builder's stash to `taxPot`, unless the builder has 0 gold or is the Tax
  Collector. This applies whether or not the build was paid for.
- if `state.warrants[0]` is the building player's character and the builder paid
  for the build, push `magistrate-confiscate` for the Magistrate's owner.

### 4. Registry entries
Point the five new purposes at the five characters' existing `<id>Resolve`
exports in CHARACTER_RESOLVERS. Their bodies are stubs today; the character
workers fill them. This keeps the registry total so the compiler enforces it.

### 5. Round reset
In `applyEndRound`, clear the per-round fields: `robbed: null`,
`bewitched: null`, `threats: []`, `warrants: []`. Do NOT clear `taxPot`; it
carries over between rounds per the rulebook.

## ACCEPTANCE (tests in hooks.test.ts)
- A cast with Thief: after the Thief names a character, calling that character
  opens `thief-rob` owed by the Thief's owner, and the Thief takes the owner's gold.
- A cast with Witch: the bewitched character's own turn is suppressed and the
  Witch's window opens instead.
- A cast with Blackmailer: a threatened player's turn opens `blackmailer-threat`
  before their own window.
- A cast with Tax Collector: building a district adds 1 gold to `taxPot`; a
  builder with 0 gold adds nothing; the Tax Collector building adds nothing.
- `applyEndRound` clears the four per-round fields and keeps `taxPot`.
- `npx tsc -p tsconfig.citadels.json` is clean and the scaffold test still passes.

Write these tests against the raw `genesisState` + `stepState` seam, the way
scaffold.test.ts does. The character stubs do not implement the abilities yet, so
assert the WINDOW the engine opens and the gold transfer the call site performs,
not the full ability.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/hooks.test.ts shared/core/tests/lockstep/citadels/scaffold.test.ts`

## FORBIDDEN
Standing orders apply. Do not implement any character ability body. Do not add a
window purpose beyond the five named.

## REPORT
status; files written; verify command and raw output; commit SHA; the exact
insertion points (file:line) of the three call sites; anything in the rulebook
text you could not represent.

## STANDING ORDERS
<paste preferences.md verbatim>
