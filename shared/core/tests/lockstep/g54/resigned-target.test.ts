import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  type RoleId,
} from "./driver.ts";
import { priestTargetable, targetable } from "../../../lockstep/games/g54/helpers.ts";

const SET: readonly RoleId[] = ["banker", "director", "guerrilla", "politician", "priest"];

test("a resigned seat is not targetable by a role claim, even while holding cards", () => {
  const state = { ...craftSet(SET, [], "resigned-target-predicate"), resigned: [BOB] };
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(targetable(state, ANN, BOB)).toBe(false);
  expect(priestTargetable(state, ANN, BOB)).toBe(false);
});

test("a role claim on a resigned target falls back to the always-legal general action", () => {
  const state = { ...craftSet(SET, [], "resigned-target-claim"), resigned: [BOB] };
  const after = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  // The illegal target is coerced to Income: Ann gains 1, Bob keeps his coins,
  // and no challenge window opens on the resigned seat.
  expect(rawCoins(after, ANN)).toBe(3);
  expect(rawCoins(after, BOB)).toBe(2);
  expect(openPurpose(after)).toBe("turn");
});
