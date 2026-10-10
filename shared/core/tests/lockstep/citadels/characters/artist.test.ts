import { expect, test } from "vitest";
import { act, idle, type SeatId } from "../../../../index.ts";
import { artist, artistResolve } from "../../../../lockstep/games/citadels/characters/artist.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import type {
  CitadelsAction,
  CitadelsState,
  Window,
} from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  rawFrame,
  rawGenesis,
  rawGold,
  rawRandom,
  withGold,
} from "../driver.ts";

const ARTIST_CAST: readonly CharacterId[] = [...BASE_CAST_IDS, "artist"];

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const artistState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, ARTIST_CAST),
  claimed: [{ seat: ANN, character: "artist" }],
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

const topWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

const resolve = (state: CitadelsState, action: CitadelsAction | null): CitadelsState =>
  artistResolve({
    state,
    window: topWindow(state),
    frame: rawFrame(0, [[ANN, action === null ? idle<CitadelsAction>() : act(action)]]),
    rng: rawRandom(),
  });

/** The window the Artist's own effect opens. */
const opened = (state: CitadelsState): CitadelsState => {
  const next = artist(ctxFor(state));
  expect(next.steps[0]).toMatchObject({ kind: "window", window: { purpose: "artist-beautify" } });
  return next;
};

const cityGold = (state: CitadelsState, seat: SeatId): readonly number[] =>
  (state.players.find((p) => p.seat === seat)?.city ?? []).map((district) => district.gold);

test("beautify up to two of your districts by placing one gold from your stash on each", () => {
  const state = withCity(artistState(), ANN, ["manor", "castle", "tavern"]);
  const first = resolve(opened(state), { t: "keep", index: 0 });
  expect(cityGold(first, ANN)).toEqual([1, 0, 0]);
  expect(rawGold(first, ANN)).toBe(rawGold(state, ANN) - 1);
  const second = resolve(first, { t: "keep", index: 1 });
  expect(cityGold(second, ANN)).toEqual([1, 1, 0]);
  expect(rawGold(second, ANN)).toBe(rawGold(state, ANN) - 2);
  expect(second.steps).toHaveLength(0);
});

test("you may beautify fewer than two districts and stop", () => {
  const state = withCity(artistState(), ANN, ["manor", "castle"]);
  const first = resolve(opened(state), { t: "keep", index: 0 });
  expect(topWindow(first).purpose).toBe("artist-beautify");
  const stopped = resolve(first, { t: "pass" });
  expect(cityGold(stopped, ANN)).toEqual([1, 0]);
  expect(rawGold(stopped, ANN)).toBe(rawGold(state, ANN) - 1);
  expect(stopped.steps).toHaveLength(0);
});

test("placing a gold requires one gold in your stash", () => {
  const state = withGold(withCity(artistState(), ANN, ["manor"]), ANN, 0);
  const next = artist(ctxFor(state));
  expect(next.steps).toHaveLength(0);
  expect(cityGold(next, ANN)).toEqual([0]);
});

test("a beautified district's cost is permanently increased by one", () => {
  const state = withCity(artistState(), ANN, ["manor"]);
  const next = resolve(opened(state), { t: "keep", index: 0 });
  // The marker on the placed district is the permanent +1 cost the engine reads at scoring and destroy time.
  expect(cityGold(next, ANN)).toEqual([1]);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) - 1);
});

test("each district can be beautified only once", () => {
  const state = withCity(artistState(), ANN, ["manor", "castle"]);
  const first = resolve(opened(state), { t: "keep", index: 0 });
  const again = resolve(first, { t: "keep", index: 0 });
  expect(cityGold(again, ANN)).toEqual([1, 0]);
  expect(rawGold(again, ANN)).toBe(rawGold(state, ANN) - 1);
  expect(again.steps).toHaveLength(0);
});

test("the ability is not a no-op: it moves gold from your stash onto a district", () => {
  const state = withCity(artistState(), ANN, ["manor"]);
  const before = rawGold(state, ANN);
  const next = resolve(opened(state), { t: "keep", index: 0 });
  expect(cityGold(next, ANN)[0]).toBe(1);
  expect(rawGold(next, ANN)).toBe(before - 1);
});
