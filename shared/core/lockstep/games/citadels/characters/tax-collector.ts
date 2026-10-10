import type { SeatId } from "../../../index.ts";
import type { CharacterEffect } from "../characters/index.ts";
import {
  actionOf,
  addGold,
  emptyPending,
  isSkipped,
  seatHolding,
  winStep,
  withPending,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The `choose` value that takes the whole token. */
const TAKE = "take";

/**
 * The Tax Collector may take the whole token at any time during its turn. The
 * engine charges the token on every build (see `chargeBuildTax` in helpers.ts),
 * so this effect only opens the take window; the window resolves before the
 * turn's gather-and-build window, which rides in `ctx.rest`.
 */
export const taxCollector: CharacterEffect = (ctx) => {
  if (isSkipped(ctx.state, "tax-collector")) return withSteps(ctx.state, ctx.rest);
  const seat = seatHolding(ctx.state, "tax-collector") ?? ctx.seat;
  const armed = withPending(ctx.state, emptyPending(seat, "tax-collector"));
  return withSteps(armed, [winStep("tax-collect", [seat]), ...ctx.rest]);
};

/** Whether the Tax Collector chose to empty the token. */
const wantsTake = (action: ReturnType<typeof actionOf>): boolean =>
  action?.t === "gold" || (action?.t === "choose" && action.value === TAKE);

/**
 * Move every gold on the token into the Tax Collector's stash. A pass (or any
 * other action) leaves the token untouched, so its gold carries to a later turn.
 */
export const taxCollectorResolve: WindowResolver = (ctx) => {
  const rest = ctx.state.steps.slice(1);
  const seat =
    ctx.window.seats[0] ?? ctx.state.pending?.actor ?? seatHolding(ctx.state, "tax-collector");
  const pot = ctx.state.taxPot ?? 0;
  const action = actionOf(ctx.frame, seat ?? ctx.state.active);
  const cleared = withPending(ctx.state, null);
  if (seat === null || !wantsTake(action) || pot <= 0) return withSteps(cleared, rest);
  return withSteps({ ...addGold(cleared, seat, pot), taxPot: 0 }, rest);
};
