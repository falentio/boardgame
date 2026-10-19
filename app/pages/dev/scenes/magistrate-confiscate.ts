import { auto, castWith, openPurpose, type Decide, type Scene } from "./kit.ts";

/**
 * The warrant fires on the named character's first paid build. The Thief is the rank that
 * follows the Magistrate's own, so it gathers and builds while the warrant is still signed.
 */
const decide: Decide = (seat, state) => {
  if (openPurpose(state) === "choose-character" && state.pending?.character === "magistrate") {
    return { t: "name-character", character: "thief" };
  }
  return auto(seat, state);
};

const scene: Scene = { purpose: "magistrate-confiscate", cast: castWith("magistrate"), decide };

export default scene;
