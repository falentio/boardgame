import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import type { CharacterId } from "../characters.ts";
import type { CitadelsState, Step } from "../state.ts";
import {
  addGold,
  emptyPending,
  popWindow,
  RESOLVE,
  armCharacterTurn,
  resolveChooseCharacter,
  seatHolding,
  winStep,
  withPending,
  withSteps,
  type WindowCtx,
  type WindowResolver,
} from "../helpers.ts";
import { declareSchoolOfMagic } from "../districts/school-of-magic.ts";

/** The Witch's fixed gather, taken before the bewitch. */
const GATHER = 2;

/** Tags the witch's in-flight commit so its second pass is distinguishable. */
const NAME_NOTE = "witch-name";


/** The Witch may bewitch another character in the cast, never herself. */
export const canBewitch = (
  state: { readonly cast: readonly CharacterId[] },
  character: CharacterId,
): boolean => character !== "witch" && state.cast.includes(character);

/**
 * Gather resources (the fixed +2), then call the name of another character to
 * bewitch. The turn is put on hold: the round's own turn window stays in the
 * stack so the engine pauses at it, but `resolveTurn` closes it at once without
 * gathering or building ("your turn is put on hold and you cannot build"). Her
 * turn resumes when the bewitched character is called (see `witchResolve`).
 */
export const witch: CharacterEffect = (ctx: CharacterCtx) => {
  const { state, seat, rest } = ctx;
  const pending = state.pending;
  const committing = pending !== null && pending.character === "witch" && pending.note === NAME_NOTE;
  if (committing) {
    const named = pending.namedCharacter;
    const cleared = withPending(state, null);
    if (named === null || !canBewitch(state, named)) {
      return withSteps(cleared, rest);
    }
    return withSteps({ ...cleared, bewitched: named }, rest);
  }
  const gathered = addGold(state, seat, GATHER);
  const armed = withPending(gathered, { ...emptyPending(seat, "witch"), note: NAME_NOTE });
  return withSteps(armed, [winStep("choose-character", []), { kind: "resolve" }, ...rest]);
};

/**
 * The stack the Witch's resume runs: the bewitched character's OWN armed turn,
 * built by the same `armCharacterTurn` `applyCall` uses, so the Navigator's
 * choice window opens above the resolve and every other character's ability
 * resolves below the gather turn window. The engine's resolve step runs
 * `CHARACTER_EFFECTS[bewitched]` with the Witch's seat, and `seatHolding`
 * (keyed on the owned `resume` record) points the bewitched character's owner
 * lookup at the Witch, so its ability lands on her hand, gold, and city.
 */
const resumeStack = (
  witchSeat: SeatId,
  bewitched: CharacterId | null,
  rest: readonly Step[],
): readonly Step[] => armCharacterTurn(bewitched, witchSeat, rest);

/**
 * `witch-takeover` (opened by `applyCall` when the bewitched character is called)
 * gives the bewitched owner its gather and ends its turn at once, then hands the
 * held turn back to the Witch. `witch-resume` opens the Witch's turn as the
 * bewitched character's turn, played with the Witch's hand, gold, and city: the
 * resolve step runs that character's ability and `buildLimit` honours its limit.
 */
export const witchResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "witch-takeover" && ctx.window.purpose !== "witch-resume") {
    return popWindow(ctx.state);
  }
  const rest = ctx.state.steps.slice(1);
  const witchSeat = ctx.window.seats[0] ?? seatHolding(ctx.state, "witch");
  if (witchSeat === undefined || witchSeat === null) return withSteps(ctx.state, rest);
  if (ctx.window.purpose === "witch-resume") {
    const bewitched = ctx.state.bewitched ?? null;
    // The resume identity is owned state, not the shared pending slot: every
    // effect the resume runs writes its own pending record, so a marker there
    // would be clobbered. `bewitched` clears so the bewitched character's own
    // effect (which suppresses itself while `bewitched` names it) runs.
    const resumePending = emptyPending(witchSeat, bewitched);
    const resumed = withPending(
      {
        ...ctx.state,
        active: witchSeat,
        bewitched: null,
        resume: { seat: witchSeat, character: bewitched },
      },
      resumePending,
    );
    // The resumed turn is the bewitched character's turn played with the Witch's
    // city, so her School of Magic declares that character's colour before the
    // income above the turn window counts it, exactly as applyCall declares for
    // an ordinary character.
    const declared = bewitched === null ? resumed : declareSchoolOfMagic(resumed, witchSeat, bewitched);
    return withSteps(declared, resumeStack(witchSeat, bewitched, rest));
  }
  const bewitched = ctx.state.bewitched ?? null;
  const bewitchedSeat = bewitched === null ? null : seatHolding(ctx.state, bewitched);
  const gathered = bewitchedSeat === null ? ctx.state : addGold(ctx.state, bewitchedSeat, GATHER);
  return withSteps(gathered, [winStep("witch-resume", [witchSeat]), ...rest]);
};
