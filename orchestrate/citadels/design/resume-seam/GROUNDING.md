# Grounding: the Witch resume seam (D17-1..5)

## The rule
rules.json witch: "You then resume your turn as if you were playing the bewitched
character: you use that character's abilities and build limit, with YOUR hand, YOUR
gold, and YOUR city." The Witch's held turn gathers her fixed +2; the resume gathers
NOTHING and plays the bewitched character's ability on the Witch's seat.

## The under-specification (from verification-17.md)
The resume identity rides the single mutable `pending` slot and is recognized by a
marker (`pending.note === "witch-resume"`) that any character effect can clobber or
outflank:

1. `resolveTurn` reads `incoming?.note === WITCH_RESUME_NOTE` (helpers.ts:814) to set
   `resumedWitch`; `seatHolding` (helpers.ts:106) and `buildLimit` (helpers.ts:439)
   read the same marker to decide who owns the bewitched character.
2. `pending` is a single shared slot every effect writes when its turn opens.
   Bewitched effects that write `pending.note` (Abbot "abbot-split", Emperor
   "emperor-target", Spy "spy-seat/type/peek", Blackmailer "threat-1/2", and the
   rest) destroy the marker, so `seatHolding` falls back to the REAL holder: the
   income/crown/reward/loot lands on the holder, not the Witch (D17-2..5).
3. Effects that re-seat their own `turn` windows (`withBuildLimit` in scholar.ts:34
   and architect.ts:29 filters and re-prepends turn windows) move their windows
   ABOVE the fix16 `arm` step, so the window `resolveTurn` visits carries note null
   and takes the GATHER path: the resume gathers a second time (D17-1).

## The rule the seam must encode
The resume is a turn whose identity must be owned by the IMMUTABLE STACK (or a
dedicated non-clobberable state field), never by the shared mutable `pending` slot;
and the resume turn window must be recognizable by stack position, independent of
what any effect prepends.

## The seam surface (files a fix may touch)
- `shared/core/lockstep/games/citadels/helpers.ts` - `resolveTurn`, `seatHolding`,
  `buildLimit`, `activeCharacterOf`, `relocateEffectBelowThreat`
- `shared/core/lockstep/games/citadels/state.ts` - `Step` union + `encodeStep`/`decodeStep`
  (the codec MUST round-trip any new step or field; the lockstep primitive is off-limits)
- `shared/core/lockstep/games/citadels/characters/witch.ts` - `witchResolve`/`resumeStack`
- possibly `characters/scholar.ts` / `architect.ts` (withBuildLimit), `windows.ts`

## Hard constraints
- The lockstep primitive (`shared/core/lockstep/*.ts`) is untouchable.
- The codec round-trips every new Step kind or state field.
- D13 (threat below abilities), D14 (build after abilities), D15 (gather before
  abilities), D16 (resume no double-gather) must all keep holding.
- The 27 character files must NOT each need edits; the seam owns the mechanism.

## Acceptance (the D17 counterexamples)
- `verification17.test.ts` D17-1, D17-1b (Scholar resume no double-gather), D17-2
  (Abbot income to the Witch), D17-3 (Spy naming+loot), D17-4 (Blackmailer markers),
  D17-5 (Emperor reward to the Witch) all green.
- Every prior pass's counterexample (verification-report through verification16) green.
