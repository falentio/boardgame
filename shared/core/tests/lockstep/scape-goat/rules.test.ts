import { expect, test } from "vitest";
import { seatId } from "../../../index.ts";
import {
  ANN,
  BOB,
  CARA,
  DEE,
  MIN_SEATS,
  activeSeat,
  activeSeats,
  atFrameReveal,
  cardId,
  cardsConserved,
  flippedPrepare,
  knownHand,
  knownScapegoat,
  outcomeOf,
  rawGenesis,
  resolveFrame,
  scapeGoat,
  shrunkTable,
  stepState,
  withHand,
  withHands,
  withPhase,
  withPrep,
  withPrepareTokens,
  twoHolderSteal,
  withResigned,
  withScapegoat,
  type CardId,
  type Checkpoint,
  type SeatId,
  type ScapeGoatAction,
  type ScapeGoatState,
} from "./driver.ts";

const THREE: readonly SeatId[] = [ANN, BOB, CARA];

/** A reveal map keyed by seat, from `[seat, cardId]` pairs. */
const reveals = (entries: readonly (readonly [SeatId, string])[]): ReadonlyMap<SeatId, CardId> =>
  new Map(entries.map(([seat, id]): [SeatId, CardId] => [seat, cardId(id)]));

/** Put the actor on a location with the given phase, leaving every other field. */
const placed = (
  checkpoint: Checkpoint<ScapeGoatState>,
  seat: SeatId,
  at: "prepare" | "spy" | "trade" | "stash",
): Checkpoint<ScapeGoatState> =>
  withPhase(
    {
      ...checkpoint,
      state: {
        ...checkpoint.state,
        players: checkpoint.state.players.map((player) =>
          player.seat === seat ? { ...player, at } : player,
        ),
      },
    },
    { kind: "swap", active: seat },
  );

// --- resolveFrame ----------------------------------------------------------

test("a frame succeeds when exactly one seat's card lacks a colour the others share", () => {
  const result = resolveFrame(
    THREE,
    reveals([
      [ANN, "goat-tail"],
      [BOB, "goat-horns"],
      [CARA, "goat-beard"],
    ]),
  );
  expect(result.framed).toBe(ANN);
  expect(result.colour).toBe("red");
});

test("a colour present on every card fails the attempt: there is no odd card out", () => {
  const result = resolveFrame(
    THREE,
    reveals([
      [ANN, "goat-horns"],
      [BOB, "goat-herd"],
      [CARA, "goat-kid"],
    ]),
  );
  expect(result.framed).toBeNull();
  expect(result.colour).toBeNull();
});

test("two colours each framing a different seat resolves to the earlier canonical seat", () => {
  const entries: readonly (readonly [SeatId, string])[] = [
    [ANN, "goat-bleat"],
    [BOB, "goat-nose"],
    [CARA, "goat-beard"],
  ];
  expect(resolveFrame([ANN, BOB, CARA], reveals(entries)).framed).toBe(ANN);
  // The same reveals with Bob earlier in canonical order frame Bob instead: the
  // seat order decides the tie, not the colour order.
  expect(resolveFrame([BOB, ANN, CARA], reveals(entries)).framed).toBe(BOB);
});

test("a colour on all but one card frames the odd seat, and frames the scapegoat when it is that seat", () => {
  const checkpoint = withScapegoat(
    atFrameReveal(3, BOB, [
      [ANN, ["goat-tail"]],
      [BOB, ["goat-horns"]],
      [CARA, ["goat-beard"]],
    ], "rules-odd-scapegoat"),
    ANN,
    BOB,
  );
  const next = stepState(checkpoint.state, [
    [ANN, { t: "reveal", index: 0 }],
    [BOB, { t: "reveal", index: 0 }],
    [CARA, { t: "reveal", index: 0 }],
  ]);
  expect(outcomeOf(next)).toEqual({ kind: "frame", actor: BOB, framed: ANN });
  expect(scapeGoat.isTerminal(next)).toBe(true);
});

test("a missing pick fails the attempt: an idle seat never gets framed", () => {
  // Ann and Bob both reveal red; Cara idles. If a silent seat were treated as a
  // blank, Cara's empty card would be the odd card out and she would be framed.
  // The attempt must instead fail.
  const checkpoint = withScapegoat(
    atFrameReveal(3, BOB, [
      [ANN, ["goat-horns"]],
      [BOB, ["goat-beard"]],
      [CARA, ["goat-tail"]],
    ], "rules-idle-pick"),
    ANN,
    BOB,
  );
  const next = stepState(checkpoint.state, [
    [ANN, { t: "reveal", index: 0 }],
    [BOB, { t: "reveal", index: 0 }],
    [CARA, null],
  ]);
  expect(next.frame?.framed).toBeNull();
  expect(next.phase).toEqual({ kind: "swap", active: BOB });
});

test("an out-of-range reveal index is a missing pick, not a default card", () => {
  // Cara's card would be the odd one out if her bad index fell back to a real
  // card; an out-of-range index must count as no pick and fail the attempt.
  const checkpoint = withScapegoat(
    atFrameReveal(3, BOB, [
      [ANN, ["goat-horns"]],
      [BOB, ["goat-beard"]],
      [CARA, ["goat-tail"]],
    ], "rules-bad-reveal"),
    ANN,
    BOB,
  );
  const next = stepState(checkpoint.state, [
    [ANN, { t: "reveal", index: 0 }],
    [BOB, { t: "reveal", index: 0 }],
    [CARA, { t: "reveal", index: 99 }],
  ]);
  expect(next.frame?.framed).toBeNull();
});

test("fewer than three active seats fails the frame resolution", () => {
  const result = resolveFrame(
    [ANN, BOB],
    reveals([
      [ANN, "goat-tail"],
      [BOB, "goat-horns"],
    ]),
  );
  expect(result.framed).toBeNull();
  expect(result.colour).toBeNull();
});

test("a table shrunk below three seats abandons rather than empties the owed set", () => {
  const checkpoint = shrunkTable(4, "rules-shrink");
  expect(knownScapegoat(4, ANN, BOB, "rules-shrink-known").state.scapegoat).toBe(ANN);
  expect(activeSeats(checkpoint.state).length).toBeLessThan(MIN_SEATS);
  expect(scapeGoat.isTerminal(checkpoint.state)).toBe(true);
  expect(outcomeOf(checkpoint.state)).toEqual({ kind: "abandoned" });
});

// --- grey ------------------------------------------------------------------

test("grey is the empty colour set: it never contributes to a frame match", () => {
  const result = resolveFrame(
    THREE,
    reveals([
      [ANN, "goat-bystander"],
      [BOB, "goat-bystander"],
      [CARA, "goat-horns"],
    ]),
  );
  expect(result.framed).toBeNull();
  expect(result.colour).toBeNull();
});

test("grey never satisfies the own-colour swap obligation", () => {
  // Ann is the red seat. Her hand is [grey, red-bearing]; a report of index 0
  // (the grey card) must coerce to the red-bearing card at index 1.
  let checkpoint = knownHand(3, ANN, ["goat-bystander", "goat-horns"], "rules-grey-swap");
  checkpoint = placed(checkpoint, ANN, "spy");
  const next = stepState(checkpoint.state, [[ANN, { t: "swap", index: 0 }]]);
  expect(next.faceUp.spy).toBe("goat-horns");
});

// --- coercion table (gap 3) ------------------------------------------------

test("an illegal swap report coerces to an own-colour card when one is held", () => {
  let checkpoint = knownHand(3, ANN, ["goat-bystander", "goat-horns"], "rules-swap-forced");
  checkpoint = placed(checkpoint, ANN, "spy");
  const next = stepState(checkpoint.state, [[ANN, { t: "swap", index: 5 }]]);
  expect(next.faceUp.spy).toBe("goat-horns");
});

test("an illegal swap report coerces to index 0 when no own-colour card is held", () => {
  let checkpoint = knownHand(3, ANN, ["goat-bystander", "goat-tail"], "rules-swap-default");
  checkpoint = placed(checkpoint, ANN, "spy");
  const next = stepState(checkpoint.state, [[ANN, { t: "swap", index: 5 }]]);
  expect(next.faceUp.spy).toBe("goat-bystander");
});

test("a move onto the current location coerces to another legal destination", () => {
  const start = rawGenesis(4, "rules-move-coerce");
  const actor = activeSeat(start.state);
  const here = start.state.players.find((player) => player.seat === actor)?.at;
  const next = stepState(start.state, [[actor, { t: "move", to: here ?? "prepare" }]]);
  expect(next.phase.kind).toBe("action");
  expect(next.players.find((player) => player.seat === actor)?.at).not.toBe(here);
});

test("a move to the cops ends the game immediately with the scapegoat winning", () => {
  const start = rawGenesis(4, "rules-move-cops");
  const actor = activeSeat(start.state);
  const next = stepState(start.state, [[actor, { t: "move", to: "cops" }]]);
  expect(outcomeOf(next)).toEqual({ kind: "cops", actor });
});

test("a steal naming a non-holder coerces to the first holder", () => {
  const checkpoint = withPhase(twoHolderSteal(4, ANN, BOB, CARA, "rules-steal-coerce"), {
    kind: "action",
    active: ANN,
    location: "prepare",
  });
  // Name Dee, who holds no token; the first holder in canonical order is Bob.
  const next = stepState(checkpoint.state, [[ANN, { t: "steal", target: DEE }]]);
  expect(next.players.find((player) => player.seat === ANN)?.prepTokens).toBe(1);
  expect(next.players.find((player) => player.seat === BOB)?.prepTokens).toBe(0);
});

test("a steal with no holder is a no-op that still ends the action", () => {
  let checkpoint = flippedPrepare(4, ANN, "rules-steal-noop");
  checkpoint = withHand(checkpoint, ANN, ["goat-horns"]);
  checkpoint = withPhase(checkpoint, { kind: "action", active: ANN, location: "prepare" });
  const next = stepState(checkpoint.state, [[ANN, { t: "steal", target: BOB }]]);
  expect(next.players.find((player) => player.seat === ANN)?.prepTokens).toBe(0);
  expect(next.phase).toEqual({ kind: "swap", active: ANN });
});

test("an out-of-range hand index coerces to a safe default for put and give", () => {
  const start = rawGenesis(4, "rules-put-range");
  const putActor = activeSeat(start.state);
  const afterMove = stepState(start.state, [[putActor, { t: "move", to: "stash" }]]);
  const afterStash = stepState(afterMove, [[putActor, { t: "stash", slot: 0 }]]);
  const handBefore = afterStash.players.find((player) => player.seat === putActor)?.hand ?? [];
  const afterPut = stepState(afterStash, [[putActor, { t: "put", index: 99 }]]);
  expect(afterPut.stash).toContain(handBefore[0]);

  const tradeStart = rawGenesis(4, "rules-give-range");
  const tradeActor = activeSeat(tradeStart.state);
  const afterTradeMove = stepState(tradeStart.state, [[tradeActor, { t: "move", to: "trade" }]]);
  const partner = afterTradeMove.players.find((player) => player.seat !== tradeActor)?.seat;
  if (partner === undefined) throw new Error("no trade partner");
  const afterTrade = stepState(afterTradeMove, [[tradeActor, { t: "trade", target: partner }]]);
  const giverHand = afterTrade.players.find((player) => player.seat === tradeActor)?.hand ?? [];
  const afterGive = stepState(afterTrade, [
    [tradeActor, { t: "give", index: 99 }],
    [partner, { t: "give", index: 99 }],
  ]);
  const partnerHand = afterGive.players.find((player) => player.seat === partner)?.hand ?? [];
  expect(partnerHand).toContain(giverHand[0]);
});

test("a spy naming an unknown seat coerces to the first other active seat", () => {
  const start = rawGenesis(4, "rules-spy-unknown");
  const actor = activeSeat(start.state);
  const moved = stepState(start.state, [[actor, { t: "move", to: "spy" }]]);
  const next = stepState(moved, [[actor, { t: "spy", target: seatId("nobody") }]]);
  const firstOther = next.players.find((player) => player.seat !== actor)?.seat;
  expect(next.spy?.target).toBe(firstOther);
});

test("a spy naming a resigned seat coerces to the first other active seat", () => {
  let checkpoint = withResigned(rawGenesis(4, "rules-spy-resigned"), [BOB]);
  checkpoint = withPhase(checkpoint, { kind: "action", active: ANN, location: "spy" });
  const next = stepState(checkpoint.state, [[ANN, { t: "spy", target: BOB }]]);
  expect(next.spy?.target).toBe(CARA);
});

test("a spy naming itself coerces to another seat", () => {
  const start = rawGenesis(4, "rules-spy-self");
  const actor = activeSeat(start.state);
  const moved = stepState(start.state, [[actor, { t: "move", to: "spy" }]]);
  const next = stepState(moved, [[actor, { t: "spy", target: actor }]]);
  expect(next.spy?.target).not.toBe(actor);
  expect(next.spy?.target).toBeDefined();
});

// --- totality --------------------------------------------------------------

const HOSTILE: readonly (ScapeGoatAction | null)[] = [
  null,
  { t: "move", to: "cops" },
  { t: "move", to: "prepare" },
  { t: "move", to: "stash" },
  { t: "spy", target: seatId("ghost") },
  { t: "trade", target: seatId("ghost") },
  { t: "stash", slot: 9 as 0 },
  { t: "frame" },
  { t: "steal", target: seatId("ghost") },
  { t: "put", index: -5 },
  { t: "give", index: 999 },
  { t: "reveal", index: 999 },
  { t: "swap", index: 999 },
  { t: "take-prep-token" },
  { t: "go-to-cops" },
];

test("a hostile frame of garbage actions never throws out of step and never strands the owed set", () => {
  const start = rawGenesis(4, "rules-hostile");
  let state: ScapeGoatState = start.state;
  let cursor = 0;
  for (let i = 0; i < 2000 && !scapeGoat.isTerminal(state); i += 1) {
    const owed = scapeGoat.seatsOwed(state, start.frame);
    expect(owed.length).toBeGreaterThan(0);
    const inputs = owed.map((seat): readonly [SeatId, ScapeGoatAction | null] => {
      const action = HOSTILE[cursor % HOSTILE.length] ?? null;
      cursor += 1;
      return [seat, action];
    });
    state = stepState(state, inputs);
    if (!scapeGoat.isTerminal(state)) {
      expect(scapeGoat.seatsOwed(state, start.frame).length).toBeGreaterThan(0);
    }
  }
  // Hostile input may drive the game to terminal (a move to the cops). What it
  // must never do is throw or leave a non-terminal state owing nothing.
  expect(scapeGoat.isTerminal(state)).toBe(true);
});

test("hostile frames that never reach the cops still conserve the deck", () => {
  const noCops = HOSTILE.filter((action) => action === null || action.t !== "go-to-cops");
  const start = rawGenesis(3, "rules-hostile-nocops");
  let state: ScapeGoatState = start.state;
  let cursor = 0;
  for (let i = 0; i < 300 && !scapeGoat.isTerminal(state); i += 1) {
    const owed = scapeGoat.seatsOwed(state, start.frame);
    const inputs = owed.map((seat): readonly [SeatId, ScapeGoatAction | null] => {
      const action = noCops[cursor % noCops.length] ?? null;
      cursor += 1;
      return [seat, action];
    });
    state = stepState(state, inputs);
    expect(cardsConserved(state, 3)).toBe(true);
  }
});
