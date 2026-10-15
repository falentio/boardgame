import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { typeOfDistrict } from "../districts.ts";
import {
  drawIntoHand,
  emptyPending,
  hasSeat,
  patchPending,
  playerOf,
  popWindow,
  resolveChooseType,
  transferGold,
  winStep,
  withPending,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";

/** The spy's three in-flight sub-states, carried in `pending.note`. */
const SEAT_NOTE = "spy-seat";
const TYPE_NOTE = "spy-type";
const PEEK_NOTE = "spy-peek";

/**
 * Choose another player and name a district type, then look at that player's
 * hand: for each card of the named type, take 1 gold from the player and gain 1
 * card from the deck. A player short on gold loses only what they have but the
 * Spy still draws one card per matching card.
 *
 * The effect walks four passes over `pending.note`: ask for a seat, ask for a
 * type, capture the target's hand (the "look"), then apply. Capturing the hand
 * into `pending.cards` is the engine-representable form of the look, which no
 * view field exposes.
 */
export const spy: CharacterEffect = (ctx: CharacterCtx) => {
  const { state, seat, rest } = ctx;
  const mine = state.pending !== null && state.pending.character === "spy" ? state.pending : null;

  if (mine === null || mine.note === null) {
    const armed = withPending(state, { ...emptyPending(seat, "spy"), note: SEAT_NOTE });
    return withSteps(armed, [winStep("choose-seat", []), { kind: "resolve" }, ...rest]);
  }
  if (mine.note === SEAT_NOTE) {
    return withSteps(patchPending(state, { note: TYPE_NOTE }), [
      winStep("choose-type", []),
      { kind: "resolve" },
      ...rest,
    ]);
  }
  if (mine.note === TYPE_NOTE) {
    const target = mine.target;
    const hand = target !== null && hasSeat(state, target) ? [...playerOf(state, target).hand] : [];
    return withSteps(patchPending(state, { note: PEEK_NOTE, cards: hand }), [
      { kind: "resolve" },
      ...rest,
    ]);
  }

  const target = mine.target;
  const namedType = mine.namedType;
  const hand = mine.cards;
  const cleared = withPending(state, null);
  if (target === null || target === seat || namedType === null) return withSteps(cleared, rest);
  const matches = hand.filter((id) => typeOfDistrict(id) === namedType).length;
  const looted = transferGold(cleared, target, seat, matches);
  return withSteps(drawIntoHand(looted, seat, matches), rest);
};

/** Resolve the spy's `choose-type` window; any other purpose pops and continues. */
export const spyResolve: WindowResolver = (ctx) =>
  ctx.window.purpose === "choose-type" ? resolveChooseType(ctx) : popWindow(ctx.state);
