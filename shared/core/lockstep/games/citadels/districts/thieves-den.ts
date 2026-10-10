import type { BuildQuery, DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const THIEVES_DEN_ID = "thieves-den";

/**
 * You may pay for the Thieves' Den partly or fully with cards from your hand at
 * 1 card = 1 gold. The build seam offers an all-or-nothing card payment, so this
 * answers with the full card cost when the player cannot cover the Den in gold
 * but holds enough spare cards (the built card is removed before payment, so it
 * takes `cost` cards beyond the Den itself). Paying gold when gold is
 * available keeps the player's cards. The mixed gold-and-cards payment the rule
 * also allows needs a shared-file change to `tryBuild`; see the unit report.
 */
export const thievesDenBuild: BuildQuery = (ctx) => {
  if (ctx.card !== THIEVES_DEN_ID) return {};
  const player = ctx.state.players.find((entry) => entry.seat === ctx.seat);
  if (player === undefined) return {};
  const cost = specOfDistrict(THIEVES_DEN_ID).cost;
  if (player.gold >= cost) return {};
  return player.hand.length - 1 >= cost ? { payCards: cost } : {};
};

/** The Thieves' Den's payment clause is the build query above; nothing runs on build. */
export const thievesDen: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Thieves' Den carries no end-game points of its own. */
export const thievesDenScoring: DistrictScoring = () => 0;

/** The engine hook this district answers; the payment itself is the BuildQuery. */
export const thievesDenTriggers: readonly DistrictHook[] = ["onBuild"];
