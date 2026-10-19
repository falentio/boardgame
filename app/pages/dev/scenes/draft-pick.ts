import { BASE_CAST } from "#shared/core/lockstep/games/citadels/index.ts";
import type { Scene } from "./kit.ts";

/** The draft tops the stack at genesis: the picker opens before any frame is played. */
const scene: Scene = { purpose: "draft-pick", cast: BASE_CAST };

export default scene;
