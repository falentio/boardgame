# Unit: core-scaffold (PILOT)

## GOAL
Create the citadels game module skeleton at shared/core/lockstep/games/citadels/
plus its test driver, such that it type-checks, a session starts from genesis,
and every downstream worker has a stable, complete contract to implement one file
against. No character or district effect is implemented here beyond safe stubs.

## READ FIRST
- shared/core/lockstep/games/g54/ (index.ts, state.ts, actions.ts, windows.ts, helpers.ts, effects.ts, setup.ts) — mirror its structure and its data-driven window-stack design.
- shared/core/lockstep/games/coinflip.ts — the minimal plug-in shape.
- shared/core/lockstep/game.ts — the GameDefinition contract.
- shared/core/tests/lockstep/g54/driver.ts and harness.ts — the driver you must mirror.
- docs/design/citadels-full-game.md — the rules of record.
- scripts/citadels-verify.sh, scripts/citadels-commit.sh.

## SCOPE (the files you own; create all of them)
shared/core/lockstep/games/citadels/
  error.ts, characters.ts, districts.ts, state.ts, actions.ts, setup.ts,
  helpers.ts, windows.ts, scoring.ts, index.ts,
  characters/index.ts, characters/<one file per 27 character id>,
  districts/index.ts, districts/effects.ts, districts/<one file per unique district id>
shared/core/tests/lockstep/citadels/driver.ts
shared/core/tests/lockstep/citadels/scaffold.test.ts

## THE CONTRACT (downstream workers implement against exactly this; do not rename)

### characters.ts
```ts
export type CharacterId = "assassin" | "thief" | "magician" | "king" | "bishop"
  | "merchant" | "architect" | "warlord" | "witch" | "tax-collector" | "wizard"
  | "emperor" | "abbot" | "alchemist" | "navigator" | "diplomat" | "artist"
  | "queen" | "magistrate" | "blackmailer" | "spy" | "seer" | "patrician"
  | "cardinal" | "trader" | "scholar" | "marshal";
export type Rank = 1|2|3|4|5|6|7|8|9;
export interface CharacterSpec {
  readonly id: CharacterId;
  readonly name: string;
  readonly rank: Rank;
  /** The district type this character collects gold for, or null (no income ability). */
  readonly income: DistrictType | null;
  /** True when the character must take the crown (King, Emperor, Patrician). */
  readonly crown: boolean;
  /** True when the character has no build limit change and no special flag. */
  readonly summary: string;
}
export const CHARACTER_CATALOG: readonly CharacterSpec[];   // all 27
export const BASE_CAST: readonly CharacterId[];             // the 8 rank 1-8 basics
export const isCharacterId = (v: string): v is CharacterId;
export const specOfCharacter = (id: CharacterId): CharacterSpec;
export const charactersOfRank = (rank: Rank): readonly CharacterId[];
```

### districts.ts
```ts
export type DistrictType = "noble" | "religious" | "trade" | "military" | "unique";
export type DistrictId = string;   // brand if you prefer; must be stable strings
export interface DistrictSpec {
  readonly id: DistrictId;
  readonly name: string;
  readonly type: DistrictType;
  readonly cost: number;
  readonly copies: number;      // how many in the deck
  readonly unique: boolean;     // true => has an effect in districts/effects.ts
}
export const DISTRICT_CATALOG: readonly DistrictSpec[];  // all basic + unique
export const BASIC_DISTRICTS: readonly DistrictSpec[];   // the 54 basics
export const UNIQUE_DISTRICTS: readonly DistrictSpec[];  // the 30 uniques
export const specOfDistrict = (id: DistrictId): DistrictSpec;
export const buildDeck = (uniques: readonly DistrictId[], rng: Random): readonly DistrictId[];
```
Deck sizes: 54 basics (11 military, 11 religious, 12 noble, 20 trade) plus the
chosen 14 uniques. `buildDeck` returns one entry per physical card (respect
`copies`), shuffled once.

### state.ts
```ts
export interface PlacedDistrict { readonly id: DistrictId; readonly gold: number; } // gold = Artist beautify
export interface CitadelsPlayer {
  readonly seat: SeatId; readonly gold: number;
  readonly hand: readonly DistrictId[];   // hidden
  readonly city: readonly PlacedDistrict[]; // public
}
export type Phase = "draft" | "turn" | "over";
export type Step = ... // your window/step union, mirroring g54's Step
export interface Window { readonly kind: WindowKind; readonly purpose: WindowPurpose;
  readonly seats: readonly SeatId[]; }
export interface CitadelsState {
  readonly cast: readonly CharacterId[];       // the cast in play, canonical rank order
  readonly players: readonly CitadelsPlayer[];
  readonly deck: readonly DistrictId[];        // hidden; last entry is the top
  readonly discard: readonly DistrictId[];     // public faceup discard pile
  readonly crown: SeatId;
  readonly round: number;
  readonly phase: Phase;
  readonly draft: DraftState | null;
  readonly callRank: number;                   // next rank to call, 1..9, or 10 = round over
  readonly active: SeatId;                     // seat whose character was called
  readonly steps: readonly Step[];
  readonly claimed: ...;                        // per-round character assignments (see below)
  readonly resigned: readonly SeatId[];
}
export const stateCodec: Codec<CitadelsState>;
```
`DraftState` and `claimed` are yours to design, but they MUST carry: the passing
hand (hidden), which seat is picking, each seat's picked character (hidden until
called), and the public faceup/facedown discards. `project` must expose only the
viewer's own pick and the public discards.

### actions.ts
```ts
export type CitadelsAction =
  | { readonly t: "pick"; readonly character: CharacterId }
  | { readonly t: "gold" }                      // take 2 gold
  | { readonly t: "draw" }                      // draw 2, keep 1
  | { readonly t: "keep"; readonly index: number }
  | { readonly t: "build"; readonly card: number; readonly pay?: readonly number[] }
  | { readonly t: "pass" }
  | { readonly t: "target"; readonly seat: SeatId }
  | { readonly t: "name-character"; readonly character: CharacterId }
  | { readonly t: "name-type"; readonly type: DistrictType }
  | { readonly t: "choose"; readonly value: string }   // generic choice payload
  | { readonly t: "pay"; readonly amount: number };
export const actionCodec: Codec<CitadelsAction>;
```
Extend this union if a character needs a shape it lacks, but every addition must
be encoded and decoded in the codec, and you must record the addition in your
report so downstream briefs can be updated.

### The character effect contract (the seam every character worker implements)
```ts
// characters/<id>.ts
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
export const <camelCaseId>: CharacterEffect = (ctx) => { ... };
```
```ts
// characters/index.ts
export interface CharacterCtx {
  readonly state: CitadelsState;   // the state at the character's turn, resource gather not yet done
  readonly seat: SeatId;           // the owner of the character
  readonly rest: readonly Step[];  // the round continuation: push it below your steps
  readonly rng: Random;
}
export type CharacterEffect = (ctx: CharacterCtx) => CitadelsState;
export const CHARACTER_EFFECTS: Record<CharacterId, CharacterEffect>;
```
Every `characters/<id>.ts` starts as `export const <id>: CharacterEffect = (ctx) => withSteps(ctx.state, ctx.rest);`
(i.e. no-op, turn ends). Windows a character may open are declared in
`windows.ts`'s `WindowPurpose` union. Declare every window purpose any character
needs, with a resolver that is a safe no-op until its character worker fills it.

### districts/effects.ts
```ts
export interface DistrictCtx {
  readonly state: CitadelsState; readonly owner: SeatId;
  readonly city: readonly PlacedDistrict[]; readonly rest: readonly Step[];
  readonly rng: Random;
}
export type DistrictEffect = (ctx: DistrictCtx) => CitadelsState;
export const UNIQUE_EFFECTS: Record<DistrictId, DistrictEffect>;  // one per unique district
```
Trigger points are hooks on the engine: `onIncome`, `onBuild`, `onEndTurn`,
`onScoring`, `onDestroy`. Pick a small set, declare them in helpers.ts, and call
them from the engine. Each unique-district file starts as a no-op returning the
state unchanged.

### setup.ts
```ts
export interface CitadelsSetup { readonly cast: readonly CharacterId[]; }
export const STARTING_GOLD = 2; export const STARTING_HAND = 4;
export const CITY_TARGET = 8;   // 7 with Bell Tower in play
export const validateCast = (cast: readonly CharacterId[]): void;
export const genesisState = (setup: CitadelsSetup, roster: Roster, rng: Random): CitadelsState;
```
validateCast: one character per rank 1-8, optionally one rank 9, no duplicates,
no two characters of the same rank.

### scoring.ts
```ts
export interface Score { readonly seat: SeatId; readonly districts: number;
  readonly colors: number; readonly completion: number; readonly unique: number; readonly total: number; }
export const scoreGame = (state: CitadelsState): readonly Score[];
export const winnerOf = (state: CitadelsState): SeatId | null;
```
Exact rules: sum of city costs; +3 for all five district types; +4 to the first
completed city; +2 to each other completed city; plus unique-district points;
tie-break by district points, then gold.

### index.ts
```ts
export const citadels: GameDefinition<CitadelsState, CitadelsAction, CitadelsSetup, CitadelsView>;
export interface CitadelsView { ... }   // redacted: no deck, no other hands
export class CitadelsError extends Error {}
```
`genesis` opens the draft's first pick window. `seatsOwed` returns the pick seat
during the draft and the acting seat during the turn phase; it must never return
empty while `isTerminal` is false. `isTerminal` is `phase === "over"`.

## ACCEPTANCE (each a test in scaffold.test.ts)
- `makeTable(citadels, ...)` starts for 3, 4, 5, 6 seats with a legal cast.
- Genesis deals 4 district cards and 2 gold per seat; deck + hands conserve the full deck count.
- `validateCast` rejects two characters of one rank, a duplicate, and a missing rank.
- `project` omits the deck and every other seat's hand, and exposes the viewer's own hand.
- `stateCodec.decode(stateCodec.encode(s))` deep-equals `s` at genesis.
- `seatsOwed` is non-empty on a fresh genesis for every seat count.
- Every id in CHARACTER_CATALOG has a file in characters/ and an entry in CHARACTER_EFFECTS.
- Every unique district in UNIQUE_DISTRICTS has an entry in UNIQUE_EFFECTS.
- `npx tsc -p tsconfig.citadels.json` is clean.

## VERIFY
`scripts/citadels-verify.sh shared/core/tests/lockstep/citadels/scaffold.test.ts`

## TIMEBOX
Generous; this is the one-way door. If it exceeds roughly 90 minutes of work,
commit what is green and report the remainder.

## FORBIDDEN
Everything in the standing orders, plus: do not implement real character or
district effects (stubs only), do not edit g54, do not run repo-wide vp check.

## REPORT
status; the file list you created; the verify command and its raw output; the
commit SHA; every place you extended the contract beyond this brief; the exact
list of window purposes you declared.

## STANDING ORDERS
<paste preferences.md verbatim>

## ADDENDUM: the shared-file discipline (read this before designing)

Every worker in this program shares ONE worktree. So a file with two writers is a
race. The scaffold exists to make every downstream worker a single-file writer.

Two consequences you must design for:

**A. Declare the whole window vocabulary up front.** `windows.ts` is written once,
by you, and never edited again. Declare the `WindowPurpose` union with this full
superset, each with a stub resolver that is a safe no-op until its owner fills it:

draft-pick, turn, keep, choose-character, choose-seat, choose-type,
magician-swap, magician-discard, seer-give, seer-receive, emperor-crown,
abbot-split, cardinal-gold, wizard-take, diplomat-exchange, marshal-seize,
artist-beautify, magistrate-confiscate, blackmailer-resolve, scholar-keep,
trader-build, warlord-destroy, tax-collect, witch-resume, queen-income.

If a worker later needs a purpose not in this list, it reports and stops; the
coordinator adds it serially. Do not leave that to chance.

**B. Give each character its own resolver seam.** A character that opens a window
must resolve it without editing `windows.ts`. So each `characters/<id>.ts`
exports two symbols:

```ts
export const <camelId>: CharacterEffect = (ctx) => { ... };
export const <camelId>Resolve: WindowResolver = (ctx) => { ... };  // resolves its own windows
```

and `characters/index.ts` pre-wires a registry, written once by you:

```ts
export const CHARACTER_RESOLVERS: Partial<Record<WindowPurpose, WindowResolver>> = {
  "choose-character": assassinResolve,   // ...one entry per purpose, all imported here
};
```

The engine's `windows.ts` resolver table looks up `CHARACTER_RESOLVERS[purpose]`
first, then falls back to a generic no-op resolver. That way the only file a
character worker edits is its own.

**C. The same for districts.** `districts/effects.ts` pre-registers all 30 uniques,
each imported from its own `districts/<id>.ts` file. A district worker edits only
its own file. If the trigger-hook set (`onIncome`, `onBuild`, `onEndTurn`,
`onScoring`, `onDestroy`) proves too small, report it; the coordinator extends
`helpers.ts` serially rather than letting two workers edit it.

## ADDENDUM 2: pre-register everything

`CHARACTER_EFFECTS` must contain all 27 ids, `CHARACTER_RESOLVERS` all purposes
above, and `UNIQUE_EFFECTS` all 30 unique district ids, at scaffold time, each
pointing at a per-file no-op. A downstream worker then never touches a shared
file. This is the whole point of the pilot.
