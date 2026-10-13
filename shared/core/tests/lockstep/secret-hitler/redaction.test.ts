import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  activeSeats,
  driveRaw,
  fascistSeats,
  hitlerSeat,
  isTerminal,
  legalActions,
  liberalSeats,
  project,
  rawGenesis,
  seatsOwedNow,
  stepState,
  withPhase,
  withPresident,
  withStackedPile,
  withTracks,
  type Checkpoint,
  type PlayerCount,
  type SecretHitlerState,
  type SecretHitlerView,
  type SeatId,
} from "./driver.ts";

const COUNTS: readonly PlayerCount[] = [5, 6, 7, 8, 9, 10];

/** The exact key set a view may carry. Pinned so a new field cannot leak unnoticed. */
const VIEW_KEYS = [
  "seat",
  "phase",
  "players",
  "myRole",
  "myAllies",
  "liberalPolicies",
  "fascistPolicies",
  "board",
  "electionTracker",
  "president",
  "lastElectedPresident",
  "lastElectedChancellor",
  "myDrawn",
  "myOffered",
  "myInvestigations",
  "myPeeks",
  "drawCount",
  "discardCount",
  "eligibleChancellors",
  "powerTargets",
  "owedSeats",
  "legalActions",
  "outcome",
  "terminal",
].sort();

const PLAYER_KEYS = ["seat", "executed", "resigned"].sort();

const serialized = (view: SecretHitlerView): string => JSON.stringify(view);

const allSeats = (state: SecretHitlerState): readonly SeatId[] =>
  state.players.map((player) => player.seat);

const autoPolicy = (state: SecretHitlerState, seat: SeatId) => {
  const options = legalActions(project(state, seat));
  return options.find((action) => action.t === "vote" && action.ja) ?? options[0] ?? null;
};

const assertRedacted = (state: SecretHitlerState, seat: SeatId): SecretHitlerView => {
  const view = project(state, seat);
  const mine = state.players.find((player) => player.seat === seat);
  if (mine === undefined) throw new Error("viewer missing");

  expect(Object.keys(view).sort()).toEqual(VIEW_KEYS);
  for (const player of view.players) expect(Object.keys(player).sort()).toEqual(PLAYER_KEYS);
  expect(Object.keys(view)).not.toContain("drawPile");
  expect(Object.keys(view)).not.toContain("discardPile");

  expect(view.myRole).toBe(mine.role);
  expect(view.players.map((player) => player.seat)).toEqual(allSeats(state));

  const allies = view.myAllies;
  if (mine.role === "liberal") {
    expect(allies).toBeNull();
  } else {
    expect(allies).not.toBeNull();
    for (const ally of allies ?? []) {
      const allyRole = state.players.find((player) => player.seat === ally)?.role;
      expect(allyRole === "fascist" || allyRole === "hitler").toBe(true);
    }
  }

  if (view.phase.kind === "president-discard") {
    if (view.phase.president === seat) expect(view.myDrawn).not.toBeNull();
    else expect(view.myDrawn).toBeNull();
  } else {
    expect(view.myDrawn).toBeNull();
  }
  if (view.phase.kind === "chancellor-enact" || view.phase.kind === "veto") {
    if (view.phase.chancellor === seat) expect(view.myOffered).not.toBeNull();
    else expect(view.myOffered).toBeNull();
  } else {
    expect(view.myOffered).toBeNull();
  }
  return view;
};

test("the view key set is pinned exactly, and player rows carry only public fields", () => {
  const state = rawGenesis(5, "redact-keys").state;
  for (const seat of allSeats(state)) assertRedacted(state, seat);
});

test("no serialized view contains a non-viewer's role", () => {
  for (const count of COUNTS) {
    let checkpoint: Checkpoint<SecretHitlerState> = rawGenesis(count, `redact-role-${count}`);
    let steps = 0;
    while (!isTerminal(checkpoint.state) && steps < 400) {
      const state = checkpoint.state;
      for (const seat of allSeats(state)) {
        const view = assertRedacted(state, seat);
        const text = serialized(view);
        const mine = state.players.find((player) => player.seat === seat);
        if (mine === undefined) throw new Error("viewer missing");
        // A role word may appear only as the viewer's own myRole (myAllies is a
        // seat list, the phase carries no role) or as a policy card the viewer
        // legitimately holds. Any further occurrence is a leaked role or deck card.
        const allowedWords = [
          ...(view.myDrawn ?? []),
          ...(view.myOffered ?? []),
          ...view.myPeeks.flatMap((peek) => peek.cards),
          ...view.myInvestigations.map((investigation) => investigation.party),
        ];
        for (const role of ["liberal", "fascist", "hitler"] as const) {
          const occurrences = text.split(`"${role}"`).length - 1;
          const own = mine.role === role ? 1 : 0;
          const allowed = allowedWords.filter((word) => word === role).length;
          expect(occurrences).toBe(own + allowed);
        }
      }
      checkpoint = driveRaw(checkpoint, autoPolicy, steps);
      steps += 1;
    }
    expect(isTerminal(checkpoint.state)).toBe(true);
  }
});

test("the deck and discard order never crosses the boundary; only their sizes do", () => {
  for (const count of COUNTS) {
    let checkpoint: Checkpoint<SecretHitlerState> = rawGenesis(count, `redact-deck-${count}`);
    let steps = 0;
    while (!isTerminal(checkpoint.state) && steps < 400) {
      const state = checkpoint.state;
      for (const seat of allSeats(state)) {
        const view = project(state, seat);
        expect(Object.keys(view)).not.toContain("drawPile");
        expect(Object.keys(view)).not.toContain("discardPile");
        // Only the sizes leak.
        expect(view.drawCount).toBe(state.drawPile.length);
        expect(view.discardCount).toBe(state.discardPile.length);
        // The exact pile arrays never appear in the serialized view.
        const text = serialized(view);
        if (state.drawPile.length > 0) expect(text).not.toContain(JSON.stringify(state.drawPile));
        if (state.discardPile.length > 0) {
          expect(text).not.toContain(JSON.stringify(state.discardPile));
        }
        // The cards the viewer may legitimately hold: the president's drawn three
        // or the chancellor's offered two, and the president's own peeks.
        const allowed = [
          ...(view.myDrawn ?? []),
          ...(view.myOffered ?? []),
          ...view.myPeeks.flatMap((peek) => peek.cards),
        ];
        const isPhaseHolder =
          (view.phase.kind === "president-discard" && view.phase.president === seat) ||
          ((view.phase.kind === "chancellor-enact" || view.phase.kind === "veto") &&
            view.phase.chancellor === seat);
        // A card name the viewer is not holding and not peeking is never carried.
        const carried = [
          ...(view.myDrawn ?? []),
          ...(view.myOffered ?? []),
          ...view.myPeeks.flatMap((peek) => peek.cards),
        ];
        expect(carried.length).toBe(allowed.length);
        if (!isPhaseHolder && view.myPeeks.length === 0) {
          expect(view.myDrawn).toBeNull();
          expect(view.myOffered).toBeNull();
        }
      }
      checkpoint = driveRaw(checkpoint, autoPolicy, steps);
      steps += 1;
    }
    expect(isTerminal(checkpoint.state)).toBe(true);
  }
});

test("a liberal's view names no ally and no other role", () => {
  const base = rawGenesis(5, "redact-liberal").state;
  const state: SecretHitlerState = {
    ...base,
    players: base.players.map((player) =>
      player.seat === CARA ? { ...player, role: "liberal" as const } : player,
    ),
  };
  const view = project(state, CARA);
  expect(view.myRole).toBe("liberal");
  expect(view.myAllies).toBeNull();
  expect(serialized(view)).not.toContain('"hitler"');
});

test("a fascist sees hitler and the other fascists; hitler at 7-10 sees only the fascists", () => {
  for (const count of COUNTS) {
    const state = rawGenesis(count, `redact-allies-${count}`).state;
    const fascists = fascistSeats(state);
    const hitler = hitlerSeat(state);
    for (const seat of fascists) {
      const view = project(state, seat);
      const expected = fascists.filter((other) => other !== seat);
      if (seat === hitler && count > 6) {
        // Hitler at 7-10 sees no ally [RB p2, p3].
        expect(view.myAllies).toEqual([]);
      } else {
        expect([...(view.myAllies ?? [])].sort()).toEqual([...expected].sort());
      }
    }
    for (const seat of liberalSeats(state)) {
      expect(project(state, seat).myAllies).toBeNull();
    }
  }
});

test("a private investigation reaches only the president who ran it", () => {
  let checkpoint = withTracks(rawGenesis(6, "redact-investigate"), 0, 3);
  checkpoint = withPhase(checkpoint, {
    kind: "power",
    president: ANN,
    power: "investigate-loyalty",
  });
  const target = activeSeats(checkpoint.state).find((seat) => seat !== ANN) ?? ANN;
  const after = stepState(checkpoint.state, [[ANN, { t: "investigate", target }]], 6);
  expect(project(after, ANN).myInvestigations.length).toBe(1);
  for (const seat of allSeats(after)) {
    if (seat === ANN) continue;
    expect(project(after, seat).myInvestigations).toEqual([]);
  }
});

test("a policy peek reaches only the peeking president", () => {
  let checkpoint = withTracks(rawGenesis(6, "redact-peek"), 0, 3);
  checkpoint = withStackedPile(checkpoint, ["liberal", "fascist", "fascist"]);
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "policy-peek" });
  const after = stepState(checkpoint.state, [[ANN, { t: "ack" }]], 6);
  expect(project(after, ANN).myPeeks.length).toBe(1);
  for (const seat of allSeats(after)) {
    if (seat === ANN) continue;
    expect(project(after, seat).myPeeks).toEqual([]);
  }
});

test("the president's three drawn cards are visible only to the president", () => {
  let checkpoint = withTracks(rawGenesis(5, "redact-drawn"), 0, 0);
  checkpoint = withStackedPile(checkpoint, ["liberal", "fascist", "fascist"]);
  checkpoint = withPresident(checkpoint, ANN);
  checkpoint = withPhase(checkpoint, { kind: "nominate", president: ANN });
  const nominated = stepState(checkpoint.state, [[ANN, { t: "nominate", chancellor: CARA }]]);
  const passed = stepState(
    nominated,
    seatsOwedNow(nominated).map(
      (seat): readonly [SeatId, { t: "vote"; ja: boolean }] => [seat, { t: "vote", ja: true }],
    ),
  );
  expect(project(passed, ANN).myDrawn?.length).toBe(3);
  for (const seat of allSeats(passed)) {
    if (seat === ANN) continue;
    expect(project(passed, seat).myDrawn).toBeNull();
    expect(serialized(project(passed, seat))).not.toContain('"myDrawn":[');
  }
});

test("at terminal the view reveals every role for scoring", () => {
  let checkpoint = withTracks(rawGenesis(5, "redact-terminal"), 0, 3);
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "execution" });
  const hitler = hitlerSeat(checkpoint.state);
  const after = stepState(checkpoint.state, [[ANN, { t: "execute", target: hitler }]]);
  expect(isTerminal(after)).toBe(true);
  const view = project(after, CARA);
  expect(view.outcome?.allRoles.length).toBe(5);
  const roles = new Map(view.outcome?.allRoles.map((entry) => [entry.seat, entry.role]));
  for (const player of after.players) expect(roles.get(player.seat)).toBe(player.role);
});

test("project throws for a seat that is not in the roster", () => {
  const state = rawGenesis(5, "redact-ghost").state;
  expect(() => project(state, "ghost" as unknown as SeatId)).toThrow();
});
