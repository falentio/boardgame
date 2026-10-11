# Scape Goat design

Scape Goat is a social-deduction card game by Jon Perry, published by
Indie Boards and Cards in 2020. The rules live in
`docs/research/scape-goat/`. The engine lives in
`shared/core/lockstep/games/scape-goat/`. This file records why the engine
has the shape it has, what it decided where the rules do not say, and what a
future maintainer inherits.

## Why this shape

Scape Goat's turn is strictly linear. You move to a new location, you take
that location's action, and you swap one hand card for the face-up card beside
you. Nothing nests and nothing interrupts. The only multi-seat action is a
Frame Attempt, which cannot be interrupted. Two things end the game, a
successful frame and someone walking to the Cops.

G54 drives its turn from a stack of windows because its challenge, proof, and
block windows nest, and a stack is the honest structure for nesting. Scape Goat
has nothing to stack. A stack here would be a one-element list with push and
pop ceremony, and a reader would have to learn the stack discipline to
discover it never goes deeper than one.

The chosen shape is one payload-carrying phase union that `seatsOwed` and
`step` switch over exhaustively, the coinflip idiom.

```text
shared/core/lockstep/games/scape-goat/
├── index.ts      the scapeGoat GameDefinition, project, the public re-exports
├── state.ts      ScapeGoatState, Phase, Outcome, suspectOf, stateCodec
├── cards.ts      EVIDENCE_CARDS, HAND_SIZE, deckFor, coloursOf
├── actions.ts    ScapeGoatAction and its codec
├── setup.ts      ScapeGoatSetup, validateSetup, genesisState
├── locations.ts  LOCATION_LINE, faceOf, the location line
├── reducer.ts    seatsOwed, step, isTerminal, resolveFrame
├── view.ts       project, legalActions, winnersOf, the view types
└── error.ts      ScapeGoatError
```

No cycles. `state.ts` imports nothing internal. `cards.ts` and `actions.ts`
import `state.ts`. `locations.ts`, `reducer.ts`, and `view.ts` sit above those.
`index.ts` imports all.

## The two structures that carry the game

**The suspects are derived, not stored.** `suspectOf(state, seat)` returns
`state.scapegoat` for every seat except the scapegoat, whose suspect is
`state.scapegoatSuspect`.

The physical game carries 18 double-sided player mats, and the back of each
holds a decoder matrix of 10 columns by 12 rows. Read a mat with the two dice
and you learn who that player believes is the scapegoat. No rule in the game
consults the grid itself. The rules consult only who the mat names, which is
exactly `suspectOf`.

Deleting the map also deletes the sync risk: a per-seat suspect map could
disagree with the scapegoat, and the derived form cannot. The invariant the
game depends on is that no player ever sees their own colour as their suspect.
That holds structurally for every non-scapegoat, because their suspect is the
scapegoat and the scapegoat is not them. It holds for the scapegoat by
construction, because `genesisState` picks a decoy that is not the scapegoat.
`redaction.test.ts` pins it on every phase of a played game, including the
two-seat `trade-give` phase, where one seat's committed card must stay hidden
from the other.

**There is no deck in state.** `deckFor(count)` is exactly dealt at genesis:
four cards face up, three into the Stash supply, the rest into hands. Nothing
is left over, so no draw pile exists, no discard exists, and `step` accepts
`rng` and ignores it. Determinism rests on structure rather than on rng
discipline, which is why no fold can accidentally draw.

## Rule gap 1: the card mix

The published box holds 30 evidence cards, each marked bottom right with the
player counts it is legal in. The stated deal is one face-up card beside each
of the four non-Cops locations, three facedown cards at the Stash, and an
equal hand to every player. The research records that the 30 does not divide
into that deal at any player count, and that no source publishes the per-count
breakdown. The deck is filtered by player count before the deal, so the hand
size cannot be derived from the published numbers.

The design does not reverse-engineer the box. It states the marker semantics
the rulebook gives, authors one catalog, and checks two invariants by
arithmetic.

A bare number marker means that count only. A `plus` marker means that count
and every count above it. The marker groups are 13 cards at `3+`, 3 at `4+`,
1 at `5+`, 2 at `6`, 3 at `3`, 3 at `4`, and 5 at `5`, which is 30 cards.
Filtering them by count yields 16, 19, 22, and 19 cards at three, four, five,
and six players.

Hand size is a per-count constant, and it is the choice the rulebook leaves
open. The values are 3, 3, 3, and 2.

| Seats | Hand size | Face-up and Stash | Deck | Check |
| --- | --- | --- | --- | --- |
| 3 | 3 | 7 | 16 | 7 + 3 × 3 |
| 4 | 3 | 7 | 19 | 7 + 4 × 3 |
| 5 | 3 | 7 | 22 | 7 + 5 × 3 |
| 6 | 2 | 7 | 19 | 7 + 6 × 2 |

Hand size is 3 below six players because at three players a two-card hand
makes a frame need both other players to hold the colour, which is close to
unwinnable. A 16-card deck at three players also keeps hands readable.

`cards.test.ts` asserts the 30-card total, each per-count deck size, and a
colour floor: at `count` seats, every legal colour appears on at least
`count - 1` cards in that count's deck. That is a deck-wide supply floor and
nothing more. A frame needs a colour held by `count - 1` distinct other seats,
and cards in the deck do not imply that spread across hands. Over 20,000
genesis deals per count, the fraction where no colour is held by exactly
`count - 1` distinct seats is 1.7% at three players, 1.4% at four, 2.4% at
five, and 17.3% at six. The test `the deal cannot assemble a frame in the doc's
measured fraction of genesis deals` in `cards.test.ts` reruns the measurement:
it deals `rawGenesis(count, \`cards-frame-rate-${count}-${seed}\`)` for seed from
0 to 19,999 and counts the deals where no colour in `COLOURS` has exactly
`count - 1` holders. All six colours count, because `resolveFrame` matches any
colour a card carries, not only the seats' own mat colours. A pure framing
policy can therefore fail to assemble a frame at
every count, which is why `fullgame.test.ts` runs its policy to the Cops as a
fallback rather than rest on the floor.

Grey is the empty colour set, not a `Grey` variant. Every rule that mentions
it treats grey as matching nothing: it never satisfies the own-colour swap
obligation, and it never takes part in a matching frame. A variant would add a
case to every colour walk to express an absence.

## Rule gap 2: the frame tiebreak

A Frame Attempt is one frame, owed by every active seat, resolved in one
`step`. `resolveFrame` walks the seats in canonical order, and for each seat
walks the colours. A seat is framed when its own card lacks a colour that every
other seat's card carries.

Two decisions sit in that function.

Two colours each framing a different seat resolves to the earlier canonical
seat. The primitive already declares `Roster.order` the tie-break for every
in-frame resolution, so the game reuses it rather than inventing a second one.
Colour order never decides the winner, only which colour is named when two
colours frame the same seat. The win condition reads whether the framed seat is
the scapegoat, so the colour cannot change the outcome, and the resolution is
stable under relabelling colours.

A colour present on every revealed card is a failure. There is no odd card
out, so nobody is framed. This is the reading that keeps a frame a genuine
odd-one-out, and it is the contested decision in this design. The alternative
reads the rulebook's looser sentence as a success framed on that colour's
owner, which leaves nobody framed.

## Rule gap 3: out-of-model actions

The rules have no resignation, because the physical game has none. The
primitive's `resign` input has to fold somewhere, and every illegal report
has to fold somewhere. Each case is a decision, not a TODO.

| Case | Decision |
| --- | --- |
| A seat with no card pick | The attempt fails. The rules require every player to pick, and framing a silent seat would let a frame timeout decide the game. |
| Fewer than three active seats | The attempt fails, and a table shrunk below three seats folds to `outcome: { kind: "abandoned" }` so it terminates. |
| A Steal with no token holder | A no-op. The turn proceeds to the Evidence Swap. Unreachable after the flip, since both tokens live in hands and are never spent, but defined for totality. |
| Movement onto an occupied location | Legal, any number of tokens. The only movement constraint is that the destination differs from the current one. |
| A resign out of a half-finished action | The seat finishes it. The card a Stash drew must go back, or the drawer's hand size and the Stash supply both break for the rest of the game. |

Every illegal report folds to the location's safe default and never throws.
`legalActions(view)` derives the menu from the redacted view alone, so the UI
and the test policy carry no rules, and because it reads a view it cannot leak
a secret into a menu.

## Genesis

The setup surface is one field, `spyReveal`, which is the only rule gap a
table can reasonably disagree about. The player count is derived from the
roster, not stored, so the two cannot disagree. The card mix is deliberately
not lobby config, so two peers cannot disagree about the deck by agreeing on a
bad setup.

Every random draw happens here and nowhere else. One shuffle draws the scapegoat,
one draws the decoy suspect, one shuffles the placement, and one shuffles the
deck.

The placement is a shuffle of the roster walked along the four non-Cops
locations. A second pass runs at five and six players, so two locations carry
two tokens and none carries more. The first-pass occupant of Prepare moves
first, which is the reading of the player placed there first that the rules
leave open.

Turn order is the canonical roster order, wrapping. The rules never define the
direction, and the primitive already declares that order canonical, so the game
reuses it instead of inventing a second one.

The six-player outside-turn run is the antipode, the seat three places along
the circle. At six players a displacement of three and negative three name the
same seat, so the rulebook's direction ambiguity disappears. The `move` phase
owes the antipode alongside the active seat, and the antipode's only legal
input in that frame is `go-to-cops`. It costs no extra round trip, because the
two seats report in the same frame.

## The redaction boundary

`project` is the only way state leaves a session. It drops the scapegoat, the
decoy, every other seat's hand, the Stash card identities, and a private Spy
hand. It emits the viewer's own suspect and nothing else about suspects.

`phase` is carried whole rather than re-modelled as a parallel `PhaseView`.
Every field in it is public: `active` is whose turn it is, `location` is where
they moved, and `target` is the player everyone watched them name. A parallel
type would be a pass-through.

Both per-turn records go when the turn ends. A Spy hand belongs to the spy's
own turn, and a frame attempt's reveal is public only for the rest of the turn
that resolved it. Clearing the second one is what keeps a card that was
revealed and later placed facedown in the Stash out of every view, since the
Stash identities must never cross the boundary. A record set by a successful
frame survives, because the game is over and no card moves again.

At terminal the view carries the full outcome: the scapegoat, the derived
winners, and every seat's mat turned over, which the rules make public at
scoring.

## Decisions a maintainer inherits

- **The card mix is a house rule.** If someone holds a physical copy, the 30
  authored entries in `cards.ts` replace outright. Only the two invariants
  have to keep passing.
- **Hand size is 3, 3, 3, and 2.** The rulebook allows two or three and never
  says which. The values are pinned by the deal equation, and they are one
  table to change.
- **The frame tiebreak frames the earliest-seated player.** The alternative,
  failing on ambiguity, would reward a deliberately ambiguous reveal.
- **The six colour names are stand-ins.** No source publishes the physical set.
  The rulebook's worked example uses red, blue, green, and yellow.
  `COLOURS[i]` maps the i-th canonical seat to the i-th colour.
- **Spy is private by default, and `spyReveal: "public"` opens it.** The
  rulebook's plain wording reads as the acting player alone, and the flag costs
  one field.
- **The game has no turn limit and no deck-exhaustion end.** The rules give
  exactly two ends, and the deck is consumed exactly at setup and never drawn
  again, so no supply can run dry. A policy that only frames and never runs can
  therefore exceed any frame cap. `fullgame.test.ts` documents that its policy
  runs to the cops as a fallback.
- **`step` ignores `rng`.** The signature keeps it because the contract passes
  it, and the determinism argument rests on all randomness living in genesis.
