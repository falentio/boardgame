# core

The Coup Rebellion G54 game engine, and the lockstep primitive it runs on. The point of the primitive is extensibility: a new game is one object, `GameDefinition`, and no change to the primitive.

This document is for a game author. It shows the contract, walks through a complete small game, and states the rules that keep a game correct. If you only run sessions rather than write games, read [Plug a game into a session](#plug-a-game-into-a-session) and the API table.

## Commands

Run these from the repo root.

```bash
pnpm test        # run the tests
pnpm typecheck   # typecheck the engine
```

There is no build step. The engine is plain TypeScript, imported by source path.

## The GameDefinition contract

A game is one value with nine members. The primitive folds frames and asks the game who is owed and what a frame does. It never learns what a role, a card, or a deck is.

| Member       | Type                         | What it does                                                      |
| ------------ | ---------------------------- | ----------------------------------------------------------------- |
| `id`         | `GameId`                     | Stable id, checked against an inbound snapshot                    |
| `version`    | `number`                     | Bump when `step` or `seatsOwed` change meaning; checked like `id` |
| `state`      | `Codec<S>`                   | Lossless encode and decode for the game state                     |
| `action`     | `Codec<A>`                   | Lossless encode and decode for an action                          |
| `genesis`    | `(setup, roster, rng) => S`  | Build the initial state; shuffle hidden decks here                |
| `seatsOwed`  | `(state, index) => SeatId[]` | Who must report this frame; never `[]` while not terminal         |
| `step`       | `(state, frame, rng) => S`   | The pure fold; total over any input                               |
| `project`    | `(state, seat) => View`      | The redaction boundary; drop hidden information                   |
| `isTerminal` | `(state) => boolean`         | True when the game is over                                        |

Four type parameters: `S` is the state, `A` the action, `Setup` the lobby config, and `View` what one seat may see.

## Build a game, step by step

The smallest complete game in the repo is `lockstep/games/coinflip.ts`. It has one turn seat, one multi-actor window, a hidden seeded value, and a terminal condition. Read it alongside this section.

### 1. Define the state, the action, and the view

The state holds everything, including hidden information. The action is what a seat reports. The view is what a seat may see.

```ts
interface CoinflipState {
  readonly players: readonly CoinflipPlayer[];
  readonly round: number;
  readonly phase: CoinflipPhase; // "call" | "stake" | "over"
  readonly caller: SeatId;
  readonly pendingCoin: Side; // hidden; redacted by project
  readonly winner: SeatId | null;
}

type CoinflipAction = { readonly t: "call"; readonly side: Side } | { readonly t: "stake" };
```

Model the state as a state machine where you can. A discriminated `phase` beats a bag of booleans, and it makes `seatsOwed` and `step` a `switch` the compiler checks for exhaustiveness. `coinflip` drives its turn from `phase`; G54 drives its turn from a stack of windows.

### 2. Write the two codecs

A codec turns a value into `Json` and back. `decode(encode(x))` must equal `x`, because a snapshot round trip and the state-digest chain both depend on it.

Decode at the boundary and validate there. The `expect*` helpers and `field` throw on a malformed value, so a corrupt snapshot fails at parse rather than inside a later fold.

```ts
const actionCodec: Codec<CoinflipAction> = {
  encode: (action) => (action.t === "call" ? { t: "call", side: action.side } : { t: "stake" }),
  decode: (json) => {
    const object = expectObject(json, "coinflip action");
    const t = expectString(field(object, "t"), "action type");
    if (t === "stake") return { t: "stake" };
    if (t === "call") {
      const side = expectString(field(object, "side"), "call side");
      if (!isSide(side)) throw new CoinflipError(`unknown side: ${side}`);
      return { t: "call", side };
    }
    throw new CoinflipError(`unknown action: ${t}`);
  },
};
```

Use `expectInteger` for counts such as coins and rounds. `expectNumber` accepts any finite number; `expectInteger` rejects fractions.

### 3. Write `genesis`

`genesis(setup, roster, rng)` builds the initial state. It is deterministic from its three arguments. Every hidden shuffle happens here, seeded from `rng`, so all peers build the same hidden deck from the same seed.

```ts
genesis(setup, roster, rng) {
  const players = roster.order.map((seat) => ({ seat, coins: 3, secret: rng.int(1_000_000) }));
  return { players, round: 0, phase: "call", caller: roster.order[0], pendingCoin: drawCoin(rng), /* ... */ };
}
```

### 4. Write `seatsOwed`

`seatsOwed(state, index)` names the seats that must report this frame. One seat is a turn. Several seats are a window where each may act, such as a challenge.

```ts
seatsOwed(state, _index) {
  switch (state.phase) {
    case "call":  return [state.caller];                    // one seat
    case "stake": return state.players.map((p) => p.seat);  // every seat
    case "over":  return [];
  }
}
```

The rule you must not break here: never return `[]` while `isTerminal(state)` is false. An empty owed set is vacuously complete, so the session would seal empty frames forever. The session raises a `SessionError` if you do. Fold an early end, such as every seat resigning, into `isTerminal`.

### 5. Write `step`

`step(state, frame, rng)` is the pure fold. Read the seats' inputs from `frame.inputs`, advance the state, and return it. It must be total: any input, including a malformed or hostile one, folds to some state. Never throw, and never leave the turn stuck.

```ts
step(state, frame, rng) {
  switch (state.phase) {
    case "call": {
      const input = frame.inputs.find(([seat]) => seat === state.caller)?.[1];
      const call = input?.kind === "act" && input.action.t === "call" ? input.action.side : null;
      return { ...state, phase: "stake", call };
    }
    case "stake": { /* pay the stakers, advance the round */ }
    case "over": return state;
  }
}
```

When a reported action is illegal, fold it to a safe default instead of throwing. G54's `planTurn` coerces an unaffordable claim to Income, so a bad report never crashes a peer or stalls the turn.

Draw hidden values from `rng`, never from ambient entropy. `rng` is seeded from the frame's seed, so the same frame draws the same cards on every peer.

### 6. Write `project`

`project(state, seat)` returns what one seat may see. This is the redaction boundary. The raw state never leaves the session, so anything you leave out of the view is invisible to that seat.

```ts
project(state, seat) {
  return {
    seat,
    players: state.players.map((p) => ({ seat: p.seat, coins: p.coins })),
    mySecret: playerOf(state, seat).secret,   // only the viewer's own secret
    // pendingCoin is dropped: no seat may see it
  };
}
```

Drop the hidden deck order and every other seat's hidden hand here. If a value must stay secret, it must not appear in the view.

### 7. Write `isTerminal`

`isTerminal(state)` returns true once the game is over. The session stops advancing and accepts no more input. Return a terminal state together with the empty owed set, not one without the other.

## Rules that keep a game correct

Four rules cause almost every bug in a new game. Check them before you write tests.

1. `step` is total. No input throws, and no input leaves the turn stuck. Fold bad input to a safe default.
2. `seatsOwed` is never empty while the game is not terminal. Fold an early end into `isTerminal`.
3. `step` is pure and deterministic. Same inputs and same seed give the same state. Randomness comes from `rng`; never call `Math.random` or read a clock.
4. `project` hides everything secret. The deck order and other seats' hands never appear in a view.

The primitive enforces rule 2 for you: it raises a `SessionError` on an empty owed set while not terminal. It cannot see inside `step`, so rules 1 and 4 are yours, and rule 3 it can only detect after the fact. Committing the state digest turns a bad `step` into a rejected frame, not a silent fork, but the fix is still in your `step`. Tests that drive a real game to terminal catch all four.

## How the primitive runs your game

You do not need this to write a game, but it explains the constraints above.

A **frame** is the unit of agreement. It is total: one seat-addressed input per owed seat, ordered by `Roster.order`, and it seals only when every owed seat has reported. Arrival order never reaches the log. This is classic RTS lockstep.

A frame carries the `Seed` it is stepped with. The next seed is a digest of the previous seed, the frame index, the frame's agreed inputs, and the digest of the state the frame produced. Every peer computes the same value, so a receiver verifies a frame instead of trusting it. Committing the **state** digest is what makes the chain a convergence check: two peers that fold the same inputs but reach different state compute different next seeds, so a bad `step` or a lossy codec shows up as a rejected frame, not a silent fork.

`Clock` is used in one place, to decide when an active peer carries a silent owed seat to `idle` on timeout. Once carried, the input is in the frame and every downstream step is pure. A peer compares the deadline against its own clock, so a report still in flight when the deadline passes is dropped, and a seat carried too early reads as `idle`.

## Plug a game into a session

An app author implements two seams and drives a `Session`. The game author's work ends at the `GameDefinition`.

```ts
import {
  createSession,
  resumeSession,
  decodeSnapshot,
  act,
  deadline,
  seatId,
  genesisSeed,
  makeRoster,
} from "#shared/core";
import { coinflip } from "#shared/core/lockstep/games/coinflip.ts";

const port: SessionPort<CoinflipAction> = {
  sendReport: (report) => socket.send(encode({ t: "report", report })),
  send: (frame) => socket.send(encode({ t: "frame", frame })),
  sendSnapshot: (snapshot) => socket.send(encode({ t: "snap", snapshot })),
};
const clock = { now: () => Date.now() };

const session = createSession(
  { game: coinflip, port, clock, config: { seat: seatId("ann"), inputTimeoutMs: 20_000 } },
  {
    seed: genesisSeed(lobbyEntropy),
    roster: makeRoster([seatId("ann"), seatId("bob")]),
    setup: { rounds: 3 },
    startedAt: deadline(room.startedAt ?? 0),
  },
);

session.report(act({ t: "stake" })); // offer the local seat's input
session.view(); // redacted for the local seat
session.owed(); // seats the open frame waits on
session.receive(inbound); // fold a report, frame, or snapshot from a peer
session.tick(); // call on a timer; fills idle on timeout
```

`view()` calls your `project`. `report` and `receive` are total for frames: a frame that fails verification is dropped, never thrown, so a peer cannot crash the caller.

To join mid-game, pass a snapshot to `resumeSession`. A snapshot is self-contained, so a joiner is current in O(1) with no replay.

```ts
const joiner = resumeSession(deps, decodeSnapshot(coinflip, inboundJson));
```

## API reference

The barrel in `lockstep/index.ts` groups its exports by who reaches for them.

For a game author:

| Export                                                                                                                    | Role                                                                 |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GameDefinition`                                                                                                          | The contract above                                                   |
| `Codec`                                                                                                                   | Lossless encode and decode                                           |
| `Frame`, `Roster`, `SeatInput`, `SeatReport`, `SeatStatus`                                                                | The frame vocabulary                                                 |
| `act`, `idle`, `resign`, `makeRoster`, `activeSeats`, `orderSeats`, `rosterPosition`                                      | Frame and roster helpers                                             |
| `Random`                                                                                                                  | The seeded PRNG handed to `genesis` and `step`                       |
| `Json`, `canonicalize`, `asJson`, `expectObject`, `expectArray`, `expectString`, `expectNumber`, `expectInteger`, `field` | The serialization boundary                                           |
| `GameId`, `SeatId`, `FrameIndex`, `Seed`, `Deadline`                                                                     | Branded ids; construct with `gameId`, `seatId`, `frameIndex`, `seed`, `deadline` |

For an app author:

| Export                                                                 | Role                                       |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| `createSession`, `resumeSession`                                       | Build a session from genesis or a snapshot |
| `Session`, `SessionDeps`, `SessionConfig`, `GenesisInput`, `Inbound`   | The session engine and its inputs          |
| `SessionPort`, `Clock`                                                 | The two seams to implement                 |
| `Snapshot`, `encodeSnapshot`, `decodeSnapshot`, `expectedSnapshotSeed` | Serialize and parse a checkpoint           |

The barrel also exports pure helpers for tests and tooling: `advanceFrame`, `foldFrom`, `replayFromGenesis`, `genesisCheckpoint`, `buildFrame`, `isComplete`, `encodeFrame`, `decodeFrame`, `framePayload`, `withResigned`, `FrameLog`, `Checkpoint`, `encodeRoster`, `decodeRoster`, `emptyLog`, `appendFrame`, `head`, `genesisSeed`, `chainSeed`, `stateDigest`, `makeRandom`, `nextFrameIndex`, and the error types.

No transport or wire type appears anywhere on the surface. `SessionPort` is the only seam, and it carries domain types only.

## The G54 game, as a full example

`g54` is the reference implementation of the full rules: 25 roles across 4 categories, 4 tokens, and the turn windows from `docs/research/coup-rebellion-g54/`. Read it when `coinflip` is too small to show the shape you need.

Two ideas carry the extra complexity, and both are worth copying.

A turn is a **window stack**. `windows.ts` maps each window purpose (`turn`, `challenge-claim`, `proof-claim`, `block`, `resolve`, and more) to a resolver. Each resolver pops the top window and pushes the next steps. A turn reads as data, not a long branch chain.

A role is a **table entry**. `effects.ts` maps each role to its effect in `ROLE_EFFECTS`. Adding a role is one entry, not a new branch in `step`.

The game is not on the barrel. Import it by path.

```ts
import { g54, STARTER_ROLES, ROLE_CATALOG } from "./lockstep/games/g54/index.ts";
import type { G54View, G54Action, G54Setup } from "./lockstep/games/g54/index.ts";
```

`ROLE_CATALOG` is the 25-role table. `STARTER_ROLES` is the five-role starter set. A legal `G54Setup` selects five roles as one Finance, one Communications, one Force, and two Special Interest.

## Layout

```text
index.ts                       projectName plus the lockstep barrel
lockstep/
├── json.ts                    Json value type and canonical serialization
├── codec.ts                   Codec<T> and the boundary guards
├── ids.ts                     branded GameId, SeatId, FrameIndex, Seed
├── hash.ts                    digest, seed chain, seeded PRNG
├── frame.ts                   SeatInput, Frame, Roster, sealing
├── game.ts                    GameDefinition
├── log.ts                     append-only FrameLog, fold, replay
├── snapshot.ts                Snapshot plus its codec
├── session.ts                 Session engine, createSession, resumeSession
├── port.ts                    SessionPort, Clock
├── index.ts                   the public barrel
└── games/
    ├── coinflip.ts            a small 3-seat game; the worked example
    └── g54/                   the full game
        ├── state.ts           G54State, Step, Window, codec
        ├── windows.ts         the window stack machine and resolver registry
        ├── effects.ts         ROLE_EFFECTS and EXTRA_EFFECTS
        ├── helpers.ts         coin, deck, and token helpers
        ├── roles.ts           the 25-role catalog
        ├── setup.ts           draft validation, deck, deal
        ├── actions.ts         G54Action and its codec
        └── index.ts           the g54 GameDefinition and project
```

## Tests

`tests/` mirrors the engine tree. The suite runs on Vitest through `vitest`.

For a new game, drive it to terminal with a small policy and assert the outcome, the conservation of anything the rules conserve (cards, coins), and the redaction of hidden information. The primitive tests in `tests/lockstep/` show the shape: `session.test.ts` drives two independent sessions and checks they converge, and `convergence.test.ts` proves a game that reaches different state is caught at the next frame.

## Limits

The threat model is cooperative peers. Frame seeds are public, so a peer that controls a frame's inputs can predict that frame's deck draw. Anti-cheat needs a commit-reveal layer and is out of scope.

The frame barrier costs a round trip to every owed seat, so the slowest seat bounds each window. Any active peer carries a silent owed seat to `idle` once the frame's deadline passes, which bounds the wait.

First-come-first-served ordering is not representable. A frame is total and ordered by seat, so a game that needs a tie-break applies the deterministic seat-order one. G54's challenge window uses clockwise-from-active, which matches the rulebook.

The design behind all three lives in `docs/design/p2p-lockstep.md` and `docs/design/g54-full-game.md`.
