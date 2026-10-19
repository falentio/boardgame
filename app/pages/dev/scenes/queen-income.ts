import { castWith, type Scene } from "./kit.ts";

/**
 * No fold reaches this purpose, and none can. The engine declares 30 window
 * purposes and builds a window step for 29 of them; `queen-income` is the one
 * purpose with no construction site anywhere under `citadels/`, so no cast and
 * no policy can put it on the stack. The Queen's income is a windowless
 * `addGold` in `characters/queen.ts`, gated on five live seats, which is the
 * rulebook's own wall: the Queen cannot be used with 3 or 4 players. Her
 * registered resolver only pops, and the engine's `queen.test.ts` asserts she
 * opens no window. A scene names a cast, a deck, and a policy; the step this
 * purpose needs is not one of them.
 */
const scene: Scene = { purpose: "queen-income", cast: castWith("queen") };

export default scene;
