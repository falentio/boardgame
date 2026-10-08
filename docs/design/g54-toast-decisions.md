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
| `card-gained` | a hand count rises | actor | silent | - | - |
| `turn-started` | `turn` or `active` changes | room | silent | - | - |
| `claim-opened` | `pending` goes from null to a value | room | silent | - | - |

## The three rules that make detection correct

A naive "toast every diff" is wrong. Three engine facts decide what counts as a
change.

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

- The winner. The page renders a winner banner
  (`[data-slot="winner-banner"]`), so a toast would repeat it.
- Token changes: Peacekeeping, Treaty, Tax, Disappear, and Bomb. The board
  renders every token on its seat, so a toast repeats ongoing state. A Treaty
  formation and a Bomb move change targeting for the whole room and are the
  strongest candidates to promote to `room` toasts; see the open questions.
- A challenge or block opening. The window picker and the pending label already
  show it, and the owed seat gets a control.
- A claim by another seat. The pending label and the challenge window cover it.

## Open questions

- Should `turn-started` toast for the viewer's own seat? A "your turn" cue is
  useful in a game where you wait, but the phase pill already marks it. It is
  silent today.
- Should the winner toast as well as the banner? The banner is the primary
  surface; a toast is redundant.
- Should a Treaty formation or a Bomb move be a `room` toast? Both change
  targeting for every seat, and both are easy to miss on the board.
- Is one coalesced toast per interval right, or should a seat losing two cards
  produce two? One summary is the current choice.
- Should copy name the revealed card? The card is public in `revealed`, but the
  toast names only the count, so the board stays the place to read the card.
