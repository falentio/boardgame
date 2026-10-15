import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { specOfDistrict, typeOfPlaced } from "../districts.ts";
import { greatWallExchangeToll } from "../districts/great-wall.ts";
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
import { bishopShield } from "./bishop.ts";

/** The diplomat's three in-flight sub-states, carried in `pending.note`. */
const TARGET_NOTE = "diplomat-target";
const TAKE_NOTE = "diplomat-take";
const GIVE_NOTE = "diplomat-give";

/** The seat holding the Diplomat this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "diplomat") ?? ctx.seat;

/** The Diplomat's income unit: military districts in a city. */
const militaryIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter((district) => typeOfPlaced(district) === "military")
    .length;

/** The gold owed when the rival's district costs more than the one handed over. */
export const exchangeCost = (taken: string, given: string): number =>
  Math.max(0, specOfDistrict(taken).cost - specOfDistrict(given).cost);

/**
 * Gain 1 gold per military district, then offer an exchange with a rival. The
 * offer is a three-stage window: name the rival, pick the district taken from
 * their city, then pick the district given from yours. A killed Diplomat takes
 * no turn; a bewitched one is played by the Witch, so its income is not added.
 */
export const diplomat: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "diplomat") || ctx.state.bewitched === "diplomat") {
    return withSteps(ctx.state, ctx.rest);
  }
  const paid = addGold(ctx.state, owner, militaryIn(ctx.state, owner));
  const opened = withPending(paid, { ...emptyPending(owner, "diplomat"), note: TARGET_NOTE });
  return withSteps(opened, [winStep("diplomat-exchange", [owner]), ...ctx.rest]);
};

/**
 * Resolve the diplomat-exchange window. Any illegal pick closes the window and
 * leaves both cities untouched: the target must be a live rival whose city is
 * unfinished, the taken district must not already stand in the Diplomat's city,
 * and the given district must not stand in the rival's city.
 */
export const diplomatResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "diplomat-exchange") return popWindow(ctx.state);
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
    return withSteps(patchPending(ctx.state, { target, note: TAKE_NOTE }), [
      winStep("diplomat-exchange", [owner]),
      ...rest,
    ]);
  }

  const target = pending.target;
  if (target === null) return withSteps(withPending(ctx.state, null), rest);

  if (pending.note === TAKE_NOTE) {
    const index = action?.t === "keep" ? action.index : -1;
    const taken = playerOf(ctx.state, target).city[index];
    const mine = playerOf(ctx.state, owner).city;
    if (taken === undefined || mine.some((district) => district.id === taken.id)) {
      return withSteps(withPending(ctx.state, null), rest);
    }
    if (bishopShield(ctx.state) === target) return withSteps(withPending(ctx.state, null), rest);
    return withSteps(
      patchPending(ctx.state, { cards: [taken.id], amount: index, note: GIVE_NOTE }),
      [winStep("diplomat-exchange", [owner]), ...rest],
    );
  }

  const closed = withPending(ctx.state, null);
  const takenIndex = pending.amount;
  const giveIndex = action?.t === "keep" ? action.index : -1;
  const rivalCity = playerOf(ctx.state, target).city;
  const myCity = playerOf(ctx.state, owner).city;
  const taken = rivalCity[takenIndex];
  const given = myCity[giveIndex];
  if (taken === undefined || given === undefined) return withSteps(closed, rest);
  const rivalRemaining = rivalCity.filter((_, i) => i !== takenIndex);
  if (rivalRemaining.some((district) => district.id === given.id)) {
    return withSteps(closed, rest);
  }
  const owed = exchangeCost(taken.id, given.id) + greatWallExchangeToll(rivalCity, myCity);
  if (playerOf(ctx.state, owner).gold < owed) return withSteps(closed, rest);

  const paid = spendGold(ctx.state, owner, owed);
  const mineNext = [...playerOf(paid, owner).city.filter((_, i) => i !== giveIndex), taken];
  const rivalNext = [...playerOf(paid, target).city.filter((_, i) => i !== takenIndex), given];
  const swapped = withPlayer(
    withPlayer(paid, { ...playerOf(paid, owner), city: mineNext }),
    { ...playerOf(paid, target), city: rivalNext },
  );
  return withSteps(swapped, rest);
};
