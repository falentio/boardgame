import { castWith, FIVE, type Scene } from "./kit.ts";

/**
 * The engine declares 30 window purposes and builds a window step for 29 of
 * them, all from string literals under `citadels/`; `queen-income` is the one
 * with no construction site, so the step this fold waits for is never built.
 * The Queen's income lands as a windowless `addGold` in `characters/queen.ts`,
 * gated on five live seats, which is the rulebook's own wall: the Queen cannot
 * be used with 3 or 4 players. The fold asks for that full table anyway; the
 * five seats raise the income and still build no window.
 */
const scene: Scene = { purpose: "queen-income", cast: castWith("queen"), seats: FIVE };

export default scene;
