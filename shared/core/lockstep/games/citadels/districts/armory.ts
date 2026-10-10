import type { Frame, SeatId } from "../../../index.ts";
import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { CitadelsAction } from "../actions.ts";
import { windowKindFor } from "../state.ts";
import type { CitadelsState, Pending, Step } from "../state.ts";
import { CITY_TARGET } from "../setup.ts";
import type { WindowResolver } from "../helpers.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/**
 * The Armory resolves its own window, so it may not import `helpers.ts` at
 * runtime: helpers imports `districts/effects.ts`, which imports this file, and a
 * runtime edge here would leave `DISTRICT_RESOLVERS["armory-destroy"]` undefined
 * when a test loads this file before `effects.ts`. The few helpers it needs are
 * local for that reason. `CITY_TARGET` is eight; the Bell Tower is not a catalog
 * card, so the target never drops to seven.
 */
const ARMORY_ID = "armory";
const PICK_NOTE = "armory-pick";
const DESTROY_NOTE = "armory-destroy";

const playerOf = (state: CitadelsState, seat: SeatId) => {
  const player = state.players.find((p) => p.seat === seat);
  if (player === undefined) throw new Error(`seat ${seat} is not a player`);
  return player;
};

const hasSeat = (state: CitadelsState, seat: SeatId): boolean =>
  state.players.some((p) => p.seat === seat);

const hasCompleted = (state: CitadelsState, seat: SeatId): boolean =>
  state.completed.includes(seat) || playerOf(state, seat).city.length >= CITY_TARGET;

const withPlayer = (
  state: CitadelsState,
  next: CitadelsState["players"][number],
): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === next.seat ? next : p)),
});

const winStep = (seats: readonly SeatId[]): Step => ({
  kind: "window",
  window: { kind: windowKindFor("armory-destroy"), purpose: "armory-destroy", seats },
});

const popWindow = (state: CitadelsState): CitadelsState => ({
  ...state,
  steps: state.steps.slice(1),
});

const actionOf = (frame: Frame<CitadelsAction>, seat: SeatId): CitadelsAction | null => {
  const entry = frame.inputs.find(([s]) => s === seat);
  if (entry === undefined || entry[1].kind !== "act") return null;
  return entry[1].action;
};

const openedPending = (actor: SeatId): Pending => ({
  actor,
  character: null,
  target: null,
  namedCharacter: null,
  namedType: null,
  cards: [],
  gold: 0,
  amount: 0,
  note: PICK_NOTE,
});

const withPending = (state: CitadelsState, pending: Pending | null): CitadelsState => ({
  ...state,
  pending,
});

const patchPending = (state: CitadelsState, patch: Partial<Pending>): CitadelsState =>
  state.pending === null ? state : { ...state, pending: { ...state.pending, ...patch } };

/**
 * On the owner's turn, offer to destroy the Armory to destroy one district of
 * another player's. The offer is a two-stage window: name the rival whose city
 * falls, then pick the district. The Armory is the price, so no gold changes
 * hands.
 */
export const armory: DistrictEffect = (ctx: DistrictCtx) => ({
  ...withPending(ctx.state, openedPending(ctx.owner)),
  steps: [winStep([ctx.owner]), ...ctx.rest],
});

/**
 * Resolve the armory-destroy window. Stage one reads the target seat; stage two
 * reads the city index, then sinks the Armory and the chosen district to the
 * bottom of the deck. Any illegal pick closes the window and leaves every city
 * untouched: the target must be a live rival whose city is unfinished.
 */
export const armoryResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "armory-destroy") return popWindow(ctx.state);
  const rest = ctx.state.steps.slice(1);
  const owner = ctx.state.pending?.actor ?? ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  const pending = ctx.state.pending;

  if (pending === null || pending.note === PICK_NOTE) {
    const target = action?.t === "target" ? action.seat : null;
    const legal =
      target !== null &&
      target !== owner &&
      hasSeat(ctx.state, target) &&
      !hasCompleted(ctx.state, target);
    if (!legal) return { ...withPending(ctx.state, null), steps: rest };
    return {
      ...patchPending(ctx.state, { target, note: DESTROY_NOTE }),
      steps: [winStep([owner]), ...rest],
    };
  }

  const closed = withPending(ctx.state, null);
  const target = pending.target;
  const index = action?.t === "keep" ? action.index : -1;
  if (target === null) return { ...closed, steps: rest };
  const placed = playerOf(ctx.state, target).city[index];
  if (placed === undefined) return { ...closed, steps: rest };

  const mine = playerOf(ctx.state, owner).city;
  const armoryIndex = mine.findIndex((district) => district.id === ARMORY_ID);
  if (armoryIndex < 0) return { ...closed, steps: rest };

  const strippedOwner = withPlayer(ctx.state, {
    ...playerOf(ctx.state, owner),
    city: mine.filter((_, i) => i !== armoryIndex),
  });
  const strippedTarget = withPlayer(strippedOwner, {
    ...playerOf(strippedOwner, target),
    city: playerOf(strippedOwner, target).city.filter((_, i) => i !== index),
  });
  return {
    ...strippedTarget,
    deck: [...strippedTarget.deck, ARMORY_ID, placed.id],
    steps: rest,
  };
};

/** The Armory scores no end-game points of its own. */
export const armoryScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const armoryBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const armoryTriggers: readonly DistrictHook[] = ["onDestroy"];
