import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  craftSet,
  openPurpose,
  rawHand,
  totalCards,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

/** A three-seat set whose Communications role is the one under test. */
const commsSet = (comms: RoleId): readonly RoleId[] => [
  "banker",
  comms,
  "guerrilla",
  "peacekeeper",
  "politician",
];

const record: RoleRecord = {
    hand: ["producer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["producer", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "producer-give", "keep", "turn"],
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "producer-give", "keep", "turn"],
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "producer-give", "keep", "turn"],
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("producer", record);

test("Producer: take a Court card and a target card, then return one to each", () => {
  let state = craftSet(commsSet("producer"), [[ANN, ["producer", "banker"]]], "producer-action");
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  // Bob chooses which card to give.
  expect(openPurpose(state)).toBe("producer-give");
  state = advance(state, (seat) => (seat === BOB ? { t: "give", index: 0 } : null));
  expect(openPurpose(state)).toBe("keep");
  // The Court draw plus Bob's given card sit in the actor's pool to filter.
  expect(state.draw?.pool).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2, 3] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Producer: the target blocks and the exchange is stopped", () => {
  let state = craftSet(commsSet("producer"), [[BOB, ["producer", "banker"]]], "producer-block");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "producer" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Producer: a one-card target is not eliminated mid-exchange", () => {
  const roles: readonly RoleId[] = ["banker", "producer", "guerrilla", "peacekeeper", "politician"];
  let state = craftSet(
    roles,
    [
      [ANN, ["producer", "banker"]],
      [BOB, ["banker"]],
    ],
    "producer-one",
  );
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "give", index: 0 } : null));
  // Bob is momentarily cardless mid-exchange but must not be eliminated.
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(state.players.find((p) => p.seat === BOB)?.revealed).toHaveLength(0);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2, 3] } : null));
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Producer: a successful challenge makes the claimant lose a life and the exchange fail", () => {
  let state = craftSet(commsSet("producer"), [[ANN, ["banker", "banker"]]], "producer-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Producer: a failed challenge costs the challenger a life, then the exchange opens", () => {
  let state = craftSet(commsSet("producer"), [[ANN, ["producer", "banker"]]], "producer-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "producer", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("block");
});
