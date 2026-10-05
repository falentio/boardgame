import type { Random, SeatId } from "../../index.ts";
import {
  aliveSeats,
  beginStep,
  clockwise,
  courtDraw,
  drawIntoHand,
  END_TURN,
  gainFromTreasury,
  makeWindow,
  openSwap,
  otherAlive,
  playerOf,
  poorest,
  priestTargetable,
  returnToCourt,
  revealStep,
  targetable,
  transferCoins,
  windowStep,
  withPlayer,
  withSteps,
} from "./helpers.ts";
import { type RoleId } from "./roles.ts";
import type { ExtraClaim, G54State, PendingAction, Step } from "./state.ts";

export interface RoleCtx {
  /** Post-payment state with the claim cleared; `rest` is the turn continuation. */
  readonly state: G54State;
  readonly claim: PendingAction;
  readonly blocked: boolean;
  readonly rest: readonly Step[];
  readonly rng: Random;
}

export interface ExtraCtx {
  readonly state: G54State;
  readonly claim: ExtraClaim;
  readonly blocked: boolean;
  readonly rest: readonly Step[];
}

export type RoleEffect = (ctx: RoleCtx) => G54State;
export type ExtraEffect = (ctx: ExtraCtx) => G54State;

/** The three reactive roles have no turn action; a claim on one falls back to Income. */
const noEffect: RoleEffect = (ctx) => withSteps(ctx.state, [END_TURN, ...ctx.rest]);

/** One per-target block claim; General and Priest stack one per affected seat. */
const blockClaim = (
  state: G54State,
  kind: "general" | "priest",
  role: RoleId,
  target: SeatId,
): ExtraClaim => ({
  kind,
  claimant: state.active,
  role,
  target,
  blockRole: role,
  blocker: null,
  challenger: null,
  blockChallenger: null,
});

/** The execution reveal for a surviving attack, or nothing when the target is out. */
const execution = (claim: { readonly target: SeatId | null }, blocked: boolean): readonly Step[] =>
  !blocked && claim.target !== null ? [revealStep(claim.target, "execution")] : [];

export const ROLE_EFFECTS: Record<RoleId, RoleEffect> = {
  banker: (ctx) =>
    withSteps(gainFromTreasury(ctx.state, ctx.claim.claimant, 3), [END_TURN, ...ctx.rest]),
  director: (ctx) =>
    withSteps(openSwap(ctx.state, ctx.claim.claimant, 2), [
      windowStep(makeWindow("keep", [ctx.claim.claimant])),
      END_TURN,
      ...ctx.rest,
    ]),
  guerrilla: (ctx) =>
    withSteps(ctx.state, [...execution(ctx.claim, ctx.blocked), END_TURN, ...ctx.rest]),
  politician: (ctx) =>
    withSteps(
      !ctx.blocked && ctx.claim.target !== null
        ? transferCoins(ctx.state, ctx.claim.target, ctx.claim.claimant, 2)
        : ctx.state,
      [END_TURN, ...ctx.rest],
    ),
  peacekeeper: (ctx) =>
    withSteps(
      { ...gainFromTreasury(ctx.state, ctx.claim.claimant, 1), peacekeeping: ctx.claim.claimant },
      [END_TURN, ...ctx.rest],
    ),
  capitalist: (ctx) =>
    withSteps(gainFromTreasury(ctx.state, ctx.claim.claimant, 4), [
      windowStep(makeWindow("capitalist", otherAlive(ctx.state, ctx.state.active))),
      END_TURN,
      ...ctx.rest,
    ]),
  farmer: (ctx) => {
    let next = gainFromTreasury(ctx.state, ctx.claim.claimant, 3);
    if (ctx.claim.target !== null) {
      next = transferCoins(next, ctx.claim.claimant, ctx.claim.target, 1);
    }
    return withSteps(next, [END_TURN, ...ctx.rest]);
  },
  speculator: (ctx) =>
    withSteps(
      gainFromTreasury(
        ctx.state,
        ctx.claim.claimant,
        Math.min(playerOf(ctx.state, ctx.claim.claimant).coins, 5),
      ),
      [END_TURN, ...ctx.rest],
    ),
  spy: (ctx) =>
    withSteps(gainFromTreasury(ctx.state, ctx.claim.claimant, 1), [
      windowStep(makeWindow("spy-second", [ctx.claim.claimant])),
      ...ctx.rest,
    ]),
  newscaster: (ctx) =>
    withSteps(openSwap(ctx.state, ctx.claim.claimant, 3), [
      windowStep(makeWindow("keep", [ctx.claim.claimant])),
      END_TURN,
      ...ctx.rest,
    ]),
  producer: (ctx) => {
    const target = ctx.claim.target;
    if (ctx.blocked || target === null) return withSteps(ctx.state, [END_TURN, ...ctx.rest]);
    const { drawn, court } = courtDraw(ctx.state, 1);
    return withSteps(
      {
        ...ctx.state,
        court,
        draw: {
          seat: ctx.claim.claimant,
          pool: [...drawn],
          keepSize: playerOf(ctx.state, ctx.claim.claimant).hand.length,
          target,
        },
      },
      [windowStep(makeWindow("producer-give", [target])), END_TURN, ...ctx.rest],
    );
  },
  reporter: (ctx) =>
    withSteps(openSwap(gainFromTreasury(ctx.state, ctx.claim.claimant, 1), ctx.claim.claimant, 1), [
      windowStep(makeWindow("keep", [ctx.claim.claimant])),
      END_TURN,
      ...ctx.rest,
    ]),
  writer: (ctx) =>
    withSteps(openSwap(ctx.state, ctx.claim.claimant, 1), [
      windowStep(makeWindow("writer-draw", [ctx.claim.claimant])),
      END_TURN,
      ...ctx.rest,
    ]),
  "crime-boss": (ctx) => withSteps(ctx.state, [END_TURN, ...ctx.rest]),
  general: (ctx) => {
    const active = ctx.state.active;
    const targets = clockwise(
      ctx.state,
      active,
      otherAlive(ctx.state, active).filter((seat) => targetable(ctx.state, active, seat)),
    );
    return withSteps(ctx.state, [
      ...targets.map((target) => beginStep(blockClaim(ctx.state, "general", "general", target))),
      END_TURN,
      ...ctx.rest,
    ]);
  },
  judge: (ctx) =>
    withSteps(ctx.state, [...execution(ctx.claim, ctx.blocked), END_TURN, ...ctx.rest]),
  mercenary: (ctx) =>
    ctx.blocked || ctx.claim.target === null
      ? withSteps(ctx.state, [END_TURN, ...ctx.rest])
      : withSteps(
          {
            ...ctx.state,
            disappear: [...ctx.state.disappear, { target: ctx.claim.target, turns: 1 }],
          },
          [END_TURN, ...ctx.rest],
        ),
  communist: (ctx) => {
    const target = ctx.claim.target;
    if (ctx.blocked || target === null) return withSteps(ctx.state, [END_TURN, ...ctx.rest]);
    const poorestSeat = poorest(ctx.state, ctx.state.active, aliveSeats(ctx.state));
    return withSteps(
      poorestSeat === null ? ctx.state : transferCoins(ctx.state, target, poorestSeat, 3),
      [END_TURN, ...ctx.rest],
    );
  },
  "customs-officer": (ctx) =>
    withSteps(ctx.state, [
      windowStep(makeWindow("customs-mark", [ctx.claim.claimant])),
      END_TURN,
      ...ctx.rest,
    ]),
  "foreign-consular": (ctx) =>
    ctx.blocked || ctx.claim.target === null
      ? withSteps(ctx.state, [END_TURN, ...ctx.rest])
      : withSteps({ ...ctx.state, treaty: [ctx.claim.claimant, ctx.claim.target] }, [
          END_TURN,
          ...ctx.rest,
        ]),
  intellectual: noEffect,
  lawyer: noEffect,
  missionary: noEffect,
  priest: (ctx) => {
    const active = ctx.state.active;
    const payers = clockwise(
      ctx.state,
      active,
      otherAlive(ctx.state, active).filter((seat) => priestTargetable(ctx.state, active, seat)),
    );
    return withSteps(ctx.state, [
      ...payers.map((payer) => beginStep(blockClaim(ctx.state, "priest", "priest", payer))),
      END_TURN,
      ...ctx.rest,
    ]);
  },
  protestor: (ctx) =>
    withSteps(ctx.state, [
      ...(!ctx.blocked && ctx.claim.funded ? execution(ctx.claim, false) : []),
      END_TURN,
      ...ctx.rest,
    ]),
  paramilitary: (ctx) =>
    withSteps(ctx.state, [...execution(ctx.claim, ctx.blocked), END_TURN, ...ctx.rest]),
  anarchist: (ctx) => {
    const target = ctx.claim.target;
    if (target === null) return withSteps(ctx.state, [END_TURN, ...ctx.rest]);
    const bomb = { holder: target, prior: [ctx.claim.claimant], move: null };
    return withSteps({ ...ctx.state, bomb }, [
      windowStep(makeWindow("bomb", [target])),
      END_TURN,
      ...ctx.rest,
    ]);
  },
  financier: (ctx) => {
    const claimant = playerOf(ctx.state, ctx.claim.claimant);
    return withSteps(
      {
        ...withPlayer(ctx.state, { ...claimant, coins: claimant.coins + ctx.state.bank }),
        bank: 0,
      },
      [END_TURN, ...ctx.rest],
    );
  },
  "plantation-owner": (ctx) => {
    const active = ctx.state.active;
    const targets = clockwise(ctx.state, active, otherAlive(ctx.state, active));
    return withSteps(
      { ...gainFromTreasury(ctx.state, active, 1), plantation: [active] },
      [
        windowStep(makeWindow("capitalist", targets)),
        windowStep(makeWindow("plantation-payout", [active])),
        END_TURN,
        ...ctx.rest,
      ],
    );
  },
  "arms-dealer": (ctx) => {
    const requested = ctx.claim.named ?? null;
    const named =
      requested !== null && ctx.state.roles.includes(requested)
        ? requested
        : (ctx.state.roles[0] ?? "banker");
    const { drawn, court } = courtDraw(ctx.state, 2);
    const matched = drawn.includes(named);
    const paid = matched ? gainFromTreasury(ctx.state, ctx.claim.claimant, 4) : ctx.state;
    return withSteps(
      {
        ...paid,
        court: returnToCourt({ ...paid, court }, drawn, ctx.rng),
        arms: { seat: ctx.claim.claimant, named, cards: [...drawn], matched },
      },
      [END_TURN, ...ctx.rest],
    );
  },
  socialist: (ctx) => {
    const active = ctx.state.active;
    const targets = clockwise(ctx.state, active, otherAlive(ctx.state, active));
    return withSteps({ ...ctx.state, socialist: { seat: active, givers: [], pool: [] } }, [
      ...targets.map((target) =>
        beginStep({
          kind: "socialist",
          claimant: active,
          role: "socialist",
          target,
          blockRole: "socialist",
          blocker: null,
          challenger: null,
          blockChallenger: null,
        }),
      ),
      windowStep(makeWindow("socialist-keep", [active])),
      END_TURN,
      ...ctx.rest,
    ]);
  },
};

export const EXTRA_EFFECTS: Record<ExtraClaim["kind"], ExtraEffect> = {
  capitalist: (ctx) =>
    withSteps(transferCoins(ctx.state, ctx.claim.target, ctx.claim.claimant, 1), ctx.rest),
  general: (ctx) =>
    withSteps(
      ctx.state,
      ctx.blocked ? ctx.rest : [revealStep(ctx.claim.target, "execution"), ...ctx.rest],
    ),
  priest: (ctx) =>
    withSteps(
      ctx.blocked ? ctx.state : transferCoins(ctx.state, ctx.claim.target, ctx.claim.claimant, 1),
      ctx.rest,
    ),
  lawyer: (ctx) =>
    withSteps(
      transferCoins(
        ctx.state,
        ctx.claim.target,
        ctx.claim.claimant,
        playerOf(ctx.state, ctx.claim.target).coins,
      ),
      ctx.rest,
    ),
  reactive: (ctx) =>
    withSteps(
      ctx.claim.role === "missionary"
        ? drawIntoHand(ctx.state, ctx.claim.claimant, 1)
        : gainFromTreasury(ctx.state, ctx.claim.claimant, 5),
      ctx.rest,
    ),
  anarchist: (ctx) => {
    const bomb = ctx.state.bomb;
    if (bomb === null) return withSteps(ctx.state, ctx.rest);
    // resolveBomb queued a bomb window after the challenge to catch a failed claim
    // (via `move`); a surviving claim consumes it and opens the next holder's window.
    const after = ctx.rest.slice(1);
    if (bomb.move === "defuse") return withSteps({ ...ctx.state, bomb: null }, after);
    const next = {
      holder: ctx.claim.target,
      prior: [...bomb.prior, ctx.claim.claimant],
      move: null,
    };
    return withSteps({ ...ctx.state, bomb: next }, [
      windowStep(makeWindow("bomb", [ctx.claim.target])),
      ...after,
    ]);
  },
  socialist: (ctx) =>
    ctx.blocked
      ? withSteps(ctx.state, ctx.rest)
      : withSteps(ctx.state, [
          windowStep(makeWindow("socialist-give", [ctx.claim.target])),
          ...ctx.rest,
        ]),
  plantation: (ctx) =>
    withSteps(
      {
        ...ctx.state,
        plantation: [...(ctx.state.plantation ?? []), ctx.claim.claimant],
      },
      ctx.rest,
    ),
};
