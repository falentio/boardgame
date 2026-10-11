import { expect, test } from "vitest";
import { genesisSeed, makeRandom, makeRoster } from "../../../index.ts";
import {
  ANN,
  BOB,
  CARA,
  DEE,
  EVE,
  HAND_SIZE,
  SEATS6,
  activeSeat,
  antipodeOf,
  cardId,
  deckFor,
  handOf,
  moveOwed,
  outcomeOf,
  project,
  rawGenesis,
  scapeGoat,
  seatsOwedNow,
  stepResign,
  stepState,
  withAt,
  withHand,
  withHands,
  withPhase,
  withPrep,
  withPrepareTokens,
  withScapegoat,
  type Checkpoint,
  type SeatId,
  type ScapeGoatAction,
  type ScapeGoatState,
} from "./driver.ts";

const card = cardId;

/** Advance one frame, resolving each owed seat through `decide`. */
const advance = (
  checkpoint: Checkpoint<ScapeGoatState>,
  decide: (state: ScapeGoatState, seat: SeatId) => ScapeGoatAction | null,
): Checkpoint<ScapeGoatState> => {
  const inputs = seatsOwedNow(checkpoint.state).map(
    (seat): readonly [SeatId, ScapeGoatAction | null] => [seat, decide(checkpoint.state, seat)],
  );
  return { ...checkpoint, state: stepState(checkpoint.state, inputs) };
};

/** Move the active seat to `to`, then run the action, then a swap, in three frames. */
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

// --- the three-step turn ---------------------------------------------------

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

// --- Prepare ---------------------------------------------------------------

test("Prepare takes one token per visit and flips to Frame/Steal when the second goes", () => {
  // Two separate seats each visit Prepare once. The card holds two tokens, so the
  // second visit flips it. The first active seat is moved off Prepare first, since
  // a seat may not stay put.
  const first = withHand(rawGenesis(4, "turn-prepare"), ANN, [card("goat-horns")]);
  // The active seat starts on Prepare; move it off first, since it may not stay put.
  let checkpoint = withAt(first, activeSeat(first.state), "spy");
  let next = walkTurn(checkpoint, "prepare", { t: "take-prep-token" }, { t: "swap", index: 0 });
  expect(next.state.prepareTokens).toBe(1);
  const second = activeSeat(next.state);
  expect(second).not.toBe(activeSeat(first.state));
  // The next active seat takes the second token; the card flips.
  next = withAt(withHand(next, second, [card("goat-horns")]), second, "spy");
  next = walkTurn(next, "prepare", { t: "take-prep-token" }, { t: "swap", index: 0 });
  expect(next.state.prepareTokens).toBe(0);
});

test("the flipped Prepare offers Frame when the actor holds a token, Steal otherwise", () => {
  let checkpoint = withPrepareTokens(rawGenesis(4, "turn-flip-menu"), 0);
  checkpoint = withHand(checkpoint, ANN, [card("goat-horns")]);
  // Actor holds a token -> the menu is Frame only.
  let holder = withPrep(checkpoint, ANN, 1);
  holder = withPhase(holder, { kind: "action", active: ANN, location: "prepare" });
  const frame = stepState(holder.state, [[ANN, { t: "frame" }]]);
  expect(frame.phase).toEqual({ kind: "frame-reveal", active: ANN });
  // Actor holds none and another does -> Steal.
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

// --- Stash -----------------------------------------------------------------

test("Stash is two frames: the taken card enters the hand, then one hand card replaces it in the row", () => {
  const start = rawGenesis(4, "turn-stash");
  const active = activeSeat(start.state);
  let next = advance(start, (state, seat) =>
    seat === active ? { t: "move", to: "stash" } : null,
  );
  const stashBefore = [...next.state.stash];
  const handBefore = next.state.players.find((player) => player.seat === active)?.hand ?? [];
  // Pick slot 1.
  next = advance(next, (state, seat) => (seat === active ? { t: "stash", slot: 1 } : null));
  expect(next.state.phase).toEqual({ kind: "stash-put", active });
  const drawn = stashBefore[1]!;
  const handAfterPick = next.state.players.find((player) => player.seat === active)?.hand ?? [];
  expect(handAfterPick).toContain(drawn);
  expect(handAfterPick.length).toBe(handBefore.length + 1);
  // Put back the very card just drawn (the last hand index).
  const drawnIndex = handAfterPick.indexOf(drawn);
  next = advance(next, (state, seat) =>
    seat === active ? { t: "put", index: drawnIndex } : null,
  );
  expect(next.state.phase).toEqual({ kind: "swap", active });
  expect(next.state.stash).toContain(drawn);
  const handAfterPut = next.state.players.find((player) => player.seat === active)?.hand ?? [];
  expect(handAfterPut).not.toContain(drawn);
});

// --- Trade -----------------------------------------------------------------

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

// --- Frame Attempt ---------------------------------------------------------

test("a failed Frame Attempt resumes the framer's Evidence Swap, then passes the turn", () => {
  // All three reveal a card carrying red, so there is no odd card out.
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
  // The framer then swaps and the turn passes.
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

// --- Cops ------------------------------------------------------------------

test("going to the Cops ends immediately with the scapegoat winning", () => {
  const start = withScapegoat(rawGenesis(4, "turn-cops"), BOB, CARA);
  const actor = activeSeat(start.state);
  const next = stepState(start.state, [[actor, { t: "move", to: "cops" }]]);
  expect(outcomeOf(next)).toEqual({ kind: "cops", actor });
  expect(scapeGoat.isTerminal(next)).toBe(true);
});

// --- six-player pre-empt ---------------------------------------------------

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

// --- documented rule gaps --------------------------------------------------

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

test("DOCUMENTED GAP: a revealed card later put in the Stash is still named by the persisted frame record", () => {
  // `handTurn` clears the spy record but not the frame record, and the view
  // carries `frame` whole. A card revealed in a failed attempt and later placed
  // in the Stash is still named in every seat's view, so a hidden Stash identity
  // appears in a view.
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
  expect(next.state.stash).toContain("goat-horns");
  const view = project(next.state, BOB);
  expect(JSON.stringify(view)).toContain("goat-horns");
});

// --- first player ----------------------------------------------------------

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
