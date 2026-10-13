# Secret Hitler design

Secret Hitler is a hidden-role social-deduction game by Max Temkin, Mike Boxleiter,
and Tommy Maranges, published by Goat, Wolf, & Cabbage in 2016. The rules live in
`docs/research/secret-hitler/rules.md`. The engine lives in
`shared/core/lockstep/games/secret-hitler/`. This file records why the engine has
the shape it has, what it decided where the rules are silent, and what a future
maintainer inherits.

## Why this shape

Secret Hitler's round is strictly linear: nominate a Chancellor, vote, the
President discards one of three, the Chancellor enacts one of two, and then, if a
Fascist Policy landed on a power slot, the President resolves one Executive
Action. Nothing suspends an outer action to run an inner one. The Executive
Action runs *after* the Legislative Session has fully ended, and the Veto is a
back-edge into the same `chancellor-enact` phase with the same two cards, not a
nested window.

G54 drives its turn from a stack of windows because its challenge, proof, and
block windows nest and an outer claim must resume. Secret Hitler has nothing to
stack. A stack here would never exceed depth one, and a reader would have to
learn a push/pop discipline only to discover it never deepens. The chosen shape is
the scape-goat idiom: one flat, payload-carrying phase union that `seatsOwed` and
`step` switch over exhaustively, plus one `power` phase kind carrying a `PowerId`
so the four Executive Actions do not each add an arm.

The synthesis (`orchestrate/secret-hitler/synthesis.md`) picks this candidate and
rejects a `Record<PowerId, PowerResolver>` registry: four heterogeneous powers do
not earn a registry, and the registry's wide, mostly-null `PowerEffect` record
makes no illegal state unrepresentable. It also rejects g54's window stack for the
same depth-one reason.

```text
shared/core/lockstep/games/secret-hitler/
├── index.ts     the secretHitler GameDefinition and the public re-exports
├── error.ts     SecretHitlerError
├── roles.ts     Role, Party, partyOf, FASCIST_TEAM, rolesFor, dealRoles, knownAllies
├── board.ts     PowerId, BoardSlot, FASCIST_BOARD, powerFor, vetoUnlocked, votePasses
├── policies.ts  Policy, POLICY_MIX, fullDeck, drawFrom, peekFrom, needsReshuffle
├── state.ts     SecretHitlerState, Phase, Outcome, stateCodec, checkInvariants
├── actions.ts   SecretHitlerAction and its codec
├── setup.ts     SecretHitlerSetup, genesisState
├── powers.ts    POWER_IDS, legalPowerTargets, investigateParty
├── reducer.ts   step, seatsOwed, isTerminal, the phase and power handlers
└── view.ts      project, publicPhaseOf, teamOf, legalActions, the view types
```

No cycles. `error.ts`, `board.ts`, and `policies.ts` are leaves. `roles.ts`,
`state.ts`, `powers.ts` sit above them; `actions.ts`, `setup.ts`, `reducer.ts`,
`view.ts` above those; `index.ts` imports all.

## The structures that carry the game

**One board row whose length IS the Fascist win line.** `FASCIST_BOARD` in
`board.ts` is a `Record<PlayerCount, readonly BoardSlot[]>`. `boardLimit(count)`
returns `boardFor(count).length`, and `powerFor(count, n)` reads the same row. The
power a Fascist Policy grants and the length at which the Fascists win are the
same row, so they cannot drift. `BoardSlot` is the tagged union from the synthesis:
`{kind:"none"} | {kind:"power", power}` | `{kind:"fascist-win"}`, so the win slot
and "no power" are distinct from a power id and `powerFor` cannot confuse the win
line with a blank.

**One flat Phase union.** One case per round step plus one `power` case:

```text
nominate ─▶ vote ─▶ president-discard ─▶ chancellor-enact ─▶ [veto] ─▶ power ─▶ nominate
                                              │                                  │
                                              └──────────── over ◀───────────────┘  (a win)
```

`seatsOwed` and `step` switch over it exhaustively with a `never` default. A new
phase kind is a compile error in both.

**One exhaustive `stepPower` switch.** The power table lives in `board.ts`; the
switch only dispatches on `phase.power`. Adding a power is one `BoardSlot` entry
plus one case, which is the same one-edit cost the registry offered, without a
second control mechanism for the same turn.

**Invariants at the decode boundary.** `checkInvariants` runs inside
`stateCodec.decode`, the one boundary untrusted state crosses. The seed chain is a
convergence check, not a validator: it proves every peer folded the same frames to
the same state, not that the state is legal. So the codec enforces what the types
cannot: every named seat is in the roster, the track bounds, the election-tracker
bound, the role multiset, policy conservation across the two piles, the tracks,
and the open phase payload, that a filled track carries the `over` phase, that a
table below the active floor is terminal, and the synthesis invariant that the
power named by `phase.power` is exactly `powerFor(count, fascistPolicies)`.

**`partyOf` and `knownAllies` are pure derivations.** `partyOf(role)` is the one
owner of "Hitler is a Fascist to an investigation". `knownAllies(roles, viewer)`
names the setup-knowledge matrix beside the state's team accessor, so the fascist
and Hitler knowledge rules have one owner and a stored ally map cannot drift.

## Genesis and determinism

`genesisState` runs exactly two shuffles, in a fixed order: the role deal
(`dealRoles`), then the policy deck (`rng.shuffle(fullDeck())`). Nothing else in
the game shuffles at genesis. `step` draws deterministically, popping the top
(last) element. The one mid-game shuffle is the discard reshuffle, and it consumes
`rng` derived from `frame.seed` — so every peer computes the same new pile. No
`Math.random`, no `Date.now`, no roster-order read outside the canonical order.

The reshuffle is a no-op when the discard is empty: shuffling the remaining deck
alone cannot change which cards are left, only their order, so consuming rng for
it would be a gratuitous divergence point. Every peer calls it at the same points.

## Rule gaps decided

The research file marks ten places where the primary sources are silent or
ambiguous. Each is a decision here, not a TODO.

1. **The board power table.** The rulebook body lists the four powers but never
   says which count grants which; that lives only on the printed boards. The
   engine encodes the research table exactly, and `board.test.ts` pins every cell.
   The table is the authority; the engine has no board-image check.
2. **Reshuffle timing for the chaos draw.** Decision: reveal the top tile first,
   then test the remaining count. The end-of-session reshuffle already keeps the
   deck at three or more, so the chaos reveal never finds an empty pile; the
   forced reshuffle in `chaos` is defensive totality only.
3. **Tracker reset versus term-limit reset.** Decision: a face-up enactment resets
   only the Election Tracker. Only the chaos event also forgets the term limits.
   `enactPolicy` clears the tracker; `chaos` clears the term limits too.
4. **Special Election placard return.** Decision: after the special round ends,
   rotation resumes from the seat to the left of the President who enacted it, so
   a special election skips no one. `specialElectionResume` holds that anchor and
   `beginNextRound` clears it once consumed.
5. **Hitler's knowledge at 5-6.** Decision: follow the per-count setup instruction.
   Hitler knows the Fascist at 5-6 and nobody at 7-10; an ordinary Fascist knows
   the whole team at every count. `knownAllies` owns this.
6. **The majority denominator.** Decision: a strict majority of the living, voting
   seats. A tie fails. `votePasses(yes, voters)` is `yes * 2 > voters`, read
   against `activeSeats`.
7. **Clockwise versus left.** Decision: one canonical rotation direction, the
   roster order. Both phrases map to it.
8. **An empty deck at the moment of a draw.** Decision: reshuffle before the draw.
   `drawThree` reshuffles first, so a session always finds three tiles.
9. **The investigation-reuse ban.** Decision: global across all Presidents. The
   legal-target set is the active seats minus every target ever investigated.
10. **The Trump Pack.** Out of scope for the base engine; the extension research
    says it is alternate art with no rule change.

### House decisions where no rule exists

- **The active floor is three seats.** The rules give no floor for a table shrunk
  by execution or resignation. Below three the game cannot form a government, so
  it folds to `outcome: { kind: "abandoned" }` and `isTerminal` reads true. This
  folds into terminal, never into an empty owed set: an empty owed set on a
  non-terminal state is a session contract violation.
- **A nomination with no eligible seat counts as a failed election.** With the
  term limits, an edge case can leave no eligible Chancellor. Rather than wedge,
  the engine advances the Election Tracker, so the chaos reset eventually frees
  the table.
- **A Policy Peek costs a frame.** The President reports `ack` after looking, so
  the power phase is uniform and the peek is guaranteed acknowledged. The
  alternative, auto-resolving, would save a round trip but could show cards the
  President never opened.
- **A resignation mid-session returns the held cards.** A resigning President or
  Chancellor puts the drawn or offered cards into the discard and the round
  advances, so policy conservation holds and no card is stranded in a phase.
- **An illegal or hostile report coerces to a safe default.** Every phase admits a
  subset and falls back rather than throwing, so a buggy or hostile peer can never
  throw out of `step`.

## The redaction boundary

`project` is the only way state leaves a session. It drops every other seat's
role, the deck order, the discard faces, the drawn cards except to the sitting
President, the offered cards except to the sitting Chancellor, a peek and an
investigation except to the President who ran it. `publicPhaseOf` strips the two
secret payloads (`drawn`, `offered`) from the phase; it is a real removal, not a
pass-through. `myDrawn`, `myOffered`, `myPeeks`, and `myInvestigations` are the
only channels, each gated on the viewer being the one seat the record names.

The view carries only counts for the two piles (`drawCount`, `discardCount`), so
neither the deck order nor the discard order crosses. At terminal the view carries
the scoring reveal: every seat's role.

`redaction.test.ts` pins the view key set exactly, asserts no serialized view
states a non-viewer's role, and asserts the deck and discard arrays never appear.

## Decisions a maintainer inherits

- **The board and role tables are one edit each.** `FASCIST_BOARD` and
  `FASCIST_TEAM` are the single sources of truth for the power line, the win line,
  and the role multiset. `board.test.ts` pins them against the research table.
- **The deck mix is a module constant, not lobby config.** Two peers cannot
  disagree about the deck by agreeing on a bad setup; `SecretHitlerSetup` has no
  fields.
- **The reshuffle is the only mid-game rng consumer.** Any future feature that also
  consumes rng inside `step` must fix its position relative to the reshuffle, or
  peers diverge.
- **The flat union is the whole bet.** If a future extension makes an Executive
  Action open a sub-turn that must resume the outer turn, this shape needs a stack.
  The base game does not do this; the extension unit is the risk.
- **The nested Special Election is unpinned.** The rules do not cover a Special
  Election that itself opens a Special Election power. The engine overwrites the
  resume anchor, which is the plain reading of "the placard returns to the left of
  the President who enacted it"; the alternative is a two-deep anchor. Untested
  because the rules give no case.
