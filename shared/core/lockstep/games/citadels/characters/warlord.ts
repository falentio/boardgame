import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { specOfDistrict } from "../districts.ts";
import {
  actionOf,
  addGold,
  emptyPending,
  hasCompleted,
  hasSeat,
  isResigned,
  isSkipped,
  patchPending,
  playerOf,
  popWindow,
  seatHolding,
  spendGold,
  winStep,
  withPending,
  withPlayer,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The warlord's two in-flight sub-states, carried in `pending.note`. */
const PICK_NOTE = "warlord-pick";
const DESTROY_NOTE = "warlord-destroy";

/** The seat holding the Warlord this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "warlord") ?? ctx.seat;

/** The Warlord's income unit: military districts in a city. */
const militaryIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter((district) => specOfDistrict(district.id).type === "military")
    .length;

/** One fewer gold than the district's cost; the Artist's beautify gold raises the cost by one. */
export const destroyPrice = (id: string, beautifyGold = 0): number =>
  Math.max(0, specOfDistrict(id).cost + beautifyGold - 1);

/**
 * Gain 1 gold per military district, then offer to destroy one district. The
 * offer is a two-stage window: name the owner whose district falls (the
 * Warlord's own or a rival's, never a completed city), then pick the district.
 * A killed Warlord takes no turn; a bewitched one is played by the Witch, so its
 * income is not added here.
 */
export const warlord: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "warlord") || ctx.state.bewitched === "warlord") {
    return withSteps(ctx.state, ctx.rest);
  }
  const paid = addGold(ctx.state, owner, militaryIn(ctx.state, owner));
  const opened = withPending(paid, { ...emptyPending(owner, "warlord"), note: PICK_NOTE });
  return withSteps(opened, [winStep("warlord-destroy", [owner]), ...ctx.rest]);
};

/** A destroyed district is placed on the bottom of the hidden deck. */
const toDeckBottom = (state: CitadelsState, id: string): CitadelsState => ({
  ...state,
  deck: [...state.deck, id],
});

/**
 * Resolve the warlord-destroy window. Stage one reads the target seat; stage two
 * reads the city index, charges one less than the district's cost, and sinks the
 * district to the bottom of the deck. Any illegal pick closes the window and
 * leaves the board untouched.
 */
export const warlordResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "warlord-destroy") return popWindow(ctx.state);
  const rest = ctx.state.steps.slice(1);
  const owner = ctx.state.pending?.actor ?? ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  const pending = ctx.state.pending;

  if (pending === null || pending.note === PICK_NOTE) {
    const target = action?.t === "target" ? action.seat : null;
    const legal =
      target !== null &&
      hasSeat(ctx.state, target) &&
      !isResigned(ctx.state, target) &&
      !hasCompleted(ctx.state, target);
    if (!legal) return withSteps(withPending(ctx.state, null), rest);
    return withSteps(patchPending(ctx.state, { target, note: DESTROY_NOTE }), [
      winStep("warlord-destroy", [owner]),
      ...rest,
    ]);
  }

  const closed = withPending(ctx.state, null);
  const target = pending.target;
  const index = action?.t === "keep" ? action.index : -1;
  if (target === null) return withSteps(closed, rest);
  const placed = playerOf(ctx.state, target).city[index];
  if (placed === undefined) return withSteps(closed, rest);
  const price = destroyPrice(placed.id, placed.gold);
  if (playerOf(ctx.state, owner).gold < price) return withSteps(closed, rest);
  const paid = spendGold(ctx.state, owner, price);
  const remaining = playerOf(paid, target).city.filter((_, i) => i !== index);
  const stripped = withPlayer(paid, { ...playerOf(paid, target), city: remaining });
  return withSteps(toDeckBottom(stripped, placed.id), rest);
};
