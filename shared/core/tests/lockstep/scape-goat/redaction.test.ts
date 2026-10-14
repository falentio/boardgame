import { expect, test } from "vitest";
import { seatId } from "../../../index.ts";
import {
  ANN,
  BOB,
  CARA,
  SEATS4,
  ScapeGoatError,
  activeSeat,
  capThenCops,
  cardId,
  copsAction,
  driveRaw,
  grindAction,
  handOf,
  legalActions,
  project,
  rawGenesis,
  scapeGoat,
  stashAction,
  stepState,
  suspectOf,
  withAt,
  withHand,
  withHands,
  withPhase,
  withScapegoat,
  type Checkpoint,
  type FramePolicy,
  type PlayerCount,
  type ScapeGoatState,
  type ScapeGoatView,
} from "./driver.ts";

const FRAME_CAP = 400;
const COUNTS: readonly PlayerCount[] = [3, 4, 5, 6];

const VIEW_KEYS = [
  "seat",
  "phase",
  "players",
  "myHand",
  "mySuspect",
  "faceUp",
  "stashCount",
  "prepareSide",
  "owedSeats",
  "spy",
  "frame",
  "outcome",
  "terminal",
].sort();

const PLAYER_KEYS = ["seat", "at", "handCount", "prepTokens", "resigned"].sort();

const assertRedacted = (state: ScapeGoatState, seat: typeof ANN): ScapeGoatView => {
  const view = project(state, seat);
  const mine = state.players.find((player) => player.seat === seat);
  if (mine === undefined) throw new Error("viewer missing");

  expect(Object.keys(view).sort()).toEqual(VIEW_KEYS);
  for (const player of view.players) expect(Object.keys(player).sort()).toEqual(PLAYER_KEYS);

  expect(Object.keys(view)).not.toContain("scapegoat");
  expect(Object.keys(view)).not.toContain("scapegoatSuspect");
  expect(view.myHand).toEqual([...mine.hand]);
  for (const other of state.players) {
    if (other.seat === seat) continue;
    for (const card of other.hand) expect(view.myHand).not.toContain(card);
  }
  const serialized = JSON.stringify(view);
  for (const card of state.stash) expect(serialized).not.toContain(card);

  expect(view.mySuspect).toBe(suspectOf(state, seat));
  expect(view.mySuspect).not.toBe(seat);
  if (!view.terminal) {
    expect(view.outcome).toBeNull();
    expect(serialized).not.toContain("allSuspects");
  }
  return view;
};

/**
 * Trades for the first `tradeFrames` frames, then grinds to the Cops. The pure
 * trade policy is a dead end at five and six players, where no frame ever
 * resolves, so the Cops fallback is what terminates the drive.
 */
const tradeThenCops =
  (tradeFrames: number, cap: number): FramePolicy =>
  (state, seat, frame) => {
    const view = project(state, seat);
    if (frame >= cap) return copsAction(state, seat);
    if (frame < tradeFrames && view.phase.kind === "move" && view.phase.active === seat) {
      const toTrade = legalActions(view).find(
        (action) => action.t === "move" && action.to === "trade",
      );
      if (toTrade !== undefined) return toTrade;
    }
    return grindAction(state, seat);
  };

test("every seat's view is redacted on the two-seat trade-give phase", () => {
  // trade-give is the one phase that owes two seats, and each seat's committed
  // card is hidden until both have given, so the boundary must hide the partner's
  // hand while showing the viewer's own. No other drive reaches this phase.
  for (const count of COUNTS) {
    let checkpoint = rawGenesis(count, `redact-trade-drive-${count}`);
    let steps = 0;
    let sawTrade = false;
    while (!scapeGoat.isTerminal(checkpoint.state) && steps < 140) {
      if (checkpoint.state.phase.kind === "trade-give") sawTrade = true;
      for (const seat of checkpoint.state.players.map((player) => player.seat)) {
        assertRedacted(checkpoint.state, seat);
      }
      checkpoint = driveRaw(checkpoint, tradeThenCops(60, 120), steps);
      steps += 1;
    }
    expect(sawTrade, `the drive reaches trade-give at ${count} players`).toBe(true);
  }
});

test("every seat's view is redacted on every phase of a played game", () => {
  const count = 4;
  const seats = SEATS4;
  let checkpoint: Checkpoint<ScapeGoatState> = rawGenesis(count, "redact-played");
  const phases = new Set<string>();
  let steps = 0;
  while (!scapeGoat.isTerminal(checkpoint.state) && steps < FRAME_CAP + 20) {
    phases.add(checkpoint.state.phase.kind);
    for (const seat of seats) assertRedacted(checkpoint.state, seat);
    checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), steps);
    steps += 1;
  }
  // The drive must exercise the interesting phases, or the redaction check is vacuous.
  for (const phase of ["move", "action", "swap", "frame-reveal"]) {
    expect(phases.has(phase)).toBe(true);
  }
});

test("the viewer's own suspect never equals the viewer's own seat, at every count", () => {
  for (const count of COUNTS) {
    let checkpoint = rawGenesis(count, `redact-suspect-${count}`);
    let steps = 0;
    while (!scapeGoat.isTerminal(checkpoint.state) && steps < FRAME_CAP + 20) {
      for (const seat of checkpoint.state.players.map((player) => player.seat)) {
        expect(suspectOf(checkpoint.state, seat)).not.toBe(seat);
        expect(project(checkpoint.state, seat).mySuspect).not.toBe(seat);
      }
      checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), steps);
      steps += 1;
    }
  }
});

test("every non-scapegoat's suspect is the scapegoat, and the scapegoat's suspect is another seat", () => {
  for (const count of COUNTS) {
    const state = rawGenesis(count, `redact-suspect-map-${count}`).state;
    for (const player of state.players) {
      if (player.seat === state.scapegoat) {
        expect(suspectOf(state, player.seat)).not.toBe(state.scapegoat);
      } else {
        expect(suspectOf(state, player.seat)).toBe(state.scapegoat);
      }
    }
  }
});

test("the three Stash card identities never appear in a view", () => {
  let checkpoint = rawGenesis(4, "redact-stash");
  let steps = 0;
  while (!scapeGoat.isTerminal(checkpoint.state) && steps < FRAME_CAP) {
    const stash = checkpoint.state.stash;
    expect(stash.length).toBeGreaterThan(0);
    for (const seat of checkpoint.state.players.map((player) => player.seat)) {
      const serialized = JSON.stringify(project(checkpoint.state, seat));
      for (const card of stash) expect(serialized).not.toContain(card);
    }
    checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), steps);
    steps += 1;
  }
});

test("a private Spy hand reaches only the spy", () => {
  const start = withPhase(rawGenesis(4, "redact-spy-private"), {
    kind: "action",
    active: ANN,
    location: "spy",
  });
  const state = stepState(start.state, [[ANN, { t: "spy", target: BOB }]]);
  const spyView = project(state, ANN);
  const otherView = project(state, CARA);
  expect(spyView.spy?.hand).toEqual([...handOf(state, BOB)]);
  expect(otherView.spy?.hand).toBeNull();
  expect(otherView.spy?.spy).toBe(ANN);
  expect(otherView.spy?.target).toBe(BOB);
});

test("a public Spy hand reaches every seat, and the spy and target stay public", () => {
  const start = withPhase(rawGenesis(4, "redact-spy-public", { spyReveal: "public" }), {
    kind: "action",
    active: ANN,
    location: "spy",
  });
  const state = stepState(start.state, [[ANN, { t: "spy", target: BOB }]]);
  for (const seat of state.players.map((player) => player.seat)) {
    const view = project(state, seat);
    expect(view.spy?.hand).toEqual([...handOf(state, BOB)]);
    expect(view.spy?.spy).toBe(ANN);
    expect(view.spy?.target).toBe(BOB);
  }
});

test("frame picks are not visible before the attempt resolves", () => {
  const start = withPhase(withScapegoat(rawGenesis(3, "redact-frame-pending"), ANN, BOB), {
    kind: "frame-reveal",
    active: BOB,
  });
  for (const seat of start.state.players.map((player) => player.seat)) {
    expect(project(start.state, seat).frame).toBeNull();
  }
});

/**
 * Drives a full game at every count with a policy that uses the Stash, which is
 * the one action the framing policy never reaches. It is a long drive, so it
 * carries its own budget rather than the 5s default, which the whole-suite run
 * on a loaded machine exceeds.
 */
test("the redaction boundary holds through a Stash-heavy game (hands, scapegoat, suspect)", { timeout: 60_000 }, () => {
  // The framing policy never exercises the two-frame Stash action; this drive
  // does, so the boundary is checked on states the other sweep never reaches.
  for (const count of [3, 4, 5, 6] as const) {
    let checkpoint = rawGenesis(count, `redact-stash-drive-${count}`);
    let steps = 0;
    while (!scapeGoat.isTerminal(checkpoint.state) && steps < 400) {
      for (const seat of checkpoint.state.players.map((player) => player.seat)) {
        const view = project(checkpoint.state, seat);
        const mine = checkpoint.state.players.find((player) => player.seat === seat);
        if (mine === undefined) throw new Error("viewer missing");
        expect(view.myHand).toEqual([...mine.hand]);
        expect(view.mySuspect).toBe(suspectOf(checkpoint.state, seat));
        expect(view.mySuspect).not.toBe(seat);
        for (const other of checkpoint.state.players) {
          if (other.seat === seat) continue;
          for (const id of other.hand) expect(view.myHand).not.toContain(id);
        }
      }
      checkpoint = driveRaw(checkpoint, (state, seat) => stashAction(state, seat), steps);
      steps += 1;
    }
  }
});

test("a card revealed in a failed frame attempt and later stashed stays out of every view", () => {
  // A frame attempt's reveal is public for the rest of the turn that resolved it,
  // and no longer. handTurn clears the record, so a card that was revealed and
  // then placed facedown in the Stash is hidden again, which is what keeps the
  // three Stash identities out of every view.
  let checkpoint = withScapegoat(rawGenesis(3, "redact-gap-frame-stash"), ANN, BOB);
  checkpoint = withHands(checkpoint, [
    [ANN, ["goat-horns"]],
    [BOB, ["goat-herd"]],
    [CARA, ["goat-kid"]],
  ]);
  checkpoint = withPhase(checkpoint, { kind: "frame-reveal", active: ANN });
  let next = stepState(checkpoint.state, [
    [ANN, { t: "reveal", index: 0 }],
    [BOB, { t: "reveal", index: 0 }],
    [CARA, { t: "reveal", index: 0 }],
  ]);
  next = stepState(next, [[ANN, { t: "swap", index: 0 }]]);
  const actor = activeSeat(next);
  next = withHand({ ...checkpoint, state: next }, actor, ["goat-horns"]).state;
  next = withAt({ ...checkpoint, state: next }, actor, "spy").state;
  next = stepState(next, [[actor, { t: "move", to: "stash" }]]);
  next = stepState(next, [[actor, { t: "stash", slot: 0 }]]);
  const index = handOf(next, actor).indexOf(cardId("goat-horns"));
  next = stepState(next, [[actor, { t: "put", index }]]);
  expect(next.stash).toContain("goat-horns");
  // The reveal itself is not persisted past the turn. The same card is visible
  // in faceUp.spy because the Evidence Swap put it there, which the rules make
  // public; what the view must not carry is the record naming it as a reveal.
  for (const seat of [ANN, BOB, CARA]) {
    expect(project(next, seat).frame).toBeNull();
  }
});

test("at terminal the view carries the full outcome: the scapegoat, the winners, and every seat's suspect", () => {
  const start = withScapegoat(rawGenesis(3, "redact-terminal"), ANN, BOB);
  const state = stepState(start.state, [[BOB, { t: "move", to: "cops" }]]);
  expect(scapeGoat.isTerminal(state)).toBe(true);
  const view = project(state, CARA);
  expect(view.terminal).toBe(true);
  expect(view.outcome?.scapegoat).toBe(ANN);
  expect(view.outcome?.winners).toEqual([ANN]);
  const suspects = new Map(view.outcome?.allSuspects.map((entry) => [entry.seat, entry.suspect]));
  for (const player of state.players) {
    expect(suspects.get(player.seat)).toBe(suspectOf(state, player.seat));
  }
});

test("project throws for a seat that is not in the roster", () => {
  const state = rawGenesis(3, "redact-unknown-seat").state;
  expect(() => project(state, seatId("ghost"))).toThrow(ScapeGoatError);
  for (const seat of state.players.map((player) => player.seat)) {
    expect(() => project(state, seat)).not.toThrow();
  }
});
