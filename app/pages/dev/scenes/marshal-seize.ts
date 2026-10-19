import { auto, castWith, openPurpose, type Decide, type Scene } from "./kit.ts";
import { hasCompleted, playerOf } from "#shared/core/lockstep/games/citadels/helpers.ts";
import { isSeizable, seizePrice } from "#shared/core/lockstep/games/citadels/characters/marshal.ts";
import type { SeatId } from "#shared/core/lockstep/index.ts";
import type { CharacterId, CitadelsState } from "#shared/core/lockstep/games/citadels/index.ts";

/** The draft discards the front of the shuffled cast, and this seed sends the rank-8
    slot there, so the Marshal must lead the cast to reach a picker. The draft arm takes
    it first. */
const cast: readonly CharacterId[] = [
  "marshal",
  ...castWith("marshal").filter((id) => id !== "marshal"),
];

/** The rival whose city is the largest, since stage two offers its districts. */
const richestCity = (state: CitadelsState, seat: SeatId): SeatId | null =>
  state.players
    .filter((player) => player.seat !== seat && !hasCompleted(state, player.seat))
    .sort((a, b) => b.city.length - a.city.length)[0]?.seat ?? null;

const decide: Decide = (seat, state) => {
  const purpose = openPurpose(state);
  if (purpose === "draft-pick") return { t: "pick", character: "marshal" };
  if (purpose === "marshal-seize" && state.pending?.target === null) {
    const target = richestCity(state, seat);
    if (target !== null) return { t: "target", seat: target };
  }
  return auto(seat, state);
};

/** Stage two: the rival is named and holds a district costing three or less this seat can pay for. */
const until = (state: CitadelsState): boolean => {
  const pending = state.pending;
  if (pending === null || pending.target === null) return false;
  const owner = playerOf(state, pending.actor);
  const mine = new Set(owner.city.map((district) => district.id));
  return playerOf(state, pending.target).city.some(
    (district) =>
      isSeizable(district.id) && !mine.has(district.id) && seizePrice(district.id) <= owner.gold,
  );
};

const scene: Scene = { purpose: "marshal-seize", cast, decide, until };

export default scene;
