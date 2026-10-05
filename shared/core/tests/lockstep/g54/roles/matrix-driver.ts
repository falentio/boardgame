/**
 * Shared machinery for the per-role matrix tests under `roles/{category}/{role}.test.ts`.
 *
 * Each role file declares its own `RoleRecord` (or `ReactiveRecord`) and calls
 * `describeMatrix` / `describeReactiveMatrix`, which runs the generic claim-shape
 * driver and self-checks the record against the role's spec. The records live in the
 * role files, not here, so the oracle can enumerate the files on disk without
 * executing them (importing a `.test.ts` re-runs its tests).
 */
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
  withBank,
  withCoins,
  withCourt,
  type G54Action,
  type G54State,
  type RoleId,
} from "../driver.ts";
import { isHoldless, specOf, type RoleSpec } from "../../../../lockstep/games/g54/roles.ts";
import { g54 } from "../../../../lockstep/games/g54/index.ts";
import type { SeatId } from "../../../../index.ts";

export type Scenario = "resolve" | "lie" | "truth" | "block" | "blockLie" | "blockTruth";
export type SeatKey = "ann" | "bob" | "cara";

export interface Expectation {
  /** Window purposes observed after the seeded trigger window, in order. */
  readonly purposes: readonly string[];
  /** Coin delta per seat. */
  readonly coins?: Partial<Record<SeatKey, number>>;
  /** Face-down hand-size delta per seat. */
  readonly hands?: Partial<Record<SeatKey, number>>;
  /** Absolute count of Disappear tokens left in play. */
  readonly disappear?: number;
  /** The `turns` value on each Disappear token left in play, in order. */
  readonly disappearTurns?: readonly number[];
  /** Absolute treaty pair. */
  readonly treaty?: readonly SeatId[];
  /** Absolute Tax mark. */
  readonly tax?: { readonly role: RoleId; readonly holder: SeatId } | null;
  /** Absolute Peacekeeping holder. */
  readonly peacekeeping?: SeatId | null;
  /** Absolute Bank pile after the fold. */
  readonly bank?: number;
}

export interface RoleRecord {
  /** ANN's hand for the truthful scenarios. */
  readonly hand: readonly RoleId[];
  /** ANN's hand for the conceded ("lie"/"blockLie") scenarios. */
  readonly lieHand: readonly RoleId[];
  /** ANN's seed coins. */
  readonly coins: number;
  /** BOB's seed coins (default 2). */
  readonly bobCoins?: number;
  /** CARA's seed coins (default 2). */
  readonly caraCoins?: number;
  /** CARA's seed coins in the block scenarios (default `caraCoins`). */
  readonly blockCaraCoins?: number;
  /** The claim target, or null for untargeted roles. */
  readonly target: SeatId | null;
  /** The role named in the claim (Arms Dealer), or undefined. */
  readonly named?: RoleId;
  /** The seed Bank pile (Financier). */
  readonly bank?: number;
  /** A forced Court order for the scenario (Arms Dealer). */
  readonly court?: readonly RoleId[];
  /** BOB's hand for the "blockTruth" scenario (must hold the block role). */
  readonly blockHand: readonly RoleId[];
  /** A seat that funds a Protestor kill in the block scenarios. */
  readonly blockFunder?: SeatKey;
  readonly expect: Readonly<Partial<Record<Scenario, Expectation>>>;
}

export interface ReactiveRecord {
  /** The claimant's hand for the resolve/truth scenarios. */
  readonly hand: readonly RoleId[];
  /** The claimant's hand for the lie scenario. */
  readonly lieHand: readonly RoleId[];
  readonly expect: Readonly<Record<"resolve" | "lie" | "truth", Expectation>>;
}

const SEATS: Readonly<Record<SeatKey, SeatId>> = { ann: ANN, bob: BOB, cara: CARA };
export const seatOf = (key: SeatKey): SeatId => SEATS[key];

/** A three-card filler hand that never contains the role under test. */
export const OTHER_HAND: readonly RoleId[] = ["banker", "banker", "banker"];

export const pass = (): null => null;

/**
 * The scenarios a role's record must declare. A holdless role (Anarchist) opens
 * no challenge window, so its `lie`/`truth` cells are degenerate and only
 * `resolve` is forced; a blockable role adds the three block cells.
 */
export const scenariosFor = (spec: RoleSpec): readonly Scenario[] =>
  isHoldless(spec)
    ? ["resolve"]
    : spec.blockRole !== null
      ? ["resolve", "lie", "truth", "block", "blockLie", "blockTruth"]
      : ["resolve", "lie", "truth"];

/** A legal 1/1/1/2 set whose category slot is filled by the role under test. */
export const setFor = (role: RoleId): readonly RoleId[] => {
  const cat = specOf(role).category;
  const specials: RoleId[] =
    cat === "special-interest"
      ? [role, role === "politician" ? "peacekeeper" : "politician"]
      : ["politician", "peacekeeper"];
  return [
    cat === "finance" ? role : "banker",
    cat === "communications" ? role : "director",
    cat === "force" ? role : "guerrilla",
    ...specials,
  ];
};

export const reactiveSet = (role: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  role,
  "politician",
];

interface Observed {
  readonly purposes: readonly string[];
  readonly coins: Readonly<Record<SeatKey, number>>;
  readonly hands: Readonly<Record<SeatKey, number>>;
  readonly disappear: number;
  readonly disappearTurns: readonly number[];
  readonly treaty: readonly SeatId[];
  readonly tax: { readonly role: RoleId; readonly holder: SeatId } | null;
  readonly peacekeeping: SeatId | null;
  readonly bank: number;
}

const coinDelta = (before: G54State, after: G54State, seat: SeatId): number =>
  rawCoins(after, seat) - rawCoins(before, seat);

const handDelta = (before: G54State, after: G54State, seat: SeatId): number =>
  rawHand(after, seat).length - rawHand(before, seat).length;

const observe = (before: G54State, after: G54State, purposes: readonly string[]): Observed => ({
  purposes,
  coins: {
    ann: coinDelta(before, after, ANN),
    bob: coinDelta(before, after, BOB),
    cara: coinDelta(before, after, CARA),
  },
  hands: {
    ann: handDelta(before, after, ANN),
    bob: handDelta(before, after, BOB),
    cara: handDelta(before, after, CARA),
  },
  disappear: after.disappear.length,
  disappearTurns: after.disappear.map((token) => token.turns),
  treaty: [...after.treaty],
  tax: after.tax === null ? null : { role: after.tax.role, holder: after.tax.holder },
  peacekeeping: after.peacekeeping,
  bank: after.bank,
});

/**
 * Fold the window stack until the next `turn` window (or terminal), recording every
 * window purpose it passes. The seed's own top window is consumed by the first
 * `advance`, so the recorded sequence begins at the first post-seed window.
 */
export const foldToTurn = (
  state: G54State,
  decide: (seat: SeatId, s: G54State) => G54Action | null,
): { readonly state: G54State; readonly purposes: readonly string[] } => {
  const purposes: string[] = [];
  let s = advance(state, decide);
  for (let i = 0; i < 300; i += 1) {
    if (g54.isTerminal(s)) break;
    const purpose = openPurpose(s);
    if (purpose === null) break;
    purposes.push(purpose);
    if (purpose === "turn") break;
    s = advance(s, decide);
  }
  return { state: s, purposes };
};

export const checkExpectation = (label: string, want: Expectation, got: Observed): void => {
  expect(got.purposes, `${label} purposes`).toEqual([...want.purposes]);
  for (const key of ["ann", "bob", "cara"] as const) {
    expect(got.coins[key], `${label} ${key} coins`).toBe(want.coins?.[key] ?? 0);
    expect(got.hands[key], `${label} ${key} hand`).toBe(want.hands?.[key] ?? 0);
  }
  expect(got.disappear, `${label} disappear`).toBe(want.disappear ?? 0);
  expect(got.disappearTurns, `${label} disappear turns`).toEqual([...(want.disappearTurns ?? [])]);
  expect(got.treaty, `${label} treaty`).toEqual([...(want.treaty ?? [])]);
  expect(got.tax, `${label} tax`).toEqual(want.tax ?? null);
  expect(got.peacekeeping, `${label} peacekeeping`).toBe(want.peacekeeping ?? null);
  if (want.bank !== undefined) expect(got.bank, `${label} bank`).toBe(want.bank);
};

export const seedRole = (role: RoleId, rec: RoleRecord, scenario: Scenario): G54State => {
  const conceded = scenario === "lie" || scenario === "blockLie";
  const hand = conceded ? rec.lieHand : rec.hand;
  const bobHand = scenario === "blockTruth" ? rec.blockHand : OTHER_HAND;
  const blockScenario = scenario === "block" || scenario === "blockLie" || scenario === "blockTruth";
  const caraCoins = blockScenario ? (rec.blockCaraCoins ?? rec.caraCoins ?? 2) : (rec.caraCoins ?? 2);
  let state = craftSet(
    setFor(role),
    [
      [ANN, hand],
      [BOB, bobHand],
      [CARA, OTHER_HAND],
    ],
    `matrix-${role}-${scenario}`,
  );
  state = withCoins(state, ANN, rec.coins);
  state = withCoins(state, BOB, rec.bobCoins ?? 2);
  state = withCoins(state, CARA, caraCoins);
  if (rec.bank !== undefined) state = withBank(state, rec.bank);
  if (rec.court !== undefined) state = withCourt(state, rec.court);
  return state;
};

export const roleDriver =
  (role: RoleId, rec: RoleRecord, scenario: Scenario) =>
  (seat: SeatId, s: G54State): G54Action | null => {
    const blockRole = specOf(role).blockRole;
    const challenging = scenario === "lie" || scenario === "truth";
    const blockChallenging = scenario === "blockLie" || scenario === "blockTruth";
    switch (openPurpose(s)) {
      case "turn":
        return seat === s.active
          ? {
              t: "claim",
              role,
              target: rec.target,
              ...(rec.named === undefined ? {} : { named: rec.named }),
            }
          : null;
      case "challenge-claim":
        return seat === CARA && challenging ? { t: "challenge" } : null;
      case "proof-claim":
        return seat === s.active && challenging
          ? { t: scenario === "truth" ? "show" : "concede" }
          : null;
      case "block":
        return seat === BOB && blockRole !== null && scenario.startsWith("block")
          ? { t: "block", role: blockRole }
          : null;
      case "challenge-block":
        return seat === CARA && blockChallenging ? { t: "challenge" } : null;
      case "proof-block":
        return seat === BOB && blockChallenging
          ? { t: scenario === "blockTruth" ? "show" : "concede" }
          : null;
      case "protestor-fund":
        return rec.blockFunder !== undefined &&
          scenario.startsWith("block") &&
          seat === seatOf(rec.blockFunder)
          ? { t: "pay" }
          : null;
      case "crime-pay":
        return seat === s.pending?.target ? { t: "no" } : null;
      case "spy-second":
        return seat === s.active ? { t: "income" } : null;
      case "keep":
        return seat === s.active ? { t: "keep", indices: [0, 1] } : null;
      case "socialist-give":
        return { t: "pay" };
      case "socialist-keep":
        return seat === s.active ? { t: "keep", indices: [0, 0] } : null;
      case "bomb":
        return null;
      case "plantation-payout":
        return null;
      case "producer-give":
        return seat === s.draw?.target ? { t: "give", index: 0 } : null;
      case "writer-draw":
        return null;
      case "customs-mark":
        return seat === s.active ? { t: "claim", role, target: null } : null;
      case "reveal":
        return { t: "reveal", index: 0 };
      default:
        return null;
    }
  };

/** A Guerrilla hit on BOB opens his reactive window (Intellectual/Missionary). */
export const lossTrigger = (
  role: RoleId,
  bobHand: readonly RoleId[],
  entropy: string,
): G54State => {
  let state = withCoins(
    craftSet(
      reactiveSet(role),
      [
        [ANN, ["guerrilla", "banker"]],
        [BOB, bobHand],
        [CARA, OTHER_HAND],
      ],
      entropy,
    ),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  return state;
};

/** A Coup eliminates BOB, opening the Lawyer window for the survivors. */
export const eliminationTrigger = (annHand: readonly RoleId[], entropy: string): G54State => {
  let state = withCoins(
    craftSet(
      reactiveSet("lawyer"),
      [
        [ANN, annHand],
        [BOB, ["banker"]],
        [CARA, OTHER_HAND],
      ],
      entropy,
    ),
    ANN,
    8,
  );
  state = withCoins(state, BOB, 6);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  return state;
};

export const reactiveDriver =
  (role: RoleId, scenario: "resolve" | "lie" | "truth") =>
  (seat: SeatId, s: G54State): G54Action | null => {
    const challenging = scenario === "lie" || scenario === "truth";
    switch (openPurpose(s)) {
      case "reactive-intellectual":
      case "reactive-missionary":
        return { t: "claim", role, target: null };
      case "lawyer":
        return seat === ANN ? { t: "claim", role, target: null } : null;
      case "challenge-claim":
        return seat === CARA && challenging ? { t: "challenge" } : null;
      case "proof-claim":
        return challenging ? { t: scenario === "truth" ? "show" : "concede" } : null;
      default:
        return null;
    }
  };

/**
 * Run the generic claim-shape driver for one role and register it as a test. The
 * record must declare exactly the scenarios the role's spec implies; a missing or
 * extra cell fails the test.
 */
export const describeMatrix = (role: RoleId, rec: RoleRecord): void => {
  test(`matrix: ${role} drives every declared scenario`, () => {
    const scenarios = scenariosFor(specOf(role));
    expect(Object.keys(rec.expect).sort()).toEqual([...scenarios].sort());
    for (const scenario of scenarios) {
      const want = rec.expect[scenario];
      if (want === undefined) throw new Error(`${role} has no expectation for ${scenario}`);
      const before = seedRole(role, rec, scenario);
      const { state, purposes } = foldToTurn(before, roleDriver(role, rec, scenario));
      checkExpectation(`${role}/${scenario}`, want, observe(before, state, purposes));
    }
  });
};

/** Run the generic reactive-window driver for one reactive role and register it. */
export const describeReactiveMatrix = (role: RoleId, rec: ReactiveRecord): void => {
  test(`matrix: ${role} reactive window drives every declared scenario`, () => {
    const triggerWindow = role === "lawyer" ? "lawyer" : `reactive-${role}`;
    for (const scenario of ["resolve", "lie", "truth"] as const) {
      const hand = scenario === "lie" ? rec.lieHand : rec.hand;
      const before =
        role === "lawyer"
          ? eliminationTrigger(hand, `matrix-${role}-${scenario}`)
          : lossTrigger(role, hand, `matrix-${role}-${scenario}`);
      expect(openPurpose(before), `${role}/${scenario} trigger window`).toBe(triggerWindow);
      const { state, purposes } = foldToTurn(before, reactiveDriver(role, scenario));
      checkExpectation(`${role}/${scenario}`, rec.expect[scenario], observe(before, state, purposes));
    }
  });
};
