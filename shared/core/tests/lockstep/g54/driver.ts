import {
  act,
  frameIndex,
  genesisSeed,
  idle,
  makeRandom,
  makeRoster,
  seatId,
  type Frame,
  type SeatId,
  type SeatInput,
} from "../../../index.ts";
import { type G54Action, type G54View, g54 } from "../../../lockstep/games/g54/index.ts";
import type { RoleId } from "../../../lockstep/games/g54/roles.ts";
import type { G54State } from "../../../lockstep/games/g54/state.ts";
import { at, fakeClock, makeTable, type Table } from "../harness.ts";

export { g54 };
export type { G54Action, G54View, G54State, RoleId };

export const ANN = seatId("ann");
export const BOB = seatId("bob");
export const CARA = seatId("cara");
export const DAN = seatId("dan");
export const EVE = seatId("eve");
export const FINN = seatId("finn");

export const SEATS3: readonly [SeatId, SeatId, SeatId] = [ANN, BOB, CARA];
export const SEATS6: readonly [SeatId, SeatId, SeatId, SeatId, SeatId, SeatId] = [
  ANN,
  BOB,
  CARA,
  DAN,
  EVE,
  FINN,
];

export const STARTER: readonly RoleId[] = [
  "banker",
  "director",
  "guerrilla",
  "politician",
  "peacekeeper",
];

export const tableOf = (
  roles: readonly RoleId[],
  seats: readonly SeatId[],
  entropy: string,
): Table<G54Action, G54View> =>
  makeTable(g54, {
    seats,
    setup: { roles },
    seed: genesisSeed(entropy),
    clock: fakeClock().clock,
  });

/** Report one input per owed seat in the currently open frame. */
export const driveFrame = (
  table: Table<G54Action, G54View>,
  decide: (seat: SeatId, view: G54View) => G54Action | null,
): void => {
  const opener = at(table, ANN);
  const frame = opener.frame;
  for (const seat of opener.owed()) {
    const session = at(table, seat);
    if (session.frame !== frame) continue;
    const action = decide(seat, session.view());
    session.report(action === null ? idle<G54Action>() : act<G54Action>(action));
  }
};

export const driveUntil = (
  table: Table<G54Action, G54View>,
  decide: (seat: SeatId, view: G54View) => G54Action | null,
  done: (view: G54View) => boolean,
  guard = 500,
): void => {
  for (let i = 0; i < guard && !done(at(table, ANN).view()); i += 1) {
    driveFrame(table, decide);
  }
};

export const playToEnd = (
  table: Table<G54Action, G54View>,
  decide: (seat: SeatId, view: G54View) => G54Action | null,
  guard = 50_000,
): void => {
  for (let i = 0; i < guard && !at(table, ANN).terminal; i += 1) {
    driveFrame(table, decide);
  }
};

const coinsOf = (view: G54View, seat: SeatId): number =>
  view.players.find((p) => p.seat === seat)?.coins ?? 0;

const aliveOthers = (view: G54View, seat: SeatId): readonly SeatId[] =>
  view.players.filter((p) => p.handCount > 0 && p.seat !== seat).map((p) => p.seat);

/**
 * A deterministic, always-legal policy that pushes a game to terminal: Coup when
 * affordable, otherwise a Guerrilla attack, otherwise Income. Every challenge and
 * block window is passed, and reveals/keeps fall back to the engine defaults.
 */
export const autoAction = (seat: SeatId, view: G54View): G54Action | null => {
  const window = view.window;
  if (window === null || window.purpose !== "turn") return null;
  const target = aliveOthers(view, seat)[0];
  if (target === undefined) return null;
  const coins = coinsOf(view, seat);
  if (coins >= 7) return { t: "coup", target };
  if (coins >= 4) return { t: "claim", role: "guerrilla", target };
  return { t: "income" };
};

/** Roles with a chosen target, versus the untargeted/auto-targeted ones. */
const TARGETED_ROLES: ReadonlySet<string> = new Set([
  "farmer",
  "producer",
  "guerrilla",
  "crime-boss",
  "judge",
  "mercenary",
  "foreign-consular",
  "protestor",
]);
const REACTIVE_ROLES: ReadonlySet<string> = new Set(["intellectual", "lawyer", "missionary"]);
/** Force roles, so a claim removes influence and the game reaches terminal. */
const CLAIM_ORDER: readonly RoleId[] = [
  "guerrilla",
  "judge",
  "mercenary",
  "crime-boss",
  "general",
  "protestor",
];
const ROLE_COST: Readonly<Record<string, number>> = {
  guerrilla: 4,
  judge: 3,
  mercenary: 3,
  "crime-boss": 5,
  general: 5,
  protestor: 2,
};

/**
 * A deterministic, always-legal policy that challenges rivals' claims, blocks
 * attacks from its own hand, and challenges blocks it suspects. A full game under
 * it exercises `resolveBlock`, `resolveChallengeBlock`, and `proof-block`, not
 * merely the pass-everything happy path.
 */
export const challengeBlockAction = (seat: SeatId, view: G54View): G54Action | null => {
  const window = view.window;
  if (window === null) return null;
  const coins = coinsOf(view, seat);
  const rival = aliveOthers(view, seat)[0];
  const pending = view.pending;
  const holds = (role: RoleId): boolean => view.myHand.includes(role);
  switch (window.purpose) {
    case "turn":
    case "spy-second": {
      if (rival === undefined) return null;
      if (coins >= 7) return { t: "coup", target: rival };
      for (const role of CLAIM_ORDER) {
        if (!view.roles.includes(role) || !holds(role) || REACTIVE_ROLES.has(role)) continue;
        if ((ROLE_COST[role] ?? 0) > coins) continue;
        return { t: "claim", role, target: TARGETED_ROLES.has(role) ? rival : null };
      }
      return { t: "income" };
    }
    case "challenge-claim":
      if (pending === null || pending.role === null || pending.claimant === seat) return null;
      return holds(pending.role) ? null : { t: "challenge" };
    case "block":
      // Block only occasionally, so attacks still land and the game terminates;
      // the challenge and proof-block windows are still exercised when they do.
      return pending === null || pending.role === null || view.turn % 3 !== 0
        ? null
        : { t: "block", role: pending.role };
    case "challenge-block":
      if (pending === null || pending.role === null || pending.blocker === seat) return null;
      return holds(pending.role) ? null : { t: "challenge" };
    case "proof-claim":
      if (pending === null || pending.role === null || pending.claimant !== seat) return null;
      return holds(pending.role) ? { t: "show" } : { t: "concede" };
    case "proof-block":
      if (pending === null || pending.role === null || pending.blocker !== seat) return null;
      return holds(pending.role) ? { t: "show" } : { t: "concede" };
    case "reveal":
      return { t: "reveal", index: 0 };
    case "capitalist":
      return view.roles.includes("capitalist")
        ? { t: "claim", role: "capitalist", target: null }
        : null;
    case "protestor-fund":
      return coins >= 3 ? { t: "pay" } : null;
    case "crime-pay":
      return coins >= 2 ? { t: "pay" } : { t: "no" };
    case "customs-mark":
      return { t: "claim", role: view.roles[0] ?? "banker", target: null };
    case "writer-draw":
      return coins >= 1 ? { t: "pay" } : null;
    case "producer-give":
      return { t: "give", index: 0 };
    case "reactive-intellectual":
      return { t: "claim", role: "intellectual", target: null };
    case "reactive-missionary":
      return { t: "claim", role: "missionary", target: null };
    case "lawyer":
      return { t: "claim", role: "lawyer", target: null };
    default:
      return null;
  }
};

export const coinsIn = (table: Table<G54Action, G54View>, seat: SeatId): number =>
  at(table, seat)
    .view()
    .players.find((p) => p.seat === seat)?.coins ?? -1;

export const handCountIn = (table: Table<G54Action, G54View>, seat: SeatId): number =>
  at(table, seat)
    .view()
    .players.find((p) => p.seat === seat)?.handCount ?? -1;

export const handsOf = (table: Table<G54Action, G54View>, seat: SeatId): readonly RoleId[] =>
  at(table, seat).view().myHand;

export const RAW_SEED = genesisSeed("g54-raw-tests");

export interface RawSetup {
  readonly socialMedia?: boolean;
}

export const rawGenesis = (
  roles: readonly RoleId[],
  seats: readonly SeatId[],
  entropy = "g54-raw-tests",
  setup: RawSetup = {},
): G54State =>
  g54.genesis(
    { roles, socialMedia: setup.socialMedia === true },
    makeRoster(seats),
    makeRandom(genesisSeed(entropy)),
  );

export const rawRandom = (entropy = "g54-raw-tests") => makeRandom(genesisSeed(entropy));

export const rawFrame = (
  index: number,
  inputs: readonly (readonly [SeatId, SeatInput<G54Action>])[],
): Frame<G54Action> => ({ index: frameIndex(index), seed: RAW_SEED, inputs });

export const rawStep = (
  state: G54State,
  frame: Frame<G54Action>,
  entropy = "g54-raw-tests",
): G54State => g54.step(state, frame, rawRandom(entropy));

/** Replace one seat's coins, keeping every other field. */
export const withCoins = (state: G54State, seat: SeatId, coins: number): G54State => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, coins } : p)),
});

export const withHand = (state: G54State, seat: SeatId, hand: readonly RoleId[]): G54State => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, hand } : p)),
});

export const withCourt = (state: G54State, court: readonly RoleId[]): G54State => ({
  ...state,
  court,
});

export const withBank = (state: G54State, bank: number): G54State => ({ ...state, bank });

export const withPeacekeeping = (state: G54State, seat: SeatId | null): G54State => ({
  ...state,
  peacekeeping: seat,
});

export const rawPlayer = (state: G54State, seat: SeatId) => {
  const player = state.players.find((p) => p.seat === seat);
  if (player === undefined) throw new Error(`no player ${seat}`);
  return player;
};

export const rawHand = (state: G54State, seat: SeatId): readonly RoleId[] =>
  rawPlayer(state, seat).hand;

export const rawCoins = (state: G54State, seat: SeatId): number => rawPlayer(state, seat).coins;

export const rawRevealed = (state: G54State, seat: SeatId): readonly RoleId[] =>
  rawPlayer(state, seat).revealed;

export const openPurpose = (state: G54State): string | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

export const owedOf = (state: G54State): readonly SeatId[] => g54.seatsOwed(state, frameIndex(0));

/** `seatsOwed` for a frame index, without an inline cast at each call site. */
export const seatsOwedAt = (state: G54State, index = 0): readonly SeatId[] =>
  g54.seatsOwed(state, frameIndex(index));

/** Advance whole windows until the stack returns to a turn window (or terminal). */
export const runWindows = (
  state: G54State,
  decide: (seat: SeatId, state: G54State) => G54Action | null,
  entropy = "g54-raw-tests",
  until: string = "turn",
  guard = 200,
): G54State => {
  let next = advance(state, decide, entropy);
  for (let i = 1; i < guard && !g54.isTerminal(next) && openPurpose(next) !== until; i += 1) {
    next = advance(next, decide, entropy);
  }
  return next;
};

/** Pass every open window until the stack reaches the next turn window. */
export const passToTurn = (state: G54State, entropy = "g54-raw-tests"): G54State =>
  runWindows(state, () => null, entropy, "turn");

/** Crafted genesis for the three-seat starter set, with hand overrides for tests. */
export const withHands = (
  hands: readonly (readonly [SeatId, readonly RoleId[]])[],
  entropy = "g54-raw-tests",
): G54State => {
  let state = rawGenesis(STARTER, SEATS3, entropy);
  for (const [seat, hand] of hands) state = withHand(state, seat, hand);
  return state;
};

/** Crafted genesis for an arbitrary role set, with hand overrides for tests. */
export const craftSet = (
  roles: readonly RoleId[],
  hands: readonly (readonly [SeatId, readonly RoleId[]])[],
  entropy = "g54-raw-tests",
  seats: readonly SeatId[] = SEATS3,
  setup: RawSetup = {},
): G54State => {
  let state = rawGenesis(roles, seats, entropy, setup);
  for (const [seat, hand] of hands) state = withHand(state, seat, hand);
  return state;
};

/** Override the state's treaty pair. */
export const withTreaty = (state: G54State, treaty: readonly SeatId[]): G54State => ({
  ...state,
  treaty: [...treaty],
});

/** Override the state's Tax mark. */
export const withTax = (state: G54State, role: RoleId, holder: SeatId): G54State => ({
  ...state,
  tax: { role, holder },
});

/** Apply one frame from a sparse input list; omitted seats are simply absent. */
export const play = (
  state: G54State,
  inputs: readonly (readonly [SeatId, G54Action | null])[],
  entropy = "g54-raw-tests",
): G54State =>
  rawStep(
    state,
    rawFrame(
      0,
      inputs.map(([seat, action]): readonly [SeatId, SeatInput<G54Action>] =>
        action === null ? [seat, idle<G54Action>()] : [seat, act<G54Action>(action)],
      ),
    ),
    entropy,
  );

/** The three-seat starter table at genesis, with controlled hands for rule tests. */
export const crafted = (entropy = "g54-raw-tests"): G54State =>
  rawGenesis(STARTER, SEATS3, entropy);

/** Apply one frame, deciding each owed seat's input from the current state. */
export const advance = (
  state: G54State,
  decide: (seat: SeatId, state: G54State) => G54Action | null,
  entropy = "g54-raw-tests",
): G54State => {
  const owed = g54.seatsOwed(state, frameIndex(0));
  const inputs = owed.map((seat): readonly [SeatId, SeatInput<G54Action>] => {
    const action = decide(seat, state);
    return [seat, action === null ? idle<G54Action>() : act<G54Action>(action)];
  });
  return rawStep(state, rawFrame(0, inputs), entropy);
};

/** Total influence cards in play: hands, revealed cards, the Court, and any in-flight draw. */
export const totalCards = (state: G54State): number => {
  const inHands = state.players.reduce((n, p) => n + p.hand.length + p.revealed.length, 0);
  const inFlight = state.draw?.pool.length ?? 0;
  const socialist = state.socialist?.pool.length ?? 0;
  return inHands + state.court.length + inFlight + socialist;
};

/** Total coins in play: every purse, the Treasury, and the Bank pile (the 50-coin supply). */
export const totalCoins = (state: G54State): number =>
  state.players.reduce((n, p) => n + p.coins, 0) + state.treasury + state.bank;

/** Fold a raw game to terminal, checking a per-frame invariant after each step. */
export const playRaw = (
  start: G54State,
  decide: (seat: SeatId, state: G54State) => G54Action | null,
  entropy = "g54-raw-tests",
  guard = 5000,
): { readonly state: G54State; readonly steps: number } => {
  let state = start;
  let steps = 0;
  while (!g54.isTerminal(state) && steps < guard) {
    state = advance(state, decide, entropy);
    steps += 1;
  }
  return { state, steps };
};
