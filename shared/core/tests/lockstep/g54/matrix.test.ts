/**
 * g54 role/scenario matrix: a declarative spec-record registry driven by one loop.
 *
 *  - `MATRIX` is keyed by every non-reactive `ROLE_CATALOG` id. Each record declares
 *    the seed (hand, lie-hand, coins, target, block-hand, optional funder) and an
 *    `expect` table keyed by scenario. `REACTIVE_MATRIX` does the same for the three
 *    reactive roles, whose window opens on a trigger rather than a turn.
 *  - ONE driver loop per role seeds the state from the record, reports the canonical
 *    inputs for the scenario, folds the window stack, and checks the declared
 *    observables: the exact window-purpose sequence, coin/hand deltas, and the
 *    `disappear`/`treaty`/`tax`/`peacekeeping` token fields.
 *  - The completeness oracle asserts every non-reactive catalog id has a `MATRIX`
 *    entry with exactly the scenarios its `blockRole` implies, that reactive ids live
 *    only in `REACTIVE_MATRIX`, and that every declared (role, scenario) cell was
 *    actually visited by the loop. Adding a role to `ROLE_CATALOG` without a record,
 *    or dropping a scenario, fails the oracle.
 *
 * Conventions:
 *  - `purposes` is the window-purpose sequence observed AFTER the seeded trigger
 *    window (the seed's own top window is asserted separately for reactive roles).
 *  - `coins` and `hands` are DELTAS from the seeded state; `disappear`/`disappearTurns`/
 *    `treaty`/`tax`/`peacekeeping` are ABSOLUTE values of the folded state.
 *  - The canonical driver passes every block it is not asked to raise, declines the
 *    Crime Boss pay window, and takes the default keep for swaps.
 *  - The `role-specific semantics` block below pins the quirks the generic shapes
 *    cannot express (the per-role notes in `docs/research/coup-rebellion-g54/04..08`).
 *  - `mutation-proof.sh` breaks one rule at a time in the engine and asserts this file
 *    goes red; run it after editing an effect or the catalog.
 */
import { describe, expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  totalCards,
  totalCoins,
  withBank,
  withCoins,
  withCourt,
  withTax,
  withTreaty,
  type G54Action,
  type G54State,
  type RoleId,
} from "./driver.ts";
import { isHoldless, ROLE_CATALOG, specOf, type RoleSpec } from "../../../lockstep/games/g54/roles.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";
import { seatId, type SeatId } from "../../../index.ts";

type Scenario = "resolve" | "lie" | "truth" | "block" | "blockLie" | "blockTruth";
type SeatKey = "ann" | "bob" | "cara";

interface Expectation {
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

interface RoleRecord {
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

interface ReactiveRecord {
  /** The claimant's hand for the resolve/truth scenarios. */
  readonly hand: readonly RoleId[];
  /** The claimant's hand for the lie scenario. */
  readonly lieHand: readonly RoleId[];
  readonly expect: Readonly<Record<"resolve" | "lie" | "truth", Expectation>>;
}

const SEATS: Readonly<Record<SeatKey, SeatId>> = { ann: ANN, bob: BOB, cara: CARA };
const seatOf = (key: SeatKey): SeatId => SEATS[key];

/** A three-card filler hand that never contains the role under test. */
const OTHER_HAND: readonly RoleId[] = ["banker", "banker", "banker"];

const pass = (): null => null;

/**
 * The scenarios a role's record must declare. A holdless role (Anarchist) opens
 * no challenge window, so its `lie`/`truth` cells are degenerate and only
 * `resolve` is forced; a blockable role adds the three block cells.
 */
const scenariosFor = (spec: RoleSpec): readonly Scenario[] =>
  isHoldless(spec)
    ? ["resolve"]
    : spec.blockRole !== null
      ? ["resolve", "lie", "truth", "block", "blockLie", "blockTruth"]
      : ["resolve", "lie", "truth"];

/** A legal 1/1/1/2 set whose category slot is filled by the role under test. */
const setFor = (role: RoleId): readonly RoleId[] => {
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
export const MATRIX: Readonly<Partial<Record<RoleId, RoleRecord>>> = {
  "banker": {
    hand: ["banker", "banker"],
    lieHand: ["director", "director"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 3 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 3 },
        hands: { cara: -1 },
      },
    },
  },
  "capitalist": {
    hand: ["capitalist", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "capitalist", "turn"],
        coins: { ann: 4 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "capitalist", "turn"],
        coins: { ann: 4 },
        hands: { cara: -1 },
      },
    },
  },
  "farmer": {
    hand: ["farmer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 2, bob: 1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 2, bob: 1 },
        hands: { cara: -1 },
      },
    },
  },
  "speculator": {
    hand: ["speculator", "banker"],
    lieHand: ["banker", "banker"],
    coins: 6,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 5 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: -6, cara: 6 },
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 5 },
        hands: { cara: -1 },
      },
    },
  },
  "spy": {
    hand: ["spy", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "spy-second", "turn"],
        coins: { ann: 2 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "spy-second", "turn"],
        coins: { ann: 2 },
        hands: { cara: -1 },
      },
    },
  },
  "director": {
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
  },
  "newscaster": {
    hand: ["newscaster", "banker"],
    lieHand: ["banker", "banker"],
    coins: 4,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "keep", "turn"],
        coins: { ann: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "keep", "turn"],
        coins: { ann: -1 },
        hands: { cara: -1 },
      },
    },
  },
  "producer": {
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
  },
  "reporter": {
    hand: ["reporter", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "keep", "turn"],
        coins: { ann: 1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "keep", "turn"],
        coins: { ann: 1 },
        hands: { cara: -1 },
      },
    },
  },
  "writer": {
    hand: ["writer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "writer-draw", "keep", "turn"],
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "writer-draw", "keep", "turn"],
        hands: { cara: -1 },
      },
    },
  },
  "crime-boss": {
    hand: ["crime-boss", "banker"],
    lieHand: ["banker", "banker"],
    coins: 8,
    target: BOB,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "crime-pay", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "crime-pay", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -1, cara: -1 },
      },
    },
  },
  "general": {
    hand: ["general", "banker"],
    lieHand: ["banker", "banker"],
    coins: 8,
    target: null,
    blockHand: ["general", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "reveal", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -1, cara: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "reveal", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -1, cara: -2 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { cara: -1 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "reveal", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -2, cara: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { cara: -2 },
      },
    },
  },
  "guerrilla": {
    hand: ["guerrilla", "banker"],
    lieHand: ["banker", "banker"],
    coins: 7,
    target: BOB,
    blockHand: ["guerrilla", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "reveal", "turn"],
        coins: { ann: -4 },
        hands: { bob: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "reveal", "turn"],
        coins: { ann: -4 },
        hands: { bob: -1, cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
        coins: { ann: -4 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "reveal", "turn"],
        coins: { ann: -4 },
        hands: { bob: -2 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -4 },
        hands: { cara: -1 },
      },
    },
  },
  "judge": {
    hand: ["judge", "banker"],
    lieHand: ["banker", "banker"],
    coins: 6,
    target: BOB,
    blockHand: ["judge", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { bob: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { bob: -1, cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
        coins: { ann: -3, bob: 3 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { bob: -2 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { cara: -1 },
      },
    },
  },
  "mercenary": {
    hand: ["mercenary", "banker"],
    lieHand: ["banker", "banker"],
    coins: 6,
    target: BOB,
    blockHand: ["mercenary", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "turn"],
        coins: { ann: -3 },
        disappear: 1,
        disappearTurns: [1],
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "turn"],
        coins: { ann: -3 },
        hands: { cara: -1 },
        disappear: 1,
        disappearTurns: [1],
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
        coins: { ann: -3 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -1 },
        disappear: 1,
        disappearTurns: [1],
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { cara: -1 },
      },
    },
  },
  "communist": {
    hand: ["communist", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    bobCoins: 8,
    caraCoins: 1,
    target: null,
    blockHand: ["communist", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "turn"],
        coins: { bob: -3, cara: 3 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "turn"],
        coins: { bob: -3, cara: 3 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { bob: -3, cara: 3 },
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        hands: { cara: -1 },
      },
    },
  },
  "customs-officer": {
    hand: ["customs-officer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "customs-mark", "turn"],
        tax: { role: "customs-officer", holder: seatId("ann") },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "customs-mark", "turn"],
        hands: { cara: -1 },
        tax: { role: "customs-officer", holder: seatId("ann") },
      },
    },
  },
  "foreign-consular": {
    hand: ["foreign-consular", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        treaty: [seatId("ann"), seatId("bob")],
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { cara: -1 },
        treaty: [seatId("ann"), seatId("bob")],
      },
    },
  },
  "peacekeeper": {
    hand: ["peacekeeper", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 1 },
        peacekeeping: seatId("ann"),
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 1 },
        hands: { cara: -1 },
        peacekeeping: seatId("ann"),
      },
    },
  },
  "politician": {
    hand: ["politician", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["politician", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "turn"],
        coins: { ann: 2, bob: -2 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "turn"],
        coins: { ann: 2, bob: -2 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: 2, bob: -2 },
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        hands: { cara: -1 },
      },
    },
  },
  "priest": {
    hand: ["priest", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["priest", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "block", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "block", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "block", "turn"],
        coins: { ann: 1, cara: -1 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "block", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "block", "turn"],
        coins: { ann: 1, cara: -1 },
        hands: { cara: -1 },
      },
    },
  },
  "protestor": {
    hand: ["protestor", "banker"],
    lieHand: ["banker", "banker"],
    coins: 5,
    blockFunder: "cara",
    blockCaraCoins: 3,
    target: BOB,
    blockHand: ["protestor", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "protestor-fund", "turn"],
        coins: { ann: -2 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "protestor-fund", "turn"],
        coins: { ann: -2 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "protestor-fund", "block", "challenge-block", "turn"],
        coins: { ann: -2, cara: -3 },
      },
      blockLie: {
        purposes: ["challenge-claim", "protestor-fund", "block", "challenge-block", "proof-block", "reveal", "reveal", "turn"],
        coins: { ann: -2, cara: -3 },
        hands: { bob: -2 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "protestor-fund", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -2, cara: -3 },
        hands: { cara: -1 },
      },
    },
  },
  "paramilitary": {
    hand: ["paramilitary", "banker"],
    lieHand: ["banker", "banker"],
    coins: 5,
    target: BOB,
    blockHand: ["paramilitary", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -1, cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
        coins: { ann: -3 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -2 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { cara: -1 },
      },
    },
  },
  "anarchist": {
    hand: ["banker", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      // Holdless: no challenge window; the Bomb lands on BOB, who neither passes
      // nor defuses, so he loses 1 influence and the Bomb returns to the centre.
      resolve: {
        purposes: ["bomb", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -1 },
      },
    },
  },
  "financier": {
    hand: ["financier", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    bank: 4,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 4 },
        bank: 0,
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
        bank: 4,
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 4 },
        hands: { cara: -1 },
        bank: 0,
      },
    },
  },
  "plantation-owner": {
    hand: ["plantation-owner", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      // Ann takes 1 and is the sole surviving claimant, so the payout is 1.
      resolve: {
        purposes: ["challenge-claim", "capitalist", "plantation-payout", "turn"],
        coins: { ann: 2 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "capitalist", "plantation-payout", "turn"],
        coins: { ann: 2 },
        hands: { cara: -1 },
      },
    },
  },
  "arms-dealer": {
    hand: ["arms-dealer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    named: "banker",
    // The deck's first two cards both name Banker, so the reveal always matches.
    court: ["banker", "banker", "director", "guerrilla", "politician", "peacekeeper"],
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 4 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 4 },
        hands: { cara: -1 },
      },
    },
  },
  "socialist": {
    hand: ["socialist", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["socialist", "banker", "banker"],
    expect: {
      // Both rivals pay a coin, then the actor's keep window is a no-op swap.
      resolve: {
        purposes: ["challenge-claim", "block", "socialist-give", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "socialist-give", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 1, cara: -1 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "socialist-give", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "block", "socialist-give", "socialist-keep", "turn"],
        coins: { ann: 1, cara: -1 },
        hands: { cara: -1 },
      },
    },
  },
};
export const REACTIVE_MATRIX: Readonly<Partial<Record<RoleId, ReactiveRecord>>> = {
  "intellectual": {
    hand: ["banker", "intellectual", "banker"],
    lieHand: ["banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { bob: 5 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { bob: -2 },
        hands: { bob: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "reactive-intellectual", "challenge-claim", "turn"],
        coins: { bob: 5, cara: 5 },
        hands: { cara: -1 },
      },
    },
  },
  "missionary": {
    hand: ["banker", "missionary", "banker"],
    lieHand: ["banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        hands: { bob: 1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { bob: -2 },
        hands: { bob: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "reactive-missionary", "challenge-claim", "turn"],
        hands: { bob: 1 },
      },
    },
  },
  "lawyer": {
    hand: ["lawyer", "banker"],
    lieHand: ["banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 6, bob: -6 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { bob: -6 },
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 6, bob: -6 },
        hands: { cara: -1 },
      },
    },
  },
};

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
const foldToTurn = (
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

const checkExpectation = (label: string, want: Expectation, got: Observed): void => {  expect(got.purposes, `${label} purposes`).toEqual([...want.purposes]);
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

const seedRole = (role: RoleId, rec: RoleRecord, scenario: Scenario): G54State => {
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

const roleDriver =
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
        return rec.blockFunder !== undefined && scenario.startsWith("block") && seat === seatOf(rec.blockFunder)
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

const reactiveSet = (role: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  role,
  "politician",
];

/** A Guerrilla hit on BOB opens his reactive window (Intellectual/Missionary). */
const lossTrigger = (role: RoleId, bobHand: readonly RoleId[], entropy: string): G54State => {
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
const eliminationTrigger = (annHand: readonly RoleId[], entropy: string): G54State => {
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

const reactiveDriver =
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

/** Records every (role, scenario) cell the loop actually visited. */
const visited = new Set<string>();

/** A record that must exist; the oracle guarantees the registry is complete. */
const mustRecord = <K extends string, T>(table: Partial<Record<K, T>>, key: K): T => {
  const rec = table[key];
  if (rec === undefined) throw new Error(`registry is missing a record for ${key}`);
  return rec;
};

test.each(ROLE_CATALOG.filter((spec) => !spec.reactive).map((spec) => spec.id))(
  "matrix: %s drives every declared scenario",
  (role) => {
    const rec = mustRecord(MATRIX, role);
    const scenarios = scenariosFor(specOf(role));
    for (const scenario of scenarios) {
      const want = rec.expect[scenario];
      if (want === undefined) throw new Error(`${role} has no expectation for ${scenario}`);
      const before = seedRole(role, rec, scenario);
      const { state, purposes } = foldToTurn(before, roleDriver(role, rec, scenario));
      checkExpectation(`${role}/${scenario}`, want, observe(before, state, purposes));
      visited.add(`${role}/${scenario}`);
    }
  },
);

test.each(["intellectual", "missionary", "lawyer"] as const)(
  "matrix: %s reactive window drives every declared scenario",
  (role) => {
    const rec = mustRecord(REACTIVE_MATRIX, role);
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
      visited.add(`${role}/${scenario}`);
    }
  },
);

test("oracle: the registry covers the catalog exactly", () => {
  const active = ROLE_CATALOG.filter((spec) => !spec.reactive).map((spec) => spec.id);
  const reactive = ROLE_CATALOG.filter((spec) => spec.reactive).map((spec) => spec.id);

  expect(Object.keys(MATRIX).sort()).toEqual([...active].sort());
  expect(Object.keys(REACTIVE_MATRIX).sort()).toEqual([...reactive].sort());
  for (const id of reactive) expect(MATRIX[id], `${id} must not be in MATRIX`).toBeUndefined();

  for (const spec of ROLE_CATALOG) {
    if (spec.reactive) continue;
    const declared = Object.keys(MATRIX[spec.id]?.expect ?? {}).sort();
    const expected = [...scenariosFor(spec)].sort();
    expect(declared, `${spec.id} scenarios`).toEqual(expected);
  }

  const cells: string[] = [];
  for (const spec of ROLE_CATALOG) {
    const scenarios = spec.reactive ? ["resolve", "lie", "truth"] : scenariosFor(spec);
    for (const scenario of scenarios) cells.push(`${spec.id}/${scenario}`);
  }
  expect(cells.length).toBeGreaterThan(0);
  expect([...visited].sort()).toEqual(cells.sort());
});

// ---------------------------------------------------------------------------
// Role-specific semantics beyond the generic claim shapes: the quirks the
// per-role docs call out (`04..08`). Named so a reader sees each one explicitly.
// ---------------------------------------------------------------------------

describe("role-specific semantics", () => {
  test("a challenged claim conserves the deck and the coins", () => {
    const before = seedRole(
      "guerrilla",
      mustRecord(MATRIX, "guerrilla"),
      "truth",
    );
    const cards = totalCards(before);
    const coins = totalCoins(before);
    const { state } = foldToTurn(before, roleDriver("guerrilla", mustRecord(MATRIX, "guerrilla"), "truth"));
    // A truthful challenge plus the still-resolving attack land without
    // creating or destroying a single card or coin.
    expect(totalCards(state)).toBe(cards);
    expect(totalCoins(state)).toBe(coins);
  });

  test("Customs Officer: the Tax is charged on a Spy's second claim", () => {
    let state = craftSet(
      ["spy", "director", "guerrilla", "customs-officer", "politician"],
      [[BOB, ["spy", "customs-officer"]]],
      "edge-tax-spy",
    );
    state = withTax(state, "customs-officer", CARA);
    state = withCoins(state, BOB, 3);
    state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
    expect(state.active).toBe(BOB);
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "spy", target: null } : null,
    );
    state = advance(state, () => null);
    expect(openPurpose(state)).toBe("spy-second");
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "customs-officer", target: null } : null,
    );
    // The Tax is charged per claim: the Spy claim and the second claim both pay.
    expect(rawCoins(state, BOB)).toBe(3);
    expect(rawCoins(state, CARA)).toBe(3);
  });

  test("Communist: when the actor is poorest the theft is a self-transfer", () => {
    let state = withCoins(
      craftSet(
        ["banker", "director", "guerrilla", "communist", "politician"],
        [[ANN, ["communist", "banker"]]],
        "edge-comm-self",
      ),
      ANN,
      0,
    );
    state = withCoins(state, BOB, 8);
    state = withCoins(state, CARA, 5);
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "communist", target: null } : null,
    );
    state = advance(state, () => null);
    state = advance(state, () => null);
    // The actor is the poorest, so the 3 coins from the wealthiest land on the actor.
    expect(rawCoins(state, ANN)).toBe(3);
    expect(rawCoins(state, BOB)).toBe(5);
  });

  test("Communist: a wealth tie breaks clockwise from the actor", () => {
    let state = withCoins(
      craftSet(
        ["banker", "director", "guerrilla", "communist", "politician"],
        [[ANN, ["communist", "banker"]]],
        "edge-comm-tie",
      ),
      BOB,
      8,
    );
    state = withCoins(state, CARA, 8);
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "communist", target: null } : null,
    );
    state = advance(state, () => null);
    state = advance(state, () => null);
    // Bob is clockwise-first from Ann, so Bob is the victim and Cara is untouched.
    expect(rawCoins(state, BOB)).toBe(5);
    expect(rawCoins(state, CARA)).toBe(8);
  });

  test("Foreign Consular: a new treaty reassigns the old one, allies cannot target each other, and it expires at two", () => {
    const set: readonly RoleId[] = [
      "banker",
      "director",
      "guerrilla",
      "foreign-consular",
      "politician",
    ];
    let state = craftSet(set, [[ANN, ["foreign-consular", "banker"]]], "edge-treaty-reassign");
    state = withTreaty(state, [BOB, CARA]);
    state = advance(state, (seat, s) =>
      seat === s.active ? { t: "claim", role: "foreign-consular", target: BOB } : null,
    );
    state = advance(state, () => null);
    expect(state.treaty).toEqual([ANN, BOB]);

    let allied = craftSet(set, [[ANN, ["guerrilla", "banker"]]], "edge-treaty-ally");
    allied = withTreaty(allied, [ANN, BOB]);
    allied = withCoins(allied, ANN, 4);
    allied = advance(allied, (seat, s) =>
      seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
    );
    // The illegal ally target coerces to Income.
    expect(rawCoins(allied, ANN)).toBe(5);
    expect(rawHand(allied, BOB)).toHaveLength(2);

    let expiring = craftSet(
      set,
      [
        [ANN, ["banker", "banker"]],
        [CARA, ["banker"]],
      ],
      "edge-treaty-expire",
    );
    expiring = withTreaty(expiring, [ANN, BOB]);
    expiring = withCoins(expiring, ANN, 8);
    expiring = advance(expiring, (seat, s) =>
      seat === s.active ? { t: "coup", target: CARA } : null,
    );
    expiring = advance(expiring, () => null);
    // Two players left: the treaty expires.
    expect(expiring.treaty).toEqual([]);
  });

  test("Mercenary: tokens stack, fire once each, and are discarded with a dead target", () => {
    const set: readonly RoleId[] = ["banker", "director", "mercenary", "politician", "peacekeeper"];
    const turnWindow = (seat: SeatId): G54State["steps"][number] => ({
      kind: "window",
      window: { kind: "turn", purpose: "turn", seats: [seat], cause: null },
    });
    let state = craftSet(set, [[BOB, ["banker", "banker"]]], "edge-merc-stack");
    state = {
      ...state,
      active: BOB,
      steps: [turnWindow(BOB)],
      disappear: [
        { target: BOB, turns: 1 },
        { target: BOB, turns: 1 },
      ],
    };
    state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
    expect(openPurpose(state)).toBe("reveal");
    state = advance(state, () => null);
    expect(rawHand(state, BOB)).toHaveLength(1);
    state = advance(state, () => null);
    expect(rawHand(state, BOB)).toHaveLength(0);
    expect(state.disappear).toHaveLength(0);

    let dead = craftSet(
      set,
      [
        [ANN, ["banker", "banker"]],
        [BOB, ["banker"]],
      ],
      "edge-merc-dead",
    );
    dead = withCoins(dead, ANN, 8);
    dead = { ...dead, disappear: [{ target: BOB, turns: 1 }] };
    dead = advance(dead, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
    dead = advance(dead, () => null);
    expect(rawHand(dead, BOB)).toHaveLength(0);
    expect(dead.disappear).toHaveLength(0);
  });
});
