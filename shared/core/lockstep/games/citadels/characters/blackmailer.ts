import { specOfCharacter, type CharacterId } from "../characters.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  actionOf,
  activeCharacterOf,
  emptyPending,
  isSkipped,
  patchPending,
  playerOf,
  seatHolding,
  transferGold,
  winStep,
  withPending,
  withSteps,
  type WindowCtx,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState, Step } from "../state.ts";

/** The blackmailer's in-flight sub-states, carried in `pending.note`. */
const THREAT_1 = "threat-1";
const THREAT_2 = "threat-2";
const REVEAL = "reveal";

/**
 * Whether the Blackmailer may put a threat marker on `character`: not rank 1
 * (already taken its turn), not the Assassin's kill, not the Witch's bewitch, and
 * not a character already threatened this round.
 */
export const canThreat = (
  state: CitadelsState,
  character: CharacterId,
  taken: readonly CharacterId[] = [],
): boolean =>
  specOfCharacter(character).rank !== 1 &&
  !isSkipped(state, character) &&
  state.bewitched !== character &&
  !taken.includes(character);

/**
 * Assign two threat markers facedown to two different characters; the first
 * named shows the flowered lace and is the target, the second is the decoy.
 * Recorded in `threats` with the target first, which `applyCall` reads to open
 * the `blackmailer-threat` window at the start of a threatened player's turn.
 */
export const blackmailer: CharacterEffect = (ctx: CharacterCtx) => {
  const { state, seat, rest } = ctx;
  const pending = state.pending;
  const mine = pending !== null && pending.character === "blackmailer" ? pending : null;

  // applyCall arms the pending record before the effect runs, so the entry pass
  // is the one with a null note, not a null pending.
  if (mine === null || mine.note === null) {
    const armed = withPending(state, { ...emptyPending(seat, "blackmailer"), note: THREAT_1 });
    return withSteps(armed, [
      winStep("blackmailer-resolve", [seat]),
      { kind: "resolve" },
      ...rest,
    ]);
  }
  if (mine.note === THREAT_1) {
    const first = mine.namedCharacter;
    const threats = first !== null && canThreat(state, first) ? [first] : [];
    const armed = { ...patchPending(state, { note: THREAT_2, namedCharacter: null }), threats };
    return withSteps(armed, [
      winStep("blackmailer-resolve", [seat]),
      { kind: "resolve" },
      ...rest,
    ]);
  }
  const second = mine.namedCharacter;
  const base = state.threats ?? [];
  const threats = second !== null && canThreat(state, second, base) ? [...base, second] : base;
  return withSteps({ ...withPending(state, null), threats }, rest);
};

/** The Blackmailer names a character for one of the two markers. */
const resolveName = (ctx: WindowCtx, rest: readonly Step[]): CitadelsState => {
  const actor = ctx.state.pending?.actor ?? ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, actor);
  const named = action?.t === "name-character" ? action.character : null;
  return withSteps(
    named === null ? ctx.state : patchPending(ctx.state, { namedCharacter: named }),
    rest,
  );
};

/**
 * A threatened player resolves the threat before taking their turn: bribe by
 * paying half their gold (rounded down) to remove the marker, or refuse and let
 * the Blackmailer decide whether to reveal the marker.
 */
const resolveThreat = (ctx: WindowCtx, rest: readonly Step[]): CitadelsState => {
  const state = ctx.state;
  const seat = ctx.window.seats[0] ?? state.active;
  const character = activeCharacterOf(state, seat);
  if (character === null || !(state.threats ?? []).includes(character)) {
    return withSteps(state, rest);
  }
  const blackmailerOwner = seatHolding(state, "blackmailer");
  const action = actionOf(ctx.frame, seat);
  if (action?.t === "choose" && action.value === "bribe") {
    const half = Math.floor(playerOf(state, seat).gold / 2);
    const paid =
      blackmailerOwner === null ? state : transferGold(state, seat, blackmailerOwner, half);
    return withSteps({ ...paid, threats: spendMarker(paid.threats ?? [], character) }, rest);
  }
  if (blackmailerOwner === null) {
    return withSteps({ ...state, threats: spendMarker(state.threats ?? [], character) }, rest);
  }
  const armed = withPending(state, {
    ...emptyPending(blackmailerOwner, "blackmailer"),
    note: REVEAL,
  });
  return withSteps(armed, [winStep("blackmailer-resolve", [blackmailerOwner]), ...rest]);
};

/**
 * True when the threat array records that the flowered-lace marker is already
 * spent. The lace rides the placement order, so the only fact the array keeps
 * about it is that it stood first; spending that marker doubles the survivors
 * (see spendMarker), and a doubled head is the spent-lace mark.
 */
const laceSpent = (threats: readonly CharacterId[]): boolean =>
  threats.length > 1 && threats[0] === threats[threats.length - 1];

/**
 * Drop the marker character carried from the threat array. When that marker is
 * the one the lace rode - it stood first and no lace was already spent - the
 * survivors are doubled, so a later reveal still tells a standing lace from a
 * spent one: while both markers stand the array reads [lace, decoy], it reads
 * [decoy] once the decoy is spent, and [decoy, decoy] once the lace is.
 */
const spendMarker = (
  threats: readonly CharacterId[],
  character: CharacterId,
): readonly CharacterId[] => {
  const survivors = threats.filter((c) => c !== character);
  const laced = threats[0] === character && !laceSpent(threats);
  return laced ? [...survivors, ...survivors] : survivors;
};

/** The Blackmailer may reveal the marker; the flowered lace takes all the gold. */
const resolveReveal = (ctx: WindowCtx, rest: readonly Step[]): CitadelsState => {
  const state = ctx.state;
  const actor = state.pending?.actor ?? ctx.window.seats[0] ?? state.active;
  const victim = state.active;
  const character = activeCharacterOf(state, victim);
  const cleared = withPending(state, null);
  if (character === null) return withSteps(cleared, rest);
  const threats = cleared.threats ?? [];
  const action = actionOf(ctx.frame, actor);
  const revealed = action?.t === "choose" && action.value === "reveal";
  const flowered = threats[0] === character && !laceSpent(threats);
  let next: CitadelsState = { ...cleared, threats: spendMarker(threats, character) };
  if (revealed && flowered) {
    next = transferGold(next, victim, actor, playerOf(next, victim).gold);
  }
  return withSteps(next, rest);
};

/** Resolve the blackmailer's own windows; the shared `choose-*` windows never land here. */
export const blackmailerResolve: WindowResolver = (ctx) => {
  const rest = ctx.state.steps.slice(1);
  if (ctx.window.purpose === "blackmailer-resolve") {
    return ctx.state.pending?.note === REVEAL ? resolveReveal(ctx, rest) : resolveName(ctx, rest);
  }
  return resolveThreat(ctx, rest);
};
