import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { specOfDistrict } from "../districts.ts";
import {
  actionOf,
  addGold,
  drawIntoHand,
  emptyPending,
  isSkipped,
  liveSeats,
  playerOf,
  popWindow,
  seatHolding,
  transferGold,
  winStep,
  withPending,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The seat holding the Abbot this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "abbot") ?? ctx.seat;

/** The Abbot's income unit: religious districts in a city. */
const religiousIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter(
    (district) => specOfDistrict(district.id).type === "religious",
  ).length;

/** The richest live seats, by gold, optionally excluding one seat. */
const richestSeats = (state: CitadelsState, exclude?: SeatId): readonly SeatId[] => {
  const live = liveSeats(state).filter((seat) => seat !== exclude);
  const top = live.reduce((best, seat) => Math.max(best, playerOf(state, seat).gold), 0);
  return live.filter((seat) => playerOf(state, seat).gold === top);
};

/** The Abbot is the strict-or-tied richest player: nobody holds more gold. */
const isRichest = (state: CitadelsState, owner: SeatId): boolean =>
  liveSeats(state)
    .filter((seat) => seat !== owner)
    .every((seat) => playerOf(state, seat).gold <= playerOf(state, owner).gold);

/**
 * The Abbot declares, before taking, how many of its religious districts yield
 * gold; the rest yield a card each. A choose action carries that count, a pay
 * action the same number; anything else takes every district as gold.
 */
const declaredGold = (action: ReturnType<typeof actionOf>, count: number): number => {
  const requested =
    action?.t === "choose"
      ? Number.parseInt(action.value, 10)
      : action?.t === "pay"
        ? action.amount
        : count;
  if (!Number.isFinite(requested)) return count;
  return Math.max(0, Math.min(count, requested));
};

/**
 * Open the split window: the Abbot declares its gold-or-cards combination before
 * taking, then the richest clause resolves. A killed Abbot takes no income.
 */
export const abbot: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "abbot")) return withSteps(ctx.state, ctx.rest);
  const opened = withPending(ctx.state, {
    ...emptyPending(owner, "abbot"),
    note: "abbot-split",
  });
  return withSteps(opened, [winStep("abbot-split", [owner]), ...ctx.rest]);
};

/** Stage two: the Abbot picks which tied richest player pays 1 gold. */
const resolveTie = (
  ctx: Parameters<WindowResolver>[0],
  owner: SeatId,
  action: ReturnType<typeof actionOf>,
): CitadelsState => {
  const tied = richestSeats(ctx.state, owner);
  const wanted = action?.t === "target" ? action.seat : null;
  const payer = wanted !== null && tied.includes(wanted) ? wanted : tied[0];
  if (payer === undefined) return popWindow(withPending(ctx.state, null));
  return popWindow(withPending(transferGold(ctx.state, payer, owner, 1), null));
};

/** Stage one: split the religious districts into gold and cards, then the richest clause. */
const resolveSplit = (
  ctx: Parameters<WindowResolver>[0],
  owner: SeatId,
  action: ReturnType<typeof actionOf>,
): CitadelsState => {
  const count = religiousIn(ctx.state, owner);
  const gold = declaredGold(action, count);
  const paid = drawIntoHand(addGold(ctx.state, owner, gold), owner, count - gold);
  if (isRichest(paid, owner)) return popWindow(withPending(paid, null));
  const richest = richestSeats(paid, owner);
  const sole = richest.length === 1 ? richest[0] : undefined;
  if (sole !== undefined) {
    return popWindow(withPending(transferGold(paid, sole, owner, 1), null));
  }
  const opened = withPending(paid, {
    ...emptyPending(owner, "abbot"),
    note: "abbot-tie",
  });
  return withSteps(opened, [winStep("abbot-split", [owner]), ...ctx.state.steps.slice(1)]);
};

/** Resolve the two abbot-split stages, distinguished by pending.note. */
export const abbotResolve: WindowResolver = (ctx) => {
  const owner = seatHolding(ctx.state, "abbot") ?? ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  return ctx.state.pending?.note === "abbot-tie"
    ? resolveTie(ctx, owner, action)
    : resolveSplit(ctx, owner, action);
};
