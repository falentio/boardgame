import type { SeatId } from "../../../index.ts";
import type { BuildQuery, DistrictHook, DistrictType } from "../districts.ts";
import { windowKindFor } from "../state.ts";
import type { CitadelsState, Pending, PlacedDistrict, Step } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const HAUNTED_QUARTER = "haunted-quarter";

/** The `pending.note` marker that tags a Haunted Quarter's type choice. */
export const HAUNTED_QUARTER_TYPE_NOTE = "haunted-quarter-type";

const playerOf = (state: CitadelsState, seat: SeatId): CitadelsState["players"][number] => {
  const player = state.players.find((candidate) => candidate.seat === seat);
  if (player === undefined) throw new Error(`seat ${seat} is not a player`);
  return player;
};

const withPlayer = (state: CitadelsState, next: CitadelsState["players"][number]): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === next.seat ? next : player)),
});

/** The owner's Haunted Quarter, or undefined when the city holds none. */
export const hauntedQuarterIn = (
  state: CitadelsState,
  owner: SeatId,
): PlacedDistrict | undefined =>
  playerOf(state, owner).city.find((district) => district.id === HAUNTED_QUARTER);

/**
 * Write `type` onto the owner's Haunted Quarter. The chosen type rides
 * `PlacedDistrict.declaredType`, which `typeOfPlaced` reports to every type
 * reader — the colour bonus above all — so a Haunted Quarter declared noble
 * supplies the noble colour instead of the unique one.
 */
export const recordHauntedQuarterType = (
  state: CitadelsState,
  owner: SeatId,
  type: DistrictType,
): CitadelsState => {
  const player = playerOf(state, owner);
  return withPlayer(state, {
    ...player,
    city: player.city.map((district) =>
      district.id === HAUNTED_QUARTER ? { ...district, declaredType: type } : district,
    ),
  });
};

/** The pending record that tags the choice so the choose-type resolver records it. */
const openedPending = (owner: SeatId): Pending => ({
  actor: owner,
  character: null,
  target: null,
  namedCharacter: null,
  namedType: null,
  cards: [],
  gold: 0,
  amount: 0,
  note: HAUNTED_QUARTER_TYPE_NOTE,
});

/** The window the owner answers, built locally: this file may not import helpers. */
const chooseTypeStep = (seat: SeatId): Step => ({
  kind: "window",
  window: { kind: windowKindFor("choose-type"), purpose: "choose-type", seats: [seat] },
});

/**
 * Offer the owner's type choice: arm the tagged pending and queue the choose-type
 * window above `rest`. Returns `state` unchanged when the owner holds no Haunted
 * Quarter or has already recorded a type, so the engine may call it every turn.
 */
export const offerHauntedQuarterType = (
  state: CitadelsState,
  owner: SeatId,
  rest: readonly Step[],
): CitadelsState => {
  const card = hauntedQuarterIn(state, owner);
  if (card === undefined || card.declaredType !== undefined) return state;
  // Another end-of-turn offer (the Armory) may already hold the pending record;
  // do not clobber it, and let the owner name a type on a later turn.
  if (state.pending !== null) return state;
  return { ...state, pending: openedPending(owner), steps: [chooseTypeStep(owner), ...rest] };
};

/**
 * At final scoring the Haunted Quarter counts as a district of any one type its
 * owner chooses. A type already named in the pending action is recorded on the
 * card; with none, the effect offers the choose-type window that asks for it. The
 * choice rides the engine's own end-of-turn seam (see `applyEndTurn`), so the
 * district declares no hook of its own.
 */
export const hauntedQuarter: DistrictEffect = (ctx: DistrictCtx) => {
  const chosen = ctx.state.pending?.namedType ?? null;
  return chosen === null
    ? offerHauntedQuarterType(ctx.state, ctx.owner, ctx.rest)
    : recordHauntedQuarterType(ctx.state, ctx.owner, chosen);
};

/** The Haunted Quarter carries no end-game points of its own; its choice rides `typeOfPlaced`. */
export const hauntedQuarterScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const hauntedQuarterBuild: BuildQuery = () => ({});

/** The choice rides the engine's end-of-turn seam, not a district hook. */
export const hauntedQuarterTriggers: readonly DistrictHook[] = [];
