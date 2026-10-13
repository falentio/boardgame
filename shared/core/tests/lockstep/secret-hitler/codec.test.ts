import { expect, test } from "vitest";
import { CodecError } from "../../../index.ts";
import { actionCodec, type SecretHitlerAction } from "../../../lockstep/games/secret-hitler/actions.ts";
import { SecretHitlerError } from "../../../lockstep/games/secret-hitler/error.ts";
import { secretHitler } from "../../../lockstep/games/secret-hitler/index.ts";
import { stateCodec } from "../../../lockstep/games/secret-hitler/state.ts";
import {
  ANN,
  BOB,
  CARA,
  DEE,
  driveRaw,
  legalActions,
  project,
  rawGenesis,
  seatsOwedNow,
  stepState,
  withPhase,
  withPresident,
  withStackedPile,
  withTracks,
  type SecretHitlerState,
  type SeatId,
} from "./driver.ts";

const ACTIONS: readonly SecretHitlerAction[] = [
  { t: "nominate", chancellor: BOB },
  { t: "vote", ja: true },
  { t: "vote", ja: false },
  { t: "discard", index: 1 },
  { t: "enact", index: 0 },
  { t: "propose-veto" },
  { t: "accept-veto" },
  { t: "reject-veto" },
  { t: "ack" },
  { t: "investigate", target: CARA },
  { t: "special-election", target: DEE },
  { t: "execute", target: ANN },
];

test("action codec round-trips every action variant", () => {
  for (const action of ACTIONS) {
    expect(actionCodec.decode(actionCodec.encode(action))).toEqual(action);
  }
});

test("action codec rejects an unknown tag and a malformed payload", () => {
  expect(() => actionCodec.decode({ t: "teleport" })).toThrow(SecretHitlerError);
  expect(() => actionCodec.decode({ t: "vote", ja: "yes" })).toThrow(SecretHitlerError);
  expect(() => actionCodec.decode({ t: "discard", index: "a" })).toThrow(CodecError);
  expect(() => actionCodec.decode({ t: "execute" })).toThrow(CodecError);
});

test("state codec round-trips a genesis state and a mid-round state", () => {
  const genesis = rawGenesis(5, "codec").state;
  expect(stateCodec.decode(stateCodec.encode(genesis))).toEqual(genesis);

  let checkpoint = withTracks(rawGenesis(5, "codec-mid"), 0, 3);
  checkpoint = withStackedPile(checkpoint, ["liberal", "fascist", "fascist"]);
  checkpoint = withPresident(checkpoint, ANN);
  checkpoint = withPhase(checkpoint, { kind: "nominate", president: ANN });
  const nominated = stepState(checkpoint.state, [[ANN, { t: "nominate", chancellor: CARA }]]);
  expect(stateCodec.decode(stateCodec.encode(nominated))).toEqual(nominated);
});

test("state codec round-trips a state carrying an investigation and a peek", () => {
  let checkpoint = withTracks(rawGenesis(5, "codec-records"), 0, 3);
  checkpoint = withStackedPile(checkpoint, ["liberal", "fascist", "fascist"]);
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "policy-peek" });
  const peeked = stepState(checkpoint.state, [[ANN, { t: "ack" }]]);
  expect(stateCodec.decode(stateCodec.encode(peeked))).toEqual(peeked);

  let investigate = withTracks(rawGenesis(5, "codec-investigation"), 0, 3);
  investigate = withStackedPile(investigate, ["liberal", "fascist", "fascist"]);
  investigate = withPhase(investigate, {
    kind: "power",
    president: ANN,
    power: "investigate-loyalty",
  });
  const after = stepState(investigate.state, [[ANN, { t: "investigate", target: BOB }]]);
  expect(stateCodec.decode(stateCodec.encode(after))).toEqual(after);
});

test("state codec rejects a malformed payload at the boundary", () => {
  expect(() => stateCodec.decode(null)).toThrow(CodecError);
  expect(() => stateCodec.decode({})).toThrow(CodecError);
  const good = stateCodec.encode(rawGenesis(5, "codec-bad").state) as { [key: string]: unknown };
  expect(() => stateCodec.decode({ ...good, liberalPolicies: 1.5 } as never)).toThrow(CodecError);
  expect(() => stateCodec.decode({ ...good, electionTracker: 9 } as never)).toThrow(SecretHitlerError);
  expect(() =>
    stateCodec.decode({ ...good, phase: { kind: "teleport" } } as never),
  ).toThrow(SecretHitlerError);
});

test("checkInvariants rejects a snapshot whose power phase names the wrong power", () => {
  let checkpoint = withTracks(rawGenesis(5, "codec-invariant-power"), 0, 3);
  // The 5-player board grants policy-peek at 3; a phase naming execution must be rejected.
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "execution" });
  const json = stateCodec.encode(checkpoint.state);
  expect(() => stateCodec.decode(json)).toThrow(SecretHitlerError);
});

test("checkInvariants rejects a snapshot whose seats are not in the roster", () => {
  const state = rawGenesis(5, "codec-invariant-seat").state;
  const json = stateCodec.encode(state) as { [key: string]: unknown };
  expect(() => stateCodec.decode({ ...json, president: "ghost" } as never)).toThrow(
    SecretHitlerError,
  );
});

test("checkInvariants rejects a policy-conservation break", () => {
  const state = rawGenesis(5, "codec-invariant-deck").state;
  const json = stateCodec.encode(state) as { [key: string]: unknown };
  // Duplicate the draw pile: 34 cards total, way past the 17-tile mix.
  const doubled = [...state.drawPile, ...state.drawPile];
  expect(() => stateCodec.decode({ ...json, drawPile: doubled } as never)).toThrow(
    SecretHitlerError,
  );
});

test("checkInvariants rejects a role multiset that does not match the player count", () => {
  const state = rawGenesis(5, "codec-invariant-roles").state;
  const json = stateCodec.encode(state) as { [key: string]: unknown };
  const players = state.players.map((player) => ({ ...player, role: "liberal" as const }));
  expect(() => stateCodec.decode({ ...json, players } as never)).toThrow(SecretHitlerError);
});

test("secretHitler's public codec accessors are the same objects it folds with", () => {
  expect(secretHitler.state).toBe(stateCodec);
  expect(secretHitler.action).toBe(actionCodec);
  expect(secretHitler.id).toBe("secret-hitler");
  expect(secretHitler.version).toBe(1);
});

test("a full drive round-trips through the codec at every frame", () => {
  let checkpoint = rawGenesis(6, "codec-drive");
  let steps = 0;
  while (!secretHitler.isTerminal(checkpoint.state) && steps < 300) {
    const encoded = stateCodec.encode(checkpoint.state);
    expect(stateCodec.decode(encoded)).toEqual(checkpoint.state);
    checkpoint = driveRaw(checkpoint, (state, seat) => {
      const options = legalActions(project(state, seat));
      return options.find((action) => action.t === "vote" && action.ja) ?? options[0] ?? null;
    }, steps);
    steps += 1;
  }
});
