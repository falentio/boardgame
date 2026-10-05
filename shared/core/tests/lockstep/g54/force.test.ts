import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  seatsOwedAt,
  withCoins,
  withHand,
  withPeacekeeping,
  withTreaty,
} from "./driver.ts";
import type { RoleId } from "./driver.ts";

/** A three-seat set whose Force role is the one under test. */
const forceSet = (force: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  force,
  "peacekeeper",
  "politician",
];

const pass = (): null => null;

test("Crime Boss: the target pays 2 to the claimant to end the action", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-pay"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("crime-pay");
  state = advance(state, (seat) => (seat === BOB ? { t: "pay" } : null));
  // Ann paid nothing to claim Crime Boss, so the target's 2 coins land on top.
  expect(rawCoins(state, ANN)).toBe(7);
  expect(rawCoins(state, BOB)).toBe(0);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(openPurpose(state)).toBe("turn");
});

test("Crime Boss: refusal costs the claimant 5 and the target a life", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-refuse"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "no" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Crime Boss: a target holding under 2 coins cannot pay, so the report is a refusal", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-short"),
    ANN,
    5,
  );
  state = withCoins(state, BOB, 1);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("crime-pay");
  // Bob holds only 1 coin, so his `pay` cannot cover 2 and is read as a refusal.
  state = advance(state, (seat) => (seat === BOB ? { t: "pay" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("Crime Boss: only the target may decide the pay window", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-only"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, pass);
  // Cara is not owed; her `pay` is ignored and the target's silence is a refusal.
  state = advance(state, (seat) => (seat === CARA ? { t: "pay" } : null));
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawCoins(state, BOB)).toBe(2);
});

test("Crime Boss: a successful challenge makes the claimant lose a life and the kill fail", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["banker", "banker"]]], "cb-lie"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Crime Boss: a failed challenge costs the challenger a life, then the pay window opens", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-true"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("crime-pay");
});

test("General: pay 5, every other player loses a life unless they block", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-hit"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  // Two block windows open, one per target, clockwise from Ann.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("General: a target who blocks with General keeps their life", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-block"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  // Bob blocks; Cara does not.
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "general" } : null));
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("General: two blockers each open their own challenge-block window and resolve independently", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-two-block"),
    ANN,
    5,
  );
  state = withHand(state, BOB, ["general", "banker"]);
  state = withHand(state, CARA, ["banker", "banker"]);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "general" } : null));
  expect(openPurpose(state)).toBe("challenge-block");
  // Each block is a stacked extra claim, so the two windows resolve one at a time.
  expect(state.extras.at(-1)?.blocker).toBe(BOB);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, (seat) => (seat === CARA ? { t: "block", role: "general" } : null));
  expect(openPurpose(state)).toBe("challenge-block");
  expect(state.extras.at(-1)?.blocker).toBe(CARA);
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "concede" } : null));
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(0);
});

test("General: a Peacekeeping holder is excluded and opens no block window", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-peace"),
    ANN,
    5,
  );
  state = withPeacekeeping(state, BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  // The Peacekeeping holder is never a target, so only Cara owes a block.
  expect(openPurpose(state)).toBe("block");
  expect(seatsOwedAt(state)).toEqual([CARA]);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("General: a Treaty ally is excluded and opens no block window", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-ally"),
    ANN,
    5,
  );
  state = withTreaty(state, [ANN, BOB]);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  // Only Cara is owed a block: Ann and Bob are allies, so Bob is not a target.
  expect(openPurpose(state)).toBe("block");
  expect(seatsOwedAt(state)).toEqual([CARA]);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("General: a successful challenge makes the claimant lose a life and the attack fail", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["banker", "banker"]]], "general-lie"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(2);
});

test("General: a failed challenge costs the challenger a life, then the attack lands", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-true"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  // The attack still resolves: both remaining targets lose a life.
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("Judge: give 3 to the target, who loses a life unless blocked", () => {
  let state = withCoins(
    craftSet(forceSet("judge"), [[ANN, ["judge", "banker"]]], "judge-hit"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "judge", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(rawCoins(state, BOB)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Judge: a block stops the kill and the target keeps the 3 coins", () => {
  let state = withCoins(
    craftSet(forceSet("judge"), [[BOB, ["judge", "banker"]]], "judge-block"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "judge", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "judge" } : null));
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(rawCoins(state, BOB)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Judge: a successful challenge costs the claimant a life but the target keeps the 3", () => {
  let state = withCoins(
    craftSet(forceSet("judge"), [[ANN, ["banker", "banker"]]], "judge-lie"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "judge", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Judge: a failed challenge costs the challenger a life, then the kill lands", () => {
  let state = withCoins(
    craftSet(forceSet("judge"), [[ANN, ["judge", "banker"]]], "judge-true"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "judge", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});

test("Mercenary: place a Disappear token that resolves after the target's next turn", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["mercenary", "banker"]]], "merc-place"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(1);
  expect(state.disappear[0]?.target).toBe(BOB);
  // The claim ended Ann's turn; Bob takes his full turn and the token fires at its end.
  expect(state.active).toBe(BOB);
  expect(rawHand(state, BOB)).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  // The reveal window for the token loss opens before Cara's turn.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.disappear).toHaveLength(0);
  expect(state.active).toBe(CARA);
});

test("Mercenary: the target blocks at placement and no token is placed", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[BOB, ["mercenary", "banker"]]], "merc-block"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "mercenary" } : null));
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(0);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("Mercenary: a successful challenge costs a life and no token is placed", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["banker", "banker"]]], "merc-lie"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.disappear).toHaveLength(0);
});

test("Mercenary: a failed challenge costs the challenger a life, then the token lands", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["mercenary", "banker"]]], "merc-true"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(1);
});

test("Paramilitary: a 2-life target costs 3, a 1-life target costs 5", () => {
  let full = withCoins(
    craftSet(forceSet("paramilitary"), [[ANN, ["paramilitary", "banker"]]], "para-2life"),
    ANN,
    5,
  );
  full = advance(full, (seat, s) =>
    seat === s.active ? { t: "claim", role: "paramilitary", target: BOB } : null,
  );
  full = advance(full, pass);
  full = advance(full, pass);
  full = advance(full, pass);
  expect(rawCoins(full, ANN)).toBe(2);
  expect(rawHand(full, BOB)).toHaveLength(1);

  let thin = withCoins(
    craftSet(
      forceSet("paramilitary"),
      [[ANN, ["paramilitary", "banker"]]],
      "para-1life",
    ),
    ANN,
    5,
  );
  thin = {
    ...thin,
    players: thin.players.map((p) => (p.seat === BOB ? { ...p, hand: ["banker"] } : p)),
  };
  thin = advance(thin, (seat, s) =>
    seat === s.active ? { t: "claim", role: "paramilitary", target: BOB } : null,
  );
  thin = advance(thin, pass);
  thin = advance(thin, pass);
  thin = advance(thin, pass);
  expect(rawCoins(thin, ANN)).toBe(0);
  expect(rawHand(thin, BOB)).toHaveLength(0);
});

test("Paramilitary: an unaffordable 1-life hit coerces to the fallback general action", () => {
  let state = withCoins(
    craftSet(forceSet("paramilitary"), [[ANN, ["paramilitary", "banker"]]], "para-short"),
    ANN,
    3,
  );
  state = {
    ...state,
    players: state.players.map((p) => (p.seat === BOB ? { ...p, hand: ["banker"] } : p)),
  };
  // 5 coins are needed for a 1-life target; Ann has 3, so the claim falls back to Income.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "paramilitary", target: BOB } : null,
  );
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Paramilitary: a block refunds nothing and spares the target", () => {
  let state = withCoins(
    craftSet(forceSet("paramilitary"), [[BOB, ["paramilitary", "banker"]]], "para-block"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "paramilitary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "paramilitary" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Anarchist: the Bomb lands and a silent holder loses a life; it returns to the centre", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-loss"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  // The claim is holdless: no challenge window, the Bomb window opens directly.
  expect(openPurpose(state)).toBe("bomb");
  expect(state.bomb).toEqual({ holder: BOB, prior: [ANN], move: null });
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(state.bomb).toBeNull();
});

test("Anarchist: a pass advances the chain and excludes every prior holder", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-pass"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  // A pass opens its own challenge window.
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("bomb");
  expect(state.bomb).toEqual({ holder: CARA, prior: [ANN, BOB], move: null });
  // Cara defuses; the Bomb returns to the centre.
  state = advance(state, (seat) => (seat === CARA ? { t: "claim", role: "anarchist", target: null } : null));
  state = advance(state, pass);
  expect(state.bomb).toBeNull();
  expect(openPurpose(state)).toBe("turn");
});

test("Anarchist: a truthful challenged pass costs the challenger a life and the Bomb moves on", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-show"),
    ANN,
    3,
  );
  state = withHand(state, BOB, ["anarchist", "banker"]);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  // Bob truthfully passes the Bomb to Cara; the pass opens its own challenge window.
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  state = advance(state, (seat) => (seat === BOB ? { t: "show" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  // The challenger pays a life; the shown pass stands and the Bomb continues to Cara.
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(openPurpose(state)).toBe("bomb");
  expect(state.bomb).toEqual({ holder: CARA, prior: [ANN, BOB], move: null });
});

test("Anarchist: the active player can never be named as the first Bomb target", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-self"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: ANN } : null,
  );
  // The self-target is illegal, so the claim falls back to Income.
  expect(rawCoins(state, ANN)).toBe(4);
  expect(state.bomb).toBeNull();
});

test("Anarchist: a caught pass is a double life loss and the Bomb clears", () => {
  let state = withCoins(
    craftSet(forceSet("anarchist"), [[ANN, ["anarchist", "banker"]]], "bomb-caught"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "anarchist", target: BOB } : null,
  );
  // Bob lies: he passes to Cara but holds no Anarchist.
  state = advance(state, (seat) => (seat === BOB ? { t: "claim", role: "anarchist", target: CARA } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  // The challenge loss lands, then the bomb window resolves the failed claim.
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(state.bomb).toBeNull();
});
