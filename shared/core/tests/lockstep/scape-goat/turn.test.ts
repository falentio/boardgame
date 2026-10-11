import { expect, test } from "vitest";
import {
  act,
  buildFrame,
  frameIndex,
  genesisSeed,
  idle,
  makeRandom,
  makeRoster,
  resign,
  type Json,
  type SeatInput,
} from "../../../index.ts";
import {
  ANN,
  BOB,
  CARA,
  DEE,
  EVE,
  HAND_SIZE,
  MIN_SEATS,
  SEATS6,
  ScapeGoatError,
  activeSeat,
  activeSeats,
  antipodeOf,
  atFrameReveal,
  atOf,
  capThenCops,
  cardId,
  deckFor,
  handOf,
  moveOwed,
  outcomeOf,
  playRaw,
  project,
  rawGenesis,
  scapeGoat,
  seatsFor,
  seatsOwedNow,
  stepResign,
  stepState,
  winnersOf,
  withAt,
  withHand,
  withHands,
  withPhase,
  withPrep,
  withPrepareTokens,
  withScapegoat,
  type Checkpoint,
  type Phase,
  type PlayerCount,
  type SeatId,
  type ScapeGoatAction,
  type ScapeGoatState,
} from "./driver.ts";
import { stateCodec } from "../../../lockstep/games/scape-goat/state.ts";

const card = cardId;

const advance = (
  checkpoint: Checkpoint<ScapeGoatState>,
  decide: (state: ScapeGoatState, seat: SeatId) => ScapeGoatAction | null,
): Checkpoint<ScapeGoatState> => {
  const inputs = seatsOwedNow(checkpoint.state).map(
    (seat): readonly [SeatId, ScapeGoatAction | null] => [seat, decide(checkpoint.state, seat)],
  );
  return { ...checkpoint, state: stepState(checkpoint.state, inputs) };
};

const walkTurn = (
  checkpoint: Checkpoint<ScapeGoatState>,
  to: "prepare" | "spy" | "trade" | "stash",
  action: ScapeGoatAction | null,
  swap: ScapeGoatAction | null = null,
): Checkpoint<ScapeGoatState> => {
  const active = activeSeat(checkpoint.state);
  let next = advance(checkpoint, (state, seat) =>
    seat === active ? { t: "move", to } : null,
  );
  if (next.state.phase.kind === "action") {
    next = advance(next, (state, seat) => (seat === active ? action : null));
  }
  if (next.state.phase.kind === "swap") {
    next = advance(next, (state, seat) => (seat === active ? swap : null));
  }
  return next;
};

const stepWith = (
  state: ScapeGoatState,
  count: PlayerCount,
  inputs: readonly (readonly [SeatId, SeatInput<ScapeGoatAction>])[],
): ScapeGoatState => {
  const provided = new Map(inputs);
  const owed = [...seatsOwedNow(state)];
  // A frame is total over its owed seats, but a test may also report an action
  // from a seat the phase does not owe, such as the six-player antipode.
  for (const [seat] of inputs) if (!owed.includes(seat)) owed.push(seat);
  const buffer = new Map<SeatId, SeatInput<ScapeGoatAction>>(
    owed.map((seat): [SeatId, SeatInput<ScapeGoatAction>] => [
      seat,
      provided.get(seat) ?? idle<ScapeGoatAction>(),
    ]),
  );
  const seed = genesisSeed("turn-step-with");
  const frame = buildFrame(makeRoster(seatsFor(count)), owed, frameIndex(0), seed, buffer);
  return scapeGoat.step(state, frame, makeRandom(seed));
};

const tokensPerLocation = (state: ScapeGoatState): readonly number[] => {
  const counts = new Map<string, number>();
  for (const player of state.players) counts.set(player.at, (counts.get(player.at) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a);
};

test("a turn is exactly move, action, swap, in that order, with three frames", () => {
  const start = rawGenesis(4, "turn-three-steps");
  const active = activeSeat(start.state);
  const first = advance(start, (state, seat) =>
    seat === active ? { t: "move", to: "spy" } : null,
  );
  expect(first.state.phase).toEqual({ kind: "action", active, location: "spy" });
  const second = advance(first, (state, seat) =>
    seat === active ? { t: "spy", target: BOB } : null,
  );
  expect(second.state.phase).toEqual({ kind: "swap", active });
  const third = advance(second, (state, seat) => (seat === active ? { t: "swap", index: 0 } : null));
  expect(third.state.phase.kind).toBe("move");
  expect(activeSeat(third.state)).not.toBe(active);
});

test("a seat cannot stay put: a move onto the current location still moves", () => {
  const start = rawGenesis(4, "turn-no-stay");
  const active = activeSeat(start.state);
  const here = start.state.players.find((player) => player.seat === active)?.at;
  const next = advance(start, (state, seat) =>
    seat === active ? { t: "move", to: here ?? "prepare" } : null,
  );
  expect(next.state.players.find((player) => player.seat === active)?.at).not.toBe(here);
});

test("Prepare takes one token per visit and flips to Frame/Steal when the second goes", () => {
  const first = withHand(rawGenesis(4, "turn-prepare"), ANN, [card("goat-horns")]);
  let checkpoint = withAt(first, activeSeat(first.state), "spy");
  let next = walkTurn(checkpoint, "prepare", { t: "take-prep-token" }, { t: "swap", index: 0 });
  expect(next.state.prepareTokens).toBe(1);
  const second = activeSeat(next.state);
  expect(second).not.toBe(activeSeat(first.state));
  next = withAt(withHand(next, second, [card("goat-horns")]), second, "spy");
  next = walkTurn(next, "prepare", { t: "take-prep-token" }, { t: "swap", index: 0 });
  expect(next.state.prepareTokens).toBe(0);
});

test("the flipped Prepare offers Frame when the actor holds a token, Steal otherwise", () => {
  let checkpoint = withPrepareTokens(rawGenesis(4, "turn-flip-menu"), 0);
  checkpoint = withHand(checkpoint, ANN, [card("goat-horns")]);
  let holder = withPrep(checkpoint, ANN, 1);
  holder = withPhase(holder, { kind: "action", active: ANN, location: "prepare" });
  const frame = stepState(holder.state, [[ANN, { t: "frame" }]]);
  expect(frame.phase).toEqual({ kind: "frame-reveal", active: ANN });
  let stealer = withPrep(checkpoint, ANN, 0);
  stealer = withPrep(stealer, BOB, 1);
  stealer = withPhase(stealer, { kind: "action", active: ANN, location: "prepare" });
  const stolen = stepState(stealer.state, [[ANN, { t: "steal", target: BOB }]]);
  expect(stolen.players.find((player) => player.seat === ANN)?.prepTokens).toBe(1);
  expect(stolen.players.find((player) => player.seat === BOB)?.prepTokens).toBe(0);
});

test("a Steal moves a token and never spends it", () => {
  let checkpoint = withPrepareTokens(rawGenesis(4, "turn-steal-moves"), 0);
  checkpoint = withHand(checkpoint, ANN, [card("goat-horns")]);
  checkpoint = withPrep(checkpoint, ANN, 0);
  checkpoint = withPrep(checkpoint, BOB, 1);
  checkpoint = withPhase(checkpoint, { kind: "action", active: ANN, location: "prepare" });
  const before = checkpoint.state.players.reduce((n, p) => n + p.prepTokens, 0);
  const next = stepState(checkpoint.state, [[ANN, { t: "steal", target: BOB }]]);
  const after = next.players.reduce((n, p) => n + p.prepTokens, 0);
  expect(after).toBe(before);
  expect(next.players.find((player) => player.seat === ANN)?.prepTokens).toBe(1);
});

test("Stash is two frames: the taken card enters the hand, then one hand card replaces it in the row", () => {
  const start = rawGenesis(4, "turn-stash");
  const active = activeSeat(start.state);
  let next = advance(start, (state, seat) =>
    seat === active ? { t: "move", to: "stash" } : null,
  );
  const stashBefore = [...next.state.stash];
  const handBefore = next.state.players.find((player) => player.seat === active)?.hand ?? [];
  next = advance(next, (state, seat) => (seat === active ? { t: "stash", slot: 1 } : null));
  expect(next.state.phase).toEqual({ kind: "stash-put", active });
  const drawn = stashBefore[1]!;
  const handAfterPick = next.state.players.find((player) => player.seat === active)?.hand ?? [];
  expect(handAfterPick).toContain(drawn);
  expect(handAfterPick.length).toBe(handBefore.length + 1);
  const drawnIndex = handAfterPick.indexOf(drawn);
  next = advance(next, (state, seat) =>
    seat === active ? { t: "put", index: drawnIndex } : null,
  );
  expect(next.state.phase).toEqual({ kind: "swap", active });
  expect(next.state.stash).toContain(drawn);
  const handAfterPut = next.state.players.find((player) => player.seat === active)?.hand ?? [];
  expect(handAfterPut).not.toContain(drawn);
});

test("Trade is one frame owed by both seats and exchanges one card each simultaneously", () => {
  const start = rawGenesis(4, "turn-trade");
  const active = activeSeat(start.state);
  let next = advance(start, (state, seat) =>
    seat === active ? { t: "move", to: "trade" } : null,
  );
  const partner = next.state.players.find((player) => player.seat !== active)?.seat;
  if (partner === undefined) throw new Error("no partner");
  next = advance(next, (state, seat) => (seat === active ? { t: "trade", target: partner } : null));
  expect(next.state.phase).toEqual({ kind: "trade-give", active, target: partner });
  expect(seatsOwedNow(next.state)).toEqual([active, partner]);
  const giverBefore = [...(next.state.players.find((p) => p.seat === active)?.hand ?? [])];
  const partnerBefore = [...(next.state.players.find((p) => p.seat === partner)?.hand ?? [])];
  next = advance(next, (state, seat) => {
    if (seat === active) return { t: "give", index: 0 };
    if (seat === partner) return { t: "give", index: 1 };
    return null;
  });
  const giverAfter = next.state.players.find((p) => p.seat === active)?.hand ?? [];
  const partnerAfter = next.state.players.find((p) => p.seat === partner)?.hand ?? [];
  expect(giverAfter).toContain(partnerBefore[1]);
  expect(partnerAfter).toContain(giverBefore[0]);
  expect(giverAfter.length).toBe(giverBefore.length);
  expect(partnerAfter.length).toBe(partnerBefore.length);
});

test("a failed Frame Attempt resumes the framer's Evidence Swap, then passes the turn", () => {
  let checkpoint = withScapegoat(rawGenesis(3, "turn-frame-fail"), ANN, BOB);
  checkpoint = withHands(checkpoint, [
    [ANN, ["goat-horns"]],
    [BOB, ["goat-herd"]],
    [CARA, ["goat-kid"]],
  ]);
  checkpoint = withPhase(checkpoint, { kind: "frame-reveal", active: ANN });
  let next = advance(checkpoint, () => ({ t: "reveal", index: 0 }));
  expect(next.state.phase).toEqual({ kind: "swap", active: ANN });
  expect(next.state.frame?.framed).toBeNull();
  next = advance(next, (state, seat) => (seat === ANN ? { t: "swap", index: 0 } : null));
  expect(next.state.phase.kind).toBe("move");
  expect(activeSeat(next.state)).not.toBe(ANN);
});

test("a successful Frame Attempt ends immediately with no swap", () => {
  let checkpoint = withScapegoat(rawGenesis(3, "turn-frame-success"), ANN, BOB);
  checkpoint = withHands(checkpoint, [
    [ANN, ["goat-tail"]],
    [BOB, ["goat-horns"]],
    [CARA, ["goat-beard"]],
  ]);
  checkpoint = withPhase(checkpoint, { kind: "frame-reveal", active: BOB });
  const next = stepState(checkpoint.state, [
    [ANN, { t: "reveal", index: 0 }],
    [BOB, { t: "reveal", index: 0 }],
    [CARA, { t: "reveal", index: 0 }],
  ]);
  expect(next.phase).toEqual({ kind: "over", outcome: { kind: "frame", actor: BOB, framed: ANN } });
  expect(scapeGoat.isTerminal(next)).toBe(true);
});

test("going to the Cops ends immediately with the scapegoat winning", () => {
  const start = withScapegoat(rawGenesis(4, "turn-cops"), BOB, CARA);
  const actor = activeSeat(start.state);
  const next = stepState(start.state, [[actor, { t: "move", to: "cops" }]]);
  expect(outcomeOf(next)).toEqual({ kind: "cops", actor });
  expect(scapeGoat.isTerminal(next)).toBe(true);
});

test("at six players the move phase owes the active seat and its antipode", () => {
  expect(SEATS6.length).toBe(6);
  const start = rawGenesis(6, "turn-six-owed");
  const active = activeSeat(start.state);
  const antipode = antipodeOf(start.state, active);
  expect(antipode).not.toBeNull();
  expect(seatsOwedNow(start.state)).toEqual([active, antipode]);
  expect(moveOwed(start.state, active)).toEqual([active, antipode]);
});

test("at six players the antipode may end the game by going to the Cops", () => {
  const start = withScapegoat(rawGenesis(6, "turn-six-antipode-cops"), ANN, BOB);
  const active = activeSeat(start.state);
  const antipode = antipodeOf(start.state, active);
  if (antipode === null) throw new Error("no antipode");
  const next = stepState(start.state, [[antipode, { t: "go-to-cops" }]]);
  expect(outcomeOf(next)).toEqual({ kind: "cops", actor: antipode });
});

test("at six players the antipode may idle and the turn proceeds normally", () => {
  const start = rawGenesis(6, "turn-six-antipode-idle");
  const active = activeSeat(start.state);
  const antipode = antipodeOf(start.state, active);
  if (antipode === null) throw new Error("no antipode");
  const next = stepState(start.state, [[active, { t: "move", to: "spy" }], [antipode, null]]);
  expect(next.phase).toEqual({ kind: "action", active, location: "spy" });
});

test("at three to five players the move phase owes exactly one seat", () => {
  for (const count of [3, 4, 5] as const) {
    const start = rawGenesis(count, `turn-one-owed-${count}`);
    const active = activeSeat(start.state);
    expect(seatsOwedNow(start.state)).toEqual([active]);
    expect(antipodeOf(start.state, active)).toBeNull();
  }
});

test("a seat that resigns out of the Stash-put window still returns the drawn card", () => {
  // The Stash action already drew a card into the drawer's hand, so the drawer
  // owes the row a card back. Skipping that step would leave the hand one over
  // and the Stash supply one short for the rest of the game, so a resigning seat
  // finishes the action it committed to before it leaves.
  const start = rawGenesis(4, "turn-resign-stash");
  const actor = activeSeat(start.state);
  const drawn = stepState(start.state, [[actor, { t: "move", to: "stash" }]]);
  const picked = stepState(drawn, [[actor, { t: "stash", slot: 0 }]]);
  expect(handOf(picked, actor).length).toBe(HAND_SIZE[4] + 1);
  const after = stepResign(picked, actor);
  expect(after.phase.kind).toBe("move");
  expect(handOf(after, actor).length).toBe(HAND_SIZE[4]);
  expect(after.stash.length).toBe(3);
  expect(seatsOwedNow(after).includes(actor)).toBe(false);
});

test("a card revealed in a failed attempt and later stashed survives only in the public faceUp", () => {
  // The reveal is public only for the turn that resolved it. `handTurn` clears the
  // frame record, so no view may still name the card as a reveal. The one place it
  // can appear is `faceUp.spy`, which the Evidence Swap made public by rule, and
  // never the Stash identity the card now sits in.
  let checkpoint = withScapegoat(rawGenesis(3, "turn-gap-frame-stash"), ANN, BOB);
  checkpoint = withHands(checkpoint, [
    [ANN, ["goat-horns"]],
    [BOB, ["goat-herd"]],
    [CARA, ["goat-kid"]],
  ]);
  checkpoint = withPhase(checkpoint, { kind: "frame-reveal", active: ANN });
  let next = advance(checkpoint, () => ({ t: "reveal", index: 0 }));
  next = advance(next, (state, seat) => (seat === ANN ? { t: "swap", index: 0 } : null));
  const actor = activeSeat(next.state);
  next = withHand(next, actor, ["goat-horns"]);
  next = withAt(next, actor, "spy");
  next = { ...next, state: stepState(next.state, [[actor, { t: "move", to: "stash" }]]) };
  next = { ...next, state: stepState(next.state, [[actor, { t: "stash", slot: 0 }]]) };
  const index = handOf(next.state, actor).indexOf(card("goat-horns"));
  next = { ...next, state: stepState(next.state, [[actor, { t: "put", index }]]) };
  expect(next.state.stash, "the revealed card is facedown in the Stash").toContain("goat-horns");
  for (const seat of [ANN, BOB, CARA]) {
    expect(project(next.state, seat).frame, `no frame record survives the turn for ${seat}`).toBeNull();
  }
  const view = project(next.state, CARA);
  expect(view.faceUp.spy, "the swap made the card public on faceUp.spy").toBe("goat-horns");
  const occurrences = JSON.stringify(view).split("goat-horns").length - 1;
  expect(occurrences, "the card appears exactly once, in the public faceUp").toBe(1);
});

test("the first player is the first-pass occupant of Prepare", () => {
  const entropy = "turn-first-player";
  const count = 5;
  const roster = makeRoster([ANN, BOB, CARA, DEE, EVE]);
  // Replay genesis' own shuffle order to learn the placement it used.
  const rng = makeRandom(genesisSeed(entropy));
  rng.shuffle(deckFor(count));
  const placement = rng.shuffle([ANN, BOB, CARA, DEE, EVE]);
  const start = rawGenesis(count, entropy);
  expect(activeSeat(start.state)).toBe(placement[0]);
  expect(start.state.players.find((player) => player.seat === placement[0])?.at).toBe("prepare");
  void roster;
});

test("the first player starts on Prepare at every count", () => {
  for (const count of [3, 4, 5, 6] as const) {
    const start = rawGenesis(count, `turn-first-prepare-${count}`);
    const active = activeSeat(start.state);
    expect(start.state.players.find((player) => player.seat === active)?.at).toBe("prepare");
  }
});

test("no player token begins on Go to the Cops, at every count", () => {
  for (const count of [3, 4, 5, 6] as const) {
    for (const seed of [0, 1, 2]) {
      const state = rawGenesis(count, `turn-placement-cops-${count}-${seed}`).state;
      for (const player of state.players) {
        expect(player.at, `${player.seat} does not start on the Cops at ${count} players`).not.toBe(
          "cops",
        );
      }
    }
  }
});

test("at 3 and 4 players every location carries exactly one token", () => {
  for (const count of [3, 4] as const) {
    const state = rawGenesis(count, `turn-placement-single-${count}`).state;
    expect(tokensPerLocation(state), `one token per location at ${count} players`).toEqual(
      Array.from({ length: count }, () => 1),
    );
  }
});

test("at 5 players the second pass doubles exactly one location", () => {
  const state = rawGenesis(5, "turn-placement-five").state;
  expect(tokensPerLocation(state), "one location holds two tokens, the rest one").toEqual([
    2, 1, 1, 1,
  ]);
});

test("at 6 players the second pass doubles exactly two locations", () => {
  const state = rawGenesis(6, "turn-placement-six").state;
  expect(tokensPerLocation(state), "two locations hold two tokens, the rest one").toEqual([
    2, 2, 1, 1,
  ]);
});

test("no location carries more than two tokens, at every count", () => {
  for (const count of [3, 4, 5, 6] as const) {
    const state = rawGenesis(count, `turn-placement-cap-${count}`).state;
    expect(
      Math.max(...tokensPerLocation(state)),
      `the rules cap a location at two tokens at ${count} players`,
    ).toBeLessThanOrEqual(2);
  }
});

const FRAME_CAP = 400;

const RESIGN_PHASES: readonly Phase[] = [
  { kind: "move", active: ANN },
  { kind: "action", active: ANN, location: "spy" },
  { kind: "trade-give", active: ANN, target: BOB },
  { kind: "stash-put", active: ANN },
  { kind: "frame-reveal", active: ANN },
  { kind: "swap", active: ANN },
];

test("a resign in every phase passes the turn to exactly the next seat, and the game still terminates", () => {
  for (const phase of RESIGN_PHASES) {
    const start = withPhase(rawGenesis(4, `turn-resign-${phase.kind}`), phase);
    const next = stepResign(start.state, ANN);
    expect(
      activeSeat(next),
      `the turn passes to the seat after the resigning one in the ${phase.kind} phase`,
    ).toBe(BOB);
    const { checkpoint } = playRaw({ ...start, state: next }, capThenCops(FRAME_CAP));
    expect(
      scapeGoat.isTerminal(checkpoint.state),
      `the game still terminates after a resign in the ${phase.kind} phase`,
    ).toBe(true);
  }
});

test("the six-player antipode may resign in the move phase and the active seat still moves", () => {
  const start = rawGenesis(6, "turn-antipode-resign");
  const active = activeSeat(start.state);
  const antipode = antipodeOf(start.state, active);
  if (antipode === null) throw new Error("no antipode");
  const here = atOf(start.state, active);
  const to = here === "spy" ? "trade" : "spy";
  const next = stepWith(start.state, 6, [
    [active, act({ t: "move", to })],
    [antipode, resign()],
  ]);
  expect(atOf(next, active), "the active seat still moved").toBe(to);
  expect(next.phase, "the active seat's action phase opens normally").toEqual({
    kind: "action",
    active,
    location: to,
  });
});

test("the six-player antipode's go-to-cops is coerced outside the move frame", () => {
  const phases: readonly Phase[] = [
    { kind: "action", active: ANN, location: "spy" },
    { kind: "swap", active: ANN },
  ];
  for (const phase of phases) {
    const state = { ...rawGenesis(6, `turn-offturn-cops-${phase.kind}`).state, phase };
    const antipode = antipodeOf(state, ANN);
    if (antipode === null) throw new Error("no antipode");
    const next = stepWith(state, 6, [[antipode, act({ t: "go-to-cops" })]]);
    expect(
      scapeGoat.isTerminal(next),
      `go-to-cops in the ${phase.kind} frame does not end the game`,
    ).toBe(false);
    expect(outcomeOf(next), `no outcome is declared in the ${phase.kind} frame`).toBeNull();
  }
});

test("a resigning active seat does not discard the six-player antipode's run to the Cops", () => {
  // The antipode's outside-turn run is not conditioned on the active seat acting,
  // so it must survive the active seat resigning out of the same move frame. The
  // scan for it runs before the resign short-circuit; a scan living inside stepMove
  // would drop it and silently cancel the scapegoat's win.
  const start = rawGenesis(6, "turn-antipode-cops-resign");
  const active = activeSeat(start.state);
  const antipode = antipodeOf(start.state, active);
  if (antipode === null) throw new Error("no antipode");
  const next = stepWith(start.state, 6, [
    [active, resign()],
    [antipode, act({ t: "go-to-cops" })],
  ]);
  expect(outcomeOf(next), "the antipode's run ends the game even though the active seat resigned").toEqual({
    kind: "cops",
    actor: antipode,
  });
  expect(scapeGoat.isTerminal(next), "the run to the Cops is terminal").toBe(true);
});

test("a move onto an occupied location is legal and both tokens share it", () => {
  const start = rawGenesis(4, "turn-occupied");
  const actor = activeSeat(start.state);
  const occupant = start.state.players.find((player) => player.seat !== actor);
  if (occupant === undefined) throw new Error("no other seat");
  const next = stepState(start.state, [[actor, { t: "move", to: occupant.at }]]);
  const sharing = next.players.filter((player) => player.at === occupant.at).map((p) => p.seat);
  expect(sharing, "the mover joins the token already there").toEqual([occupant.seat, actor]);
});

test("a seat holding only grey is the odd card out, so the attempt frames it", () => {
  const checkpoint = withScapegoat(
    atFrameReveal(3, BOB, [
      [ANN, ["goat-bystander"]],
      [BOB, ["goat-horns"]],
      [CARA, ["goat-beard"]],
    ], "turn-all-grey"),
    ANN,
    BOB,
  );
  const next = stepState(checkpoint.state, [
    [ANN, { t: "reveal", index: 0 }],
    [BOB, { t: "reveal", index: 0 }],
    [CARA, { t: "reveal", index: 0 }],
  ]);
  expect(next.frame?.framed, "the grey holder is the odd card out").toBe(ANN);
  expect(next.frame?.colour, "the colour the others share is red").toBe("red");
});

test("a seat with no legal pick fails the attempt rather than framing the silent seat", () => {
  const checkpoint = withScapegoat(
    atFrameReveal(3, BOB, [
      [ANN, []],
      [BOB, ["goat-horns"]],
      [CARA, ["goat-beard"]],
    ], "turn-no-pick"),
    ANN,
    BOB,
  );
  const next = stepState(checkpoint.state, [
    [ANN, { t: "reveal", index: 0 }],
    [BOB, { t: "reveal", index: 0 }],
    [CARA, { t: "reveal", index: 0 }],
  ]);
  expect(next.frame?.framed, "no seat is framed when a seat cannot pick").toBeNull();
  expect(next.phase, "the failed attempt resumes the framer's swap").toEqual({
    kind: "swap",
    active: BOB,
  });
});

interface WireState {
  readonly players: { hand: string[] }[];
  scapegoat: string;
  scapegoatSuspect: string;
  readonly [key: string]: Json;
}

const codecJson = (): WireState =>
  JSON.parse(
    JSON.stringify(stateCodec.encode(rawGenesis(4, "turn-codec-reject").state)),
  ) as WireState;

const CODEC_REJECTIONS: readonly (readonly [string, (json: WireState) => void])[] = [
  ["an unknown card id in a hand", (json) => { json.players[0]!.hand[0] = "definitely-not-a-card"; }],
  ["a scapegoat that is not a player", (json) => { json.scapegoat = "ghost"; }],
  ["a suspect that is not a player", (json) => { json.scapegoatSuspect = "ghost"; }],
  ["a scapegoat that suspects itself", (json) => { json.scapegoatSuspect = json.scapegoat; }],
  ["a card held in two places", (json) => { json.players[0]!.hand[0] = json.players[1]!.hand[0]!; }],
];

test("stateCodec.decode rejects every state that shape checking cannot", () => {
  for (const [what, mutate] of CODEC_REJECTIONS) {
    const json = codecJson();
    mutate(json);
    expect(() => stateCodec.decode(json), what).toThrow(ScapeGoatError);
  }
});

test("a table reduced below three seats ends abandoned with no winners", () => {
  let state = rawGenesis(4, "turn-abandoned").state;
  let guard = 0;
  while (activeSeats(state).length >= MIN_SEATS && guard < 10) {
    state = stepResign(state, seatsOwedNow(state)[0]!);
    guard += 1;
  }
  expect(scapeGoat.isTerminal(state), "the shrunk table is terminal").toBe(true);
  expect(seatsOwedNow(state), "a terminal table owes no seat").toEqual([]);
  expect(outcomeOf(state), "the outcome is abandoned").toEqual({ kind: "abandoned" });
  expect(winnersOf(state), "an abandoned table has no winners").toEqual([]);
  const view = project(state, ANN);
  expect(view.outcome?.kind, "the view carries the abandoned outcome").toBe("abandoned");
  expect(view.outcome?.winners, "the view names no winner").toEqual([]);
});
