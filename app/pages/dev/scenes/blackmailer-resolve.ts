import { auto, castWith, openPurpose, type Scene } from "./kit.ts";

const NAMED = "blackmailer";

/** The Blackmailer opens this window on its own turn, once per threat marker it places. */
const scene: Scene = {
  purpose: "blackmailer-resolve",
  cast: castWith(NAMED),
  decide: (seat, state) =>
    openPurpose(state) === "draft-pick" ? { t: "pick", character: NAMED } : auto(seat, state),
};

export default scene;
