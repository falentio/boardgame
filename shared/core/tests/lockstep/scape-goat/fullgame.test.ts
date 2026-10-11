import { expect, test } from "vitest";
import {
  ANN,
  activeSeat,
  BOB,
  CARA,
  HAND_SIZE,
  cardId,
  cardsConserved,
  copsAction,
  driveRaw,
  grindAction,
  handSizes,
  outcomeOf,
  playRaw,
  prepTokensInPlay,
  rawGenesis,
  scapeGoat,
  seatsFor,
  stepState,
  winnersOf,
  withScapegoat,
  type Checkpoint,
  type FramePolicy,
  type PlayerCount,
  type ScapeGoatState,
} from "./driver.ts";

const COUNTS: readonly PlayerCount[] = [3, 4, 5, 6];

/**
 * The frame cap for the run-to-the-Cops fallback. At six players a two-card hand
 * can make a pure framing policy grind forever (the design's honest case: two
 * cards cannot always assemble the odd-one-out frame), so the policy runs to the
 * Cops once this many frames have been sealed. The bound sits far above the ~70
 * frames a normal game takes.
 */
const FRAME_CAP = 400;

const capThenCops = (cap: number): FramePolicy => (state, seat, frame) =>
  frame >= cap ? copsAction(state, seat) : grindAction(state, seat);

test("a policy drives every player count from 3 to 6 to terminal", () => {
  for (const count of COUNTS) {
    expect(seatsFor(count).length).toBe(count);
    const { checkpoint, steps } = playRaw(
      rawGenesis(count, `full-terminal-${count}`),
      capThenCops(FRAME_CAP),
    );
    expect(scapeGoat.isTerminal(checkpoint.state)).toBe(true);
    expect(steps).toBeLessThanOrEqual(FRAME_CAP + 1);
    expect(outcomeOf(checkpoint.state)).not.toBeNull();
  }
});

test("hand size is invariant at HAND_SIZE[count] after every frame", () => {
  for (const count of COUNTS) {
    let checkpoint = rawGenesis(count, `full-hands-${count}`);
    const expected = HAND_SIZE[count];
    let steps = 0;
    while (!scapeGoat.isTerminal(checkpoint.state) && steps < FRAME_CAP + 20) {
      for (const size of handSizes(checkpoint.state)) expect(size).toBe(expected);
      checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), steps);
      steps += 1;
    }
  }
});

test("exactly two preparation tokens exist in every committed state", () => {
  for (const count of COUNTS) {
    let checkpoint = rawGenesis(count, `full-tokens-${count}`);
    let steps = 0;
    while (!scapeGoat.isTerminal(checkpoint.state) && steps < FRAME_CAP + 20) {
      expect(prepTokensInPlay(checkpoint.state)).toBe(2);
      checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), steps);
      steps += 1;
    }
    expect(prepTokensInPlay(checkpoint.state)).toBe(2);
  }
});

test("card conservation holds after every frame", () => {
  for (const count of COUNTS) {
    let checkpoint = rawGenesis(count, `full-conserve-${count}`);
    let steps = 0;
    while (!scapeGoat.isTerminal(checkpoint.state) && steps < FRAME_CAP + 20) {
      expect(cardsConserved(checkpoint.state, count)).toBe(true);
      checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), steps);
      steps += 1;
    }
    expect(cardsConserved(checkpoint.state, count)).toBe(true);
  }
});

test("a policy that runs to the Cops as a fallback terminates within the documented cap", () => {
  for (const count of COUNTS) {
    const { checkpoint, steps } = playRaw(
      rawGenesis(count, `full-bound-${count}`),
      capThenCops(FRAME_CAP),
    );
    expect(scapeGoat.isTerminal(checkpoint.state)).toBe(true);
    expect(steps).toBeLessThanOrEqual(FRAME_CAP + 1);
  }
});

test("the run-to-the-Cops fallback is necessary: a pure framing policy grinds past the cap at six players", () => {
  // The honest case the design names: two-card hands at six players cannot always
  // assemble the odd-one-out frame, so a policy that only frames never reaches
  // terminal within the cap. This is why the policy must run to the Cops as a
  // fallback.
  const pure: FramePolicy = (state, seat) => grindAction(state, seat);
  const { checkpoint, steps } = playRaw(rawGenesis(6, "grind-c"), pure, FRAME_CAP);
  expect(scapeGoat.isTerminal(checkpoint.state)).toBe(false);
  expect(steps).toBe(FRAME_CAP);
});

const withFrameReveal = (
  checkpoint: Checkpoint<ScapeGoatState>,
  framer: typeof ANN,
  hands: readonly (readonly [typeof ANN, readonly string[]])[],
): ScapeGoatState => {
  const players = checkpoint.state.players.map((player) => {
    const hand = hands.find(([seat]) => seat === player.seat)?.[1];
    return hand === undefined ? player : { ...player, hand: hand.map((id) => cardId(id)) };
  });
  return stepState(
    { ...checkpoint.state, players, phase: { kind: "frame-reveal", active: framer } },
    players.map((player) => [player.seat, { t: "reveal" as const, index: 0 }]),
  );
};

test("a policy that frames the true scapegoat wins the table", () => {
  const start = withScapegoat(rawGenesis(3, "full-frame-win"), ANN, BOB);
  const next = withFrameReveal(start, BOB, [
    [ANN, ["goat-tail"]],
    [BOB, ["goat-horns"]],
    [CARA, ["goat-beard"]],
  ]);
  expect(outcomeOf(next)).toEqual({ kind: "frame", actor: BOB, framed: ANN });
  expect(winnersOf(next)).toEqual([BOB, CARA]);
});

test("a policy that frames the wrong seat loses, handing the win to the scapegoat", () => {
  const start = withScapegoat(rawGenesis(3, "full-frame-lose"), ANN, BOB);
  const next = withFrameReveal(start, ANN, [
    [ANN, ["goat-horns"]],
    [BOB, ["goat-tail"]],
    [CARA, ["goat-beard"]],
  ]);
  expect(outcomeOf(next)).toEqual({ kind: "frame", actor: ANN, framed: BOB });
  expect(winnersOf(next)).toEqual([ANN]);
});

test("a policy that runs to the Cops hands the win to the scapegoat", () => {
  const start = withScapegoat(rawGenesis(4, "full-cops-win"), BOB, CARA);
  const actor = activeSeat(start.state);
  const next = stepState(start.state, [[actor, { t: "move", to: "cops" }]]);
  expect(outcomeOf(next)).toEqual({ kind: "cops", actor });
  expect(winnersOf(next)).toEqual([BOB]);
});
