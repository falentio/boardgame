import { expect, test } from "vitest";
import {
  ANN,
  CARA,
  advance,
  openPurpose,
  rawHand,
  withHands,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

const record: RoleRecord = {
    hand: ["director", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "keep", "turn"],
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "keep", "turn"],
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("director", record);

test("Director: draw 2 from the Court, return any 2", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "director-action");
  const courtBefore = state.court.length;
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("keep");
  const pool = state.draw?.pool ?? [];
  expect(pool).toHaveLength(2);
  // Keep the two drawn cards: the hand becomes exactly the pool.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2, 3] } : null));
  expect(rawHand(state, ANN)).toEqual([...pool]);
  // Two drawn and two returned leaves the Court the same size.
  expect(state.court.length).toBe(courtBefore);
  expect(openPurpose(state)).toBe("turn");
});

test("Director: a successful challenge stops the swap and costs a life", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "director-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(openPurpose(state)).toBe("turn");
});

test("Director: a failed challenge costs the challenger a life, then the swap resolves", () => {
  let state = withHands([[ANN, ["director", "banker"]]], "director-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  // The Director swap then opens its keep window.
  expect(openPurpose(state)).toBe("keep");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0, 1] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
});
