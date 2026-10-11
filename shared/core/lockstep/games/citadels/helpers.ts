import type { Frame, Random, SeatId } from "../../index.ts";
import type { CitadelsAction } from "./actions.ts";
import { specOfCharacter, type CharacterId, type Rank } from "./characters.ts";
import {
  BELL_TOWER,
  specOfDistrict,
  type BuildTerms,
  type DistrictHook,
  type DistrictId,
} from "./districts.ts";
import { UNIQUE_BUILD, UNIQUE_EFFECTS, UNIQUE_TRIGGERS } from "./districts/effects.ts";
import { CitadelsError } from "./error.ts";
import { buildDraft, CITY_TARGET } from "./setup.ts";
import type {
  Claim,
  CitadelsPlayer,
  CitadelsState,
  Pending,
  PlacedDistrict,
  Step,
  Window,
  WindowPurpose,
} from "./state.ts";
import { windowKindFor } from "./state.ts";

export const playerOf = (state: CitadelsState, seat: SeatId): CitadelsPlayer => {
  const player = state.players.find((p) => p.seat === seat);
  if (player === undefined) throw new CitadelsError(`seat ${seat} is not a player`);
  return player;
};

export const hasSeat = (state: CitadelsState, seat: SeatId): boolean =>
  state.players.some((p) => p.seat === seat);

export const withPlayer = (state: CitadelsState, next: CitadelsPlayer): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === next.seat ? next : p)),
});

export const isResigned = (state: CitadelsState, seat: SeatId): boolean =>
  state.resigned.includes(seat);

/** Every seat still at the table. Citadels has no elimination; only resign shrinks the set. */
export const liveSeats = (state: CitadelsState): readonly SeatId[] =>
  state.players.filter((p) => !isResigned(state, p.seat)).map((p) => p.seat);

export const isTerminal = (state: CitadelsState): boolean =>
  state.phase === "over" || liveSeats(state).length <= 1;

/** The seat one step clockwise from `seat`, restricted to the live seats. */
export const nextSeat = (state: CitadelsState, seat: SeatId): SeatId => {
  const order = state.players.map((p) => p.seat);
  const from = order.indexOf(seat);
  if (from < 0) return seat;
  for (let i = 1; i <= order.length; i += 1) {
    const candidate = order[(from + i) % order.length];
    if (candidate !== undefined && !isResigned(state, candidate)) return candidate;
  }
  return seat;
};

/** Seats in clockwise order starting one step past `anchor`, restricted to `seats`. */
export const clockwise = (
  state: CitadelsState,
  anchor: SeatId,
  seats: readonly SeatId[],
): readonly SeatId[] => {
  const order = state.players.map((p) => p.seat);
  const n = order.length;
  const from = order.indexOf(anchor);
  if (from < 0) return [...seats];
  const rank = new Map<SeatId, number>();
  for (const seat of seats) {
    const at = order.indexOf(seat);
    if (at >= 0) rank.set(seat, (at - from + n) % n);
  }
  return [...seats].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
};

export const characterRank = (id: CharacterId): Rank => specOfCharacter(id).rank;

/** The cast character at a rank, or null when the cast omits that rank. */
export const characterAtRank = (state: CitadelsState, rank: Rank): CharacterId | null => {
  for (const id of state.cast) {
    if (characterRank(id) === rank) return id;
  }
  return null;
};

export const claimOf = (state: CitadelsState, seat: SeatId): Claim | null =>
  state.claimed.find((claim) => claim.seat === seat) ?? null;

/** The seat holding a character this round, or null. */
export const seatHolding = (state: CitadelsState, character: CharacterId): SeatId | null =>
  state.claimed.find((claim) => claim.character === character)?.seat ?? null;

export const isSkipped = (state: CitadelsState, character: CharacterId): boolean =>
  state.skipped.includes(character);

export const isClaimed = (state: CitadelsState, character: CharacterId): boolean =>
  state.claimed.some((claim) => claim.character === character);

/** The finish line: eight districts, or seven while the Bell Tower is in play. */
export const cityTarget = (state: CitadelsState): number =>
  bellTowerInPlay(state) ? CITY_TARGET - 1 : CITY_TARGET;

export const bellTowerInPlay = (state: CitadelsState): boolean => {
  if (state.deck.includes(BELL_TOWER) || state.discard.includes(BELL_TOWER)) return true;
  for (const player of state.players) {
    if (player.hand.includes(BELL_TOWER)) return true;
    if (player.city.some((d) => d.id === BELL_TOWER)) return true;
  }
  return false;
};

export const citySize = (player: CitadelsPlayer): number => player.city.length;

/** Draw up to `count` cards from the top of the hidden deck. */
export const deckDraw = (
  state: CitadelsState,
  count: number,
): { readonly drawn: readonly DistrictId[]; readonly deck: readonly DistrictId[] } => {
  const n = Math.max(0, Math.min(count, state.deck.length));
  return { drawn: state.deck.slice(0, n), deck: state.deck.slice(n) };
};

export const drawIntoHand = (state: CitadelsState, seat: SeatId, count: number): CitadelsState => {
  const { drawn, deck } = deckDraw(state, count);
  const player = playerOf(state, seat);
  return withPlayer({ ...state, deck }, { ...player, hand: [...player.hand, ...drawn] });
};

export const addGold = (state: CitadelsState, seat: SeatId, amount: number): CitadelsState => {
  const player = playerOf(state, seat);
  return withPlayer(state, { ...player, gold: player.gold + Math.max(0, amount) });
};

export const spendGold = (state: CitadelsState, seat: SeatId, amount: number): CitadelsState => {
  const player = playerOf(state, seat);
  const paid = Math.max(0, Math.min(amount, player.gold));
  return withPlayer(state, { ...player, gold: player.gold - paid });
};

export const transferGold = (
  state: CitadelsState,
  from: SeatId,
  to: SeatId,
  amount: number,
): CitadelsState => {
  const source = playerOf(state, from);
  const taken = Math.max(0, Math.min(amount, source.gold));
  const next = withPlayer(state, { ...source, gold: source.gold - taken });
  return addGold(next, to, taken);
};

export const withSteps = (state: CitadelsState, steps: readonly Step[]): CitadelsState => ({
  ...state,
  steps,
});

export const makeWindow = (purpose: WindowPurpose, seats: readonly SeatId[]): Window => ({
  kind: windowKindFor(purpose),
  purpose,
  seats,
});

export const windowStep = (window: Window): Step => ({ kind: "window", window });
export const winStep = (purpose: WindowPurpose, seats: readonly SeatId[]): Step =>
  windowStep(makeWindow(purpose, seats));
export const CALL: Step = { kind: "call" };
export const END_TURN: Step = { kind: "end-turn" };
export const END_ROUND: Step = { kind: "end-round" };

export const emptyPending = (actor: SeatId, character: CharacterId | null): Pending => ({
  actor,
  character,
  target: null,
  namedCharacter: null,
  namedType: null,
  cards: [],
  gold: 0,
  amount: 0,
  note: null,
});

export const withPending = (state: CitadelsState, pending: Pending | null): CitadelsState => ({
  ...state,
  pending,
});

export const patchPending = (state: CitadelsState, patch: Partial<Pending>): CitadelsState =>
  state.pending === null ? state : { ...state, pending: { ...state.pending, ...patch } };

export const actionOf = (frame: Frame<CitadelsAction>, seat: SeatId): CitadelsAction | null => {
  const entry = frame.inputs.find(([s]) => s === seat);
  if (entry === undefined || entry[1].kind !== "act") return null;
  return entry[1].action;
};

/** True when `seat` has built a city of the target size. */
export const hasCompleted = (state: CitadelsState, seat: SeatId): boolean =>
  state.completed.includes(seat) || citySize(playerOf(state, seat)) >= cityTarget(state);

/**
 * Run every unique district an owner holds that responds to `hook`. The trigger
 * each district declares lives in its own file and is aggregated by
 * `districts/effects.ts`, so a district worker never edits a shared table.
 */
export const runDistrictHooks = (
  state: CitadelsState,
  hook: DistrictHook,
  owner: SeatId,
  rest: readonly Step[],
  rng: Random,
): CitadelsState => {
  const player = playerOf(state, owner);
  let next = state;
  for (const district of player.city) {
    if (!specOfDistrict(district.id).unique) continue;
    if (!(UNIQUE_TRIGGERS[district.id] ?? []).includes(hook)) continue;
    const effect = UNIQUE_EFFECTS[district.id];
    if (effect === undefined) continue;
    next = effect({ state: next, owner, city: player.city, rest, rng });
  }
  return next;
};

// --- engine window resolvers ------------------------------------------------

export interface WindowCtx {
  readonly state: CitadelsState;
  readonly window: Window;
  readonly frame: Frame<CitadelsAction>;
  readonly rng: Random;
}

export type WindowResolver = (ctx: WindowCtx) => CitadelsState;

/** Drop the top window and continue with the rest of the stack. */
export const popWindow = (state: CitadelsState): CitadelsState =>
  withSteps(state, state.steps.slice(1));

/** The generic resolver for a window no character owns: pop and continue. */
export const resolveGeneric: WindowResolver = (ctx) => popWindow(ctx.state);

const claimsInRankOrder = (claims: readonly Claim[]): readonly Claim[] =>
  [...claims].sort(
    (a, b) => specOfCharacter(a.character).rank - specOfCharacter(b.character).rank,
  );

/** The live seats in crown order, crown holder first. */
export const crownOrder = (state: CitadelsState): readonly SeatId[] => {
  const seats = liveSeats(state);
  const at = seats.indexOf(state.crown);
  if (at < 0) return seats;
  return [...seats.slice(at), ...seats.slice(0, at)];
};

export const resolveDraftPick: WindowResolver = (ctx) => {
  const draft = ctx.state.draft;
  if (draft === null) return popWindow(ctx.state);
  const picker = ctx.window.seats[0] ?? draft.picker;
  const action = actionOf(ctx.frame, picker);
  const wanted = action?.t === "pick" ? draft.pool.indexOf(action.character) : -1;
  const index = wanted >= 0 ? wanted : draft.pool.length > 0 ? 0 : -1;
  const character = index < 0 ? undefined : draft.pool[index];
  if (character === undefined) return popWindow(ctx.state);
  const pool = draft.pool.filter((_, i) => i !== index);
  const picks = [...draft.picks, { seat: picker, character }];
  const order = draft.order.slice(1);
  const next = order[0];
  if (next !== undefined) {
    return withSteps(
      { ...ctx.state, draft: { ...draft, pool, picks, picker: next, order } },
      [winStep("draft-pick", [next]), ...ctx.state.steps.slice(1)],
    );
  }
  const claimed = claimsInRankOrder(picks);
  const first = claimed[0];
  return {
    ...ctx.state,
    draft: null,
    phase: "turn",
    claimed,
    callRank: 1,
    active: first?.seat ?? ctx.state.crown,
    steps: [...ctx.state.steps.slice(1), CALL, END_ROUND],
  };
};

/** Charge the Tax Collector's token: one gold from a builder who can spare it. */
const chargeBuildTax = (state: CitadelsState, seat: SeatId): CitadelsState => {
  if (!state.cast.includes("tax-collector")) return state;
  if (seatHolding(state, "tax-collector") === seat) return state;
  if (playerOf(state, seat).gold <= 0) return state;
  return { ...spendGold(state, seat, 1), taxPot: (state.taxPot ?? 0) + 1 };
};

/** The per-turn build limits a character overrides; everyone else gets one. */
export const BUILD_LIMITS: Partial<Record<CharacterId, number>> = {
  architect: 3,
  seer: 2,
  scholar: 2,
  navigator: 0,
};

/**
 * How many limit-counting builds a seat's character allows this turn. The
 * Architect, Seer, Scholar, and Navigator override the default of one; the
 * Trader is unlimited, but only for trade districts, so `card` names the
 * district being built.
 */
export const buildLimit = (state: CitadelsState, seat: SeatId, card?: DistrictId): number => {
  const character = claimOf(state, seat)?.character ?? null;
  if (character === "trader" && card !== undefined && specOfDistrict(card).type === "trade") {
    return Number.POSITIVE_INFINITY;
  }
  return character === null ? 1 : (BUILD_LIMITS[character] ?? 1);
};

/**
 * Fold the build terms: every unique in the builder's city answers first, then
 * the card being built answers last and overrides. So a card prices itself
 * (Framework, Necropolis, Thieves' Den) and a city card discounts it (Factory).
 * The destroy source is the district whose query last asked for a destroy, which
 * is the card a Framework build consumes.
 */
const buildTerms = (
  state: CitadelsState,
  seat: SeatId,
  card: DistrictId,
  city: readonly PlacedDistrict[],
): { readonly terms: BuildTerms; readonly destroySource: DistrictId | null } => {
  const ctx = { state, seat, card, city };
  let terms: BuildTerms = {};
  let destroySource: DistrictId | null = null;
  for (const placed of [...city, { id: card, gold: 0 }]) {
    const query = UNIQUE_BUILD[placed.id];
    if (query === undefined) continue;
    const answer = query(ctx);
    terms = { ...terms, ...answer };
    if (answer.destroy === true) destroySource = placed.id;
    else if (answer.destroy === false) destroySource = null;
  }
  return { terms, destroySource };
};

/**
 * Build a district from hand index `card` under the terms its city and the card
 * declare; otherwise do nothing. A build may be rejected for being illegal, for
 * an unaffordable gold cost, or for lacking the cards or city district an
 * alternative payment needs. The returned state carries the build's follow-up
 * windows (the Magistrate's confiscation, for a gold-paid build) as its step
 * stack, which `resolveTurn` splices below `end-turn`.
 */
export const tryBuild = (
  state: CitadelsState,
  seat: SeatId,
  card: number,
  rng: Random,
): CitadelsState => {
  const player = playerOf(state, seat);
  const id = player.hand[card];
  if (id === undefined) return withSteps(state, []);
  const { terms, destroySource } = buildTerms(state, seat, id, player.city);
  if (terms.legal === false) return withSteps(state, []);

  const cost = Math.max(0, terms.cost ?? specOfDistrict(id).cost);
  const payCards = Math.max(0, terms.payCards ?? 0);
  const destroy = terms.destroy === true;

  let gold = player.gold;
  let hand = player.hand.filter((_, i) => i !== card);
  let city = player.city;
  let discard = state.discard;
  let deck = state.deck;
  let paid = true;

  if (destroy) {
    if (city.length === 0) return withSteps(state, []);
    const at = destroySource === null ? -1 : city.findIndex((placed) => placed.id === destroySource);
    const gone = city[at < 0 ? 0 : at];
    city = city.filter((_, i) => i !== (at < 0 ? 0 : at));
    // A destroyed district sinks to the bottom of the deck, as the Warlord and Armory do.
    if (gone !== undefined) deck = [...deck, gone.id];
    paid = false;
  } else if (payCards > 0) {
    if (hand.length < payCards) return withSteps(state, []);
    discard = [...discard, ...hand.slice(0, payCards)];
    hand = hand.slice(payCards);
    paid = false;
  } else {
    if (gold < cost) return withSteps(state, []);
    gold -= cost;
  }

  const builtPlayer = { ...player, gold, hand, city: [...city, { id, gold: 0 }] };
  const counted = terms.countsAsBuild !== false;
  const builtState: CitadelsState = {
    ...withPlayer(state, builtPlayer),
    discard,
    deck,
    builtThisTurn: counted ? (state.builtThisTurn ?? 0) + 1 : (state.builtThisTurn ?? 0),
  };
  const taxed = chargeBuildTax(runDistrictHooks(builtState, "onBuild", seat, [], rng), seat);
  const magistrate = seatHolding(state, "magistrate");
  const warrant = state.warrants?.[0];
  if (paid && warrant !== undefined && magistrate !== null && seatHolding(state, warrant) === seat) {
    return withSteps(taxed, [winStep("magistrate-confiscate", [magistrate])]);
  }
  return withSteps(taxed, []);
};

/** The gather's draw: two cards, keep one, before any district adjusts it. */
export const DRAW_COUNT = 2;
export const DRAW_KEEP = 1;

/**
 * Deal the gather's cards. A pending record carries the draw count in `amount`
 * and the keep count in `gold`, so a district's `onDraw` hook can raise either
 * (Library keeps both, Observatory draws three). The cards land in
 * `pending.cards` for the `keep` window below.
 */
const drawGather = (
  state: CitadelsState,
  seat: SeatId,
  rest: readonly Step[],
  rng: Random,
): CitadelsState => {
  const armed = withPending(state, {
    ...emptyPending(seat, null),
    amount: DRAW_COUNT,
    gold: DRAW_KEEP,
  });
  const hooked = runDistrictHooks(armed, "onDraw", seat, rest, rng);
  const pending = hooked.pending ?? armed.pending;
  if (pending === null) return hooked;
  const { drawn, deck } = deckDraw(hooked, Math.max(0, pending.amount));
  return { ...hooked, deck, pending: { ...pending, cards: drawn } };
};

export const resolveTurn: WindowResolver = (ctx) => {
  const rest = ctx.state.steps.slice(1);
  const seat = ctx.window.seats[0] ?? ctx.state.active;
  if (!hasSeat(ctx.state, seat) || isResigned(ctx.state, seat)) {
    return withSteps(ctx.state, [END_TURN, ...rest]);
  }
  const action = actionOf(ctx.frame, seat);
  if (action?.t === "draw") {
    return withSteps(drawGather(ctx.state, seat, rest, ctx.rng), [winStep("keep", [seat]), END_TURN, ...rest]);
  }
  if (action?.t === "build") {
    const built = tryBuild(ctx.state, seat, action.card, ctx.rng);
    // A build succeeds when the card left the hand; only a successful build under
    // the limit re-offers a turn window, so a failed attempt ends the turn as before.
    const builtId = playerOf(ctx.state, seat).hand[action.card];
    const succeeded =
      playerOf(built, seat).hand.length < playerOf(ctx.state, seat).hand.length;
    if (succeeded && (built.builtThisTurn ?? 0) < buildLimit(ctx.state, seat, builtId)) {
      // Drop any duplicate turn windows a character effect pre-seeded so the
      // limit counter, not the pre-seeded count, decides how many builds remain.
      const below = rest.filter(
        (step) =>
          !(
            step.kind === "window" &&
            step.window.purpose === "turn" &&
            step.window.seats.includes(seat)
          ),
      );
      return withSteps(built, [...built.steps, winStep("turn", [seat]), ...below]);
    }
    return withSteps(built, [...built.steps, END_TURN, ...rest]);
  }
  const gathered = runDistrictHooks(addGold(ctx.state, seat, 2), "onIncome", seat, rest, ctx.rng);
  return withSteps(gathered, [END_TURN, ...rest]);
};

export const resolveKeep: WindowResolver = (ctx) => {
  const rest = ctx.state.steps.slice(1);
  const seat = ctx.window.seats[0] ?? ctx.state.active;
  const pool = ctx.state.pending?.cards ?? [];
  const action = actionOf(ctx.frame, seat);
  const wanted = action?.t === "keep" ? action.index : 0;
  const index = Number.isInteger(wanted) && wanted >= 0 && wanted < pool.length ? wanted : 0;
  // The gather's keep count rides on `pending.gold`; the default draw keeps one.
  const keepCount = Math.max(1, Math.min(ctx.state.pending?.gold ?? 1, pool.length));
  const kept =
    keepCount >= pool.length
      ? pool
      : index >= 0 && index < pool.length
        ? [pool[index] as DistrictId]
        : [];
  const keptIndexes = new Set(
    kept.map((card) => pool.indexOf(card)).filter((at) => at >= 0),
  );
  let next = ctx.state;
  if (kept.length > 0) {
    const player = playerOf(next, seat);
    next = withPlayer(next, { ...player, hand: [...player.hand, ...kept] });
    next = {
      ...next,
      discard: [...next.discard, ...pool.filter((_, i) => !keptIndexes.has(i))],
    };
  }
  return withSteps(withPending(next, null), rest);
};

const actorOf = (state: CitadelsState, window: Window): SeatId =>
  state.pending?.actor ?? window.seats[0] ?? state.active;

export const resolveChooseCharacter: WindowResolver = (ctx) => {
  const actor = actorOf(ctx.state, ctx.window);
  const action = actionOf(ctx.frame, actor);
  const named = action?.t === "name-character" ? action.character : null;
  return popWindow(named === null ? ctx.state : patchPending(ctx.state, { namedCharacter: named }));
};

export const resolveChooseSeat: WindowResolver = (ctx) => {
  const actor = actorOf(ctx.state, ctx.window);
  const action = actionOf(ctx.frame, actor);
  const target = action?.t === "target" ? action.seat : null;
  return popWindow(target === null ? ctx.state : patchPending(ctx.state, { target }));
};

export const resolveChooseType: WindowResolver = (ctx) => {
  const actor = actorOf(ctx.state, ctx.window);
  const action = actionOf(ctx.frame, actor);
  const type = action?.t === "name-type" ? action.type : null;
  return popWindow(type === null ? ctx.state : patchPending(ctx.state, { namedType: type }));
};

/** A threatened character's owner resolves the threat before their own turn. */
const withThreat = (
  state: CitadelsState,
  character: CharacterId,
  seat: SeatId,
  stack: readonly Step[],
): readonly Step[] =>
  (state.threats ?? []).includes(character)
    ? [winStep("blackmailer-threat", [seat]), ...stack]
    : stack;

/** Advance the rank cursor: call the next cast character, or close the round. */
export const applyCall = (state: CitadelsState): CitadelsState => {
  const rest = state.steps.slice(1);
  const rank = state.callRank;
  if (rank > 9) return withSteps(state, rest);
  const character = characterAtRank(state, rank as Rank);
  const seat = character === null ? null : seatHolding(state, character);
  const skip =
    character === null || seat === null || isSkipped(state, character) || isResigned(state, seat);
  if (skip) return withSteps({ ...state, callRank: rank + 1 }, [CALL, ...rest]);

  const witchOwner = seatHolding(state, "witch");
  if (state.bewitched === character && witchOwner !== null) {
    // The Witch plays this slot; the bewitched character's own turn is suppressed.
    const takeover: readonly Step[] = [
      winStep("witch-takeover", [witchOwner]),
      END_TURN,
      CALL,
      ...rest,
    ];
    return withSteps(
      { ...state, active: seat, callRank: rank + 1 },
      withThreat(state, character, seat, takeover),
    );
  }

  const thiefOwner = seatHolding(state, "thief");
  const turn: readonly Step[] = [winStep("turn", [seat]), END_TURN, CALL, ...rest];
  const called: readonly Step[] =
    state.robbed === character && thiefOwner !== null
      ? [winStep("thief-rob", [thiefOwner]), ...turn]
      : turn;
  return withSteps(
    { ...state, active: seat, callRank: rank + 1 },
    withThreat(state, character, seat, called),
  );
};

export const applyEndTurn = (state: CitadelsState, rng: Random): CitadelsState => {
  const rest = state.steps.slice(1);
  const hooked = runDistrictHooks(state, "onEndTurn", state.active, rest, rng);
  return withSteps(withPending({ ...hooked, builtThisTurn: 0 }, null), rest);
};

/** Clear the per-round markers; the Tax Collector's pot carries over. */
const clearRoundMarkers = (state: CitadelsState): CitadelsState => ({
  ...state,
  robbed: null,
  bewitched: null,
  threats: [],
  warrants: [],
});

export const applyEndRound = (state: CitadelsState, rng: Random): CitadelsState => {
  const rest = state.steps.slice(1);
  const round = state.round + 1;
  const finished = state.players.filter((p) => p.city.length >= cityTarget(state)).map((p) => p.seat);
  if (finished.length > 0) {
    return clearRoundMarkers({ ...state, round, phase: "over", completed: finished, steps: [] });
  }
  // A district that acts at the start of the round (the Theater) opens its
  // window here. The window queues below the new round's draft picks, so it
  // resolves once every seat has claimed and the swap lands on a card the rank
  // cursor will call.
  let started = state;
  const windows: Step[] = [];
  for (const seat of liveSeats(state)) {
    const hooked = runDistrictHooks(started, "onRoundStart", seat, [], rng);
    if (hooked === started) continue;
    windows.push(...hooked.steps);
    started = { ...hooked, steps: [] };
  }
  const draft = buildDraft(state.cast, crownOrder(state), rng);
  return clearRoundMarkers({
    ...started,
    round,
    phase: "draft",
    draft,
    claimed: [],
    skipped: [],
    callRank: 1,
    pending: null,
    steps: [winStep("draft-pick", [draft.picker]), ...windows, ...rest],
  });
};
