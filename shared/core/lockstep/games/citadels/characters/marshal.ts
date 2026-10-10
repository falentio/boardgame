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

/** The marshal's two in-flight sub-states, carried in `pending.note`. */
const TARGET_NOTE = "marshal-target";
const SEIZE_NOTE = "marshal-seize";

/** The Marshal may only seize a district costing three or less. */
export const SEIZE_CEILING = 3;

/** The seat holding the Marshal this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "marshal") ?? ctx.seat;

/** The Marshal's income unit: military districts in a city. */
const militaryIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter((district) => specOfDistrict(district.id).type === "military")
    .length;

/** The gold owed the owner: the district's catalog cost. */
export const seizePrice = (id: string): number => specOfDistrict(id).cost;

/** A district is seizable when its catalog cost is three or less. */
export const isSeizable = (id: string): boolean => seizePrice(id) <= SEIZE_CEILING;

/**
 * Gain 1 gold per military district, then offer to seize a cheap district from a
 * rival. The offer is a two-stage window: name the rival whose city is
 * unfinished, then pick a district costing three or less that the Marshal does
 * not already hold. A killed Marshal takes no turn; a bewitched one is played by
 * the Witch, so its income is not added here.
 */
export const marshal: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "marshal") || ctx.state.bewitched === "marshal") {
    return withSteps(ctx.state, ctx.rest);
  }
  const paid = addGold(ctx.state, owner, militaryIn(ctx.state, owner));
  const opened = withPending(paid, { ...emptyPending(owner, "marshal"), note: TARGET_NOTE });
  return withSteps(opened, [winStep("marshal-seize", [owner]), ...ctx.rest]);
};

/**
 * Resolve the marshal-seize window. Any illegal pick closes the window and
 * leaves both cities untouched: the target must be a live rival whose city is
 * unfinished, and the seized district must cost three or less and not already
 * stand in the Marshal's city. The owner is paid the district's cost.
 */
export const marshalResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "marshal-seize") return popWindow(ctx.state);
  const rest = ctx.state.steps.slice(1);
  const owner = ctx.state.pending?.actor ?? ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  const pending = ctx.state.pending;
  if (pending === null) return withSteps(ctx.state, rest);

  if (pending.note === TARGET_NOTE) {
    const target = action?.t === "target" ? action.seat : null;
    const legal =
      target !== null &&
      target !== owner &&
      hasSeat(ctx.state, target) &&
      !isResigned(ctx.state, target) &&
      !hasCompleted(ctx.state, target);
    if (!legal) return withSteps(withPending(ctx.state, null), rest);
    return withSteps(patchPending(ctx.state, { target, note: SEIZE_NOTE }), [
      winStep("marshal-seize", [owner]),
      ...rest,
    ]);
  }

  const closed = withPending(ctx.state, null);
  const target = pending.target;
  const index = action?.t === "keep" ? action.index : -1;
  if (target === null) return withSteps(closed, rest);
  const placed = playerOf(ctx.state, target).city[index];
  if (placed === undefined) return withSteps(closed, rest);
  const mine = playerOf(ctx.state, owner).city;
  if (mine.some((district) => district.id === placed.id)) return withSteps(closed, rest);
  if (!isSeizable(placed.id)) return withSteps(closed, rest);
  const price = seizePrice(placed.id);
  if (playerOf(ctx.state, owner).gold < price) return withSteps(closed, rest);

  const paid = spendGold(ctx.state, owner, price);
  const paidOwner = addGold(paid, target, price);
  const remaining = playerOf(paidOwner, target).city.filter((_, i) => i !== index);
  const stripped = withPlayer(paidOwner, { ...playerOf(paidOwner, target), city: remaining });
  const holder = playerOf(stripped, owner);
  const seized = withPlayer(stripped, {
    ...holder,
    city: [...holder.city, { id: placed.id, gold: placed.gold }],
  });
  return withSteps(seized, rest);
};
