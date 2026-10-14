import { expect, test } from "vitest";
import {
  decodeSnapshot,
  encodeSnapshot,
  resumeSession,
  stateDigest,
  type SeatId,
  type Snapshot,
} from "../../../../index.ts";
import { citadels } from "../../../../lockstep/games/citadels/index.ts";
import { stateCodec, type CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import { at, fakeClock, nullPort, type Table } from "../../harness.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS4,
  autoAction,
  autoStep,
  driveFrame,
  playToEnd,
  rawGenesis,
  tableOf,
  type CitadelsAction,
  type CitadelsView,
} from "../driver.ts";

const FRAME_BUDGET = 5000;
const SEVERAL_ROUNDS = 2;

interface Milestones {
  readonly genesis: CitadelsState;
  readonly midDraft: CitadelsState;
  readonly midTurnPending: CitadelsState;
}

/**
 * Fold a real game under the always-legal policy and stop at the first mid-game
 * draft and the first turn-phase state carrying a pending action, both after
 * several rounds. Genesis is the third point, captured before any frame.
 */
const milestones = (entropy: string): Milestones => {
  const genesis = rawGenesis(SEATS4, BASE_CAST_IDS, entropy);
  let state = genesis;
  let midDraft: CitadelsState | null = null;
  let midTurnPending: CitadelsState | null = null;
  for (let i = 0; i < FRAME_BUDGET && !citadels.isTerminal(state); i += 1) {
    state = autoStep(state);
    if (
      midDraft === null &&
      state.round >= SEVERAL_ROUNDS &&
      state.phase === "draft" &&
      state.draft !== null
    ) {
      midDraft = state;
    }
    if (
      midTurnPending === null &&
      state.round >= SEVERAL_ROUNDS &&
      state.phase === "turn" &&
      state.pending !== null
    ) {
      midTurnPending = state;
    }
    if (midDraft !== null && midTurnPending !== null) break;
  }
  if (midDraft === null || midTurnPending === null) {
    throw new Error(
      `no mid-game milestone after ${String(SEVERAL_ROUNDS)} rounds: draft=${String(midDraft !== null)} pending=${String(midTurnPending !== null)}`,
    );
  }
  return { genesis, midDraft, midTurnPending };
};

test("a full state round-trips through the codec at genesis, mid-draft, and mid-turn with a pending action", () => {
  const { genesis, midDraft, midTurnPending } = milestones("citadels-codec-roundtrip");
  expect(midDraft.round).toBeGreaterThanOrEqual(SEVERAL_ROUNDS);
  expect(midTurnPending.round).toBeGreaterThanOrEqual(SEVERAL_ROUNDS);
  expect(midTurnPending.pending).not.toBeNull();
  expect(midDraft.pending).toBeNull();

  const points = [
    ["genesis", genesis],
    ["mid-draft", midDraft],
    ["mid-turn-pending", midTurnPending],
  ] as const;
  for (const [label, state] of points) {
    const encoded = stateCodec.encode(state);
    expect(stateCodec.decode(encoded), label).toEqual(state);
    // Encode is a pure function of the value, so re-encoding the decoded state
    // reproduces the same bytes a peer would ship.
    expect(stateCodec.encode(stateCodec.decode(encoded)), label).toEqual(encoded);
  }
});

const sessionDeps = (seat: SeatId) => ({
  game: citadels,
  port: nullPort<CitadelsAction>(),
  clock: fakeClock().clock,
  config: { seat, inputTimeoutMs: 1000 },
});

const adoptSnapshot = (
  table: Table<CitadelsAction, CitadelsView>,
  snapshot: Snapshot<CitadelsAction>,
): void => {
  for (const seat of table.sessions.keys()) at(table, seat).receive({ kind: "snapshot", snapshot });
};

test("a mid-game snapshot round-trips and the restored session reaches the same terminal state", () => {
  const original = tableOf(SEATS4, BASE_CAST_IDS, "citadels-snapshot-resume");
  while (at(original, ANN).view().round < SEVERAL_ROUNDS && !at(original, ANN).terminal) {
    driveFrame(original, autoAction);
  }
  expect(at(original, ANN).view().round).toBeGreaterThanOrEqual(SEVERAL_ROUNDS);
  expect(at(original, ANN).terminal).toBe(false);

  const snapshot = at(original, ANN).snapshot();
  const decoded = decodeSnapshot(citadels, encodeSnapshot(citadels, snapshot));
  expect(decoded.frame).toBe(snapshot.frame);
  expect(decoded.seed).toBe(snapshot.seed);
  expect(decoded.head).toEqual(snapshot.head);
  expect(decoded.state).toEqual(snapshot.state);

  const resumed = resumeSession(sessionDeps(ANN), decoded);
  expect(resumed.view()).toEqual(at(original, ANN).view());

  // A fresh table with unrelated entropy adopts the snapshot, so any agreement
  // below comes from the snapshot carrying the whole state, not shared genesis.
  const restored = tableOf(SEATS4, BASE_CAST_IDS, "citadels-snapshot-resume-other");
  adoptSnapshot(restored, decoded);
  expect(at(restored, ANN).view()).toEqual(at(original, ANN).view());

  playToEnd(original, autoAction);
  playToEnd(restored, autoAction);
  expect(at(original, ANN).terminal).toBe(true);
  expect(at(restored, ANN).terminal).toBe(true);

  const endOriginal = at(original, ANN).snapshot().state;
  const endRestored = at(restored, ANN).snapshot().state;
  expect(stateDigest(endRestored)).toBe(stateDigest(endOriginal));
  expect(endRestored).toEqual(endOriginal);
});

test("for every seat, project exposes that seat's own hand and pick, and hides the deck", () => {
  const { midDraft, midTurnPending } = milestones("citadels-redaction-keys");
  for (const state of [midDraft, midTurnPending]) {
    // Non-vacuity: the raw state carries the hidden keys, so their absence from
    // the view is a real omission rather than an empty source.
    expect(Object.keys(state)).toContain("deck");
    expect(state.deck.length).toBeGreaterThan(0);
    for (const player of state.players) expect(Object.keys(player)).toContain("hand");

    for (const seat of SEATS4) {
      const mine = state.players.find((player) => player.seat === seat);
      if (mine === undefined) throw new Error(`no player ${seat}`);
      const view = citadels.project(state, seat);

      expect(Object.keys(view)).not.toContain("deck");
      expect(Object.keys(view)).not.toContain("draft");
      expect(Object.keys(view)).not.toContain("pool");
      expect(Object.keys(view)).not.toContain("facedown");
      expect(view.myHand).toEqual([...mine.hand]);
      expect(view.deckCount).toBe(state.deck.length);
      const ownPick = state.draft?.picks.find((entry) => entry.seat === seat)?.character ?? null;
      expect(view.myPick).toBe(ownPick);

      for (const player of view.players) {
        expect(Object.keys(player)).not.toContain("hand");
        const raw = state.players.find((candidate) => candidate.seat === player.seat);
        expect(player.handCount).toBe(raw?.hand.length);
      }
    }
  }
});

const collectArrays = (value: unknown, out: unknown[][]): void => {
  if (Array.isArray(value)) {
    out.push(value);
    for (const item of value) collectArrays(item, out);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectArrays(item, out);
  }
};

const sameArray = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

test("no CitadelsView field carries the deck order or another seat's hand", () => {
  const { midDraft, midTurnPending } = milestones("citadels-redaction-walk");
  for (const state of [midDraft, midTurnPending]) {
    expect(state.deck.length).toBeGreaterThan(0);
    for (const seat of SEATS4) {
      const view = citadels.project(state, seat);
      const mine = state.players.find((player) => player.seat === seat);
      if (mine === undefined) throw new Error(`no player ${seat}`);
      // A hidden array identical to the viewer's own hand carries no new
      // information, so it is not a leak; every other hidden array is.
      const hidden = [
        state.deck,
        ...state.players.filter((p) => p.seat !== seat).map((p) => p.hand),
      ].filter((cards) => !sameArray(cards, mine.hand));
      expect(hidden.length).toBeGreaterThan(0);

      const arrays: unknown[][] = [];
      collectArrays(view, arrays);
      // Non-vacuity: the walk reached the viewer's own hand array.
      expect(arrays.some((found) => sameArray(found, mine.hand))).toBe(true);

      for (const found of arrays) {
        for (const cards of hidden) {
          expect(
            sameArray(found, cards),
            `view for ${seat} exposes a hidden array of ${String(cards.length)} cards`,
          ).toBe(false);
        }
      }
    }
  }
});

/** Some card id in play that differs from `avoid`, so a swap is a real change. */
const otherCard = (state: CitadelsState, avoid: string): string => {
  const pool = [
    ...state.deck,
    ...state.discard,
    ...state.players.flatMap((player) => player.hand),
    ...state.players.flatMap((player) => player.city.map((district) => district.id)),
  ];
  const found = pool.find((id) => id !== avoid);
  if (found === undefined) throw new Error("no distinct card id in play to perturb with");
  return found;
};

test("stateDigest commits to hidden state, so perturbing a hidden card changes it", () => {
  const { midTurnPending } = milestones("citadels-digest-hidden");
  const base = stateDigest(stateCodec.encode(midTurnPending));
  const deckTop = midTurnPending.deck[0];
  if (deckTop === undefined) throw new Error("the deck is empty");
  // Replacing the top card with a different id changes the deck array at index 0,
  // so the encoded bytes change and the digest must move with them.
  const deckPerturbed: CitadelsState = {
    ...midTurnPending,
    deck: [otherCard(midTurnPending, deckTop), ...midTurnPending.deck.slice(1)],
  };
  expect(deckPerturbed.deck).not.toEqual(midTurnPending.deck);
  expect(stateDigest(stateCodec.encode(deckPerturbed))).not.toBe(base);

  const victim = midTurnPending.players[0];
  const handTop = victim?.hand[0];
  if (victim === undefined || handTop === undefined) throw new Error("no dealt hand to perturb");
  const handPerturbed: CitadelsState = {
    ...midTurnPending,
    players: midTurnPending.players.map((player) =>
      player.seat === victim.seat
        ? { ...player, hand: [otherCard(midTurnPending, handTop), ...player.hand.slice(1)] }
        : player,
    ),
  };
  expect(handPerturbed.players[0]?.hand).not.toEqual(victim.hand);
  expect(stateDigest(stateCodec.encode(handPerturbed))).not.toBe(base);
});
