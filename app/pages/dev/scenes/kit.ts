import {
  charactersOfRank,
  citadels,
  specOfCharacter,
  specOfDistrict,
  type CharacterId,
  type CitadelsAction,
  type CitadelsState,
  type CitadelsView,
  type Rank,
  type WindowPurpose,
} from "#shared/core/lockstep/games/citadels/index.ts";
import { DEFAULT_UNIQUES, type DistrictId } from "#shared/core/lockstep/games/citadels/districts.ts";
import {
  act,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  type SeatId,
} from "#shared/core/lockstep/index.ts";
import { seatId } from "#shared/rooms/ids.ts";

const ANN = seatId("ann");
const BOB = seatId("bob");
const CARA = seatId("cara");
const DAN = seatId("dune");
const EVE = seatId("eve");

export const SEATS = [ANN, BOB, CARA];

/** The Queen's ability is dead below five players, so a scene may ask for a full table. */
export const FIVE = [ANN, BOB, CARA, DAN, EVE];
export const SEED = genesisSeed("purpose-recordings");
export const NAMES = new Map([
  [ANN, "Ada"],
  [BOB, "Bo"],
  [CARA, "Cy"],
  [DAN, "Dune"],
  [EVE, "Eve"],
]);

export type Decide = (seat: SeatId, state: CitadelsState) => CitadelsAction | null;

/**
 * A scene names the purpose it must fold to, the cast and deck that can reach it,
 * and how to play.
 */
export interface Scene {
  readonly purpose: WindowPurpose;
  readonly cast: readonly CharacterId[];
  /** The 14 unique districts the fold deals; the engine's default when a scene names none. */
  readonly uniques?: readonly DistrictId[];
  readonly decide?: Decide;
  readonly until?: (state: CitadelsState) => boolean;
  /** Who sits at the table. Three by default; a scene may need a full five. */
  readonly seats?: readonly SeatId[];
}

/** A legal rank-1..8 cast carrying `target`, plus rank 9 when it lives there. */
export const castWith = (target: CharacterId): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1 as Rank; rank <= 8; rank = (rank + 1) as Rank) {
    const at = charactersOfRank(rank);
    const fallback = at[0];
    if (fallback === undefined) throw new Error("no character at rank " + String(rank));
    cast.push(at.includes(target) ? target : fallback);
  }
  if (specOfCharacter(target).rank === 9) cast.push(target);
  return cast;
};

/** The always-legal policy: answer whatever the top window asks for with a legal input. */
export const auto: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  const window = view.window;
  if (window === null) return null;
  if (window.purpose === "turn") {
    const me = view.players.find((player) => player.seat === seat);
    const inCity = new Set((me?.city ?? []).map((district) => district.id));
    const purse = me?.gold ?? 0;
    const buildable = view.myHand
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => !inCity.has(id) && specOfDistrict(id).cost <= purse)
      .sort((a, b) => specOfDistrict(a.id).cost - specOfDistrict(b.id).cost)[0];
    if (buildable !== undefined && (me?.city.length ?? 0) < 8) {
      return { t: "build", card: buildable.index };
    }
    if (view.myHand.length < 4 && view.deckCount > 0) return { t: "draw" };
    return { t: "gold" };
  }
  if (window.purpose === "keep") return { t: "keep", index: 0 };
  if (window.purpose === "draft-pick") {
    const pick = view.cast[0];
    return pick === undefined ? null : { t: "pick", character: pick };
  }
  return null;
};

/** One frame, every owed seat answered by `decide`. */
export const advance = (state: CitadelsState, decide: Decide): CitadelsState =>
  citadels.step(
    state,
    {
      index: frameIndex(0),
      seed: SEED,
      inputs: citadels.seatsOwed(state, frameIndex(0)).map((seat) => {
        const action = decide(seat, state);
        return [seat, action === null ? { kind: "idle" } : act<CitadelsAction>(action)];
      }),
    },
    makeRandom(SEED),
  );

export const openPurpose = (state: CitadelsState): string | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

export const answeringSeat = (state: CitadelsState): SeatId => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no window open");
  return top.window.kind === "any"
    ? (state.pending?.actor ?? state.active)
    : (top.window.seats[0] ?? state.active);
};

export const viewOf = (state: CitadelsState): CitadelsView =>
  citadels.project(state, answeringSeat(state));

/** Fold real frames from a real genesis until the scene's purpose tops the window stack. */
export const foldScene = (scene: Scene): { readonly state: CitadelsState; readonly frames: number } => {
  const decide = scene.decide ?? auto;
  const ready = scene.until ?? ((): boolean => true);
  let state = citadels.genesis(
    { cast: [...scene.cast], uniques: scene.uniques ?? DEFAULT_UNIQUES },
    makeRoster(scene.seats ?? SEATS),
    makeRandom(SEED),
  );
  for (let frames = 0; frames < 4000; frames += 1) {
    if (openPurpose(state) === scene.purpose && ready(state)) return { state, frames };
    state = advance(state, decide);
  }
  throw new Error("the engine reached no " + scene.purpose + " window");
};
