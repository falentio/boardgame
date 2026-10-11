import type { Frame, SeatId } from "../../../index.ts";
import type { CitadelsAction } from "../actions.ts";
import { specOfCharacter } from "../characters.ts";
import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { WindowResolver } from "../helpers.ts";
import type { CitadelsState, Claim, Step } from "../state.ts";
import { windowKindFor } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/**
 * The Theater resolves its own window, so it may not import `helpers.ts` at
 * runtime: helpers imports `districts/effects.ts`, which imports this file, and
 * a runtime edge here would leave `DISTRICT_RESOLVERS["theatre-swap"]` undefined
 * when a test loads this file before `effects.ts`. The few helpers it needs are
 * local for that reason.
 */
const hasSeat = (state: CitadelsState, seat: SeatId): boolean =>
  state.players.some((p) => p.seat === seat);

const isResigned = (state: CitadelsState, seat: SeatId): boolean =>
  state.resigned.includes(seat);

const actionOf = (frame: Frame<CitadelsAction>, seat: SeatId): CitadelsAction | null => {
  const entry = frame.inputs.find(([s]) => s === seat);
  if (entry === undefined || entry[1].kind !== "act") return null;
  return entry[1].action;
};

const swapStep = (seats: readonly SeatId[]): Step => ({
  kind: "window",
  window: { kind: windowKindFor("theatre-swap"), purpose: "theatre-swap", seats },
});

const popWindow = (state: CitadelsState): CitadelsState => ({
  ...state,
  steps: state.steps.slice(1),
});

const claimsOf = (state: CitadelsState, seat: SeatId): readonly Claim[] =>
  state.claimed.filter((claim) => claim.seat === seat);

const inRankOrder = (claims: readonly Claim[]): readonly Claim[] =>
  [...claims].sort(
    (a, b) => specOfCharacter(a.character).rank - specOfCharacter(b.character).rank,
  );

/**
 * The Theater opens the theatre-swap window at the start of the round, owed by
 * its owner. The window is queued below the new round's draft and resolves once
 * `claimed` holds every seat's characters for the round, so the swapped card is
 * the one the rank cursor later calls.
 */
export const theater: DistrictEffect = (ctx: DistrictCtx) => ({
  ...ctx.state,
  steps: [swapStep([ctx.owner]), ...ctx.rest],
});

/** The first live seat that is not `owner`: the rival a give-only answer faces. */
const firstRival = (state: CitadelsState, owner: SeatId): SeatId | null =>
  state.players.find((player) => player.seat !== owner && !isResigned(state, player.seat))
    ?.seat ?? null;

/**
 * Resolve the theatre-swap window. The owner names a rival seat, blind to that
 * rival's characters; the resolver takes one of the rival's claimed characters
 * at random and swaps it for one of the owner's. rules.json (theatre): "You
 * choose the player blindly. In 2-3 player games you choose which of your two
 * characters to give and randomly take one of your opponent's."
 *
 * The owner's give-choice rides a `keep` index into its claimed characters in
 * rank order; absent (a single-character seat, or a target-only answer), the
 * lowest-rank claim is given, which is the only claim a one-character seat has.
 * The rival rides a `target` answer; a give-only answer faces the first live
 * rival. An illegal or absent target (self, absent seat, resigned seat, a seat
 * with no claim) closes the window and leaves both claim sets untouched.
 */
export const theaterResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "theatre-swap") return popWindow(ctx.state);
  const owner = ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  const mine = inRankOrder(claimsOf(ctx.state, owner));
  if (mine.length === 0) return popWindow(ctx.state);

  // The give-choice: a keep index into the owner's claims in rank order. Absent,
  // the owner gives its lowest-rank claim (the sole claim of a one-character seat).
  const wanted = action?.t === "keep" ? action.index : 0;
  const giveIndex = Number.isInteger(wanted) && wanted >= 0 && wanted < mine.length ? wanted : 0;
  const given = mine[giveIndex];
  if (given === undefined) return popWindow(ctx.state);

  // The rival: named by a target answer; a give-only answer faces the first live
  // rival, so the owner's choice of which character to give is honoured either way.
  const named = action?.t === "target" ? action.seat : null;
  const target = named ?? (action?.t === "keep" ? firstRival(ctx.state, owner) : null);
  const legal =
    target !== null &&
    target !== owner &&
    hasSeat(ctx.state, target) &&
    !isResigned(ctx.state, target);
  const theirs = target === null ? [] : claimsOf(ctx.state, target);
  if (!legal || theirs.length === 0) return popWindow(ctx.state);

  const taken = theirs[ctx.rng.int(theirs.length)];
  if (taken === undefined) return popWindow(ctx.state);

  const swapped = ctx.state.claimed.map((claim) => {
    if (claim.seat === owner && claim.character === given.character) {
      return { ...claim, character: taken.character };
    }
    if (claim.seat === target && claim.character === taken.character) {
      return { ...claim, character: given.character };
    }
    return claim;
  });
  return popWindow({ ...ctx.state, claimed: inRankOrder(swapped) });
};

/**
 * The Theater carries no end-game points: the catalog gives it an in-round
 * ability (swap your character for another player's at the start of the round),
 * not a scoring bonus. So it adds zero to its owner's final score.
 */
export const theaterScoring: DistrictScoring = () => 0;

/** The Theater prices and gates its own build no differently; the engine's default terms apply. */
export const theaterBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to: the start of the round. */
export const theaterTriggers: readonly DistrictHook[] = ["onRoundStart"];
