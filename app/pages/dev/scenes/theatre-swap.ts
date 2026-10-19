import { auto, type Decide, type Scene } from "./kit.ts";
import {
  DEFAULT_UNIQUES,
  type DistrictId,
} from "#shared/core/lockstep/games/citadels/districts.ts";
import {
  BASE_CAST,
  citadels,
  specOfDistrict,
  type CitadelsState,
} from "#shared/core/lockstep/games/citadels/index.ts";

const THEATER: DistrictId = "theater";

/** The default 14 with the Theater in place of the Monument, so a deal can hold it. */
const UNIQUES: readonly DistrictId[] = [...DEFAULT_UNIQUES.filter((id) => id !== "monument"), THEATER];

/** Carry the Theater: bank the gold for it, build it, and build nothing else. */
const playTurn: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose !== "turn") return auto(seat, state);
  const me = view.players.find((player) => player.seat === seat);
  const held = view.myHand.indexOf(THEATER);
  if (me === undefined) return auto(seat, state);
  // The Theater is a single deck copy, so a seat without one digs it out.
  if (held < 0) return view.deckCount > 0 ? { t: "draw" } : { t: "gold" };
  return specOfDistrict(THEATER).cost <= me.gold ? { t: "build", card: held } : { t: "gold" };
};

/** The window's one stage: name a rival that holds a claim, so the resolver has a card to take. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose !== "theatre-swap") return playTurn(seat, state);
  const rival = view.players.find(
    (player) => player.seat !== seat && state.claimed.some((claim) => claim.seat === player.seat),
  );
  return rival === undefined ? null : { t: "target", seat: rival.seat };
};

/** Hold only on a resolvable window: `theaterResolve` pops one whose owner or rival holds no claim. */
const swapReady = (state: CitadelsState): boolean => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") return false;
  const owner = top.window.seats[0];
  if (owner === undefined) return false;
  return (
    state.claimed.some((claim) => claim.seat === owner) &&
    state.claimed.some((claim) => claim.seat !== owner)
  );
};

const scene: Scene = {
  purpose: "theatre-swap",
  cast: BASE_CAST,
  uniques: UNIQUES,
  decide,
  until: swapReady,
};

export default scene;
