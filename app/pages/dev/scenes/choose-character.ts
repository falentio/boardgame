import { castWith, type Scene } from "./kit.ts";
import { BASE_CAST } from "#shared/core/lockstep/games/citadels/index.ts";

/** The draft: the picker opens on the seat whose turn it is to name a character. */
const scene: Scene = { purpose: "choose-character", cast: BASE_CAST };

export default scene;
