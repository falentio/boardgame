# p2p lockstep primitive

A peer-to-peer, transport-agnostic primitive for deterministic multiplayer state. Peers each hold a copy of the game, agree on an ordered log of inputs, and fold that log through the same pure functions to reach identical state. No server, no authority, no consensus protocol.

Lives at `shared/core/lockstep`. Games plug in through one interface, `GameDefinition`.

## Why frames, not per-action messages

The hard case is Coup's challenge window. Any player may act in it, so two peers can propose a response at the same logical position at the same time. A per-action log has to break that tie, and any tie-break a peer computes from the proposals it happens to hold is unsound: a peer holding one proposal commits it, a peer holding two commits the smaller, and the two logs diverge permanently.

The primitive removes the concurrency instead of ordering it. The unit of agreement is a **frame**, and a frame is _total_: one seat-addressed input per owed seat, ordered by seat, sealed only when every owed seat has reported. Arrival order never reaches the log. This is classic RTS lockstep, and it is what makes peers converge by construction.

## Determinism

Nothing non-deterministic enters state or the log.

- **No wall clock in the core.** A `Clock` is injected and used only to decide when the _local_ peer emits an `idle` input on timeout. Once emitted, the input is in the frame and every downstream step is pure.
- **No ambient randomness.** All randomness is a seeded PRNG. A frame carries the `Seed` it is stepped with, and the next seed is a hash of the previous seed, the frame index, the frame's agreed inputs, _and the digest of the state the frame produced_, so the chain is self-verifying and commits to the resulting state, not just the inputs.
- **Hidden information stays out of the log.** The reducer owns hidden state (the Court deck order, face-down hands). The deck is shuffled once inside the game's `genesis` from the genesis seed. The log never carries it. Peers reproduce it because they share the seed, not because they exchange the cards.
- **Redaction is a first-class member.** `project(state, seat)` returns a `View` with hidden information removed. The raw state never leaves the primitive.

### State convergence

Because the chain commits to the state a frame produced (`stateDigest`), two peers that fold the same inputs but reach different state compute different next seeds. A receiver recomputes the expected seed for the open frame from its local head and the _current_ state; a divergent peer's seed does not match, so its next frame is rejected rather than silently forked. This is the **state-convergence check**: the log cannot agree while the state disagrees, so the primitive converges by construction rather than by trusting `step` to be deterministic.

## Data shape

The organizing structure is a **pure fold over an append-only frame log**, wrapped by a thin per-peer shell. State is never stored on the wire; a snapshot is a fold checkpoint, always discardable.

```ts
type SeatInput<A> =
  | { readonly kind: "act"; readonly action: A }
  | { readonly kind: "idle" }
  | { readonly kind: "resign" };

interface Frame<A> {
  readonly index: FrameIndex;
  readonly seed: Seed; // seed this frame is stepped with
  readonly inputs: readonly (readonly [SeatId, SeatInput<A>])[]; // in roster order, total
}

interface Roster {
  readonly order: readonly SeatId[];
  readonly status: ReadonlyMap<SeatId, "active" | "resigned">;
}

interface GameDefinition<S, A, Setup, View> {
  readonly id: GameId;
  readonly version: number;
  readonly state: Codec<S>;
  readonly action: Codec<A>;
  genesis(setup: Setup, roster: Roster, rng: Random): S;
  seatsOwed(state: S, index: FrameIndex): readonly SeatId[]; // never [] while !isTerminal
  step(state: S, frame: Frame<A>, rng: Random): S;
  project(state: S, seat: SeatId): View;
  isTerminal(state: S): boolean;
}
```

`seatsOwed` must not return an empty set while `isTerminal` is false. An empty owed set is vacuously complete, so the session would seal empty frames forever, spinning the frame index with no progress; the session treats that as a hard `SessionError`. A game whose play can end early (for example every seat resigning) must fold that into `isTerminal` and return a terminal state.

## Module map

| Module        | Owns                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| `json.ts`     | `Json` value type and canonical serialization                                          |
| `codec.ts`    | `Codec<T>` encode/decode, the serialization boundary                                   |
| `ids.ts`      | branded `GameId`, `SeatId`, `FrameIndex`, `Seed` and their smart constructors          |
| `hash.ts`     | deterministic digest (`stateDigest`, `chainSeed`) and the seeded PRNG, no dependencies |
| `frame.ts`    | `SeatInput`, `Frame`, `Roster`, pure frame construction and sealing                    |
| `game.ts`     | `GameDefinition`, `View` contract                                                      |
| `log.ts`      | append-only `FrameLog`, gap-free append, fold and replay                               |
| `snapshot.ts` | `Snapshot` plus `encodeSnapshot`/`decodeSnapshot`                                      |
| `session.ts`  | `Session` engine, `createSession`, `resumeSession`                                     |
| `port.ts`     | `SessionPort`, `Clock` — the only transport and time seams                             |
| `index.ts`    | public barrel                                                                          |

## Public surface

```ts
createSession<...>(deps: SessionDeps<S, A, Setup, View>, genesis: GenesisInput<Setup>): Session<A, View>
resumeSession<...>(deps: SessionDeps<S, A, Setup, View>, snapshot: Snapshot<A>): Session<A, View>

interface SessionDeps<S, A, Setup, View> {
  readonly game: GameDefinition<S, A, Setup, View>;
  readonly port: SessionPort<A>;
  readonly clock: Clock;
  readonly config: SessionConfig;         // { seat, inputTimeoutMs }
}

interface Session<A, View> {
  readonly seat: SeatId;
  readonly frame: FrameIndex;
  readonly terminal: boolean;
  report(input: SeatInput<A>): void;      // local intent
  receive(msg: Inbound<A>): void;         // inbound report, frame, or snapshot
  owed(): readonly SeatId[];              // who may act this frame (public)
  view(): View;                           // redacted for the local seat
  snapshot(): Snapshot<A>;
  tick(): void;                           // app-driven timeout check
}

interface SessionPort<A> {
  sendReport(report: SeatReport<A>): void;
  send(frame: Frame<A>): void;
  sendSnapshot(snapshot: Snapshot<A>): void;
}
```

The session is not parameterized by the state type: the raw state never leaves the primitive, and the only read path is `game.project(state, seat)`. `receive` is total for frames — a frame that fails verification (bad seed chain, wrong inputs, too far ahead) is dropped, never thrown, so a peer cannot crash the caller. A _divergent_ snapshot (same frame, different seed) is a hard fork and is raised as a `SessionError`; a merely stale snapshot is dropped.

A caller offers a move with one `report`, advances by satisfying the owed set, and reads with `view`. Ordering, sealing, seeding, verification, redaction, and snapshotting are hidden behind those methods. No transport or wire type appears on the surface.

## Load

Snapshot load, log replay, and late-join are the same left fold at different base points. `resumeSession` adopts a snapshot in O(1). A snapshot is `{ gameId, version, frame, seed, roster, state, head }`, self-contained, so a joiner needs no replay. A `FrameLog` is gap-free, so replay is a plain fold.

A snapshot's `seed` is never trusted as stored: it is re-derived from `head` over the carried state and the two must agree, so a tampered or divergent snapshot is rejected. A stale snapshot (`frame <` the local frame) is dropped rather than rewinding a live session, and a same-frame snapshot with a different seed is a divergence and is rejected loudly.

## Threat model

Cooperative peers. Frame seeds are public, so a peer that controls a frame's inputs can predict that frame's deck draw. Anti-cheat needs a commit-reveal layer and is out of scope for the draft.

The **state-convergence check** defends against a subtler failure than cheating: peers that fold the same inputs but reach different state (a non-deterministic `step`, a codec that loses information, a version skew). Because each seed commits to the resulting state digest, such peers compute different next seeds and reject each other's frames instead of forking silently. This assumes cooperative peers — it detects divergence, it does not stop a peer from lying about its inputs.

## Tradeoffs

- **Frame barrier latency.** A frame seals only when every owed seat has reported, so the slowest owed seat bounds the round trip. This is the price of removing concurrency; a game that wants to act on a partial frame cannot, by construction. The local `idle` timeout bounds the wait for a silent seat.
- **Challenge ordering is not "first come, first served."** A frame is total and ordered by seat, so the log cannot represent which of two simultaneous responses arrived first. Only the deterministic seat-order tie-break is representable: the earliest seat in `Roster.order` wins an in-frame race. A game that needs true first-come-first-served must not model it in the frame.
