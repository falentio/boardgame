# Secret Hitler: rebalanced setup

**UNOFFICIAL. This is not a Goat, Wolf, & Cabbage rule.** The rebalanced setup is a
variant from the secrethitler.io web adaptation [SHIO], not the official rulebook,
whose deck is always 6 Liberal and 11 Fascist tiles [RB p2]. The official game ships
no such rule. This definition exists so the platform can host a rebalanced table
beside the base without changing the base rules.

The engine lives in `shared/core/lockstep/games/secret-hitler-rebalanced/`. The base
game it extends is `shared/core/lockstep/games/secret-hitler/`, designed in
`docs/design/secret-hitler.md`; the rules are in
`docs/research/secret-hitler/rules.md`; the variant verdict is in
`docs/research/secret-hitler/extension-secret-hitler-2.md`.

## What the variant changes

The variant changes setup at exactly three player counts and changes nothing else.
The [SHIO] text: "6 player games start with a Fascist Policy already enacted, 7
player games start with 10 Fascist Policies in the deck instead of 11, and 9 player
games start with 9 Fascist Policies in the deck."

| Players | Base | Rebalanced |
| --- | --- | --- |
| 6 | deck 6 Liberal / 11 Fascist, track 0 | deck 6 Liberal / 10 Fascist, track 1 Fascist |
| 7 | deck 6 Liberal / 11 Fascist, track 0 | deck 6 Liberal / 10 Fascist, track 0 |
| 9 | deck 6 Liberal / 11 Fascist, track 0 | deck 6 Liberal / 9 Fascist, track 0 |
| 5, 8, 10 | unchanged | byte-identical to the base |

Every other count and every other rule is the base game: the role mix, the reveal
matrix, the election, the term limits, the tracker, the Executive Actions, the
veto, the reshuffle, and all four win conditions. The variant changes only the
supply of Fascist tiles and, at 6, the starting track.

## The structures that carry the variant

**One delta table.** `REBALANCE_DELTA` in `variant.ts` is a
`Record<PlayerCount, RebalanceDelta>`, one row per count. Each row names a
`preEnactedFascist` count and a `fascistSupply` total. The three variant numbers
exist only here; `genesisState` and the state codec's supply both read the table,
so they cannot drift. The five rows the variant leaves alone carry the base values,
which is what makes the table the single statement of the delta.

**Genesis is the base genesis with the delta applied.** `genesisState` runs the
same two shuffles in the same fixed order as the base — the role deal, then the
deck — so at a count the table leaves alone it produces byte-identical state. The
only differences are the deck built with the reduced Fascist count and the starting
`fascistPolicies`.

**Everything else is the base's function, referenced not copied.** The
`secretHitlerRebalanced` `GameDefinition` wires `step`, `seatsOwed`,
`isTerminal`, and `project` straight from the base modules, and reuses the base
`actionCodec`. `variant.test.ts` asserts those members by identity
(`toBe`), not just behavior: a copy would pass a behavior check and still drift
the first time either game changes. Only `id`, `state` (the base codec plus the
pre-enactment floor), and `genesis` differ.

## The seam this variant needed in the base

The base hard-coded the deck mix, so the variant could not reuse the base state
codec without weakening or copying it. Two base edits, both behavior-preserving for
the base, close that seam:

- `policies.ts`: a `PolicyMix` type and a `deckFor(mix)` builder. `fullDeck()`
  is now `deckFor(POLICY_MIX)`, so the base deck is unchanged.
- `state.ts`: `checkInvariants` now takes the mix and conserves against it, and an
  exported `stateCodecFor(supply)` factory builds a codec for a supply. The base's
  exported `stateCodec` is `stateCodecFor(POLICY_MIX)`, so every existing base
  consumer is untouched.

The supply is a `PolicyMix` or a `(count) => PolicyMix` resolver, because the
variant's supply changes with the table size: the codec conserves a 7-player state
against 6 Liberal / 10 Fascist and a 5-player state against the base 6 / 11. The
conservation invariant stays strong — it is the check that catches a phase
stranding a card — and `variant.test.ts` proves it still fires by feeding the
variant codec a state whose supply is off by one.

Conservation alone is not enough at 6 players, where the supply is the base 11: the
pre-enacted policy and a deck tile are arithmetically identical, so a base-shaped
frame-0 state (track 0, 11 Fascist in the deck) would conserve and decode. The
variant therefore wraps the codec with a floor: `variantStateCodec` in
`variant.ts` runs the conserving codec and then rejects a track below
`preEnactedFascist`. Genesis is the track's only writer and the fold only
increments it, so the track is never below the floor in any legal state. The base
codec is unchanged, so the floor costs the base nothing.

**Rejected: duplicating the codec.** A copy of the base `stateCodec` in the variant
would be drift-prone and would silently diverge the first time either side changed.
**Rejected: a `deckMix` field on the base state.** The mix is a function of
`(gameId, playerCount)`, not of state, and a state field would let a peer claim a
mix that disagrees with its game.

## Rule gaps decided

The extension research file's Rule gaps section has three entries. One touches this
variant; the other two are about the Trump Pack and do not.

3. **The exact rules of every unofficial variant.** The research asks whether the
   engine treats an unofficial variant's text as UNVERIFIED until read from the fan
   documents. Decision: the rebalanced delta is taken from the [SHIO] rules page,
   the cited primary source, and encoded in one table with that citation. The
   variant is labeled UNOFFICIAL in this doc and in the file header of `variant.ts`
   and `index.ts`, so no reader mistakes it for a Goat, Wolf, & Cabbage rule. The
   other unofficial variants the research names (Secret Hitler XL, Double Agent,
   Secret Voldemort) are out of scope; the engine does not carry their text.

Gaps 1 and 2, the Trump Pack's face list and the Pence card, do not touch the
rebalanced setup: the pack changes no rule, and this variant changes no card face.

### Gaps the variant inherits from the base, decided there

The variant reuses the base fold, so every one of the ten rule gaps in
`docs/research/secret-hitler/rules.md` is decided once, in
`docs/design/secret-hitler.md` ("Rule gaps decided"), and the variant inherits each
decision unchanged. None of the ten is about the deck supply or the starting track,
so none needs a second decision here.

### One new gap, decided from the source

The research text does not say where the 6-player pre-enacted Fascist Policy comes
from: is it drawn from the 11-tile supply (so the deck holds 10), or is it an extra
twelfth tile (so the deck holds 11)? The two readings differ. Decision: it is drawn
from the supply, so a 6-player game has 11 Fascist tiles in total — 1 on the track
and 10 in the deck. This is the reading of the [SHIO] implementation, verified
against its source this session: at 6 players under `rebalance6p` the track is set
to 1 (`routes/socket/game/start-game.js`, fetched 2026-10-13,
https://github.com/cozuya/secret-hitler/blob/master/routes/socket/game/start-game.js),
and `shufflePolicies` builds the deck as `deckState.fas - trackState.fascistPolicyCount`
— 11 − 1 = 10 (`routes/socket/game/common.js`, fetched 2026-10-13,
https://github.com/cozuya/secret-hitler/blob/master/routes/socket/game/common.js).
The variant table encodes this as `fascistSupply: 11, preEnactedFascist: 1`.
`variant.test.ts` pins the resulting deck at 6 Liberal / 10 Fascist with track 1.

The same master file disagrees with the table at 9 players. Under `rebalance9p2f` it
sets `deckState.fas = 10` (`routes/socket/game/start-game.js`, line 41), where this
table keeps 9. The 9-player row follows the archived [SHIO] rules page, the primary
source cited above ("9 player games start with 9 Fascist Policies in the deck"), not
the master branch code.

## Decisions a maintainer inherits

- **The delta is one table.** Adding or moving a rebalanced count is one row edit in
  `REBALANCE_DELTA`; genesis and the codec's supply both follow it.
- **The base and the variant cannot drift in the fold.** The four fold members and
  the action codec are the base's, referenced by identity, and a test pins that.
- **The base deck is unchanged.** `fullDeck()` and `stateCodec` are the same
  behavior as before the seam; the base suite is the regression guard.
- **A future variant with a different supply is one `stateCodecFor` call.** The
  supply parameter is the extension point; a second unofficial variant needs no new
  codec, only its own delta and supply.
