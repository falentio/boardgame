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

/**
 * Resolve the theatre-swap window. The owner names a rival seat, blind to that
 * rival's characters; the resolver takes one of the rival's claimed characters
 * at random and swaps it for the owner's lowest-rank claimed character. An
 * illegal or absent target (self, absent seat, resigned seat, a seat with no
 * claim) closes the window and leaves both claim sets untouched.
 */
export const theaterResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "theatre-swap") return popWindow(ctx.state);
  const owner = ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  const target = action?.t === "target" ? action.seat : null;
  const legal =
    target !== null &&
    target !== owner &&
    hasSeat(ctx.state, target) &&
    !isResigned(ctx.state, target);
  const mine = claimsOf(ctx.state, owner);
  const theirs = target === null ? [] : claimsOf(ctx.state, target);
  if (!legal || mine.length === 0 || theirs.length === 0) return popWindow(ctx.state);

  const given = inRankOrder(mine)[0];
  const taken = theirs[ctx.rng.int(theirs.length)];
  if (given === undefined || taken === undefined) return popWindow(ctx.state);

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
