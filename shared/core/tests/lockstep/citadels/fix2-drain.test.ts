import { expect, test } from "vitest";
import { citadels } from "../../../lockstep/games/citadels/index.ts";
import {
  BASE_CAST_IDS,
  SEATS3,
  advance,
  autoAction,
  rawGenesis,
  type CitadelsAction,
  type CitadelsState,
} from "./driver.ts";

/**
 * V2-1 folded-game proof. With `drain` asking `windowOwed` instead of `owedFor`,
 * a real base-cast game opens the Assassin's or Thief's `choose-character` window
 * and records a kill or a rob. Before the fix `drain` pops the empty-seat "any"
 * window before anyone can answer it, so no marker is ever set.
 *
 * The per-character counterexamples in verification2.test.ts pin the same fix on
 * a hand-drained window; this folds the whole game with the driver's always-legal
 * `autoAction` for every non-naming window, so it also proves the game still
 * reaches terminal with the naming sub-machine live.
 */
test("a folded base-cast game opens a naming window and records a kill or rob", () => {
  let state = rawGenesis(SEATS3, BASE_CAST_IDS, "v2-naming-fold");
  const namingPolicy = (seat: string, s: CitadelsState): CitadelsAction | null => {
    const view = citadels.project(s, seat);
    const w = view.window;
    if (w === null) return null;
    if (w.purpose === "choose-character") {
      const target = view.cast.find((id) => id !== "assassin");
      return target === undefined ? null : { t: "name-character", character: target };
    }
    return autoAction(seat, view);
  };
  const purposes = new Set<string>();
  let named = false;
  for (let frames = 0; frames < 5000 && !citadels.isTerminal(state); frames += 1) {
    if (
      state.skipped.length > 0 ||
      (state.robbed ?? null) !== null ||
      (state.bewitched ?? null) !== null
    ) {
      named = true;
    }
    const top = state.steps[0];
    if (top !== undefined && top.kind === "window") purposes.add(top.window.purpose);
    state = advance(state, namingPolicy);
  }
  expect(citadels.isTerminal(state)).toBe(true);
  expect(named, "the folded game records a kill, rob, or bewitch").toBe(true);
  expect(
    [...purposes].some((p) => p === "choose-character" || p === "choose-seat" || p === "choose-type"),
    "a naming window surfaces through the engine",
  ).toBe(true);
});
