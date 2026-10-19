import { auto, castWith, FIVE, type Decide, type Scene } from "./kit.ts";

/**
 * The engine declares 30 window purposes and builds a window step for 29 of
 * them, all from string literals under `citadels/`; `queen-income` is the one
 * with no construction site, so the step this fold waits for is never built.
 * The Queen's income lands as a windowless `addGold` in `characters/queen.ts`,
 * gated on five live seats, which is the rulebook's own wall: the Queen cannot
 * be used with 3 or 4 players. The scene seats five and takes her as soon as
 * the passing pool holds her, so the table can pay her income; only the shuffle
 * decides whether she is dealt, and no fold ever builds a `queen-income` window.
 */
const draftQueen: Decide = (seat, state) => {
  const top = state.steps[0];
  const open = top?.kind === "window" ? top.window.purpose : null;
  if (open === "draft-pick" && state.draft?.pool.includes("queen") === true) {
    return { t: "pick", character: "queen" };
  }
  return auto(seat, state);
};

const scene: Scene = {
  purpose: "queen-income",
  cast: castWith("queen"),
  seats: FIVE,
  decide: draftQueen,
};

export default scene;
