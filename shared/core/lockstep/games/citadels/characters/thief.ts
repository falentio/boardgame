import { specOfCharacter, type CharacterId } from "../characters.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  emptyPending,
  isSkipped,
  playerOf,
  resolveChooseSeat,
  transferGold,
  winStep,
  withPending,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** Tags the thief's in-flight commit so its second pass is distinguishable. */
const NAME_NOTE = "thief-name";

/**
 * Whether the Thief may rob `character`. The Thief (rank 2) names after every
 * rank-1 character has been called, so the kill and the bewitch are already
 * known: rank 1 is excluded outright, and the killed or bewitched character is
 * excluded because its owner never gets the turn the Thief would rob.
 */
export const canRob = (state: CitadelsState, character: CharacterId): boolean =>
  character !== "thief" &&
  specOfCharacter(character).rank !== 1 &&
  !isSkipped(state, character) &&
  state.bewitched !== character;

/**
 * Call the name of another character. The first pass arms the commit and opens
 * the choose-character window; the second pass, reached after that window
 * resolves, records the name in `robbed`, which `applyCall` reads to open the
 * thief-rob window before the named character takes its turn.
 */
export const thief: CharacterEffect = (ctx: CharacterCtx) => {
  const { state, seat, rest } = ctx;
  const pending = state.pending;
  const committing =
    pending !== null && pending.character === "thief" && pending.note === NAME_NOTE;
  if (committing) {
    const named = pending.namedCharacter;
    const cleared = withPending(state, null);
    if (named === null || !canRob(state, named)) return withSteps(cleared, rest);
    return withSteps({ ...cleared, robbed: named }, rest);
  }
  const armed = withPending(state, { ...emptyPending(seat, "thief"), note: NAME_NOTE });
  return withSteps(armed, [winStep("choose-character", []), { kind: "resolve" }, ...rest]);
};

/**
 * Resolve the windows the Thief's own file owns: the shared `choose-seat` pick
 * (any character that names a target seat) and `thief-rob`, which takes all of
 * the called character's owner's gold.
 */
export const thiefResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose === "choose-seat") return resolveChooseSeat(ctx);
  const rest = ctx.state.steps.slice(1);
  const thiefOwner = ctx.window.seats[0] ?? ctx.state.pending?.actor ?? ctx.state.active;
  const victim = ctx.state.active;
  if (ctx.state.robbed === null || victim === thiefOwner) {
    return withSteps(ctx.state, rest);
  }
  const loot = playerOf(ctx.state, victim).gold;
  return withSteps(transferGold(ctx.state, victim, thiefOwner, loot), rest);
};
