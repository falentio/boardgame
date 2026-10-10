# Unit: engine-seams (SERIALIZED shared-file change)

## GOAL
Add the cross-turn persistent state fields that five characters need, to
state.ts, once, before any character worker runs. A character worker must then
never edit state.ts.

## WHY THIS UNIT EXISTS
The scaffold's CitadelsState carries only turn-local state. Five characters hold
state across turns:
- Thief: names a character at its turn; robs that character's owner when the
  named character is later called.
- Witch: names a character; takes over that character's turn when it is called.
- Blackmailer: assigns two threat markers to characters; a threatened character
  resolves the threat at the start of its own turn.
- Magistrate: assigns three warrant markers to characters; confiscates a
  district when the targeted character builds one.
- Tax Collector: a gold pot on the character token, charged when any player
  builds a district, collected by the Tax Collector on its turn, carrying over
  between rounds.
Each needs a field the current state lacks. Adding all five in one serialized
change is what keeps every character worker a single-file writer.

## READ FIRST
- docs/design/citadels-catalog.md (the character ranks and abilities)
- docs/design/citadels-full-game.md
- shared/core/lockstep/games/citadels/state.ts  (the file you own)
- shared/core/lockstep/games/citadels/helpers.ts (read it, do NOT edit it)
- shared/core/lockstep/games/citadels/index.ts (read project; you may need to add a view field)

## SCOPE (the files you own)
- shared/core/lockstep/games/citadels/state.ts
- shared/core/lockstep/games/citadels/index.ts  (only to extend CitadelsView if a field must be public)
- shared/core/tests/lockstep/citadels/seams.test.ts (NEW)

Do NOT edit helpers.ts, windows.ts, characters/index.ts, districts/effects.ts,
characters.ts, districts.ts, setup.ts, scoring.ts, actions.ts, or any effect
file. If a seam needs an engine call site in helpers.ts, report the exact line
and stop; the coordinator serializes that edit.

## WHAT TO ADD (exact field names; downstream briefs name them)

```ts
/** The character the Thief named this round, or null. Cleared at end of round. */
readonly robbed: CharacterId | null;
/** The character the Witch bewitched this round, or null. */
readonly bewitched: CharacterId | null;
/** The two Blackmailer threat markers: the targeted one first, the decoy second. */
readonly threats: readonly CharacterId[];
/** The three Magistrate warrant markers: the signed (targeted) one first. */
readonly warrants: readonly CharacterId[];
/** Gold accumulated on the Tax Collector's token; carries between rounds. */
readonly taxPot: number;
```

Also add `readonly beau: number` is NOT needed; the Artist's marker is already
`PlacedDistrict.gold`.

Encode and decode every new field in `stateCodec`, in the same style as the
existing fields, and default them in `genesisState` (in setup.ts) is NOT yours:
instead, document in your report that setup.ts must initialize
`robbed: null, bewitched: null, threats: [], warrants: [], taxPot: 0`, so the
coordinator can apply that one-line change, or make the fields optional with a
default. Choose the option that keeps setup.ts untouched; an optional field with
a documented default is acceptable here.

## ACCEPTANCE (tests in seams.test.ts)
- `stateCodec.decode(stateCodec.encode(s))` round-trips a state with all five
  fields set to non-default values.
- `stateCodec.decode` rejects a state missing any of the five fields (they are
  part of the wire contract once added).
- The new fields do not appear in `CitadelsView` unless they are public
  information; if you add one, assert the redaction of the rest.
- `npx tsc -p tsconfig.citadels.json` is clean.
- The existing scaffold test still passes.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/seams.test.ts shared/core/tests/lockstep/citadels/scaffold.test.ts`

## FORBIDDEN
Standing orders apply. Plus: do not implement any character behavior. Do not add
a field beyond the five named unless you report why.

## REPORT
status; files written; the verify command and raw output; the commit SHA; exactly
which files still need a one-line change to initialize the new fields (setup.ts,
or wherever genesisState lives), quoted as the exact line to insert.

## STANDING ORDERS
<paste preferences.md verbatim>
