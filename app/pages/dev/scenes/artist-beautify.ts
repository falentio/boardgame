import { answeringSeat, auto, castWith, openPurpose, type Decide, type Scene } from "./kit.ts";
import { playerOf } from "#shared/core/lockstep/games/citadels/helpers.ts";
import type { CharacterId, CitadelsState } from "#shared/core/lockstep/games/citadels/index.ts";

/** The draft discards the front of the shuffled cast, and this seed sends the rank-9
    slot there, so the Artist must lead the cast to reach a picker. The Architect rides
    beside it: the seat's other character is what grows the city this window reads. */
const cast: readonly CharacterId[] = [
  "artist",
  "assassin",
  "architect",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "warlord",
];

/** Draft the Artist, then give the same seat the Architect that must build behind it. */
const decide: Decide = (seat, state) => {
  if (openPurpose(state) === "draft-pick") {
    const picks = state.draft?.picks ?? [];
    const mine = picks.filter((pick) => pick.seat === seat).map((pick) => pick.character);
    if (mine.includes("artist")) return { t: "pick", character: "architect" };
    if (!picks.some((pick) => pick.character === "artist")) return { t: "pick", character: "artist" };
  }
  return auto(seat, state);
};

/** One stage, so the board reads as a city: two districts still carrying no gold marker. */
const until = (state: CitadelsState): boolean =>
  playerOf(state, answeringSeat(state)).city.filter((district) => district.gold === 0).length >= 2;

const scene: Scene = { purpose: "artist-beautify", cast, decide, until };

export default scene;
