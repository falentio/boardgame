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
import {
  citadelsBoardOf,
  citadelsPurposeLabel,
  phaseLabel,
  type CitadelsBoard,
} from "../citadels-board.ts";
import { windowChoiceValue } from "../window-choices.ts";
import {
  advance,
  autoAction,
  autoStep,
  castWith,
  dealFor,
  openPurpose,
  rawHand,
  type CitadelsState,
  type CharacterId,
} from "../../../shared/core/tests/lockstep/citadels/driver.ts";
import { specOfDistrict } from "#shared/core/lockstep/games/citadels/districts.ts";
import { destroyPrice } from "#shared/core/lockstep/games/citadels/characters/warlord.ts";
import { greatWallToll } from "#shared/core/lockstep/games/citadels/districts/great-wall.ts";

const ANN = seatId("ann");
const BOB = seatId("bob");
const CARA = seatId("cara");
const SEATS = [ANN, BOB, CARA];
const SEED = genesisSeed("citadels-board-tests");

const genesis = () =>
  citadels.genesis({ cast: [...BASE_CAST] }, makeRoster(SEATS), makeRandom(SEED));

const view = (seat: SeatId = ANN): CitadelsView => citadels.project(genesis(), seat);

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

test("the players rail carries every seat, the viewer's own first", () => {
  const board = citadelsBoardOf(view(BOB), names());
  expect(board.seats.map((seat) => seat.seat)).toEqual([BOB, CARA, ANN]);
  expect(board.seats.map((seat) => seat.kind)).toEqual(["me", "rival", "rival"]);
  expect(board.seats[0]).toBe(board.me);
  expect(board.seats.at(-1)?.name).toBe("Ada");
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
      ? {
          ...player,
          city: [
            { id: "tavern", gold: 3 },
            { id: "keep", gold: 0 },
          ],
        }
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
  expect(mine.table.window?.purpose).toBe("draft-pick");
  expect(mine.table.window?.label).toBe("Pick a character");
  expect(mine.table.window?.owedByMe).toBe(true);
  const theirs = citadelsBoardOf(view(CARA), names());
  expect(theirs.table.window?.owedByMe).toBe(false);
});

/** Fold the real draft until the viewer has picked and a public discard is up. */
const midDraft = (): CitadelsState => {
  let folded = genesis();
  for (let i = 0; i < 60; i += 1) {
    const mine = citadels.project(folded, ANN);
    if (mine.myPick !== null && mine.faceup.length > 0) return folded;
    folded = autoStep(folded);
  }
  throw new Error("no draft pick in 60 frames");
};

/** Fold the real round until a character's turn is in flight. */
const inFlightTurn = (): CitadelsState => {
  let folded = genesis();
  for (let i = 0; i < 4000; i += 1) {
    const pending = folded.pending;
    if (openPurpose(folded) === "turn" && pending !== null && pending.character !== null) {
      return folded;
    }
    folded = autoStep(folded);
  }
  throw new Error("no turn with a character in flight in 4000 frames");
};

const castStateIn = (board: CitadelsBoard, character: CharacterId) =>
  board.table.cast.find((slot) => slot.character === character)?.state;

test("a real draft's cast marks the faceup discard and the viewer's own pick", () => {
  const state = midDraft();
  const mine = citadels.project(state, ANN);
  const board = citadelsBoardOf(mine, names());
  const faceup = mine.faceup[0];
  const picked = mine.myPick;
  if (faceup === undefined || picked === null) {
    throw new Error("the draft lost its public discard or the viewer's pick");
  }
  expect(castStateIn(board, faceup)).toBe("faceup");
  expect(castStateIn(board, picked)).toBe("mine");
  expect(board.table.cast.filter((slot) => slot.state === "available")).toHaveLength(
    mine.cast.length - 2,
  );
  expect(board.table.pending).toBeNull();
});

test("a real turn's cast marks the character in flight", () => {
  const state = inFlightTurn();
  const inFlight = state.pending?.character ?? null;
  if (inFlight === null) throw new Error("the fold reached no character in flight");
  const board = citadelsBoardOf(citadels.project(state, ANN), names());
  expect(castStateIn(board, inFlight)).toBe("pending");
  expect(board.table.cast.filter((slot) => slot.state === "available")).toHaveLength(
    state.cast.length - 1,
  );
  // A turn has no draft, so `myPick` and `faceup` are empty and neither "mine"
  // nor "faceup" can share a cast with "pending".
  expect(board.table.myPick).toBeNull();
  expect(board.table.cast.filter((slot) => slot.state === "faceup")).toHaveLength(0);
});

test("the cast carries each character's name and rank", () => {
  const board = citadelsBoardOf(view(ANN), names());
  expect(board.table.cast.map((slot) => slot.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(board.table.cast.map((slot) => slot.name)).toContain("Assassin");
  expect(board.table.cast.length).toBeGreaterThan(0);
});

test("the pending action names the actor, the character, and the target", () => {
  const board = citadelsBoardOf(
    withView(view(ANN), { pending: { actor: BOB, character: "assassin", target: ANN, cards: 3 } }),
    names(),
  );
  expect(board.table.pending).toEqual({
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
  expect(board.table.pending?.characterName).toBeNull();
  expect(board.table.pending?.targetName).toBeNull();
});

test("the table carries the round, the public counts, and the discard", () => {
  const projected = view(ANN);
  const board = citadelsBoardOf(projected, names());
  expect(board.table.round).toBe(projected.round);
  expect(board.table.phase).toBe("draft");
  expect(board.table.phaseLabel).toBe("Draft");
  expect(board.table.deckCount).toBe(projected.deckCount);
  expect(board.table.discard).toEqual(projected.discard);
  expect(board.table.terminal).toBe(false);
  expect(board.table.winner).toBeNull();
});

test("a terminal board names the winner", () => {
  const board = citadelsBoardOf(withView(view(ANN), { terminal: true, winner: BOB }), names());
  expect(board.table.terminal).toBe(true);
  expect(board.table.winner).toEqual({ seat: BOB, name: "Bo" });
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
  expect(board.table.myPick).toBe(picked);
  expect(board.table.cast.find((slot) => slot.character === picked)?.state).toBe("mine");
});

test("citadelsPurposeLabel names every window purpose in the engine's union", () => {
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
    const label = citadelsPurposeLabel(purpose as Parameters<typeof citadelsPurposeLabel>[0]);
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe(purpose);
  }
  expect(citadelsPurposeLabel("thief-rob")).toBe("Rob a player");
  expect(citadelsPurposeLabel("armory-destroy")).toBe("Destroy a district");
});

test("phaseLabel covers every engine phase", () => {
  expect(phaseLabel("draft")).toBe("Draft");
  expect(phaseLabel("turn")).toBe("Turn");
  expect(phaseLabel("over")).toBe("Game over");
});

const foldedToKeep = (): { readonly state: ReturnType<typeof genesis>; readonly owner: SeatId } => {
  let state = genesis();
  for (let i = 0; i < 4000; i += 1) {
    const pending = state.pending;
    if (openPurpose(state) === "keep" && pending !== null && pending.cards.length === 2) {
      return { state, owner: pending.actor };
    }
    state = autoStep(state);
  }
  throw new Error("no gather keep in 4000 frames");
};

test("the drawn pool reaches only the seat that owes the keep window", () => {
  const { state, owner } = foldedToKeep();
  const pool = state.pending?.cards ?? [];
  const mine = citadels.project(state, owner);
  expect(pool).toHaveLength(2);
  expect(mine.window?.purpose).toBe("keep");
  expect(mine.owedSeats).toEqual([owner]);
  expect(mine.myDraw).toEqual(pool);
  for (const rival of SEATS.filter((seat) => seat !== owner)) {
    expect(citadels.project(state, rival).myDraw).toEqual([]);
  }
});

test("the keep surface shows the drawn pair to its owner and nothing to a rival", () => {
  const { state, owner } = foldedToKeep();
  const pool = state.pending?.cards ?? [];
  const rival = SEATS.find((seat) => seat !== owner);
  if (rival === undefined) throw new Error("no rival seat");
  const mine = citadelsBoardOf(citadels.project(state, owner), names());
  expect(mine.table.window).toEqual({
    purpose: "keep",
    label: "Keep a card",
    owedByMe: true,
    choices: [],
  });
  expect(mine.table.drawn).toEqual(pool);
  expect(citadelsBoardOf(citadels.project(state, rival), names()).table.drawn).toEqual([]);
});
const answeringSeat = (state: CitadelsState): SeatId => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no window open");
  return top.window.kind === "any"
    ? (state.pending?.actor ?? state.active)
    : (top.window.seats[0] ?? state.active);
};

/** The engine's own always-legal policy, read against a folded state. */
const auto = (seat: SeatId, state: CitadelsState): CitadelsAction | null =>
  autoAction(seat, citadels.project(state, seat));

interface FoldOptions {
  readonly cast?: readonly CharacterId[];
  readonly wanted?: Readonly<Record<string, CharacterId>>;
  readonly decide?: (seat: SeatId, state: CitadelsState) => CitadelsAction | null;
  readonly until?: (state: CitadelsState) => boolean;
}

/** Fold real frames from a real deal until `purpose` is the window at the top. */
const foldTo = (purpose: string, options: FoldOptions = {}): CitadelsState => {
  const decide = options.decide ?? auto;
  const ready = options.until ?? ((): boolean => true);
  let state =
    options.wanted === undefined
      ? genesis()
      : dealFor(
          options.cast ?? BASE_CAST,
          SEATS,
          options.wanted,
          undefined,
          `fold-${purpose}`,
        );
  for (let i = 0; i < 4000; i += 1) {
    if (openPurpose(state) === purpose && ready(state)) return state;
    state = advance(state, decide);
  }
  throw new Error(`the engine reached no ${purpose} window in 4000 frames`);
};

const choicesAt = (state: CitadelsState) =>
  citadelsBoardOf(citadels.project(state, answeringSeat(state)), names()).table.window?.choices ??
  [];

const withCast = (character: CharacterId) => ({ cast: castWith(character), wanted: { [ANN]: character } });

test("a choose-character window offers every cast character the rule leaves nameable", () => {
  const state = foldTo("choose-character");
  const choices = choicesAt(state);
  expect(state.cast.filter((id) => id !== "assassin")).toContain("thief");
  expect(choices.map((choice) => choice.kind)).toEqual(["character", "character", "character", "character", "character", "character", "character"]);
  expect(choices.map((choice) => choice.action)).toEqual(
    state.cast
      .filter((id) => id !== "assassin")
      .map((character) => ({ t: "name-character", character })),
  );
  expect(choices.map((choice) => choice.label)).toContain("Thief");
});

test("a choose-seat window offers the rival seats and never the viewer's own", () => {
  const state = foldTo("choose-seat", withCast("spy"));
  const actor = answeringSeat(state);
  const choices = choicesAt(state);
  expect(choices.map((choice) => choice.kind)).toEqual(["seat", "seat"]);
  expect(choices.map((choice) => choice.action)).toEqual(
    SEATS.filter((seat) => seat !== actor).map((seat) => ({ t: "target", seat })),
  );
});

/** Answer the Spy's choose-seat pass with a rival, so the type window below it opens. */
const spySeat = (seat: SeatId, state: CitadelsState): CitadelsAction | null => {
  if (openPurpose(state) === "choose-seat") {
    const rival = SEATS.find((candidate) => candidate !== seat);
    return rival === undefined ? null : { t: "target", seat: rival };
  }
  return auto(seat, state);
};

test("a choose-type window offers the district types the catalog declares", () => {
  const state = foldTo("choose-type", { ...withCast("spy"), decide: spySeat });
  const choices = choicesAt(state);
  expect(choices.map((choice) => choice.kind)).toEqual(["type", "type", "type", "type", "type"]);
  expect([...choices.map((choice) => choice.label)].sort()).toEqual([
    "military",
    "noble",
    "religious",
    "trade",
    "unique",
  ]);
  expect(choices.every((choice) => choice.action.t === "name-type")).toBe(true);
});

test("a magician-discard window offers the viewer's own hand by index, then a stop", () => {
  const state = foldTo("magician-discard", withCast("magician"));
  const actor = answeringSeat(state);
  const hand = rawHand(state, actor);
  const choices = choicesAt(state);
  expect(choices.slice(0, hand.length).map((choice) => choice.action)).toEqual(
    hand.map((_, index) => ({ t: "keep", index })),
  );
  expect(choices.at(-1)).toEqual({
    action: { t: "pass" },
    label: "END",
    kind: "confirm",
    note: null,
  });
  expect(choices).toHaveLength(hand.length + 1);
});

test("a warlord-destroy window offers the target city's districts, the Keep aside", () => {
  const state = foldTo("warlord-destroy", {
    ...withCast("warlord"),
    decide: (seat, folded) => {
      if (openPurpose(folded) === "warlord-destroy" && folded.pending?.target === null) {
        const pick = folded.players
          .filter((player) => player.seat !== seat)
          .sort((a, b) => b.city.length - a.city.length)[0];
        return pick === undefined || pick.city.length === 0
          ? { t: "pass" }
          : { t: "target", seat: pick.seat };
      }
      return auto(seat, folded);
    },
    until: (folded) => folded.pending?.target !== null,
  });
  const target = state.pending?.target ?? null;
  const city = state.players.find((player) => player.seat === target)?.city ?? [];
  const actor = answeringSeat(state);
  const purse = state.players.find((player) => player.seat === actor)?.gold ?? 0;
  const choices = choicesAt(state);
  const expected = city
    .map((district, index) => ({ district, index }))
    .filter(({ district }) => district.id !== "keep")
    .map(({ district, index }) => ({
      index,
      district,
      price: destroyPrice(district.id, district.gold) + greatWallToll(city),
    }))
    .filter(({ price }) => price <= purse);
  expect(city.length).toBeGreaterThan(0);
  expect(expected.length).toBeGreaterThan(0);
  expect(choices.map((choice) => choice.action)).toEqual(
    expected.map(({ index }) => ({ t: "keep", index })),
  );
  expect(choices.map((choice) => choice.kind)).toEqual(expected.map(() => "district"));
  expect(choices.map((choice) => choice.note)).toEqual(expected.map(({ price }) => String(price)));
});

test("a trader-build window offers the trade districts in hand, then a stop", () => {
  const state = foldTo("trader-build", withCast("trader"));
  const actor = answeringSeat(state);
  const trade = rawHand(state, actor)
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => specOfDistrict(id).type === "trade");
  const choices = choicesAt(state);
  expect(choices.slice(0, trade.length).map((choice) => choice.action)).toEqual(
    trade.map(({ index }) => ({ t: "build", card: index })),
  );
  expect(choices.map((choice) => choice.kind).slice(0, trade.length)).toEqual(
    trade.map(() => "district"),
  );
  expect(choices.at(-1)?.label).toBe("STOP");
});

test("the windows the turn bar and the keep surface own carry no choices", () => {
  const draft = citadelsBoardOf(view(ANN), names());
  expect(draft.table.window?.purpose).toBe("draft-pick");
  expect(draft.table.window?.choices).toEqual([]);
  const { state } = foldedToKeep();
  const owner = state.pending?.actor ?? ANN;
  expect(citadelsBoardOf(citadels.project(state, owner), names()).table.window?.choices).toEqual([]);
});

test("an any window offers nothing to a seat whose report the resolver ignores", () => {
  const state = foldTo("choose-character");
  const actor = answeringSeat(state);
  const rival = SEATS.find((seat) => seat !== actor);
  if (rival === undefined) throw new Error("no rival seat");
  const theirs = citadelsBoardOf(citadels.project(state, rival), names());
  expect(theirs.table.window?.owedByMe).toBe(true);
  expect(theirs.table.window?.choices).toEqual([]);
  expect(choicesAt(state).length).toBeGreaterThan(0);
});

test("an owed window that leaves no choice keeps a bare confirm so the game can advance", () => {
  const state = foldTo("tax-collect", withCast("tax-collector"));
  expect(choicesAt(state)).toEqual([
    { action: { t: "gold" }, label: "TAKE TOKEN", kind: "confirm", note: null },
    { action: { t: "pass" }, label: "LEAVE IT", kind: "confirm", note: null },
  ]);
});

test("windowChoiceValue reads the value an assertion wants off each kind of choice", () => {
  expect(windowChoiceValue({ action: { t: "target", seat: BOB }, label: "Bo", kind: "seat", note: null })).toBe("bob");
  expect(
    windowChoiceValue({ action: { t: "keep", index: 3 }, label: "Tavern", kind: "district", note: null }),
  ).toBe("3");
  expect(
    windowChoiceValue({ action: { t: "pass" }, label: "END", kind: "confirm", note: null }),
  ).toBe("pass");
});
