/**
 * UNOFFICIAL. The rebalanced setup is a variant from the secrethitler.io web
 * adaptation [SHIO], not a Goat, Wolf, & Cabbage rule; the official rulebook
 * always deals 6 Liberal and 11 Fascist tiles [RB p2]. It applies at 6, 7, and 9
 * players and changes nothing else. See docs/design/secret-hitler-rebalanced.md.
 */
import type { Codec, Random, Roster } from "../../index.ts";
import { SecretHitlerError } from "../secret-hitler/error.ts";
import { deckFor, POLICY_MIX, type PolicyMix } from "../secret-hitler/policies.ts";
import { dealRoles, playerCountOf, type PlayerCount } from "../secret-hitler/roles.ts";
import { validateSetup, type SecretHitlerSetup } from "../secret-hitler/setup.ts";
import { stateCodecFor, type PlayerState, type SecretHitlerState } from "../secret-hitler/state.ts";

/** What the variant adds at one count: a pre-enacted policy and/or a smaller Fascist supply. */
export interface RebalanceDelta {
  /** Fascist Policies already on the board at genesis. */
  readonly preEnactedFascist: number;
  /** Total Fascist tiles in play, the deck plus any pre-enacted policy. */
  readonly fascistSupply: number;
}

const BASE_DELTA: RebalanceDelta = { preEnactedFascist: 0, fascistSupply: POLICY_MIX.fascist };

/**
 * The rebalanced delta per count, the single owner of the three variant numbers
 * [SHIO]: 6 players pre-enact one Fascist Policy, 7 players hold 10 Fascist
 * tiles, and 9 players hold 9. Every other row is the base game.
 *
 * The 6-player pre-enactment is drawn from the supply, not an extra tile. The
 * secrethitler.io source sets the track to 1 under `rebalance6p` and its
 * `shufflePolicies` builds the deck as `deckState.fas - trackState.fascistPolicyCount`,
 * so the pre-enacted tile is subtracted from the 11-tile supply.
 */
export const REBALANCE_DELTA: Readonly<Record<PlayerCount, RebalanceDelta>> = {
  5: BASE_DELTA,
  6: { ...BASE_DELTA, preEnactedFascist: 1 },
  7: { ...BASE_DELTA, fascistSupply: 10 },
  8: BASE_DELTA,
  9: { ...BASE_DELTA, fascistSupply: 9 },
  10: BASE_DELTA,
};

export const rebalanceOf = (count: PlayerCount): RebalanceDelta => REBALANCE_DELTA[count];

/** The supply a variant state conserves against: base Liberals, the variant Fascist total. */
export const variantMixFor = (count: PlayerCount): PolicyMix => ({
  liberal: POLICY_MIX.liberal,
  fascist: rebalanceOf(count).fascistSupply,
});

const conservedCodec = stateCodecFor(variantMixFor);

/**
 * The variant codec: the base codec plus the pre-enactment floor. At 6 players the
 * supply is the base 11, so conservation cannot tell the pre-enacted policy from a
 * deck tile: a base-shaped state (track 0, 11 Fascist in the deck) conserves and
 * would decode, letting a joiner play the base game. Genesis is the track's only
 * writer and the fold only increments it, so the track is never below the
 * pre-enactment.
 */
export const variantStateCodec: Codec<SecretHitlerState> = {
  encode: conservedCodec.encode,
  decode: (json) => {
    const state = conservedCodec.decode(json);
    const floor = rebalanceOf(playerCountOf(state.players.length)).preEnactedFascist;
    if (state.fascistPolicies < floor) {
      throw new SecretHitlerError(
        `fascist policies are below the ${String(floor)} pre-enacted at ${String(state.players.length)} players: ${String(state.fascistPolicies)}`,
      );
    }
    return state;
  },
};

/**
 * Build the initial variant state. Same two shuffles, in the same fixed order, as
 * the base, so at a count the table leaves alone this is byte-identical to the
 * base genesis; only the deck mix and the pre-enacted track differ.
 */
export const genesisState = (
  _setup: SecretHitlerSetup,
  roster: Roster,
  rng: Random,
): SecretHitlerState => {
  const count = validateSetup(_setup, roster);
  const delta = rebalanceOf(count);
  const dealt = dealRoles(roster.order, count, rng);
  const drawPile = rng.shuffle(
    deckFor({
      liberal: POLICY_MIX.liberal,
      fascist: delta.fascistSupply - delta.preEnactedFascist,
    }),
  );
  const president = roster.order[0];
  if (president === undefined) {
    throw new SecretHitlerError("secret-hitler-rebalanced needs at least one seat");
  }
  const players: readonly PlayerState[] = dealt.map((entry) => ({
    seat: entry.seat,
    role: entry.role,
    executed: false,
  }));
  return {
    players,
    drawPile,
    discardPile: [],
    liberalPolicies: 0,
    fascistPolicies: delta.preEnactedFascist,
    electionTracker: 0,
    president,
    lastElectedPresident: null,
    lastElectedChancellor: null,
    specialElectionResume: null,
    investigations: [],
    peeks: [],
    phase: { kind: "nominate", president },
    resigned: [],
  };
};
