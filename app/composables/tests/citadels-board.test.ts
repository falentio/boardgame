import { expect, test } from "vitest";
import {
  act,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  type Frame,
} from "#shared/core/lockstep/index.ts";
import {
  BASE_CAST,
  citadels,
  type CitadelsAction,
  type CitadelsView,
} from "#shared/core/lockstep/games/citadels/index.ts";
import { seatId, type SeatId } from "#shared/rooms/ids.ts";
import { citadelsBoardOf, phaseLabel, purposeLabel } from "../citadels-board.ts";

const ANN = seatId("ann");
const BOB = seatId("bob");
const CARA = seatId("cara");
const SEATS = [ANN, BOB, CARA];
const SEED = genesisSeed("citadels-board-tests");

const genesis = () => citadels.genesis({ cast: [...BASE_CAST] }, makeRoster(SEATS), makeRandom(SEED));

const view = (seat: SeatId = ANN): CitadelsView => citadels.project(genesis(), seat);

/** A real projection with one field replaced, so an unreachable state is still honestly shaped. */
const withView = (base: CitadelsView, patch: Partial<CitadelsView>): CitadelsView => ({
  ...base,
  ...patch,
});

const names = (): ReadonlyMap<SeatId, string> =>
  new Map([
    [ANN, "Ada"],
    [BOB, "Bo"],
    [CARA, "Cy"],
  ]);

const platesOf = (board: ReturnType<typeof citadelsBoardOf>) => [board.me, ...board.opponents];

test("the table starts with the viewer's own seat, then runs clockwise", () => {
  const board = citadelsBoardOf(view(BOB), names());
  expect(board.me.seat).toBe(BOB);
  expect(board.me.kind).toBe("me");
  expect(board.opponents.map((seat) => seat.seat)).toEqual([CARA, ANN]);
});

test("the viewer's plate carries cards where a rival's carries a count", () => {
  const projected = view(ANN);
  const board = citadelsBoardOf(projected, names());
  expect(board.me.hand).toEqual(projected.myHand);
  expect(board.me.hand).toHaveLength(4);
  expect(board.me.cityTarget).toBe(8);
  for (const rival of board.opponents) {
    expect(rival.kind).toBe("rival");
    expect(rival.handCount).toBe(
      projected.players.find((player) => player.seat === rival.seat)?.handCount,
    );
    expect("hand" in rival).toBe(false);
  }
});

test("a city narrows to the district id and its placed gold, with no catalog copy", () => {
  const projected = view(ANN);
  const built = projected.players.map((player) =>
    player.seat === ANN
      ? { ...player, city: [{ id: "tavern", gold: 3 }, { id: "keep", gold: 0 }] }
      : player,
  );
  const board = citadelsBoardOf(withView(projected, { players: built }), names());
  expect(board.me.city).toEqual([
    { id: "tavern", gold: 3 },
    { id: "keep", gold: 0 },
  ]);
});

test("the crown, the active seat, and who still owes input come from the view", () => {
  const projected = view(ANN);
  const board = citadelsBoardOf(projected, names());
  const plates = platesOf(board);
  expect(plates.filter((seat) => seat.crown).map((seat) => seat.seat)).toEqual([projected.crown]);
  expect(plates.filter((seat) => seat.active).map((seat) => seat.seat)).toEqual([projected.active]);
  const owed = plates.filter((seat) => seat.owed).map((seat) => seat.seat);
  expect(owed).toEqual(projected.owedSeats);
});

test("the window names its purpose and whether the viewer owes it", () => {
  const mine = citadelsBoardOf(view(ANN), names());
  expect(mine.window?.purpose).toBe("draft-pick");
  expect(mine.window?.label).toBe("Pick a character");
  expect(mine.window?.owedByMe).toBe(true);
  const theirs = citadelsBoardOf(view(CARA), names());
  expect(theirs.window?.owedByMe).toBe(false);
});

test("the cast marks the faceup discards, the viewer's own pick, and the card in flight", () => {
  const base = view(ANN);
  const faceup = base.cast[0];
  const picked = base.cast[1];
  const inFlight = base.cast[2];
  if (faceup === undefined || picked === undefined || inFlight === undefined) {
    throw new Error("the base cast is too small for this test");
  }
  const board = citadelsBoardOf(
    withView(base, {
      faceup: [faceup],
      myPick: picked,
      pending: { actor: BOB, character: inFlight, target: ANN, cards: 2 },
    }),
    names(),
  );
  const stateOf = (character: string) =>
    board.cast.find((slot) => slot.character === character)?.state;
  expect(stateOf(inFlight)).toBe("pending");
  expect(stateOf(picked)).toBe("mine");
  expect(stateOf(faceup)).toBe("faceup");
  expect(board.cast.filter((slot) => slot.state === "available")).toHaveLength(5);
});

test("the cast carries each character's name and rank", () => {
  const board = citadelsBoardOf(view(ANN), names());
  expect(board.cast.map((slot) => slot.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(board.cast.map((slot) => slot.name)).toContain("Assassin");
  expect(board.cast.length).toBeGreaterThan(0);
});

test("the pending action names the actor, the character, and the target", () => {
  const board = citadelsBoardOf(
    withView(view(ANN), { pending: { actor: BOB, character: "assassin", target: ANN, cards: 3 } }),
    names(),
  );
  expect(board.pending).toEqual({
    actor: BOB,
    actorName: "Bo",
    character: "assassin",
    characterName: "Assassin",
    target: ANN,
    targetName: "Ada",
    cards: 3,
  });
});

test("a pending action without a character or a target reports both as absent", () => {
  const board = citadelsBoardOf(
    withView(view(ANN), { pending: { actor: BOB, character: null, target: null, cards: 0 } }),
    names(),
  );
  expect(board.pending?.characterName).toBeNull();
  expect(board.pending?.targetName).toBeNull();
});

test("the table carries the round, the public counts, and the discard", () => {
  const projected = view(ANN);
  const board = citadelsBoardOf(projected, names());
  expect(board.round).toBe(projected.round);
  expect(board.phase).toBe("draft");
  expect(board.phaseLabel).toBe("Draft");
  expect(board.deckCount).toBe(projected.deckCount);
  expect(board.discard).toEqual(projected.discard);
  expect(board.terminal).toBe(false);
  expect(board.winner).toBeNull();
});

test("a terminal board names the winner", () => {
  const board = citadelsBoardOf(
    withView(view(ANN), { terminal: true, winner: BOB }),
    names(),
  );
  expect(board.terminal).toBe(true);
  expect(board.winner).toEqual({ seat: BOB, name: "Bo" });
});

test("a seat missing from the roster map falls back to its id", () => {
  const board = citadelsBoardOf(view(ANN), new Map());
  expect(platesOf(board).map((seat) => seat.name)).toEqual([ANN, BOB, CARA]);
});

test("a draft pick reaches the board as the viewer's own pick", () => {
  const state = genesis();
  const first = citadels.project(state, ANN);
  const picker = first.owedSeats[0];
  const named = first.cast[1];
  if (picker === undefined || named === undefined) {
    throw new Error("the seeded draft has no picker or no second character");
  }
  const frame: Frame<CitadelsAction> = {
    index: frameIndex(0),
    seed: SEED,
    inputs: [[picker, act<CitadelsAction>({ t: "pick", character: named })]],
  };
  const stepped = citadels.project(citadels.step(state, frame, makeRandom(SEED)), picker);
  const picked = stepped.myPick;
  if (picked === null) throw new Error("the pick window closed without a pick");
  const board = citadelsBoardOf(stepped, names());
  expect(board.myPick).toBe(picked);
  expect(board.cast.find((slot) => slot.character === picked)?.state).toBe("mine");
});

test("purposeLabel names every window purpose in the engine's union", () => {
  const purposes: readonly string[] = [
    "draft-pick",
    "turn",
    "keep",
    "choose-character",
    "choose-seat",
    "choose-type",
    "magician-swap",
    "magician-discard",
    "seer-give",
    "seer-receive",
    "emperor-crown",
    "abbot-split",
    "cardinal-gold",
    "wizard-take",
    "diplomat-exchange",
    "marshal-seize",
    "artist-beautify",
    "magistrate-confiscate",
    "blackmailer-resolve",
    "scholar-keep",
    "trader-build",
    "warlord-destroy",
    "tax-collect",
    "witch-resume",
    "queen-income",
    "thief-rob",
    "witch-takeover",
    "blackmailer-threat",
    "armory-destroy",
    "theatre-swap",
  ];
  expect(purposes).toHaveLength(30);
  for (const purpose of purposes) {
    const label = purposeLabel(purpose as Parameters<typeof purposeLabel>[0]);
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe(purpose);
  }
  expect(purposeLabel("thief-rob")).toBe("Rob a player");
  expect(purposeLabel("armory-destroy")).toBe("Destroy a district");
});

test("phaseLabel covers every engine phase", () => {
  expect(phaseLabel("draft")).toBe("Draft");
  expect(phaseLabel("turn")).toBe("Turn");
  expect(phaseLabel("over")).toBe("Game over");
});
