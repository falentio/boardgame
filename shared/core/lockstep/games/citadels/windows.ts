import type { Frame, FrameIndex, Random, SeatId } from "../../index.ts";
import type { CitadelsAction } from "./actions.ts";
import { CHARACTER_EFFECTS, CHARACTER_RESOLVERS } from "./characters/index.ts";
import { CitadelsError } from "./error.ts";
import {
  applyCall,
  applyEndRound,
  applyEndTurn,
  END_TURN,
  hasSeat,
  isResigned,
  isTerminal,
  liveSeats,
  resolveGeneric,
  withSteps,
  type WindowCtx,
} from "./helpers.ts";
import type { CitadelsState, Step, Window, WindowPurpose } from "./state.ts";

export { isTerminal } from "./helpers.ts";
export { winnerOf } from "./scoring.ts";

/** A seat still at the table. A resigned seat is never owed an input. */
const owedFor = (state: CitadelsState, window: Window): readonly SeatId[] =>
  window.seats.filter((seat) => hasSeat(state, seat) && !isResigned(state, seat));

/** Apply one non-window step and hand back the state with the stack advanced. */
const applyImmediate = (state: CitadelsState, step: Step, rng: Random): CitadelsState => {
  switch (step.kind) {
    case "call":
      return applyCall(state);
    case "end-turn":
      return applyEndTurn(state, rng);
    case "end-round":
      return applyEndRound(state, rng);
    case "resolve": {
      const pending = state.pending;
      if (pending === null || pending.character === null) return withSteps(state, state.steps.slice(1));
      const effect = CHARACTER_EFFECTS[pending.character];
      return effect({
        state,
        seat: pending.actor,
        rest: state.steps.slice(1),
        rng,
      });
    }
    case "window":
      return state;
  }
};

/** Apply steps until the stack tops out at a window that owes input, or the game ends. */
const drain = (state: CitadelsState, rng: Random): CitadelsState => {
  let next = state;
  for (let guard = 0; ; guard += 1) {
    if (guard > 2000) {
      throw new CitadelsError(`citadels stack machine did not settle: ${JSON.stringify(next.steps)}`);
    }
    if (isTerminal(next)) return withSteps(next, []);
    const top = next.steps[0];
    if (top === undefined) {
      // The stack emptied mid-round (every remaining seat resigned): close the round.
      next = applyEndRound({ ...next, steps: [{ kind: "end-round" }] }, rng);
      if (isTerminal(next)) return next;
      continue;
    }
    if (top.kind === "window") {
      const owed = owedFor(next, top.window);
      if (top.window.kind === "turn" || owed.length > 0) return next;
      next = withSteps(next, next.steps.slice(1));
      continue;
    }
    next = applyImmediate(next, top, rng);
  }
};

/** The seats a window owes: every live seat for `any`, else its named live seats. */
const windowOwed = (state: CitadelsState, window: Window): readonly SeatId[] =>
  window.kind === "any" ? liveSeats(state) : owedFor(state, window);

const foldResigns = (state: CitadelsState, frame: Frame<CitadelsAction>): CitadelsState => {
  const resigned = [...state.resigned];
  for (const [seat, input] of frame.inputs) {
    if (input.kind === "resign" && !resigned.includes(seat)) resigned.push(seat);
  }
  return resigned.length === state.resigned.length ? state : { ...state, resigned };
};

export const stepState = (
  state: CitadelsState,
  frame: Frame<CitadelsAction>,
  rng: Random,
): CitadelsState => {
  if (isTerminal(state)) return state;
  const folded = foldResigns(state, frame);
  if (isTerminal(folded)) return withSteps(folded, []);
  const top = folded.steps[0];
  if (top === undefined || top.kind !== "window") {
    throw new CitadelsError("citadels step called with no open window");
  }
  const owed = windowOwed(folded, top.window);
  if (owed.length === 0 && top.window.kind !== "turn") {
    return drain(withSteps(folded, folded.steps.slice(1)), rng);
  }
  const resolver = CHARACTER_RESOLVERS[top.window.purpose] ?? resolveGeneric;
  const ctx: WindowCtx = { state: folded, window: top.window, frame, rng };
  return drain(resolver(ctx), rng);
};

/** The seats owed input right now, or an empty set when the game is over. */
export const seatsOwedNow = (state: CitadelsState): readonly SeatId[] => {
  if (isTerminal(state)) return [];
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") {
    const live = liveSeats(state);
    return live.length > 0 ? live : state.players.map((p) => p.seat);
  }
  const owed = windowOwed(state, top.window);
  if (owed.length > 0) return owed;
  const live = liveSeats(state);
  return live.length > 0 ? live : [state.active];
};

export const seatsOwedFor = (state: CitadelsState, _index: FrameIndex): readonly SeatId[] =>
  seatsOwedNow(state);

/** True when the window stack has a live window on top (never a bare step). */
export const openWindow = (state: CitadelsState): Window | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window : null;
};

export { END_TURN };
export type { WindowPurpose };
