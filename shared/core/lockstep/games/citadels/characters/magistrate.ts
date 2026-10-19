import type { CharacterId } from "../characters.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { specOfDistrict } from "../districts.ts";
import {
  actionOf,
  addGold,
  CONFISCATE_REFUND_NOTE,
  emptyPending,
  playerOf,
  popWindow,
  resolveChooseCharacter,
  seatHolding,
  winStep,
  withPending,
  withPlayer,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";

/** Tags the magistrate's in-flight commit so its second pass is distinguishable. */
const NAME_NOTE = "magistrate-name";

/** The Magistrate may warrant another character in the cast, never himself. */
export const canConfiscate = (
  state: { readonly cast: readonly CharacterId[] },
  character: CharacterId,
): boolean => character !== "magistrate" && state.cast.includes(character);

/**
 * Assign three warrant markers to three different characters, the named target
 * first (see `assassinResolve`), then take the normal turn. `tryBuild` opens
 * `magistrate-confiscate` when the warranted character later pays to build.
 */
export const magistrate: CharacterEffect = (ctx: CharacterCtx) => {
  const { state, seat, rest } = ctx;
  const pending = state.pending;
  const committing =
    pending !== null && pending.character === "magistrate" && pending.note === NAME_NOTE;
  if (committing) {
    const named = pending.namedCharacter;
    const cleared = withPending(state, null);
    if (named === null || !canConfiscate(state, named)) {
      return withSteps(cleared, rest);
    }
    const decoys = state.cast.filter((id) => id !== named && id !== "magistrate").slice(0, 2);
    return withSteps({ ...cleared, warrants: [named, ...decoys] }, rest);
  }
  const armed = withPending(state, { ...emptyPending(seat, "magistrate"), note: NAME_NOTE });
  return withSteps(armed, [winStep("choose-character", []), { kind: "resolve" }, ...rest]);
};

/**
 * Reveal the signed warrant and take the target's just-built district into the
 * Magistrate's city for free, refunding only the gold the target spent on it (a
 * Thieves' Den paid with cards refunds just its gold share). The warrant is spent
 * on the target's first paid build either way; a district the Magistrate already
 * owns cannot be taken.
 */
export const magistrateResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "magistrate-confiscate") return popWindow(ctx.state);
  const rest = ctx.state.steps.slice(1);
  const pending = ctx.state.pending;
  // The build carried the gold it spent on pending; a hand-built state without it
  // (or a build with no pending channel) refunds the catalog cost, which equals
  // the gold spent on a fully-gold build.
  const carriedGold = pending?.note === CONFISCATE_REFUND_NOTE ? pending.gold : null;
  const magistrateSeat = ctx.window.seats[0] ?? seatHolding(ctx.state, "magistrate");
  const target = ctx.state.warrants?.[0] ?? null;
  const targetSeat = target === null ? null : seatHolding(ctx.state, target);
  const spent = { ...ctx.state, warrants: [], pending: null };
  if (magistrateSeat === null) return withSteps(spent, rest);
  const action = actionOf(ctx.frame, magistrateSeat);
  const reveal = action?.t === "choose" && action.value === "confiscate";
  if (!reveal || targetSeat === null || magistrateSeat === targetSeat) {
    return withSteps(spent, rest);
  }
  const targetPlayer = playerOf(spent, targetSeat);
  const built = targetPlayer.city[targetPlayer.city.length - 1];
  if (built === undefined) return withSteps(spent, rest);
  const magistratePlayer = playerOf(spent, magistrateSeat);
  if (magistratePlayer.city.some((district) => district.id === built.id)) {
    return withSteps(spent, rest);
  }
  const refund = carriedGold ?? specOfDistrict(built.id).cost;
  const stripped = withPlayer(spent, { ...targetPlayer, city: targetPlayer.city.slice(0, -1) });
  const paidBack = addGold(stripped, targetSeat, refund);
  const holder = playerOf(paidBack, magistrateSeat);
  const seized = withPlayer(paidBack, {
    ...holder,
    city: [...holder.city, { id: built.id, gold: built.gold }],
  });
  return withSteps(seized, rest);
};
