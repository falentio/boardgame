import {
  bankDeposit,
  END_TURN,
  gainFromTreasury,
  makeWindow,
  openSwap,
  revealStep,
  windowStep,
  withSteps,
} from "./helpers.ts";
import type { G54State, PendingAction, Step } from "./state.ts";

/**
 * The general actions: Income and Coup fold in with Anarchy's Bank and Social
 * Media so `planTurn`/`pendingFor`/`applyResolve` read one registry instead of
 * branching on a kind. Bank replaces Income while Financier is in play.
 */
export type GeneralActionId = "income" | "coup" | "bank" | "social-media";

export interface GeneralCtx {
  /** Post-payment state; `claim.kind` is this general action's id. */
  readonly state: G54State;
  readonly claim: PendingAction;
  readonly rest: readonly Step[];
}

export type GeneralEffect = (ctx: GeneralCtx) => G54State;

export interface GeneralAction {
  readonly id: GeneralActionId;
  readonly cost: number;
  readonly needsTarget: boolean;
  readonly summary: string;
  readonly effect: GeneralEffect;
}

export const GENERAL_ACTIONS: Record<GeneralActionId, GeneralAction> = {
  income: {
    id: "income",
    cost: 0,
    needsTarget: false,
    summary: "Take 1 coin from the Treasury.",
    effect: (ctx) =>
      withSteps(gainFromTreasury(ctx.state, ctx.claim.claimant, 1), [END_TURN, ...ctx.rest]),
  },
  coup: {
    id: "coup",
    cost: 7,
    needsTarget: true,
    summary: "Pay 7; the target loses 1 influence.",
    effect: (ctx) =>
      withSteps(ctx.state, [
        ...(ctx.claim.target === null ? [] : [revealStep(ctx.claim.target, "coup")]),
        END_TURN,
        ...ctx.rest,
      ]),
  },
  bank: {
    id: "bank",
    cost: 0,
    needsTarget: false,
    summary: "Take 1 coin from the Treasury; add it to the Bank pile.",
    effect: (ctx) => withSteps(bankDeposit(ctx.state), [END_TURN, ...ctx.rest]),
  },
  "social-media": {
    id: "social-media",
    cost: 0,
    needsTarget: false,
    summary: "Swap 1 card with the Court; no challenge or block.",
    effect: (ctx) =>
      withSteps(openSwap(ctx.state, ctx.claim.claimant, 1), [
        windowStep(makeWindow("keep", [ctx.claim.claimant])),
        END_TURN,
        ...ctx.rest,
      ]),
  },
};

/** The general actions available in this game, in menu order. */
export const generalActionsFor = (state: G54State): readonly GeneralActionId[] => [
  state.roles.includes("financier") ? "bank" : "income",
  "coup",
  ...(state.socialMedia ? (["social-media"] as const) : []),
];

/** The always-affordable default for a hostile or unaffordable report. */
export const fallbackGeneral = (state: G54State): GeneralActionId =>
  state.roles.includes("financier") ? "bank" : "income";
