import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  actionOf,
  deckDraw,
  emptyPending,
  isSkipped,
  patchPending,
  playerOf,
  popWindow,
  seatHolding,
  winStep,
  withPending,
  withPlayer,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { DistrictId } from "../districts.ts";
import type { CitadelsState, Step } from "../state.ts";

/** The Scholar draws seven cards, keeps one, and returns the rest. */
export const SCHOLAR_DRAW = 7;

/** The Scholar may build up to two districts this turn. */
export const SCHOLAR_BUILD_LIMIT = 2;

/** The seat holding the Scholar this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "scholar") ?? ctx.seat;

/**
 * The engine's only build-capable window is `turn`, one per turn by default, so
 * the Scholar's "building limit this turn is two" is two such windows replacing
 * the round's single one.
 */
const withBuildLimit = (steps: readonly Step[], seat: SeatId, limit: number): readonly Step[] => {
  const others = steps.filter(
    (step) => !(step.kind === "window" && step.window.purpose === "turn"),
  );
  const turns: readonly Step[] = Array.from({ length: Math.max(0, limit) }, () =>
    winStep("turn", [seat]),
  );
  return [...turns, ...others];
};

/**
 * Draw seven cards into flight, then open the scholar-keep window to choose one.
 * The seven are held on the pending record until the keep resolves. A killed
 * Scholar draws nothing; a bewitched one is played by the Witch, so neither
 * opens the window here.
 */
export const scholar: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "scholar") || ctx.state.bewitched === "scholar") {
    return withSteps(ctx.state, ctx.rest);
  }
  const { drawn, deck } = deckDraw(ctx.state, SCHOLAR_DRAW);
  const armed = withPending(
    { ...ctx.state, deck },
    { ...emptyPending(owner, "scholar"), cards: drawn },
  );
  return withSteps(armed, [
    winStep("scholar-keep", [owner]),
    ...withBuildLimit(ctx.rest, owner, SCHOLAR_BUILD_LIMIT),
  ]);
};

/** Put the cards the Scholar did not keep back into the deck, shuffled. */
const returnToDeck = (
  state: CitadelsState,
  cards: readonly DistrictId[],
  rng: CharacterCtx["rng"],
): CitadelsState => (cards.length === 0 ? state : { ...state, deck: rng.shuffle([...state.deck, ...cards]) });

/**
 * Resolve the scholar-keep window: the chosen card joins the Scholar's hand and
 * the other six are shuffled back into the deck. A pass (or any illegal index)
 * keeps the first card. Either way the deck loses exactly one card, so the
 * district deck stays conserved.
 */
export const scholarResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "scholar-keep") return popWindow(ctx.state);
  const rest = ctx.state.steps.slice(1);
  const seat = ctx.window.seats[0] ?? ctx.state.pending?.actor ?? ctx.state.active;
  const pool = ctx.state.pending?.cards ?? [];
  const action = actionOf(ctx.frame, seat);
  const wanted = action?.t === "keep" ? action.index : 0;
  const index = Number.isInteger(wanted) && wanted >= 0 && wanted < pool.length ? wanted : 0;
  const card = pool[index];
  const closed = withPending(ctx.state, null);
  if (card === undefined) return withSteps(closed, rest);
  const player = playerOf(closed, seat);
  const kept = withPlayer(closed, { ...player, hand: [...player.hand, card] });
  const returned = returnToDeck(kept, pool.filter((_, i) => i !== index), ctx.rng);
  return withSteps(returned, rest);
};
