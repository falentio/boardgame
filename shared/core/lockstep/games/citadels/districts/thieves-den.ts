import type { BuildQuery, DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const THIEVES_DEN_ID = "thieves-den";

/**
 * You may pay for the Thieves' Den partly or fully with cards from your hand at
 * 1 card = 1 gold. The card share of any split is the shortfall the purse cannot
 * cover: zero when gold alone suffices, the whole cost when the purse is empty,
 * and the difference in between. The old query offered cards only when gold was
 * wholly insufficient, so with 2 gold and 2 spare cards on the cost-4 Den it
 * answered {} and the build was refused; naming the shortfall at every split lets
 * the build proceed. The built card leaves the hand before payment, so the hand
 * must hold \`payCards\` cards beyond the Den itself.
 *
 * The matching gold share (\`cost - payCards\`) is not debited yet: \`tryBuild\`'s
 * card branch charges no gold whenever \`payCards\` is positive, so a mixed build
 * keeps the gold it should have spent. Charging that share needs a one-line
 * change to \`tryBuild\` (see the unit report), which this unit does not own.
 */
export const thievesDenBuild: BuildQuery = (ctx) => {
  if (ctx.card !== THIEVES_DEN_ID) return {};
  const player = ctx.state.players.find((entry) => entry.seat === ctx.seat);
  if (player === undefined) return {};
  return { payCards: Math.max(0, specOfDistrict(THIEVES_DEN_ID).cost - player.gold) };
};

/** The Thieves' Den's payment clause is the build query above; nothing runs on build. */
export const thievesDen: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Thieves' Den carries no end-game points of its own. */
export const thievesDenScoring: DistrictScoring = () => 0;

/** The engine hook this district answers; the payment itself is the BuildQuery. */
export const thievesDenTriggers: readonly DistrictHook[] = ["onBuild"];
