# The g54 turn as phases, and how to build the UI one phase at a time

This doc explains how the g54 engine advances from one phase of play to the next. It exists so the game UI can be built in small steps, one phase per step, against the phase the engine is actually in.

The reader is an engineer adding interaction to `app/pages/games/[code].vue`. Today that page renders a read-only board and one Resign button. Every window the engine opens is a place the UI can grow a control. This doc names each window, the seat that owes input, the action that window accepts, and the view fields it needs.

The engine is the source of truth. File paths and line numbers below are from `shared/core/lockstep/games/g54/`.

## The engine is a stack machine

A g54 turn is not a fixed loop. It is a stack of steps that the engine pops one at a time. The stack lives in `G54State.steps` (`state.ts:187`), top first. `steps[0]` is the next thing to do.

There are five step kinds (`state.ts:171`).

| Step | What it does |
| --- | --- |
| `window` | Waits for input from the seats it names. The only step kind that can block. |
| `resolve` | Pays the claim's cost and applies its effect. |
| `begin` | Installs a linked extra claim and opens its first window. |
| `settle` | Returns an eliminated seat's coins to the Treasury and drops its tokens. |
| `end-turn` | Advances the active seat and opens the next turn. |

A window carries four fields (`state.ts:59`).

- `kind` is one of `turn`, `any`, `oneOf`, `targets`, and decides whose input it needs.
- `purpose` is one of 22 values and decides what the window resolves.
- `seats` names the seats for `turn`, `oneOf`, and `targets`.
- `cause` gates the reactive windows after a loss.

The mapping from `purpose` to `kind` is fixed data, not a choice (`WINDOW_KIND`, `state.ts:219`). The decoder rejects a window whose kind disagrees with its purpose (`state.ts:339`).

### Who owes input at a window

`owedSeats` (`windows.ts:1065`) turns a window into the set of seats that must report.

- `any` owes every alive seat. Each one reports `challenge` or `pass`. The frame seals only when all have reported.
- `turn` and `oneOf` owe their named seats, minus any that are gone.
- `targets` owes each named seat, and each decides on its own.

`seatsOwedNow` (`windows.ts:1116`) is what `project` exposes as `view.owedSeats`. A `turn` window is never voided, so it always owes its seat.

## The phase spine of one turn

One turn runs from the `turn` window to `end-turn`. The active seat reports one action, then the engine walks the resulting windows.

```text
turn window, seats active [1] ← active seat picks a general action or a role claim
├── general action reported [1a] ← income, coup, bank, or social-media
│   └── resolve [1a1] ← pay cost, apply effect
│       └── end-turn [1a1a] ← advance active, open the next turn window
└── role claim reported [1b] ← claim a role in play, with a target when the role needs one
    ├── holdless claim, Anarchist [1b1] ← no challenge window
    │   └── resolve [1b1a]
    └── held claim [1b2]
        └── challenge-claim, seats all alive [1b2a] ← any seat may challenge
            ├── no challenger [1b2a1]
            │   └── after-claim-survives [1b2a1a] ← block window, or resolve
            └── challenger found [1b2a2] ← first challenger clockwise from active
                └── proof-claim, seats claimant [1b2a2a] ← show the card or concede
                    ├── claimant shows [1b2a2a1] ← challenger loses a life, claim survives
                    │   └── after-claim-survives [1b2a2a1a]
                    └── claimant concedes or cannot show [1b2a2a2] ← claimant loses a life, claim fails
```

`planTurn` (`windows.ts:152`) coerces the active seat's report into a legal plan. At 10 or more coins the action always becomes a Coup. An illegal or unaffordable report falls back to Income, or to Bank while Financier is in play. So the turn never stalls on a bad report.

## The claim chain

`afterClaimSurvives` (`windows.ts:250`) decides what follows a claim that beat its challenge. A Protestor with a target opens the funding window. A Crime Boss with a target opens the payment window. A role with a `blockRole` and a target opens the block window. Everything else resolves.

```text
after-claim-survives [1]
├── Protestor with a target [1a]
│   └── protestor-fund, seats rivals but the target [1a1] ← a third party may pay 3
├── Crime Boss with a target [1b]
│   └── crime-pay, seats target [1b1] ← pay 2, or the boss pays 5 to kill
├── role with a blockRole and a target [1c]
│   └── block, seats target [1c1] ← block with the matching role, or pass
│       ├── block declined [1c1a]
│       │   └── resolve [1c1a1]
│       └── block declared [1c1b]
│           └── challenge-block, seats alive but the blocker [1c1b1] ← any seat may challenge
│               ├── no challenger [1c1b1a]
│               │   └── resolve [1c1b1a1]
│               └── challenger found [1c1b1b]
│                   └── proof-block, seats blocker [1c1b1b1] ← show the card or concede
│                       ├── blocker shows [1c1b1b1a] ← block stands, challenger loses a life
│                       │   └── resolve [1c1b1b1a1]
│                       └── blocker concedes [1c1b1b1b] ← block drops, blocker loses a life
│                           └── resolve [1c1b1b1b1] ← the action still lands
└── anything else [1d]
    └── resolve [1d1]
```

The resolve step (`windows.ts:476`) pays the cost and calls the effect for the role or general action. A role effect pushes that role's own sub-windows, then `end-turn`.

## The 22 windows

Each window is one phase the UI can render. The table names what the owed seat decides and the action it reports. Actions are the `G54Action` variants in `actions.ts:20`.

| Purpose | Kind | Owes | The seat decides | Action reported |
| --- | --- | --- | --- | --- |
| `turn` | turn | active | general action or role claim | `income`, `coup`, `bank`, `social-media`, or `claim` |
| `spy-second` | turn | claimant | a second general or role action, or nothing | same as `turn`, or `pass` |
| `challenge-claim` | any | all alive | challenge the claim or pass | `challenge` or `pass` |
| `proof-claim` | oneOf | claimant | show the claimed card or concede | `show` or `concede` |
| `block` | oneOf | target | block with the block role or pass | `block` or `pass` |
| `challenge-block` | any | alive but blocker | challenge the block or pass | `challenge` or `pass` |
| `proof-block` | oneOf | blocker | show the block card or concede | `show` or `concede` |
| `reveal` | oneOf | seat | pick a card to flip face up | `reveal` with an index |
| `keep` | oneOf | seat | choose which cards to keep from a swap | `keep` with indices |
| `crime-pay` | oneOf | target | pay 2, or let the boss kill | `pay` or `no` |
| `capitalist` | targets | rivals | each rival may claim the role to collect | `claim` |
| `protestor-fund` | targets | rivals but target | a third party may pay 3 to fund the kill | `pay` or `no` |
| `producer-give` | oneOf | partner | give one card to the swap | `give` with an index |
| `writer-draw` | oneOf | writer | pay 1 for an extra draw, or keep | `pay` or `no` |
| `customs-mark` | oneOf | claimant | mark a role for the Tax token | `claim` with a role |
| `reactive-intellectual` | oneOf | seat | claim Intellectual after a loss | `claim` or `no` |
| `reactive-missionary` | oneOf | seat | claim Missionary after a loss, not on a Coup | `claim` or `no` |
| `lawyer` | any | anchor is the eliminated seat | any alive seat may claim the estate | `claim` with `lawyer` |
| `bomb` | oneOf | holder | pass the Bomb on or defuse it | `claim` with `anarchist` |
| `socialist-give` | oneOf | target | give 1 coin or 1 card to the Socialist | `give` with an index, or `pay` |
| `socialist-keep` | oneOf | active | swap one own card for one from the pile | `keep` with indices |
| `plantation-payout` | oneOf | active | acknowledge only, the payout is automatic | any report |

Three things about this table matter for the UI.

- `spy-second` has `kind: "turn"`, so the UI must branch on `purpose`, not `kind`, or it will show a normal turn menu a second time.
- `lawyer` stores the eliminated seat in `seats[0]` as the clockwise anchor. It is not an owed seat (`state.ts:62`).
- `plantation-payout` ignores its input but still owes the active seat. It needs an acknowledge button, not a decision.

## How one frame advances one phase

`useGame` calls `session.tick()` every 250 ms and refreshes the view when the frame changes (`useGame.ts:124`). Each sealed frame runs `stepState` once (`windows.ts:1096`).

```text
stepState(state, frame, rng) [1]
├── if terminal, return unchanged [1a]
├── fold resigns from the frame [1b]
├── if the active seat resigned, rebuild the turn for the next alive seat [1c]
├── read the top window [1d]
│   └── throw if the top is not a window [1d1] ← a contract guard, not a user path
├── if the window owes nobody and is not a turn window, void it [1e]
└── otherwise run the resolver for the window purpose [1f]
    └── drain() [1f1] ← apply resolve, begin, settle, and end-turn steps until a live window tops the stack
```

`drain` (`windows.ts:1044`) applies the immediate steps and stops at the first window that owes somebody. So one frame moves the phase by exactly one window, then the engine waits.

The consequence for the UI is that `view.window.purpose` names the phase to render, and `view.owedSeats` names the seats that can act in it.

## The render path today

```text
app/pages/games/[code].vue [1]
├── useAuthSession() -> user -> viewer [1a]
├── useLobby(code, viewer) -> lobby -> room [1b]
├── useGame({ game: g54, room, viewer }) [1c]
│   ├── opens a GameSession over the room channel [1c1]
│   ├── 250 ms tick -> refresh() -> view [1c2]
│   └── returns { view, status, acted, report, resign } [1c3] ← the page uses view, status, resign only
├── identities: Map<SeatId, SeatIdentity> [1d]
├── board = boardOf(view, identities) [1e]
│   └── board-view.ts maps G54View -> Board { table, seats } [1e1]
└── template branches [1f]
    ├── loadFailed -> message and a dashboard link [1f1]
    ├── status "waiting" -> Spinner [1f2]
    ├── status "spectator" -> notice [1f3]
    ├── status "resyncing" -> Spinner and a catch-up message [1f4]
    └── board -> GameBoard and a Resign button [1f5]
        ├── TablePuck :table -> turn, treasury, bank, court, role strip, status pill [1f5a]
        └── SeatPiece :seat per seat -> avatar, coins, phase pill, hand, revealed, tokens [1f5b]
```

`boardOf` (`board-view.ts:95`) is the only adapter between the game view and the UI. It narrows `G54View` on purpose. The board subtree has no click handlers and no emits, so `GameBoard`, `SeatPiece`, and `TablePuck` are pure functions of `Board`. `useGame.report` is the only seam that dispatches an action, and the page never calls it except through `resign`.

## What the board shows and what it drops

`G54View` (`index.ts:69`) is the only read path. The board uses part of it.

| View field | Reaches the UI | Rendered |
| --- | --- | --- |
| `players` | `BoardSeat` | yes, coins, hand backs, revealed |
| `myHand` | `BoardSeat.hand` when the seat is you | yes |
| `roles`, `treasury`, `bank`, `courtCount`, `turn` | `BoardTable` | yes |
| `active` | `BoardSeat.phase` is `acting` | yes, as a pill |
| `owedSeats` | `BoardSeat.phase` is `owed` | yes, as a pill, never as a list |
| `pending` | `BoardTable.pending` label | yes, claimant, role, target only |
| `tokens` | `BoardSeat.tokens` | partly, no counts or allies |
| `terminal` | `BoardTable.terminal` | yes, a Game over pill |
| `window` | dropped | no |
| `generalActions` | dropped | no |
| `myDraw`, `mySocialist` | dropped | no |
| `arms` | dropped | no |
| `winner` | dropped | no |
| `socialMedia` | dropped | no |

The gap that blocks action UI is `window`. The engine projects `{ kind, purpose }` for the open window (`index.ts:142`), but `boardOf` throws it away. A phase-aware UI needs it. `PendingView` is also lossy. It carries `claimant`, `role`, `target`, `blocker`, and `named`, but not `cost`, `costTo`, `blockRole`, `challenger`, or `blockChallenger` (`index.ts:35`). Those live in `PendingAction` in the raw state and never cross `project`. Showing "challenged by X" or "blocked with role Y" needs a domain change, not just a UI change.

## Build the UI phase by phase

Build in the order the engine plays. Each unit ends with a working page you can drive by hand.

### Unit 1. Carry the phase into the board

Add the open window and the owed seats to the board model. Extend `BoardTable` with `window: { kind, purpose } | null` and `owedSeats: readonly SeatId[]`, and fill them in `boardOf` from `view.window` and `view.owedSeats`. Render the purpose as a status line in `TablePuck`. No input yet.

Verify by opening a game and watching the status line change as the turn advances.

### Unit 2. The turn menu

Render a menu when `view.window.purpose === "turn"` and `view.owedSeats` includes the viewer. Offer the `view.generalActions` entries and a claim control for each role in `view.roles` that is not reactive. Dispatch through `useGame.report` with `{ kind: "act", action }`. Coup and the target-taking roles need a target picker over the other alive seats.

This is the first unit that writes. The seam is `report(SeatInput<G54Action>)`, already returned by `useGame` and already unused by the page.

### Unit 3. The challenge windows

When the purpose is `challenge-claim` or `challenge-block` and the viewer is owed, show Challenge and Pass. Every alive seat is owed in these windows, so each seat reports on its own client and the frame seals when all have. A seat that never reports is carried by the `idle` timeout, but the Pass button is what makes the round trip visible.

### Unit 4. The proof windows

When the purpose is `proof-claim` or `proof-block` and the viewer is owed, show Show and Concede. Show is legal only when the viewer holds the claimed card, which the client can read from `view.myHand` for a claim, and from the pending `blockRole` for a block.

### Unit 5. The block window

When the purpose is `block` and the viewer is the target, show Block and Pass. The block role is `pending.blockRole`, which the view does not carry yet. Either add `blockRole` to `PendingView` or derive it from `specOf(pending.role).blockRole` in the UI.

### Unit 6. The reveal window

When the purpose is `reveal` and the viewer is owed, let the viewer pick a face-down card to flip. Dispatch `reveal` with the index. The hand is already in `BoardSeat.hand`.

### Unit 7. The keep window

When the purpose is `keep` and the viewer is owed, show the swap pool and let the viewer choose `keepSize` cards. The pool is `view.myDraw`, which the board drops today. Carry it into the board model for this unit.

### Unit 8. The role sub-windows

Each remaining purpose is its own small control, keyed the same way.

- `crime-pay`, `protestor-fund`, `writer-draw` are pay or decline.
- `producer-give`, `socialist-give` are pick a card to give.
- `socialist-keep` is a two-card swap.
- `customs-mark`, `capitalist`, `lawyer`, `reactive-intellectual`, `reactive-missionary` are claim or decline.
- `bomb` is pass or defuse.
- `spy-second` is a second turn menu, so reuse Unit 2 and branch on purpose, not kind.
- `plantation-payout` is an acknowledge button.

### Unit 9. Terminal and tokens

Add a winner branch for `status === "terminal"` using `view.winner`, which the board drops. Then surface the token detail the board drops now, the Disappear countdown, the Treaty allies, and the Bomb holder and prior set.

## Gotchas

A few engine behaviors will surprise a phase-keyed UI.

- One frame is one window. The phase can only move once per sealed frame, so a control that reports must tolerate the view staying put until every owed seat has reported.
- An `any` window owes every alive seat, not just the active one. The challenge controls belong to all seats at once.
- The stack below the top window is not projected. The UI can render the current window only, never what comes next.
- A role claim keeps `pending` set through its sub-windows and clears it at `end-turn` (`windows.ts:498`, `windows.ts:946`). The pending label should stay up across the sub-windows.
- `end-turn` can push reveal windows for firing Disappear tokens before the next turn window (`windows.ts:956`). The phase can jump from `end-turn` straight to `reveal`.
- The engine is total over `G54Action`. Any report is coerced to a safe default, so a buggy control will not stall the game. It will just do the wrong legal thing.
