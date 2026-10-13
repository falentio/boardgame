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
import { museumIn, museumPlace } from "./districts/museum.ts";
import { declareSchoolOfMagic } from "./districts/school-of-magic.ts";
import {
  HAUNTED_QUARTER_TYPE_NOTE,
  offerHauntedQuarterType,
  recordHauntedQuarterType,
} from "./districts/haunted-quarter.ts";
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

/**
 * The seat holding a character this round, or null. During the Witch's resume the
 * bewitched character is played by the Witch, so its own effect must act on her
 * hand, gold, and city: the resume record names her seat and carries the
 * bewitched id, so this reports her seat for that one character. The record is
 * owned state, not the shared pending slot an effect overwrites when its own
 * turn opens.
 */
export const seatHolding = (state: CitadelsState, character: CharacterId): SeatId | null => {
  const resume = state.resume ?? null;
  if (resume !== null && resume.character === character) return resume.seat;
  return state.claimed.find((claim) => claim.character === character)?.seat ?? null;
};

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

/**
 * The `pending.note` marker that selects the Navigator's four-card branch over
 * its four-gold one. `resolveTurn` writes it from the Navigator's choice window,
 * and the Navigator effect below the resolve step reads it.
 */
export const NAVIGATOR_CARDS_NOTE = "navigator-cards";

/**
 * The `pending.note` marker a build sets when it opens the Magistrate's
 * confiscation window, carrying the gold the build spent in `pending.gold` so
 * the refund can be limited to gold (a Thieves' Den paid with cards refunds only
 * its gold share, per rules.json).
 */
export const CONFISCATE_REFUND_NOTE = "confiscate-refund";

/**
 * The `pending.note` marker the engine writes when a Cardinal's build fails for
 * lack of gold and the shortfall offer opens. `pending.amount` carries the
 * shortfall and `pending.cards[0]` the district being built, so the resolver
 * covers the gap from a named donor without giving away the card being built.
 */
export const CARDINAL_BUILD_NOTE = "cardinal-build";

/**
 * The `pending.note` marker a turn window carries once the turn's gather has
 * landed. The window below it — and any build window a successful build
 * re-offers — reads the marker and takes no gather of its own, so a turn gathers
 * exactly once and may still build (rules of record, docs/design/citadels-full-game.md:
 * "A turn: gather (2 gold, or draw 2 keep 1), then optionally build one district.").
 * `resolveTurn` clears the pending as it reads the window, so the marker never
 * leaks past the window that owns it.
 */
export const TURN_GATHERED_NOTE = "turn-gathered";

/**
 * The `pending.note` marker the Museum's once-per-turn placement offer carries.
 * The offer reuses the `keep` purpose (a district-owned purpose would need a new
 * WindowPurpose, a shared-file change); `resolveKeep` tells it apart from the
 * gather keep — which always carries the drawn pool — by this tag. The tag rides
 * the offer's pending so any standing pending the turn left (an Alchemist's build
 * spend, whose refund resolve step sits below the offer) survives it untouched.
 */
export const MUSEUM_OFFER_NOTE = "museum-offer";

export const CALL: Step = { kind: "call" };
export const RESOLVE: Step = { kind: "resolve" };
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

/** The pending a build window carries: the turn's gather already landed above it. */
export const turnGatheredPending = (seat: SeatId): Pending => ({
  ...emptyPending(seat, null),
  note: TURN_GATHERED_NOTE,
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

/** The Quarry: the one district that lets its owner hold a duplicate. */
const QUARRY: DistrictId = "quarry";

/**
 * Append every live seat whose city has reached the target to `completed`, in
 * roster order, without duplicating a seat already recorded. Called when a turn
 * opens and after each successful build, so `completed` carries finish order
 * (the +4 goes to the seat that finished first) rather than roster order.
 */
export const recordFinished = (state: CitadelsState): CitadelsState => {
  const target = cityTarget(state);
  const newly = state.players
    .filter(
      (player) =>
        !state.completed.includes(player.seat) &&
        !isResigned(state, player.seat) &&
        player.city.length >= target,
    )
    .map((player) => player.seat);
  return newly.length === 0 ? state : { ...state, completed: [...state.completed, ...newly] };
};

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

/**
 * The character taking the current turn for `seat`. `applyCall` advances
 * `callRank` past the rank it calls, so the character being played is
 * `callRank - 1`; a hand-built state that never ran the cursor falls back to
 * the seat's own claim. Used to key the Tax Collector's exemption on the
 * character in play, not the seat, in the 2-3 player games where a seat drafts
 * two characters.
 */
export const activeCharacterOf = (state: CitadelsState, seat: SeatId): CharacterId | null => {
  const played = state.callRank - 1;
  if (played >= 1 && played <= 9) {
    const at = characterAtRank(state, played as Rank);
    if (at !== null && seatHolding(state, at) === seat) return at;
  }
  return claimOf(state, seat)?.character ?? null;
};

/**
 * Charge the Tax Collector's token: one gold from a builder who can spare it.
 * The Tax Collector character itself pays no tax, but in a 2-3 player game a
 * seat holds two characters, so building with the seat's other character still
 * pays.
 */
const chargeBuildTax = (state: CitadelsState, seat: SeatId): CitadelsState => {
  if (!state.cast.includes("tax-collector")) return state;
  if (activeCharacterOf(state, seat) === "tax-collector") return state;
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
  // The Witch's resume plays the bewitched character's turn with the Witch's
  // resources, so its limit is the bewitched character's: the owned resume record
  // names her seat and the character she plays.
  const resume = state.resume ?? null;
  const resumed = resume !== null && resume.seat === seat ? resume.character : null;
  const character = resumed ?? activeCharacterOf(state, seat);
  if (character === "trader" && card !== undefined && specOfDistrict(card).type === "trade") {
    return Number.POSITIVE_INFINITY;
  }
  return character === null ? 1 : (BUILD_LIMITS[character] ?? 1);
};

/**
 * The base rule forbids building a district already standing in the builder's
 * city; the Quarry (one duplicate) and the Wizard's turn ability are the two
 * permissions. A duplicate with neither permission is refused.
 */
const duplicateBlocked = (state: CitadelsState, seat: SeatId, id: DistrictId): boolean => {
  const city = playerOf(state, seat).city;
  if (!city.some((district) => district.id === id)) return false;
  if (city.some((district) => district.id === QUARRY)) return false;
  const character = activeCharacterOf(state, seat) ?? state.pending?.character ?? null;
  return character !== "wizard";
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
 * Record the gold a build paid on the turn-local pending, but only for the
 * Alchemist, whose end-of-turn ability reads it back. Every other character
 * leaves `pending` untouched, so the Museum's bare-pending sentinel is preserved
 * and a build never misroutes the Museum's placement offer.
 */
const recordAlchemistSpend = (
  state: CitadelsState,
  seat: SeatId,
  goldPaid: number,
): CitadelsState =>
  goldPaid <= 0 || activeCharacterOf(state, seat) !== 'alchemist'
    ? state
    : withPending(state, {
        ...emptyPending(seat, 'alchemist'),
        gold: (state.pending?.gold ?? 0) + goldPaid,
      });

/**
 * A threatened player must resolve the threat before using abilities or building
 * (rules.json blackmailer). `resolveTurn` reorders a threatened seat's own turn
 * window below the marker, but a character effect may hoist a build window that
 * reorder never sees: the Trader opens its trade-build window above the turn
 * window, so it drained first and the seat built four trade districts with its
 * marker still standing (D12-4). The build seam itself therefore refuses while
 * the marker stands, wherever in the stack the effect left its window, and the
 * character's own limit counter re-offers the window once the marker is spent.
 */
const buildBlockedByThreat = (state: CitadelsState, seat: SeatId): boolean => {
  const character = activeCharacterOf(state, seat);
  return character !== null && (state.threats ?? []).includes(character);
};

/**
 * Build a district from hand index `card` under the terms its city and the card
 * declare; otherwise do nothing. A build may be rejected for being illegal, for
 * an unaffordable gold cost, for a standing Blackmailer marker, or for lacking
 * the cards or city district an alternative payment needs. The returned state
 * carries the build's follow-up windows (the Magistrate's confiscation, for a
 * gold-paid build) as its step stack, which `resolveTurn` splices below
 * `end-turn`.
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
  if (duplicateBlocked(state, seat, id)) return withSteps(state, []);
  if (buildBlockedByThreat(state, seat)) return withSteps(state, []);
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
  let goldPaid = cost;

  if (destroy) {
    if (city.length === 0) return withSteps(state, []);
    const at = destroySource === null ? -1 : city.findIndex((placed) => placed.id === destroySource);
    const gone = city[at < 0 ? 0 : at];
    city = city.filter((_, i) => i !== (at < 0 ? 0 : at));
    // A destroyed district and any cards tucked under it sink to the bottom of
    // the deck, as the Warlord and Armory do (Museum: "if destroyed the cards are
    // discarded to the bottom of the deck").
    if (gone !== undefined) deck = [...deck, gone.id, ...(gone.cards ?? [])];
    paid = false;
    goldPaid = 0;
  } else if (payCards > 0) {
    // The card share covers `payCards` gold of the cost; the builder still owes
    // the remainder in gold. The Thieves' Den names the card share and so debits
    // the difference here rather than building for free.
    const goldShare = Math.max(0, cost - payCards);
    if (hand.length < payCards || gold < goldShare) return withSteps(state, []);
    discard = [...discard, ...hand.slice(0, payCards)];
    hand = hand.slice(payCards);
    gold -= goldShare;
    goldPaid = goldShare;
  } else {
    if (gold < cost) return withSteps(state, []);
    gold -= cost;
  }

  const builtPlayer = { ...player, gold, hand, city: [...city, { id, gold: 0 }] };
  const counted = terms.countsAsBuild !== false;
  const builtState: CitadelsState = recordAlchemistSpend(
    recordFinished({
      ...withPlayer(state, builtPlayer),
      discard,
      deck,
      builtThisTurn: counted ? (state.builtThisTurn ?? 0) + 1 : (state.builtThisTurn ?? 0),
    }),
    seat,
    goldPaid,
  );
  const taxed = chargeBuildTax(runDistrictHooks(builtState, "onBuild", seat, [], rng), seat);
  const magistrate = seatHolding(state, "magistrate");
  const warrant = state.warrants?.[0];
  // A build that paid in gold or cards is confiscatable; a build that destroyed a
  // district (Framework, Necropolis) is not. The gold spent rides on pending so
  // the Magistrate refunds only gold, never the cards a Den consumed.
  if (paid && warrant !== undefined && magistrate !== null && seatHolding(state, warrant) === seat) {
    const carrying = withPending(taxed, {
      ...emptyPending(magistrate, null),
      note: CONFISCATE_REFUND_NOTE,
      gold: goldPaid,
    });
    return withSteps(carrying, [winStep("magistrate-confiscate", [magistrate])]);
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

/**
 * The Museum's once-per-turn placement offer. It appends a `keep` window after
 * the turn's continuation once the turn's last build window has resolved, so
 * the owner may tuck a card under it after gathering and building. The offer
 * reuses the `keep` purpose (a district-owned purpose would need a new
 * WindowPurpose, a shared-file change) and tags its pending with
 * MUSEUM_OFFER_NOTE so `resolveKeep` routes it to the Museum rather than the
 * gather keep. The tag carries any standing pending the turn left — an
 * Alchemist's build spend, whose refund resolve step sits below the offer — so
 * that pending survives the offer untouched. A note an intervening window above
 * owns (the Magistrate's confiscate refund) is left alone; that window clears
 * pending before the offer opens. A turn window still standing in `cont` means
 * the turn has another build, so no offer.
 */
const withMuseumOffer = (
  state: CitadelsState,
  seat: SeatId,
  cont: readonly Step[],
): { readonly state: CitadelsState; readonly steps: readonly Step[] } => {
  if (!museumIn(state, seat)) return { state, steps: cont };
  const hasTurn = cont.some(
    (step) =>
      step.kind === "window" &&
      step.window.purpose === "turn" &&
      step.window.seats.includes(seat),
  );
  if (hasTurn) return { state, steps: cont };
  const standing = state.pending;
  const tagged: Pending =
    standing !== null && standing.note !== null
      ? standing
      : { ...(standing ?? emptyPending(seat, null)), note: MUSEUM_OFFER_NOTE };
  return { state: withPending(state, tagged), steps: [winStep("keep", [seat]), ...cont] };
};

/**
 * The continuation a turn hands to the round. The engine's turn stack already
 * carries the turn's single END_TURN at the head of the turn window's rest; a
 * hand-built stack may omit it. Reuse the continuation's own END_TURN when it is
 * there, else supply one, so end-of-turn districts fire exactly once per turn.
 */
const endTurnThen = (rest: readonly Step[]): readonly Step[] => {
  // The turn's own END_TURN can sit below steps the turn still owes: a bare
  // post-threat resolve marker, an arm step re-arming a deferred ability payload,
  // or the relocated ability windows themselves (D13) all land between the
  // post-threat build window and that END_TURN. Reuse the turn's own END_TURN
  // wherever it sits rather than prepending a second one. A duplicate END_TURN
  // closes the turn before those steps drain, so the relocated abilities run with
  // no payload and re-offer forever, and the end-of-turn hooks fire twice.
  return rest.some((step) => step.kind === "end-turn") ? rest : [END_TURN, ...rest];
};

/** The gather: 2 gold, then any `onIncome` district hooks (the School of Magic). */
const gatherGold = (
  state: CitadelsState,
  seat: SeatId,
  rest: readonly Step[],
  rng: Random,
): CitadelsState => runDistrictHooks(addGold(state, seat, 2), "onIncome", seat, rest, rng);

/**
 * The seat's own turn windows, dropped from a continuation so the build limit
 * counter — not the pre-seeded window count — decides how many builds remain. A
 * character that pre-seeds several build windows (the Architect's three) keeps
 * exactly the one the turn's gather hands it; the limit re-offers the rest.
 */
const withoutTurnWindows = (steps: readonly Step[], seat: SeatId): readonly Step[] =>
  steps.filter(
    (step) =>
      !(
        step.kind === "window" &&
        step.window.purpose === "turn" &&
        step.window.seats.includes(seat)
      ),
  );

/** True for a seat's Blackmailer threat window, wherever it sits in the stack. */
const isThreatWindow = (step: Step): boolean =>
  step.kind === "window" && step.window.purpose === "blackmailer-threat";

/**
 * After a character's effect runs, relocate the ability windows it pushed above
 * its gather turn window so they drain AFTER the gather, exactly where a refused
 * threat's relocated ability runs.
 *
 * A threatened turn: the windows sit below the Blackmailer threat window, so the
 * resolved stack reads [turn(gather), threat, effectWindows..., END_TURN, ...] -
 * the order rules.json (blackmailer) requires: "they must gather resources, then
 * resolve the threat ... A threatened player must resolve the threat before using
 * abilities or building". Without the move they drain before the threat opens and
 * the ability lands with the marker still standing (D13-1..11).
 *
 * A plain turn: the windows sit below the gather turn window itself, so the stack
 * reads [turn(gather), arm, effectWindows..., END_TURN, ...]. rules of record
 * (docs/design/citadels-full-game.md): "A turn: gather (2 gold, or draw 2 keep 1),
 * then optionally build one district." The threat is spliced INTO the seat's own
 * turn, so the plain turn must be the same order with no threat standing - gather
 * -> abilities -> build - or a purse-gated ability (the Warlord's destroy, the
 * Marshal's seize, the Diplomat's exchange, the Abbot's richest clause) reads a
 * different purse on a refused turn than on a plain one and the refused seat no
 * longer ends where its plain turn ends (D15).
 *
 * The Witch's held turn is exempt: her naming window drives her whole
 * resume/takeover pairing, which resolveTurn sequences off the pending she clears,
 * so relocating it would double-count her gather; her turn keeps the shape
 * resolveTurn already established (Witch markers ride).
 */
export const relocateEffectBelowThreat = (
  steps: readonly Step[],
  pending: Pending | null,
  seat: SeatId,
  character: CharacterId | null,
  resumed = false,
): readonly Step[] => {
  if (character === "witch") return steps;
  // A resumed turn has no gather, so the ability windows stay ABOVE the resume
  // turn window (which resolves as the build): the turn reads abilities -> build,
  // the order a plain turn reaches after its gather. Relocating them below would
  // put the build window ahead of the ability (D19-1/D19-2).
  if (resumed) return steps;
  const turnAt = steps.findIndex(
    (step) => step.kind === "window" && step.window.purpose === "turn" && step.window.seats.includes(seat),
  );
  if (turnAt < 0) return steps;
  const threatAt = steps.findIndex(isThreatWindow);
  const head = steps.slice(0, turnAt);
  const turn = steps[turnAt] as Step;
  // Relocate only the effect's FIRST pass. A first pass runs with the gather turn
  // window ahead of it and the effect's own windows (if any) pushed above that
  // window. A later pass (the Spy's second and third, the Blackmailer's second
  // marker, the Assassin's commit) runs with the turn's BUILD window already
  // placed and a turn-gathered arm step planted directly above it: relocating
  // there would hoist the build window over the arm step that arms its gather
  // marker, so the build window would gather a second time - the Spy measured
  // three gathers and a goldDelta of 6 where 4 is correct. An arm step in the
  // segment above the turn window therefore marks a later pass; leave the stack
  // alone. Only a first pass has an ability window above the gather turn window;
  // an effect that pushed no window (the Alchemist's settle resolve, the
  // income-only characters) has nothing to relocate.
  const hasArmAbove = head.some((step) => step.kind === "arm");
  const hasWindowAbove = head.some((step) => step.kind === "window");
  if (hasArmAbove || !hasWindowAbove) return steps;
  // The ability windows read the payload the effect armed (the Warlord's pick,
  // the Scholar's drawn pool, the Thief's named victim). The turn window's gather
  // (and the threat, when one stands) overwrites pending before those windows
  // drain, so the payload rides an arm step instead, re-armed exactly where the
  // relocated windows need it. An effect that pushed no window above the turn
  // window (the Alchemist's settle resolve already sits below it) needs no arm.
  const carried: readonly Step[] =
    head.length === 0 || pending === null || pending.character !== character
      ? head
      : [{ kind: "arm", pending } as Step, ...head];
  if (threatAt < 0) {
    // The plain turn: the ability drains after the gather, so the stack reads
    // [turn(gather), arm, ...abilityWindows, END_TURN, ...]. resolveTurn's gather
    // branch then plants the build window above END_TURN, giving the rule's
    // gather -> abilities -> build order.
    return [turn, ...carried, ...steps.slice(turnAt + 1)];
  }
  if (turnAt >= threatAt) return steps;
  const mid = steps.slice(turnAt, threatAt);
  const threat = steps[threatAt] as Step;
  return [...mid, threat, ...carried, ...steps.slice(threatAt + 1)];
};

export const resolveTurn: WindowResolver = (ctx) => {
  // Record any seat that finished on an earlier turn before this turn's build, so
  // `completed` carries finish order and not roster order. Preserve the two markers
  // a turn carries across its own windows — the Witch's resume (her build turn) and
  // the turn's gathered marker (a build window below the gather) — and clear any
  // other character pending the effect above the turn window left behind.
  const incoming = ctx.state.pending;
  const resume = ctx.state.resume ?? null;
  const gatheredPending = incoming?.note === TURN_GATHERED_NOTE ? incoming : null;
  const state = withPending(recordFinished(ctx.state), gatheredPending);
  const rest = state.steps.slice(1);
  const seat = ctx.window.seats[0] ?? state.active;
  const resumedWitch = resume !== null && resume.seat === seat;
  if (!hasSeat(state, seat) || isResigned(state, seat)) {
    return withSteps(state, endTurnThen(rest));
  }
  const action = actionOf(ctx.frame, seat);
  // The Witch plays two turns with one seat. Her held turn (her own rank) is put
  // on hold: no gather (her fixed +2 was the gather) and no build ("you cannot
  // build"), so it closes at once. The window stays in the stack so the engine
  // pauses here, keeping the bewitch recorded. Her resumed turn (the bewitched
  // character's rank) is marked by `resumePending` and builds without gathering.
  const heldWitch =
    !resumedWitch && incoming === null && activeCharacterOf(state, seat) === "witch";
  if (heldWitch) return withSteps(state, endTurnThen(rest));
  const playedCharacter = activeCharacterOf(state, seat);
  // The Navigator's turn window is its gain choice, not a gather: a draw names the
  // four-card branch, anything else the four-gold one. The choice rides pending.note
  // for the resolve step above the turn window to read. Its effect strips the build
  // windows, so the turn carries no build either.
  if (playedCharacter === "navigator") {
    const note = action?.t === "draw" ? NAVIGATOR_CARDS_NOTE : null;
    const armed = withPending(state, { ...emptyPending(seat, "navigator"), note });
    // The Navigator's gain resolves first (its choice rides pending.note), then the
    // Museum's placement offer opens on the turn's close — the continuation an
    // ordinary turn reaches through closeTurn. A threatened Navigator's threat
    // window leads its resolve, so the offer follows the resolve, not the window.
    const at = rest.findIndex((step) => step.kind === "resolve");
    if (at < 0) return withSteps(armed, rest);
    const below = rest.slice(at + 1);
    // A threatened Navigator's threat window leads that continuation, so the offer
    // splices below it, where a threatened seat's deferred build window sits:
    // rules.json (blackmailer) "A threatened player must resolve the threat before
    // using abilities or building", and the Museum's placement is an ability.
    const threatAt = below.findIndex(
      (step) => step.kind === "window" && step.window.purpose === "blackmailer-threat",
    );
    const offer = withMuseumOffer(
      armed,
      seat,
      endTurnThen(withoutTurnWindows(threatAt < 0 ? below : below.slice(threatAt + 1), seat)),
    );
    return withSteps(offer.state, [
      ...rest.slice(0, at + 1),
      ...below.slice(0, threatAt < 0 ? 0 : threatAt + 1),
      ...offer.steps,
    ]);
  }

  // The turn's build window. The gather already landed above it (or the Witch
  // already gathered on her held turn), so it takes no gather of its own. Its
  // marker rides pending so it survives the windows between the gather and it —
  // the gather's keep, the Blackmailer's threat, or the Cardinal's shortfall offer.
  const buildWindow = winStep("turn", [seat]);
  const markGathered = (s: CitadelsState): CitadelsState =>
    withPending(
      s,
      resumedWitch
        ? emptyPending(seat, resume?.character ?? null)
        : turnGatheredPending(seat),
    );
  // End the turn, clearing the turn marker so a following Museum keep (which the
  // gather keep distinguishes by a bare pending) is not misrouted. The Alchemist's
  // settle pending (character "alchemist", note null) is left for its resolve step.
  const clearMarker = (s: CitadelsState): CitadelsState => {
    const note = s.pending?.note ?? null;
    return note === TURN_GATHERED_NOTE ? withPending(s, null) : s;
  };
  const closeTurn = (s: CitadelsState, cont: readonly Step[]): CitadelsState => {
    const cleared = clearMarker(s);
    const offer = withMuseumOffer(cleared, seat, endTurnThen(withoutTurnWindows(cont, seat)));
    return withSteps(offer.state, offer.steps);
  };
  // Apply a build: a legal, affordable build lands; a Cardinal build short of gold
  // opens the shortfall offer and retries below it; a build under the limit re-offers
  // the build window; anything else ends the turn. The build's own follow-up windows
  // (the Magistrate's confiscation) lead the continuation.
  const applyBuild = (
    base: CitadelsState,
    card: number,
    cont: readonly Step[],
  ): CitadelsState => {
    const built = tryBuild(base, seat, card, ctx.rng);
    const builtId = playerOf(base, seat).hand[card];
    const succeeded =
      playerOf(built, seat).hand.length < playerOf(base, seat).hand.length;
    if (!succeeded && !resumedWitch && playedCharacter === "cardinal" && builtId !== undefined) {
      const shortfall = Math.max(0, specOfDistrict(builtId).cost - playerOf(base, seat).gold);
      if (shortfall > 0) {
        const armed = withPending(base, {
          ...emptyPending(seat, "cardinal"),
          amount: shortfall,
          cards: [builtId],
          note: CARDINAL_BUILD_NOTE,
        });
        return withSteps(armed, [winStep("cardinal-gold", [seat]), buildWindow, ...cont]);
      }
    }
    if (succeeded && (built.builtThisTurn ?? 0) < buildLimit(base, seat, builtId)) {
      return withSteps(markGathered(built), [
        ...built.steps,
        buildWindow,
        ...withoutTurnWindows(cont, seat),
      ]);
    }
    const cleared = clearMarker(built);
    const offer = withMuseumOffer(cleared, seat, endTurnThen(withoutTurnWindows(cont, seat)));
    return withSteps(offer.state, [...built.steps, ...offer.steps]);
  };

  const threatened =
    !resumedWitch &&
    playedCharacter !== null &&
    (state.threats ?? []).includes(playedCharacter);
  // The threatened seat's turn window is visited twice: the pre-threat window,
  // with the threat window standing directly below it, and the post-threat window
  // below the resolved threat. Resolving the threat drops the character from
  // `threats` and clears the pending the gathered marker rode, so the post-threat
  // window is told from the stack instead: a bare resolve step standing under it
  // marks a gather that already landed. The bare step runs nothing, so draining
  // it costs no input and no effect. Reading the INCOMING pending is what tells
  // the marker apart from a character's own resolve step below its turn window:
  // the Alchemist's settle step carries that character's pending, while the
  // reveal left none behind.
  const postThreat = incoming === null && rest[0]?.kind === "resolve";
  const alreadyGathered = resumedWitch || gatheredPending !== null || postThreat;

  // A threatened seat must gather, then resolve the threat, then build: the gather
  // lands on this window, the threat window opens on the post-gather gold, and a
  // build window sits below the threat, so nothing stands in the city while the
  // threat is open (rules.json blackmailer).
  if (threatened && !alreadyGathered) {
    // SEARCH the stack for the threat window instead of reading its top: the
    // character's own effect reshapes the stack above it. The Architect and the
    // Scholar hoist their extra build windows above the threat, and the Alchemist
    // splices its settle resolve between this window and the threat, so the
    // threat window is not at rest[0] and a build window runs ahead of it
    // (D12-1..3). Whatever the shape, the seat gathers on this window, opens the
    // threat on the post-gather purse, and builds only below the resolved threat:
    // rules.json (blackmailer) "A threatened player must resolve the threat
    // before using abilities or building".
    const threatAt = rest.findIndex(isThreatWindow);
    const threat = threatAt < 0 ? undefined : rest[threatAt];
    // The continuation the resolved threat hands the turn: the steps hoisted above
    // the threat that are not this seat's own build windows (the effect's relocated
    // ability windows with their arm step, or the Alchemist's settle resolve),
    // followed by the steps that stood below the threat. Pre-seeded build windows
    // drop because the build limit re-offers them from its own counter (see
    // withoutTurnWindows).
    const below =
      threatAt < 0
        ? rest
        : [
            ...withoutTurnWindows(rest.slice(0, threatAt), seat),
            ...rest.slice(threatAt + 1),
          ];
    // Where the turn's build window belongs below the resolved threat. The plain
    // turn builds AFTER its ability: the effect's windows sit above its gather
    // window, so they precede its build (the Scholar draws and keeps before it
    // builds the kept card, the Marshal seizes before it builds). A threatened
    // seat builds after its relocated ability windows too, above the turn's own
    // END_TURN. An effect resolve that must run after the build (the Alchemist's
    // settle refund) leads the continuation instead, so there the build window
    // goes directly under the threat and that resolve stays beneath it.
    //
    // Either way the build window takes no second gather. The Alchemist's settle
    // resolve already stands directly beneath it, and elsewhere a turn-gathered
    // arm step is planted directly beneath it, so the build window reads the same
    // marker a build window an ordinary turn re-offers carries (TURN_GATHERED_NOTE)
    // rather than depending on the pending the relocated abilities leave behind.
    const leadsWithResolve = below[0]?.kind === "resolve";
    const endAt = below.findIndex((step) => step.kind === "end-turn");
    const ability: readonly Step[] =
      leadsWithResolve || endAt < 0 ? below : below.slice(0, endAt);
    const close: readonly Step[] = leadsWithResolve || endAt < 0 ? [] : below.slice(endAt);
    const rearm: Step = { kind: "arm", pending: turnGatheredPending(seat) };
    const belowThreat: readonly Step[] =
      threat === undefined
        ? [buildWindow, ...rest]
        : leadsWithResolve
          ? [threat, buildWindow, ...ability]
          : [threat, ...ability, rearm, buildWindow, ...close];
    if (action?.t === "draw") {
      const gathered = drawGather(state, seat, rest, ctx.rng);
      return withSteps(gathered, [winStep("keep", [seat]), ...belowThreat]);
    }
    const gathered = gatherGold(state, seat, rest, ctx.rng);
    return withSteps(markGathered(gathered), belowThreat);
  }

  // The build window: the gather already landed, so take the build or end the turn.
  if (alreadyGathered) {
    if (action?.t === "build") return applyBuild(state, action.card, rest);
    return closeTurn(state, rest);
  }

  // The gather window: land the gather, then leave the turn's build window below.
  // The character's relocated ability windows drain between the gather and the
  // build, so the turn reads gather -> abilities -> build - the same order a
  // refused threat's relocated ability reaches below its threat. A plain turn's
  // continuation therefore holds [arm, ...abilityWindows, END_TURN, ...] and the
  // build window goes after those windows and above the turn's own END_TURN,
  // exactly as the threatened branch places it. An effect whose resolve must run
  // after the build (the Alchemist's settle refund) leads the continuation
  // instead, and a hand-built stack with no END_TURN keeps its build window
  // directly below the gather, where endTurnThen supplies the close.
  const afterGather = (below: readonly Step[]): readonly Step[] => {
    const leadsWithResolve = below[0]?.kind === "resolve";
    const endAt = below.findIndex((step) => step.kind === "end-turn");
    if (leadsWithResolve || endAt < 0) return [buildWindow, ...endTurnThen(below)];
    const ability = below.slice(0, endAt);
    const close = below.slice(endAt);
    // With no ability window between the gather and the close the build window
    // keeps its old place directly below the gather; only a real ability needs
    // its payload re-armed below the build window.
    if (ability.length === 0) return [buildWindow, ...close];
    const rearm: Step = { kind: "arm", pending: turnGatheredPending(seat) };
    return [...ability, rearm, buildWindow, ...close];
  };

  if (action?.t === "draw") {
    const gathered = drawGather(state, seat, rest, ctx.rng);
    return withSteps(gathered, [
      winStep("keep", [seat]),
      ...afterGather(withoutTurnWindows(rest, seat)),
    ]);
  }
  const gathered = gatherGold(state, seat, rest, ctx.rng);
  const below = withoutTurnWindows(rest, seat);
  const endAt = below.findIndex((step) => step.kind === "end-turn");
  // The ability windows an effect pushed below the gather must drain before the
  // build (gather -> abilities -> build). When one stands there, a build reported
  // at the gather window is deferred to the build window those abilities hand the
  // turn, so the build cannot land ahead of the ability that must precede it -
  // exactly the order the threatened branch reaches below its threat. A turn with
  // no such ability window (a hand-built stack, or an income-only character) keeps
  // the immediate build so its fixtures are unchanged.
  const hasAbility = below
    .slice(0, endAt < 0 ? below.length : endAt)
    .some((step) => step.kind === "window");
  if (action?.t === "build" && !hasAbility) return applyBuild(gathered, action.card, rest);
  return withSteps(markGathered(gathered), afterGather(below));
};

export const resolveKeep: WindowResolver = (ctx) => {
  const rest = ctx.state.steps.slice(1);
  const seat = ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, seat);
  const pending = ctx.state.pending;
  // The gather keep always carries the drawn pool on `pending`; the Museum's
  // placement offer is tagged MUSEUM_OFFER_NOTE (carrying any standing pending —
  // an Alchemist's build spend — through untouched), a Navigator's offer keeps its
  // gain record (its choice owns the note), and a hand-built offer window carries
  // no pending at all. Anything else is the gather keep.
  if (pending === null || pending.note === MUSEUM_OFFER_NOTE || pending.character === "navigator") {
    return withSteps(museumPlace(ctx.state, seat, action), rest);
  }
  const pool = pending.cards;
  const wanted = action?.t === "keep" ? action.index : 0;
  const index = Number.isInteger(wanted) && wanted >= 0 && wanted < pool.length ? wanted : 0;
  // The gather's keep count rides on `pending.gold`; the default draw keeps one.
  const keepCount = Math.max(1, Math.min(pending.gold, pool.length));
  // Track kept cards by position, not by id: a pool may hold two identical cards,
  // and `pool.indexOf` would collapse them and mis-route a copy to the deck.
  const keptIndexes = new Set<number>();
  if (keepCount >= pool.length) {
    for (let i = 0; i < pool.length; i += 1) keptIndexes.add(i);
  } else {
    keptIndexes.add(index);
  }
  let next = ctx.state;
  if (keptIndexes.size > 0) {
    const kept = [...keptIndexes].map((at) => pool[at] as DistrictId);
    const player = playerOf(next, seat);
    next = withPlayer(next, { ...player, hand: [...player.hand, ...kept] });
    // The unkept cards came from the hidden deck, so they sink back to its bottom
    // rather than into the public discard pile, which would reveal them.
    const unkept = pool.filter((_, i) => !keptIndexes.has(i));
    next = { ...next, deck: [...next.deck, ...unkept] };
  }
  // The turn's gather already landed, so the build window below takes no second
  // gather: hand it the gathered marker.
  return withSteps(withPending(next, turnGatheredPending(seat)), rest);
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
  if (type === null) return popWindow(ctx.state);
  // The Haunted Quarter's choice rides this window too, tagged by its own note;
  // it records the type on the card at once, where the Spy carries the type on
  // to its peek pass in `pending.namedType`.
  if (ctx.state.pending?.note === HAUNTED_QUARTER_TYPE_NOTE) {
    return popWindow(withPending(recordHauntedQuarterType(ctx.state, actor, type), null));
  }
  return popWindow(patchPending(ctx.state, { namedType: type }));
};

/**
 * A threatened character's owner gathers resources first, then resolves the
 * threat (rules.json blackmailer: "they must gather resources, then resolve the
 * threat"). The window the gather lands on therefore sits above the threat
 * window: an ordinary character gathers on its turn window, so the threat is
 * spliced directly below it (above the turn's END_TURN) and opens on the
 * post-gather gold; the Navigator gathers on the resolve step below its turn
 * window, so the threat is spliced below that resolve and opens on the post-gain
 * purse. A stack with neither (the Witch's takeover) gets the threat prepended.
 */
const withThreat = (
  state: CitadelsState,
  character: CharacterId,
  seat: SeatId,
  stack: readonly Step[],
): readonly Step[] => {
  if (!(state.threats ?? []).includes(character)) return stack;
  // The threatened seat completes its gather before the threat opens, so the
  // window the gather lands on must sit above the threat. For every character but
  // the Navigator that is the turn window, and the threat goes directly below it,
  // above the turn's END_TURN. The Navigator's turn window is its gain choice and
  // its gain rides the resolve step below it, so the threat goes below that
  // resolve: the gain lands first and the threat opens on the post-gain purse
  // (rules.json blackmailer: "they must gather resources, then resolve the
  // threat").
  const at =
    character === "navigator"
      ? stack.findIndex((step) => step.kind === "resolve")
      : stack.findIndex((step) => step.kind === "window" && step.window.purpose === "turn");
  if (at < 0) return [winStep("blackmailer-threat", [seat]), ...stack];
  return [
    ...stack.slice(0, at + 1),
    winStep("blackmailer-threat", [seat]),
    ...stack.slice(at + 1),
  ];
};

/**
 * The steps from the resolve that runs a character's ability through the turn
 * window to the turn's END_TURN, followed by the continuation `rest`. The
 * Navigator's turn window IS its gain choice, so it opens above the resolve that
 * reads the choice from pending.note; every other character opens its ability
 * windows above the gather turn window and resolves below it. `applyCall` arms
 * an ordinary turn as this shape plus a trailing CALL; the Witch's resume arms
 * the bewitched character's turn with the SAME shape, so a resumed turn is that
 * character's own turn, not a generic template.
 */
export const armCharacterTurn = (
  character: CharacterId | null,
  seat: SeatId,
  rest: readonly Step[],
): readonly Step[] =>
  character === "navigator"
    ? [winStep("turn", [seat]), RESOLVE, END_TURN, ...rest]
    : [RESOLVE, winStep("turn", [seat]), END_TURN, ...rest];

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
    // The resume supplies the bewitched turn's END_TURN (armCharacterTurn), so
    // the takeover carries no END_TURN of its own: the witch-takeover window
    // gathers for the bewitched owner, then witch-resume arms that turn.
    const takeover: readonly Step[] = [winStep("witch-takeover", [witchOwner]), CALL, ...rest];
    return withSteps(
      { ...state, active: seat, callRank: rank + 1 },
      withThreat(state, character, seat, takeover),
    );
  }

  // Arm the character's pending record and push a resolve step above the turn
  // window: the resolve branch runs CHARACTER_EFFECTS[character] with the turn
  // window as its `rest`, and the steps it returns become the turn. Any window
  // the effect opens (the Warlord's destroy, the Assassin's naming) sits above the
  // gather so it resolves first.
  // The School of Magic declares its colour when the turn opens, above the
  // resolve step that runs this character's income, so the income counts it.
  const declared = declareSchoolOfMagic(state, seat, character);
  const armed = withPending(declared, emptyPending(seat, character));
  const thiefOwner = seatHolding(state, "thief");
  // The Navigator's turn window is its gain choice, so it must resolve before
  // the resolve step that reads the choice from pending.note.
  const turn: readonly Step[] = armCharacterTurn(character, seat, [CALL, ...rest]);
  const called: readonly Step[] =
    state.robbed === character && thiefOwner !== null
      ? [winStep("thief-rob", [thiefOwner]), ...turn]
      : turn;
  return withSteps(
    { ...armed, active: seat, callRank: rank + 1 },
    withThreat(armed, character, seat, called),
  );
};

export const applyEndTurn = (state: CitadelsState, rng: Random): CitadelsState => {
  const rest = state.steps.slice(1);
  const hooked = runDistrictHooks(state, "onEndTurn", state.active, rest, rng);
  const cleared = withPending({ ...hooked, builtThisTurn: 0, resume: null }, null);
  // The Armory's "on your turn" clause: offer its destroy window once per turn,
  // at the end of the acting seat's turn, above the round's continuation. Every
  // other onDestroy district (the Great Wall, the Keep) is a query, not a window.
  const destroyed = runDistrictHooks(cleared, "onDestroy", state.active, rest, rng);
  const settled = destroyed === cleared ? withSteps(cleared, rest) : destroyed;
  // The Haunted Quarter's owner names its counted type before scoring; the offer
  // rides the end-of-turn seam, like the Museum's placement offer.
  return offerHauntedQuarterType(settled, settled.active, settled.steps);
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
  // `completed` already holds every seat that reached the target in finish order,
  // appended by recordFinished when a turn opened or a build landed. Recording
  // here catches any seat a hand-built state left unrecorded, without reordering.
  const recorded = recordFinished(state);
  if (recorded.completed.length > 0) {
    return clearRoundMarkers({ ...recorded, round, phase: "over", steps: [] });
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
