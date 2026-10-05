import type { Frame, FrameIndex, Random, SeatInput, SeatId } from "../../index.ts";
import type { G54Action } from "./actions.ts";
import { EXTRA_EFFECTS, ROLE_EFFECTS, type ExtraCtx, type RoleCtx } from "./effects.ts";
import { G54Error } from "./error.ts";
import {
  fallbackGeneral,
  GENERAL_ACTIONS,
  generalActionsFor,
  type GeneralActionId,
} from "./generals.ts";
import {
  activeClaim,
  aliveSeats,
  beginStep,
  bombPassable,
  clockwise,
  courtDraw,
  coupTargetable,
  END_TURN,
  expireTreaty,
  gainFromTreasury,
  hasExtra,
  isAlive,
  isResigned,
  isTerminal,
  makeWindow,
  nextAlive,
  otherAlive,
  patchClaim,
  payToTreasury,
  playerOf,
  popClaim,
  proveCard,
  pushExtra,
  RESOLVE,
  returnToCourt,
  revealStep,
  settleNow,
  targetable,
  transferCoins,
  wealthiest,
  windowPool,
  withPlayer,
  withSteps,
} from "./helpers.ts";
import { claimCost, isHoldless, specOf, type RoleId } from "./roles.ts";
import {
  type BombState,
  type ExtraClaim,
  type G54State,
  type LossCause,
  type PendingAction,
  type Step,
  type Window,
  type WindowPurpose,
} from "./state.ts";

/** The forced-Coup threshold from `03-turn-structure-and-rules.md`. */
export const FORCED_COUP_COINS = 10;
export const COUP_COST = 7;

export { isTerminal, winnerOf } from "./helpers.ts";

const inputFor = (frame: Frame<G54Action>, seat: SeatId): SeatInput<G54Action> | undefined =>
  frame.inputs.find(([s]) => s === seat)?.[1];

const actOf = (frame: Frame<G54Action>, seat: SeatId): G54Action | null => {
  const input = inputFor(frame, seat);
  return input?.kind === "act" ? input.action : null;
};

const foldResigns = (state: G54State, frame: Frame<G54Action>): G54State => {
  const resigned = [...state.resigned];
  for (const [seat, input] of frame.inputs) {
    if (input.kind === "resign" && !resigned.includes(seat)) resigned.push(seat);
  }
  return resigned.length === state.resigned.length ? state : { ...state, resigned };
};

const winStep = (
  purpose: WindowPurpose,
  seats: readonly SeatId[],
  cause: LossCause | null = null,
): Step => ({
  kind: "window",
  window: makeWindow(purpose, seats, cause),
});
const challengeStep = (seats: readonly SeatId[]): Step => winStep("challenge-claim", seats);
const blockStep = (seat: SeatId): Step => winStep("block", [seat]);
const keepStep = (seat: SeatId): Step => winStep("keep", [seat]);
const turnStep = (seat: SeatId): Step => winStep("turn", [seat]);

type Planned =
  | { readonly kind: GeneralActionId; readonly target: SeatId | null }
  | {
      readonly kind: "role";
      readonly role: RoleId;
      readonly target: SeatId | null;
      readonly named: RoleId | null;
    };

const coupTarget = (state: G54State, requested: SeatId | null): SeatId | null => {
  const candidates = otherAlive(state, state.active).filter((seat) =>
    coupTargetable(state, state.active, seat),
  );
  if (requested !== null && candidates.includes(requested)) return requested;
  return candidates[0] ?? null;
};

/** A role the active seat may legally claim right now, or null. */
const legalRole = (
  state: G54State,
  role: RoleId,
  target: SeatId | null,
  named: RoleId | null,
): { readonly role: RoleId; readonly target: SeatId | null; readonly named: RoleId | null } | null => {
  const spec = state.roles.includes(role) ? specOf(role) : null;
  const player = playerOf(state, state.active);
  if (spec === null || spec.reactive) return null;
  if (spec.id === "communist") {
    const victim = wealthiest(
      state,
      state.active,
      otherAlive(state, state.active).filter((seat) => targetable(state, state.active, seat)),
    );
    if (victim === null) return null;
    if (claimCost(spec, playerOf(state, victim).hand.length) > player.coins) return null;
    return { role: "communist", target: victim, named: null };
  }
  if (spec.needsTarget) {
    if (target === null || !targetable(state, state.active, target)) return null;
    // Anarchist can never name the active player: bombPassable excludes the prior set.
    if (
      spec.id === "anarchist" &&
      !bombPassable(state, { holder: state.active, prior: [], move: null }, target)
    ) {
      return null;
    }
    if (claimCost(spec, playerOf(state, target).hand.length) > player.coins) return null;
    return { role: spec.id, target, named };
  }
  if (claimCost(spec, 0) > player.coins) return null;
  return { role: spec.id, target: null, named };
};

/**
 * Resolve the active seat's reported input to a legal plan. Anything illegal or
 * unaffordable falls back to the always-affordable general action (Bank while
 * Financier is in play, else Income), and at 10+ coins it always becomes a Coup
 * — so `step` is total and the turn never stalls on a hostile or buggy report.
 */
const planTurn = (state: G54State, frame: Frame<G54Action>): Planned => {
  const player = playerOf(state, state.active);
  const action = actOf(frame, state.active);
  const fallback: Planned = { kind: fallbackGeneral(state), target: null };
  if (player.coins >= FORCED_COUP_COINS) {
    const target = coupTarget(state, action?.t === "coup" ? action.target : null);
    return target === null ? fallback : { kind: "coup", target };
  }
  if (action?.t === "coup") {
    if (player.coins < COUP_COST) return fallback;
    const target = coupTarget(state, action.target);
    return target === null ? fallback : { kind: "coup", target };
  }
  if (action?.t === "income" || action?.t === "bank" || action?.t === "social-media") {
    return generalActionsFor(state).includes(action.t) ? { kind: action.t, target: null } : fallback;
  }
  if (action?.t === "claim") {
    const legal = legalRole(state, action.role, action.target, action.named ?? null);
    if (legal === null) return fallback;
    return { kind: "role", role: legal.role, target: legal.target, named: legal.named };
  }
  return fallback;
};

const pendingFor = (state: G54State, planned: Planned): PendingAction => {
  const base = {
    claimant: state.active,
    target: null,
    named: null,
    cost: 0,
    costTo: "treasury" as const,
    blockRole: null,
    blocker: null,
    challenger: null,
    blockChallenger: null,
    funded: false,
  };
  if (planned.kind === "role") {
    const spec = specOf(planned.role);
    const lives = planned.target === null ? 0 : playerOf(state, planned.target).hand.length;
    return {
      ...base,
      kind: "role",
      role: spec.id,
      target: planned.target,
      named: planned.named,
      // Crime Boss pays conditionally, inside its pay window, not here.
      cost: spec.id === "crime-boss" ? 0 : claimCost(spec, lives),
      costTo: spec.costTo,
      blockRole: spec.blockRole,
    };
  }
  const general = GENERAL_ACTIONS[planned.kind];
  return { ...base, kind: planned.kind, role: null, target: planned.target, cost: general.cost };
};

const payCost = (state: G54State, pending: PendingAction): G54State => {
  if (pending.cost <= 0) return state;
  const claimant = playerOf(state, pending.claimant);
  const paid = Math.min(pending.cost, claimant.coins);
  const next = withPlayer(state, { ...claimant, coins: claimant.coins - paid });
  if (pending.costTo === "target" && pending.target !== null) {
    return withPlayer(next, {
      ...playerOf(next, pending.target),
      coins: playerOf(next, pending.target).coins + paid,
    });
  }
  return { ...next, treasury: next.treasury + paid };
};

/** Charge the Tax mark before the challenge window, per `08-tokens-and-special-cases.md`. */
const applyTax = (
  state: G54State,
  claim: { readonly role: RoleId | null; readonly claimant: SeatId },
): G54State => {
  const tax = state.tax;
  if (tax === null || tax.role !== claim.role || tax.holder === claim.claimant) return state;
  return transferCoins(state, claim.claimant, tax.holder, 1);
};

/** A seat that still holds a face-down card and has not resigned. */
const liveSeat = (state: G54State, seat: SeatId | undefined): seat is SeatId => {
  if (seat === undefined) return false;
  const player = state.players.find((p) => p.seat === seat);
  return player !== undefined && isAlive(player) && !isResigned(state, seat);
};

/** Abandon an in-flight swap: return its drawn cards to the Court, never lose them. */
const voidDraw = (state: G54State, rng: Random): G54State =>
  state.draw === null
    ? state
    : { ...state, court: returnToCourt(state, state.draw.pool, rng), draw: null };

/** Drop the top window (and any swap it was holding) without acting on a substitute seat. */
const voidWindow = (state: G54State, rng: Random): G54State =>
  withSteps(voidDraw(state, rng), state.steps.slice(1));

/** What follows a claim that survived its challenge: a block window or resolve. */
const afterClaimSurvives = (state: G54State, rest: readonly Step[]): readonly Step[] => {
  const claim = activeClaim(state);
  if (claim === null) return [RESOLVE, ...rest];
  if (!hasExtra(state) && claim.role === "protestor" && claim.target !== null) {
    const funders = aliveSeats(state).filter((seat) => seat !== claim.target);
    return funders.length === 0
      ? [RESOLVE, ...rest]
      : [winStep("protestor-fund", funders), ...rest];
  }
  if (!hasExtra(state) && claim.role === "crime-boss" && claim.target !== null) {
    return [winStep("crime-pay", [claim.target]), ...rest];
  }
  if (claim.blockRole !== null && claim.target !== null) return [blockStep(claim.target), ...rest];
  return [RESOLVE, ...rest];
};

const openClaim = (state: G54State, planned: Planned, rest: readonly Step[]): G54State => {
  const pending = pendingFor(state, planned);
  if (planned.kind === "role") {
    const next = applyTax({ ...state, pending }, pending);
    // Anarchist needs no held card, so its claim opens no challenge window.
    if (isHoldless(specOf(planned.role))) return withSteps(next, [RESOLVE, ...rest]);
    return withSteps(next, [challengeStep(aliveSeats(next)), ...rest]);
  }
  return withSteps({ ...state, pending }, [RESOLVE, ...rest]);
};

const resolveTurn = (state: G54State, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  return openClaim(state, planTurn(state, frame), rest);
};

/**
 * Spy's second action: a full general or role action with its own windows. A
 * pass, or any illegal claim, simply ends the turn.
 */
const resolveSpySecond = (state: G54State, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const player = playerOf(state, state.active);
  const action = actOf(frame, state.active);
  if (player.coins >= FORCED_COUP_COINS) {
    const target = coupTarget(state, action?.t === "coup" ? action.target : null);
    return target === null
      ? withSteps(state, [END_TURN, ...rest])
      : openClaim(state, { kind: "coup", target }, rest);
  }
  if (action?.t === "coup") {
    const target = player.coins >= COUP_COST ? coupTarget(state, action.target) : null;
    return target === null
      ? withSteps(state, [END_TURN, ...rest])
      : openClaim(state, { kind: "coup", target }, rest);
  }
  if (
    action?.t === "income" ||
    action?.t === "bank" ||
    action?.t === "social-media"
  ) {
    if (generalActionsFor(state).includes(action.t)) {
      return openClaim(state, { kind: action.t, target: null }, rest);
    }
  }
  if (action?.t === "claim") {
    const legal = legalRole(state, action.role, action.target, action.named ?? null);
    if (legal !== null) {
      return openClaim(
        state,
        { kind: "role", role: legal.role, target: legal.target, named: legal.named },
        rest,
      );
    }
  }
  return withSteps(state, [END_TURN, ...rest]);
};

const resolveChallengeClaim = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
): G54State => {
  const rest = state.steps.slice(1);
  const claim = activeClaim(state);
  if (claim === null) return withSteps(state, rest);
  // A claimant who left the table strands the claim: drop it, never retarget.
  if (!liveSeat(state, claim.claimant)) return withSteps(popClaim(state), rest);
  const challengers = clockwise(
    state,
    state.active,
    windowPool(state, window).filter(
      (seat) => seat !== claim.claimant && actOf(frame, seat)?.t === "challenge",
    ),
  );
  const challenger = challengers[0] ?? null;
  if (challenger === null) return withSteps(state, afterClaimSurvives(state, rest));
  return withSteps(patchClaim(state, { challenger }), [
    winStep("proof-claim", [claim.claimant]),
    ...rest,
  ]);
};

const failClaim = (state: G54State, rest: readonly Step[]): G54State => {
  const claim = activeClaim(state);
  if (claim === null) return withSteps(state, rest);
  const isExtra = hasExtra(state);
  // Judge pays the target even when its claim is successfully challenged.
  const paid =
    !isExtra &&
    state.pending !== null &&
    state.pending.role === "judge" &&
    state.pending.target !== null
      ? payCost(state, state.pending)
      : state;
  const popped = popClaim(paid);
  const tail: Step[] = isExtra ? [...rest] : [END_TURN, ...rest];
  // A failed Intellectual or Missionary claim costs a second life, per
  // `07-roles-special-interest.md` ("a successful challenge against the claim
  // costs the claimant another influence").
  const extraLoss: readonly Step[] =
    isExtra && claim.kind === "reactive" ? [revealStep(claim.claimant, "challenge")] : [];
  return withSteps(popped, [revealStep(claim.claimant, "challenge"), ...extraLoss, ...tail]);
};

const resolveProofClaim = (state: G54State, frame: Frame<G54Action>, rng: Random): G54State => {
  const rest = state.steps.slice(1);
  const claim = activeClaim(state);
  if (claim === null || claim.role === null || claim.challenger === null) {
    return withSteps(state, rest);
  }
  // A claimant who left the table cannot prove; the claim simply fails.
  if (!liveSeat(state, claim.claimant)) return failClaim(state, rest);
  const claimant = playerOf(state, claim.claimant);
  const holds = claimant.hand.includes(claim.role);
  const shows = actOf(frame, claim.claimant)?.t === "show" && holds;
  if (shows) {
    // Truthful: the challenger loses a life; the shown card is shuffled away and
    // a hidden replacement drawn (identity of the replacement stays hidden).
    const next = proveCard(state, claim.claimant, claim.role, rng);
    return withSteps(next, [
      revealStep(claim.challenger, "challenge"),
      ...afterClaimSurvives(next, rest),
    ]);
  }
  // A caught Speculator claim hands the challenger every coin the claimant holds.
  const next =
    claim.role === "speculator" && !hasExtra(state)
      ? transferCoins(state, claim.claimant, claim.challenger, claimant.coins)
      : state;
  return failClaim(next, rest);
};

const resolveBlock = (state: G54State, window: Window, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const claim = activeClaim(state);
  const target = window.seats[0];
  if (claim === null || claim.blockRole === null || !liveSeat(state, target)) {
    return withSteps(state, [RESOLVE, ...rest]);
  }
  const action = actOf(frame, target);
  if (action?.t !== "block" || action.role !== claim.blockRole) {
    return withSteps(state, [RESOLVE, ...rest]);
  }
  const challengers = aliveSeats(state).filter((seat) => seat !== target);
  return withSteps(patchClaim(state, { blocker: target }), [
    winStep("challenge-block", challengers),
    ...rest,
  ]);
};

const resolveChallengeBlock = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
): G54State => {
  const rest = state.steps.slice(1);
  const claim = activeClaim(state);
  if (claim === null || claim.blocker === null) return withSteps(state, [RESOLVE, ...rest]);
  if (!liveSeat(state, claim.blocker)) {
    return withSteps(patchClaim(state, { blocker: null }), [RESOLVE, ...rest]);
  }
  const challengers = clockwise(
    state,
    state.active,
    windowPool(state, window).filter(
      (seat) => seat !== claim.blocker && actOf(frame, seat)?.t === "challenge",
    ),
  );
  const challenger = challengers[0] ?? null;
  if (challenger === null) return withSteps(state, [RESOLVE, ...rest]);
  return withSteps(patchClaim(state, { blockChallenger: challenger }), [
    winStep("proof-block", [claim.blocker]),
    ...rest,
  ]);
};

const resolveProofBlock = (state: G54State, frame: Frame<G54Action>, rng: Random): G54State => {
  const rest = state.steps.slice(1);
  const claim = activeClaim(state);
  if (claim === null || claim.blocker === null || claim.blockRole === null) {
    return withSteps(state, [RESOLVE, ...rest]);
  }
  // A blocker who left the table cannot prove; the block drops.
  if (!liveSeat(state, claim.blocker)) {
    return withSteps(patchClaim(state, { blocker: null }), [RESOLVE, ...rest]);
  }
  const blocker = playerOf(state, claim.blocker);
  const holds = blocker.hand.includes(claim.blockRole);
  const shows = actOf(frame, claim.blocker)?.t === "show" && holds;
  const challenger = claim.blockChallenger;
  if (shows) {
    // The block stands; the challenger pays a life. The proven card is shuffled
    // away and replaced, exactly as a proven claim is.
    const next = proveCard(state, claim.blocker, claim.blockRole, rng);
    return withSteps(next, [
      ...(challenger === null ? [] : [revealStep(challenger, "challenge")]),
      RESOLVE,
      ...rest,
    ]);
  }
  // The block was a lie or declined: the blocker loses a life, the block drops,
  // and the action still resolves (the execution lands on the target).
  return withSteps(patchClaim(state, { blocker: null }), [
    revealStep(claim.blocker, "challenge"),
    RESOLVE,
    ...rest,
  ]);
};

const applyResolve = (state: G54State, rng: Random): G54State => {
  const rest = state.steps.slice(1);
  if (hasExtra(state)) {
    const claim = state.extras[state.extras.length - 1];
    if (claim === undefined) return withSteps(state, rest);
    const ctx: ExtraCtx = {
      state: { ...state, extras: state.extras.slice(0, -1) },
      claim,
      blocked: claim.blocker !== null,
      rest,
    };
    return EXTRA_EFFECTS[claim.kind](ctx);
  }
  const pending = state.pending;
  if (pending === null) return withSteps(state, rest);
  const paid = payCost(state, pending);
  if (pending.kind !== "role") {
    const cleared = { ...paid, pending: null };
    const ctx = { state: cleared, claim: pending, rest };
    return GENERAL_ACTIONS[pending.kind].effect(ctx);
  }
  if (pending.role === null) return withSteps({ ...paid, pending: null }, [END_TURN, ...rest]);
  // A role claim keeps `pending` set so its sub-windows (Crime Boss pay, Protestor
  // funding, Spy's second action) can read the claim; `end-turn` clears it.
  const ctx: RoleCtx = {
    state: paid,
    claim: pending,
    blocked: pending.blocker !== null,
    rest,
    rng,
  };
  return ROLE_EFFECTS[pending.role](ctx);
};

const resolveKeep = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
  rng: Random,
): G54State => {
  const rest = state.steps.slice(1);
  const draw = state.draw;
  if (draw === null) return withSteps(state, rest);
  const seat = window.seats[0] ?? draw.seat;
  if (!liveSeat(state, seat)) return withSteps(voidDraw(state, rng), rest);
  const player = playerOf(state, seat);
  const combined = [...player.hand, ...draw.pool];
  const action = actOf(frame, seat);
  const requested = action?.t === "keep" ? action.indices : [];
  const valid =
    requested.length === draw.keepSize &&
    requested.every((i) => Number.isInteger(i) && i >= 0 && i < combined.length) &&
    new Set(requested).size === requested.length;
  const keptIndices = valid
    ? [...requested].sort((a, b) => a - b)
    : [...combined.keys()].slice(0, draw.keepSize);
  const keptSet = new Set(keptIndices);
  const kept = keptIndices
    .map((i) => combined[i])
    .filter((card): card is RoleId => card !== undefined);
  const returned = combined.filter((_, i) => !keptSet.has(i));
  let next = withPlayer(state, { ...player, hand: kept });
  if (draw.target !== null) {
    // Producer: return one card to the target and one to the Court.
    const gift = returned[0];
    const rest2 = returned.slice(1);
    if (gift !== undefined) {
      next = withPlayer(next, {
        ...playerOf(next, draw.target),
        hand: [...playerOf(next, draw.target).hand, gift],
      });
    }
    next = { ...next, court: returnToCourt(next, rest2, rng) };
  } else {
    next = { ...next, court: returnToCourt(next, returned, rng) };
  }
  return withSteps({ ...next, draw: null }, rest);
};

const resolveCrimePay = (state: G54State, window: Window, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const claim = state.pending;
  const target = window.seats[0];
  if (claim === null || !liveSeat(state, target)) return withSteps(state, [END_TURN, ...rest]);
  const pays = actOf(frame, target)?.t === "pay" && playerOf(state, target).coins >= 2;
  if (pays) {
    return withSteps(transferCoins(state, target, claim.claimant, 2), [END_TURN, ...rest]);
  }
  // Per `06-roles-force.md`, a claimant short of 5 coins after the refusal cannot kill.
  if (playerOf(state, claim.claimant).coins < 5) return withSteps(state, [END_TURN, ...rest]);
  const paid = payToTreasury(state, claim.claimant, 5);
  return withSteps(paid, [revealStep(target, "execution"), END_TURN, ...rest]);
};

const resolveFund = (state: G54State, window: Window, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const claim = state.pending;
  if (claim === null || claim.target === null) return withSteps(state, [RESOLVE, ...rest]);
  if (!liveSeat(state, claim.target)) return withSteps(state, [RESOLVE, ...rest]);
  const funders = clockwise(
    state,
    state.active,
    windowPool(state, window).filter(
      (seat) => liveSeat(state, seat) && actOf(frame, seat)?.t === "pay",
    ),
  );
  const funder = funders.find((seat) => playerOf(state, seat).coins >= 3) ?? null;
  if (funder === null) return withSteps(state, [RESOLVE, ...rest]);
  const paid = payToTreasury(state, funder, 3);
  // The block window is followed by resolveBlock's own RESOLVE, so no extra here.
  return withSteps({ ...paid, pending: { ...claim, funded: true } }, [
    blockStep(claim.target),
    ...rest,
  ]);
};

/** Which extra kind a mass-claim window opens, keyed by the pending role. */
const MASS_CLAIM_KINDS: Partial<Record<RoleId, ExtraClaim["kind"]>> = {
  capitalist: "capitalist",
  "plantation-owner": "plantation",
};

const resolveMassClaim = (state: G54State, window: Window, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const active = state.active;
  const role = state.pending?.role ?? null;
  const kind = role === null ? undefined : MASS_CLAIM_KINDS[role];
  if (role === null || kind === undefined) return withSteps(state, rest);
  const claimants = clockwise(
    state,
    active,
    windowPool(state, window).filter((seat) => {
      const action = actOf(frame, seat);
      return (
        seat !== active &&
        liveSeat(state, seat) &&
        action?.t === "claim" &&
        action.role === role
      );
    }),
  );
  const begins = claimants.map((seat) =>
    beginStep({
      kind,
      claimant: seat,
      role,
      target: active,
      blockRole: null,
      blocker: null,
      challenger: null,
      blockChallenger: null,
    }),
  );
  return withSteps(state, [...begins, ...rest]);
};

const resolveCustomsMark = (state: G54State, window: Window, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const seat = window.seats[0] ?? state.active;
  if (!liveSeat(state, seat)) return withSteps(state, rest);
  const action = actOf(frame, seat);
  const role =
    action?.t === "claim" && state.roles.includes(action.role)
      ? action.role
      : (state.roles[0] ?? "banker");
  return withSteps({ ...state, tax: { role, holder: seat } }, rest);
};

const resolveWriterDraw = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
  rng: Random,
): G54State => {
  const rest = state.steps.slice(1);
  const draw = state.draw;
  if (draw === null) return withSteps(state, rest);
  const seat = window.seats[0] ?? draw.seat;
  if (!liveSeat(state, seat)) return withSteps(voidDraw(state, rng), rest);
  const wantsMore =
    actOf(frame, seat)?.t === "pay" && playerOf(state, seat).coins >= 1 && state.court.length > 0;
  if (!wantsMore) return withSteps(state, [keepStep(seat), ...rest]);
  const paid = payToTreasury(state, seat, 1);
  const { drawn, court } = courtDraw(paid, 1);
  return withSteps({ ...paid, court, draw: { ...draw, pool: [...draw.pool, ...drawn] } }, [
    winStep("writer-draw", [seat]),
    ...rest,
  ]);
};

/** Open the reactive windows a loss enables: Intellectual always, Missionary except Coup. */
const reactiveSteps = (state: G54State, seat: SeatId, cause: LossCause): readonly Step[] => {
  const steps: Step[] = [];
  if (state.roles.includes("intellectual")) steps.push(winStep("reactive-intellectual", [seat]));
  if (cause !== "coup" && state.roles.includes("missionary")) {
    steps.push(winStep("reactive-missionary", [seat]));
  }
  return steps;
};

const resolveReveal = (state: G54State, window: Window, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const seat = window.seats[0];
  if (seat === undefined || !liveSeat(state, seat)) return withSteps(state, rest);
  const player = playerOf(state, seat);
  const action = actOf(frame, seat);
  const requested = action?.t === "reveal" ? action.index : 0;
  const index =
    Number.isInteger(requested) && requested >= 0 && requested < player.hand.length ? requested : 0;
  const card = player.hand[index];
  if (card === undefined) return withSteps(state, rest);
  const hand = player.hand.filter((_, i) => i !== index);
  const next = withPlayer(state, { ...player, hand, revealed: [...player.revealed, card] });
  if (hand.length === 0) {
    // Elimination: the Lawyer window opens before the coins return.
    const tail: Step[] = state.roles.includes("lawyer")
      ? [winStep("lawyer", [seat]), { kind: "settle", seat }, ...rest]
      : [{ kind: "settle", seat }, ...rest];
    return withSteps(next, tail);
  }
  return withSteps(next, [...reactiveSteps(next, seat, window.cause ?? "execution"), ...rest]);
};

const resolveReactive = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
  role: RoleId,
): G54State => {
  const rest = state.steps.slice(1);
  const seat = window.seats[0];
  if (seat === undefined || !liveSeat(state, seat)) return withSteps(state, rest);
  const action = actOf(frame, seat);
  if (action?.t !== "claim" || action.role !== role) return withSteps(state, rest);
  const next = pushExtra(state, {
    kind: "reactive",
    claimant: seat,
    role,
    target: seat,
    blockRole: null,
    blocker: null,
    challenger: null,
    blockChallenger: null,
  });
  return withSteps(next, [challengeStep(aliveSeats(state)), ...rest]);
};

const resolveLawyer = (state: G54State, window: Window, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const anchor = window.seats[0] ?? state.active;
  const claimants = clockwise(
    state,
    anchor,
    aliveSeats(state).filter((seat) => {
      const action = actOf(frame, seat);
      return liveSeat(state, seat) && action?.t === "claim" && action.role === "lawyer";
    }),
  );
  // Resolve every claimant clockwise from the eliminated seat, stopping at the
  // first success: each `begin` opens its own challenge window, and a drained
  // estate voids the rest, per `07-roles-special-interest.md`.
  const begins = claimants.map((seat) =>
    beginStep({
      kind: "lawyer" as const,
      claimant: seat,
      role: "lawyer" as const,
      target: anchor,
      blockRole: null,
      blocker: null,
      challenger: null,
      blockChallenger: null,
    }),
  );
  return withSteps(state, [...begins, ...rest]);
};

const resolvePlantationPayout = (state: G54State, window: Window): G54State => {
  const rest = state.steps.slice(1);
  const survivors = state.plantation;
  if (survivors === null || survivors.length === 0) {
    return withSteps({ ...state, plantation: null }, rest);
  }
  const count = survivors.length;
  let next: G54State = { ...state, plantation: null };
  for (const seat of survivors) {
    if (liveSeat(state, seat)) next = gainFromTreasury(next, seat, count);
  }
  return withSteps(next, rest);
};

const resolveBomb = (state: G54State, window: Window, frame: Frame<G54Action>): G54State => {
  const rest = state.steps.slice(1);
  const bomb = state.bomb;
  if (bomb === null) return withSteps(state, rest);
  // A live `move` means the pass/defuse claim that named it was caught: the holder
  // takes the Bomb loss on top of the challenge loss (the double loss).
  if (bomb.move !== null) {
    return withSteps({ ...state, bomb: null }, [revealStep(bomb.holder, "execution"), ...rest]);
  }
  const holder = window.seats[0];
  if (holder === undefined || holder !== bomb.holder || !liveSeat(state, holder)) {
    return withSteps(state, rest);
  }
  const action = actOf(frame, holder);
  if (action?.t === "claim" && action.role === "anarchist") {
    const target = action.target;
    const defuse = target === null;
    const pass = target !== null && bombPassable(state, bomb, target);
    if (defuse || pass) {
      const extra: ExtraClaim = {
        kind: "anarchist",
        claimant: holder,
        role: "anarchist",
        target: target ?? holder,
        blockRole: null,
        blocker: null,
        challenger: null,
        blockChallenger: null,
      };
      const next: G54State = {
        ...state,
        bomb: { ...bomb, move: defuse ? "defuse" : "pass" },
        extras: [...state.extras, extra],
      };
      return withSteps(next, [challengeStep(aliveSeats(next)), winStep("bomb", [holder]), ...rest]);
    }
  }
  return withSteps({ ...state, bomb: null }, [revealStep(holder, "execution"), ...rest]);
};

const resolveSocialistGive = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
): G54State => {
  const rest = state.steps.slice(1);
  const socialist = state.socialist;
  const seat = window.seats[0];
  if (socialist === null || seat === undefined || !liveSeat(state, seat)) {
    return withSteps(state, rest);
  }
  const player = playerOf(state, seat);
  const action = actOf(frame, seat);
  const wantsCard = action?.t === "give";
  // Coercion: a seat with no coins must give a card, a seat with no cards must pay.
  const giveCard = wantsCard ? player.hand.length > 0 : player.coins === 0;
  if (giveCard) {
    const requested = action?.t === "give" ? action.index : 0;
    const index =
      Number.isInteger(requested) && requested >= 0 && requested < player.hand.length ? requested : 0;
    const card = player.hand[index];
    if (card === undefined) return withSteps(state, rest);
    const next = withPlayer(state, {
      ...player,
      hand: player.hand.filter((_, i) => i !== index),
    });
    return withSteps(
      {
        ...next,
        socialist: {
          ...socialist,
          givers: [...socialist.givers, seat],
          pool: [...socialist.pool, card],
        },
      },
      rest,
    );
  }
  return withSteps(transferCoins(state, seat, socialist.seat, 1), rest);
};

const resolveSocialistKeep = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
  rng: Random,
): G54State => {
  const rest = state.steps.slice(1);
  const socialist = state.socialist;
  const seat = window.seats[0] ?? socialist?.seat;
  if (socialist === null || seat === undefined || !liveSeat(state, seat)) {
    // The actor left mid-sub-turn: the collected cards return to the Court, never vanish.
    return withSteps(voidSocialist(state, rng), rest);
  }
  const player = playerOf(state, seat);
  const hand = player.hand;
  const pool = socialist.pool;
  const combined = [...hand, ...pool];
  const action = actOf(frame, seat);
  const requested = action?.t === "keep" ? action.indices : [];
  const ownRaw = requested[0] ?? 0;
  const ownIndex = Number.isInteger(ownRaw) && ownRaw >= 0 && ownRaw < hand.length ? ownRaw : 0;
  const keepRaw = requested[1] ?? 0;
  let keepIndex =
    Number.isInteger(keepRaw) && keepRaw >= 0 && keepRaw < combined.length ? keepRaw : 0;
  // Keeping an own card other than the contributed one would duplicate it; fall back
  // to the first received card (or the contributed card when the pool is empty).
  if (keepIndex < hand.length && keepIndex !== ownIndex) {
    keepIndex = pool.length > 0 ? hand.length : ownIndex;
  }
  const ownCard = hand[ownIndex];
  const kept = combined[keepIndex];
  const newHand = hand.filter((_, i) => i !== ownIndex);
  if (kept !== undefined) newHand.push(kept);
  const remaining = [...pool];
  if (ownCard !== undefined) remaining.push(ownCard);
  if (kept !== undefined) {
    const at = remaining.indexOf(kept);
    if (at >= 0) remaining.splice(at, 1);
  }
  const shuffled = rng.shuffle(remaining);
  let next = withPlayer(state, { ...player, hand: newHand });
  for (const [i, giver] of socialist.givers.entries()) {
    const card = shuffled[i];
    if (card === undefined) continue;
    next = withPlayer(next, {
      ...playerOf(next, giver),
      hand: [...playerOf(next, giver).hand, card],
    });
  }
  const leftover = shuffled.slice(socialist.givers.length);
  return withSteps({ ...next, court: returnToCourt(next, leftover, rng), socialist: null }, rest);
};

const applyBegin = (state: G54State, extra: ExtraClaim): G54State => {
  const rest = state.steps.slice(1);
  if (!liveSeat(state, extra.claimant)) return withSteps(state, rest);
  // Once a Lawyer has taken the estate there is nothing left for later claimants.
  if (extra.kind === "lawyer" && playerOf(state, extra.target).coins <= 0) {
    return withSteps(state, rest);
  }
  // A secondary Capitalist collection is taxed per claim like any other claim.
  const taxed = extra.kind === "capitalist" ? applyTax(state, extra) : state;
  const next = pushExtra(taxed, extra);
  const first: Step =
    extra.kind === "general" || extra.kind === "priest" || extra.kind === "socialist"
      ? blockStep(extra.target)
      : challengeStep(aliveSeats(next));
  return withSteps(next, [first, ...rest]);
};

const applySettle = (state: G54State, seat: SeatId): G54State => {
  const rest = state.steps.slice(1);
  return withSteps(expireTreaty(settleNow(state, seat)), rest);
};

/** Return an in-flight Socialist pool to the Court, so a voided sub-turn loses no card. */
const voidSocialist = (state: G54State, rng: Random): G54State =>
  state.socialist === null || state.socialist.pool.length === 0
    ? { ...state, socialist: null }
    : {
        ...state,
        court: returnToCourt(state, state.socialist.pool, rng),
        socialist: null,
      };

const applyEndTurn = (state: G54State, rng: Random): G54State => {
  const rest = state.steps.slice(1);
  const ending = state.active;
  const ticked = state.disappear.map((token) =>
    token.target === ending ? { ...token, turns: token.turns - 1 } : token,
  );
  const firing = ticked.filter((token) => token.turns <= 0);
  const advanced: G54State = expireTreaty(
    voidSocialist(
      {
        ...state,
        disappear: ticked.filter((token) => token.turns > 0),
        active: nextAlive(state, ending),
        turn: state.turn + 1,
        pending: null,
        extras: [],
        draw: null,
        bomb: null,
        plantation: null,
      },
      rng,
    ),
  );
  if (isTerminal(advanced)) return withSteps(advanced, []);
  return withSteps(advanced, [
    ...firing.map(() => revealStep(ending, "execution")),
    turnStep(advanced.active),
    ...rest,
  ]);
};

type WindowResolver = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
  rng: Random,
) => G54State;

/**
 * The window registry: one resolver per purpose, keyed by data rather than a
 * branch. Each resolver pops the window (its `state.steps[0]`) and pushes the
 * next step(s), so the whole turn is a data-driven stack machine.
 */
const RESOLVERS: Record<WindowPurpose, WindowResolver> = {
  turn: (state, _window, frame) => resolveTurn(state, frame),
  "challenge-claim": (state, window, frame) => resolveChallengeClaim(state, window, frame),
  "proof-claim": (state, _window, frame, rng) => resolveProofClaim(state, frame, rng),
  block: (state, window, frame) => resolveBlock(state, window, frame),
  "challenge-block": (state, window, frame) => resolveChallengeBlock(state, window, frame),
  "proof-block": (state, _window, frame, rng) => resolveProofBlock(state, frame, rng),
  reveal: (state, window, frame) => resolveReveal(state, window, frame),
  keep: (state, window, frame, rng) => resolveKeep(state, window, frame, rng),
  "crime-pay": (state, window, frame) => resolveCrimePay(state, window, frame),
  capitalist: (state, window, frame) => resolveMassClaim(state, window, frame),
  "spy-second": (state, _window, frame) => resolveSpySecond(state, frame),
  "protestor-fund": (state, window, frame) => resolveFund(state, window, frame),
  "producer-give": (state, window, frame, rng) => resolveProducerGive(state, window, frame, rng),
  "writer-draw": (state, window, frame, rng) => resolveWriterDraw(state, window, frame, rng),
  "customs-mark": (state, window, frame) => resolveCustomsMark(state, window, frame),
  "reactive-intellectual": (state, window, frame) =>
    resolveReactive(state, window, frame, "intellectual"),
  "reactive-missionary": (state, window, frame) =>
    resolveReactive(state, window, frame, "missionary"),
  lawyer: (state, window, frame) => resolveLawyer(state, window, frame),
  bomb: (state, window, frame) => resolveBomb(state, window, frame),
  "socialist-give": (state, window, frame) => resolveSocialistGive(state, window, frame),
  "socialist-keep": (state, window, frame, rng) => resolveSocialistKeep(state, window, frame, rng),
  "plantation-payout": (state, window) => resolvePlantationPayout(state, window),
};

const resolveProducerGive = (
  state: G54State,
  window: Window,
  frame: Frame<G54Action>,
  rng: Random,
): G54State => {
  const rest = state.steps.slice(1);
  const draw = state.draw;
  const target = window.seats[0];
  if (draw === null || target === undefined || draw.target !== target || !liveSeat(state, target)) {
    return withSteps(voidDraw(state, rng), rest);
  }
  const player = playerOf(state, target);
  const action = actOf(frame, target);
  const requested = action?.t === "give" ? action.index : 0;
  const index =
    Number.isInteger(requested) && requested >= 0 && requested < player.hand.length ? requested : 0;
  const card = player.hand[index];
  if (card === undefined) return withSteps(state, rest);
  const next = withPlayer(state, { ...player, hand: player.hand.filter((_, i) => i !== index) });
  return withSteps({ ...next, draw: { ...draw, pool: [...draw.pool, card] } }, [
    keepStep(draw.seat),
    ...rest,
  ]);
};

const applyImmediate = (state: G54State, step: Step, rng: Random): G54State => {
  switch (step.kind) {
    case "resolve":
      return applyResolve(state, rng);
    case "end-turn":
      return applyEndTurn(state, rng);
    case "begin":
      return applyBegin(state, step.extra);
    case "settle":
      return applySettle(state, step.seat);
    case "window":
      return state;
  }
};

/** Apply non-window steps until the stack tops out at a live window (or the game ends). */
const drain = (state: G54State, rng: Random): G54State => {
  let next = state;
  for (;;) {
    if (isTerminal(next)) return withSteps(next, []);
    const top = next.steps[0];
    if (top === undefined) {
      // Voiding windows emptied the stack mid-turn: end the turn cleanly.
      next = applyEndTurn({ ...next, steps: [END_TURN] }, rng);
      continue;
    }
    if (top.kind === "window") {
      if (top.window.kind === "turn" || owedSeats(next, top.window).length > 0) return next;
      // A window whose named seats are all gone is voided, never retargeted.
      next = voidWindow(next, rng);
      continue;
    }
    next = applyImmediate(next, top, rng);
  }
};

/** The seats a window actually owes: every live seat for `any`, else its named seats. */
const owedSeats = (state: G54State, window: Window): readonly SeatId[] => {
  const alive = aliveSeats(state);
  return windowPool(state, window).filter((seat) => alive.includes(seat));
};

/**
 * The active seat left mid-turn: return any in-flight Court cards to the Court and
 * hand the turn to the next live seat with a fresh window, never an empty stack.
 */
const resignActive = (state: G54State, rng: Random): G54State => {
  const court =
    state.draw === null
      ? state.socialist === null || state.socialist.pool.length === 0
        ? state.court
        : returnToCourt(state, state.socialist.pool, rng)
      : returnToCourt(state, [...state.draw.pool, ...(state.socialist?.pool ?? [])], rng);
  const active = nextAlive(state, state.active);
  return {
    ...state,
    court,
    active,
    pending: null,
    extras: [],
    draw: null,
    bomb: null,
    socialist: null,
    plantation: null,
    steps: [turnStep(active)],
  };
};

export const stepState = (state: G54State, frame: Frame<G54Action>, rng: Random): G54State => {
  if (isTerminal(state)) return state;
  const folded = foldResigns(state, frame);
  if (isTerminal(folded)) return withSteps(folded, []);
  // The active seat left mid-turn: rebuild with a fresh turn window for the new
  // active seat, opened (not consumed by this frame) so it reports next frame.
  if (folded.resigned.includes(folded.active)) return drain(resignActive(folded, rng), rng);
  const top = folded.steps[0];
  if (top === undefined || top.kind !== "window") {
    throw new G54Error("g54 step called with no open window");
  }
  const owed = owedSeats(folded, top.window);
  if (owed.length === 0 && top.window.kind !== "turn") {
    // The window names only gone seats: void it and continue the rest of the stack.
    return drain(voidWindow(folded, rng), rng);
  }
  const resolver = RESOLVERS[top.window.purpose];
  return drain(resolver(folded, top.window, frame, rng), rng);
};

export const seatsOwedFor = (state: G54State, _index: FrameIndex): readonly SeatId[] => {
  if (isTerminal(state)) return [];
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") return [state.active];
  const owed = owedSeats(state, top.window);
  return owed.length > 0 ? owed : [state.active];
};
