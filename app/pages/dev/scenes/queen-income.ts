import { castWith, type Scene } from "./kit.ts";

/**
 * Blocked at the engine, not at the cast. A `queen-income` step is declared in
 * `citadels/state.ts` and resolved by `characters/queen.ts`, but nothing builds
 * one: the Queen's three gold lands inside `queen.ts` with no window, so this
 * fold throws the engine's own "reached no queen-income window". The fold's
 * three-seat roster walls it a second time, because the same ability returns
 * early below its five-player minimum.
 */
const scene: Scene = { purpose: "queen-income", cast: castWith("queen") };

export default scene;
