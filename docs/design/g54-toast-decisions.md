# Game event toasts: which events reach a player, and why

The g54 play page (`app/pages/games/[code].vue`) can interrupt a player with a
toast. A toast is expensive attention: it covers the board and asks to be read.
This document decides which game events earn one, who sees each, and why. The
engine and the page follow it.

The reader is an engineer adding an event to the toast catalogue, or a reviewer
checking that a noisy event stays silent.

## The two questions every event answers

An event is a change between two consecutive board projections. The client has
no event stream; `useGame` folds agreed frames and hands back a redacted
`G54View` per frame, so the only way to see what happened is to diff two
projections. Each detected change answers two questions.

1. Who needs to know? Audience is `actor` (only the seat the event concerns) or
   `room` (every seat at the table).
2. Is it worth an interruption? Importance is `toast` or `silent`.

The two questions are independent. A silent event still gets classified, because
recording "we chose not to toast this" is the point. A `silent` row carries no
copy, so the catalogue cannot drift from the decision.

## The rule

Toast an event only when it changes what the recipient must know to play.

- Money is private. A coin change alters one player's budget and their distance
  from the forced-Coup threshold at 10 coins. Only that player needs the
  interruption; everyone else reads the public coin count off the board. So a
  coin change is `actor`.
- A lost card is public and changes the table. Every seat must track who is
  closer to elimination and which card is now face up. So a lost card is `room`.
- Everything the board already shows every frame is noise. A phase pill, a
  pending-claim label, a turn number, a hand count, and a token all update in
  place. A toast for them repeats what the eye already sees. They are `silent`.

## The catalogue

One row per event kind. Audience and importance are columns, so adding a kind
without deciding both is a compile error. Severity picks the icon and color the
`Toaster` renders.

| Event | Detected when | Audience | Importance | Severity | Copy |
| --- | --- | --- | --- | --- | --- |
| `coins-gained` | a seat's `coins` rises | actor | toast | success | `You gained N coins (M total).` |
| `coins-lost` | a seat's `coins` falls | actor | toast | warning | `You paid N coins (M total).` |
| `influence-lost` | `revealed` grows and the hand stays non-empty | room | toast | warning | `Bo lost a card (1 left).` |
| `eliminated` | a reveal empties the hand | room | toast | error | `Bo is out of the game.` |
| `resigned` | the `resigned` flag flips | room | toast | warning | `Bo left the game.` |
| `arms-reveal` | `arms` changes by value | room | toast | info | `Bo revealed Banker, Judge with no match for Banker.` |
| `card-gained` | a hand count rises | actor | silent | - | - |
| `turn-started` | `turn` or `active` changes | room | silent | - | - |
| `claim-opened` | `pending` goes from null to a value | room | silent | - | - |
| `targeted` | the main claim names a target | actor | silent | - | - |
| `you-owe-input` | `owedSeats` gains a seat in a private window | actor | silent | - | - |
| `game-over` | `terminal` flips true | room | silent | - | - |
| `claim-blocked` | the same claim's `blocker` goes null to a seat | room | silent | - | - |
| `treaty-formed` | `treaty` goes empty to a pair | room | silent | - | - |
| `treaty-expired` | `treaty` goes pair to empty, no member left | room | silent | - | - |
| `peacekeeping-gained` | `peacekeeping` goes null to a seat | room | silent | - | - |
| `tax-marked` | `tax` gains or moves a mark | room | silent | - | - |
| `disappear-placed` | `disappear` gains a target | room | silent | - | - |
| `bomb-placed` | `bomb` goes null to a value | room | silent | - | - |
| `bomb-passed` | the Bomb holder changes | room | silent | - | - |
| `bomb-cleared` | `bomb` goes from a value to null | room | silent | - | - |

`arms-reveal` is the only toast added after the first pass. The Arms Dealer
reveal draws two Court cards and shuffles them straight back, so it describes a
transient draw that no board chip can carry: `arms` is the one public field with
no surface. Every other row is a real diff branch that stays silent because the
board already draws it every frame. Recording the silences keeps the decision
reviewable and makes a promotion a one-row edit.

## The rules that make detection correct

A naive "toast every diff" is wrong. The engine facts below decide what counts as
a change, and each one is pinned by a test.

A card is lost when `revealed` grows, never when a hand count falls. The give
windows move a card from a hand into a pool with no reveal
(`resolveProducerGive` and `resolveSocialistGive` in
`shared/core/lockstep/games/g54/windows.ts`), and a proven card is swapped for a
hidden replacement at constant hand size (`proveCard` in `helpers.ts`). Only
`resolveReveal` moves a card from `hand` to `revealed`. Gating a loss on the hand
count would toast a false "lost a card" on every Producer and Socialist give.

Elimination is a reveal that empties the hand, and its coin delta is suppressed.
`settleNow` (`helpers.ts`) zeroes the eliminated seat's ledger on the way out.
That is bookkeeping, not a payment, so the diff drops that seat's `coins` change
in the same frame and emits `eliminated` instead.

A transfer moves two ledgers. `transferCoins` (`helpers.ts`) takes from one seat
and gives to another, so a steal produces a `coins-lost` for the payer and a
`coins-gained` for the payee. Both are `actor`, so each seat sees only its own
half.

Three more rules keep the bigger catalogue honest, each pinned by a test.

A blocked claim needs the same claim on both sides. `claim-blocked` fires only
when the claimant, role, and target match across the interval and the blocker
goes null to a seat. Without that guard a claim swap, a Spy second action or a
mass claim's extra, would misfire it.

A treaty that empties because a member left is not an expiry. `expireTreaty`
(`helpers.ts`) clears the treaty when the table drops to two, so `treaty-expired`
is suppressed when a former member was eliminated or resigned in the same
interval; the `eliminated` or `resigned` toast already reports the cause.

A Bomb that clears is `bomb-cleared`, and the cause is not knowable from an
interval diff. A real defuse and a caught defuse that exploded both clear with
`move === "defuse"` and no reveal in the clearing interval: a caught defuse
reveals the holder in an earlier frame, and the bomb window clears the Bomb in a
later one (`resolveBomb` in `windows.ts`), so the diff that sees the Bomb leave
sees no card loss. The event is therefore deliberately neutral — it reports only
that the Bomb left the table, and the reveal that a caught defuse also causes
toasts separately as `influence-lost`.

Two more guards cover the self cues and the mass claim, which stay silent today
but must detect correctly if promoted. `targeted` fires only when the main claim
opens (`prev.pending === null`), because while a mass claim resolves `pending` is
the active extra and its target walks every touched seat. `you-owe-input` skips
broadcast windows (`window.kind === "any"`), where every seat is owed and the
claimant and blocker are auto-passed, so the cue would be false for them.

## Scenarios

Each scenario names the engine path, the projections it changes, and the toasts
that result for a room of Ann, Bo, and Cy.

### Ann pays 7 for a Coup on Bo

`planTurn` opens the Coup, `applyResolve` pays the cost, `gainFromTreasury` and
`payToTreasury` move the coins, and `revealStep` flips one of Bo's cards.

- Ann's `coins` falls by 7. Ann sees `coins-lost` (warning). Bo and Cy do not.
- Bo's `revealed` grows, hand stays non-empty. Every seat sees `influence-lost`
  (warning), `Bo lost a card (1 left).`
- Bo's `coins` is unchanged, so no coin toast for Bo.

Ann is not toasted about Bo's card loss as an actor, because she is a room
member like everyone else.

### Ann claims Banker and takes 3

`ROLE_EFFECTS.banker` calls `gainFromTreasury`.

- Ann's `coins` rises by 3. Ann sees `coins-gained` (success). Bo and Cy do not.
- No card changes. No other toast.

### Ann claims Arms Dealer and reveals two Court cards

`ROLE_EFFECTS["arms-dealer"]` draws two cards, checks them against the named
role, then shuffles them back into the Court (`returnToCourt`). It stores the
result in `state.arms`.

- `arms` changes by value. Every seat sees `arms-reveal` (info), `Ann revealed
  Banker, Judge with no match for Banker.`
- This is the only new toast, because the two cards are gone by the next frame:
  no board chip can show a draw that was shuffled back, so the toast is the only
  surface the fact has.
- A second reveal that draws the identical two cards is invisible, because
  `arms` is never reset and detection is a value diff. Closing that gap needs a
  counter in the view, which this change does not add.

### Bo plays Politician and steals 2 from Cy

`ROLE_EFFECTS.politician` calls `transferCoins(state, target, claimant, 2)`.

- Cy's `coins` falls by 2. Cy sees `coins-lost` (warning).
- Bo's `coins` rises by 2. Bo sees `coins-gained` (success).
- Ann sees neither. The board's coin counts update for her.

### Cy loses their last card to a Coup

`resolveReveal` moves the last card from `hand` to `revealed`, then `settleNow`
zeroes Cy's coins.

- Cy's `revealed` grows and the hand empties. Every seat sees `eliminated`
  (error), `Cy is out of the game.`
- Cy's `coins` drops to 0 through `settleNow`. That delta is suppressed, so no
  `coins-lost` fires. Without the suppression Cy would read "You paid N coins"
  for a balance the game cleared, not a payment.
- No `influence-lost` fires for the same reveal, so one event produces one toast.

### Bo plays Producer on Cy

`ROLE_EFFECTS.producer` moves a card from Cy's hand into the draw pool and opens
the keep window.

- Cy's hand count falls by 1 with no reveal. No toast. This is a swap in
  progress, not a loss.
- If the give transiently leaves Cy at zero cards, `isInPlay` (`helpers.ts`)
  still counts Cy as in play, so no `eliminated` fires either.

### Cy resigns

`foldResigns` sets the `resigned` flag. It does not drain the hand and does not
settle coins.

- The `resigned` flag flips. Every seat sees `resigned` (warning), `Cy left the
  game.`
- No card or coin toast, because neither changed.

### The turn passes to Bo

`applyEndTurn` advances `active` and increments `turn`.

- `turn-started` is detected and dropped by its `silent` row. The board's phase
  pill and turn counter show the change.

### Ann draws a card from the Court

`drawIntoHand` grows Ann's hand.

- `card-gained` is detected and dropped by its `silent` row. The board's hand
  count updates, and the keep window already shows Ann the drawn cards.

## Interval diffs and resync

`useGame.refresh()` replaces the projection only when the frame index changes,
and one tick can seal more than one frame. So a diff is over an interval, not one
frame. A seat that loses two cards across the interval produces one
`influence-lost` with the lower remaining count, not two toasts. This is
deliberate: a burst of toasts for one action is worse than one accurate summary.

A snapshot adoption can jump the turn arbitrarily, and the jump is
indistinguishable from a legitimate interval by turn number alone. The composable
guards this with `isContinuation(prev, next)`: same seat, `prev` not terminal,
`next.turn >= prev.turn`. A failed guard resets the baseline and emits nothing,
so a resync never fires a burst. The first projection after mount is a baseline
for the same reason.

## What is deliberately not toasted

Every bullet below has a `silent` catalogue row unless it says otherwise, so the
decision is recorded rather than left implicit. The reason is the same for all of
them: the board already draws the fact every frame, and the player must read that
surface to act.

- The winner (`game-over`). The page renders a winner banner
  (`[data-slot="winner-banner"]`).
- Your turn (`turn-started`) and you owe input (`you-owe-input`). The acting and
  owed phase pills mark the seat, the turn counter shows the turn, and the window
  picker appears in place.
- You are targeted (`targeted`). The targeted pill marks the seat, and the
  pending label reads `... on <you>`.
- A block (`claim-blocked`). The window pill flips to "Challenge a block".
- A claim by another seat (`claim-opened`). The pending label shows claimant,
  role, and target.
- Token changes (`treaty-formed`, `treaty-expired`, `peacekeeping-gained`,
  `tax-marked`, `disappear-placed`, `bomb-placed`, `bomb-passed`,
  `bomb-cleared`). The board renders every token as a chip on its seat, so a toast
  repeats ongoing state. These are the strongest promotion candidates; see the
  open questions.

A challenge opening has no row. The window picker is the surface, and the
challenger has a control there, so a fact to classify would be noise.

## Open questions

- `claim-blocked` is the strongest promotion candidate. A block decides whether
  an action lands, and once the window closes the board shows nothing about it.
  It is silent today because the window pill and the target's pending label cover
  the moment. Promoting it is a one-row edit, and its same-claim guard is already
  in place.
- Should the Bomb family toast? A Bomb change alters the threat model for the
  whole room, and the `Bomb from <priors>` chip is dense. Silent today.
- Should a Treaty formation or a Bomb move be a `room` toast? Both change
  targeting for every seat, and both are easy to miss on the board.
- Should `treaty-expired` toast when a non-member's elimination drops the table
  to two? The survivors learn they can now attack each other, but the expiry
  always arrives beside an `eliminated` toast.
- Should `turn-started` toast for the viewer's own seat? A "your turn" cue is
  useful in a game where you wait, but the phase pill already marks it. Silent
  today.
- Should the winner toast as well as the banner? The banner is the primary
  surface; a toast is redundant.
- Is one coalesced toast per interval right, or should a seat losing two cards
  produce two? One summary is the current choice.
- Should copy name the revealed card? The card is public in `revealed`, but the
  toast names only the count, so the board stays the place to read the card.
- An identical consecutive Arms reveal is invisible, because `arms` is never
  reset. Closing it needs a counter in `G54View`, a protocol change this work
  does not make.
