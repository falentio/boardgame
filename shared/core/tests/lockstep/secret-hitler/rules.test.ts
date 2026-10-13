import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  DEE,
  EVE,
  FINN,
  HITLER_CHANCELLOR_FASCIST,
  LIBERAL_LIMIT,
  MIN_ACTIVE_SEATS,
  activeSeats,
  boardLimit,
  driveRaw,
  eligibleChancellors,
  isTerminal,
  legalActions,
  outcomeOf,
  policiesConserved,
  powerFor,
  project,
  rawGenesis,
  seatsOwedNow,
  secretHitler,
  stepResign,
  stepState,
  withExecuted,
  withPhase,
  withPresident,
  withResigned,
  withRoles,
  withStackedPile,
  withTerms,
  withTracker,
  withTracks,
  type Checkpoint,
  type PlayerCount,
  type Policy,
  type SecretHitlerAction,
  type SecretHitlerState,
  type SeatId,
} from "./driver.ts";

const FIVE: PlayerCount = 5;

/** A controlled 5-player table: ann and bob are the fascist team (bob is Hitler). */
const fiveTable = (entropy = "rules-five"): Checkpoint<SecretHitlerState> => {
  let checkpoint = withRoles(rawGenesis(FIVE, entropy), [
    [ANN, "fascist"],
    [BOB, "hitler"],
    [CARA, "liberal"],
    [DEE, "liberal"],
    [EVE, "liberal"],
  ]);
  checkpoint = withPresident(checkpoint, ANN);
  return withPhase(checkpoint, { kind: "nominate", president: ANN });
};

const voteFrame = (state: SecretHitlerState, yes: readonly SeatId[]) =>
  seatsOwedNow(state).map(
    (seat): readonly [SeatId, SecretHitlerAction] => [seat, { t: "vote", ja: yes.includes(seat) }],
  );

const nominate = (state: SecretHitlerState, president: SeatId, chancellor: SeatId) =>
  stepState(state, [[president, { t: "nominate", chancellor }]]);

/** Run the whole legislature, discarding around `want` so it is the card enacted. */
const legislate = (state: SecretHitlerState, want: Policy): SecretHitlerState => {
  const phase = state.phase;
  if (phase.kind !== "president-discard") throw new Error("expected president-discard");
  const drawn = project(state, phase.president).myDrawn;
  if (drawn === null) throw new Error("the president has no cards");
  const discardIndex = drawn.findIndex((card) => card !== want);
  const afterDiscard = stepState(state, [[phase.president, { t: "discard", index: discardIndex }]]);
  const offered = project(afterDiscard, phase.chancellor).myOffered;
  if (offered === null) throw new Error("the chancellor has no cards");
  const enactIndex = offered.findIndex((card) => card === want);
  return stepState(afterDiscard, [[phase.chancellor, { t: "enact", index: enactIndex }]]);
};

test("a nomination opens a vote owed by every active seat", () => {
  const nominated = nominate(fiveTable().state, ANN, CARA);
  expect(nominated.phase).toEqual({ kind: "vote", president: ANN, chancellor: CARA });
  expect(seatsOwedNow(nominated)).toEqual([ANN, BOB, CARA, DEE, EVE]);
});

test("an illegal nominee coerces to the first eligible seat", () => {
  const start = fiveTable("rules-nominee-coerce");
  const nominated = nominate(start.state, ANN, ANN);
  const phase = nominated.phase;
  if (phase.kind !== "vote") throw new Error("expected a vote");
  expect(phase.chancellor).not.toBe(ANN);
  expect(eligibleChancellors(start.state)).toContain(phase.chancellor);
});

test("a majority yes seats the government and opens the president's discard", () => {
  const nominated = nominate(fiveTable("rules-pass").state, ANN, CARA);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA]));
  expect(passed.phase.kind).toBe("president-discard");
  expect(passed.lastElectedPresident).toBe(ANN);
  expect(passed.lastElectedChancellor).toBe(CARA);
  expect(project(passed, ANN).myDrawn?.length).toBe(3);
  expect(project(passed, BOB).myDrawn).toBeNull();
});

test("a tie vote fails: the tracker advances and the presidency rotates", () => {
  const nominated = nominate(fiveTable("rules-tie").state, ANN, CARA);
  // A 2-2 tie across four voters fails; here 2 yes of 5 also fails [RB p4].
  const failed = stepState(nominated, voteFrame(nominated, [ANN, CARA]));
  expect(failed.electionTracker).toBe(1);
  expect(failed.phase).toEqual({ kind: "nominate", president: BOB });
  expect(failed.fascistPolicies).toBe(0);
});

test("a plain failed election keeps the prior term limits", () => {
  let start = withTerms(fiveTable("rules-terms-fail"), ANN, CARA);
  start = withPresident(start, ANN);
  const nominated = nominate(start.state, ANN, DEE);
  const failed = stepState(nominated, voteFrame(nominated, []));
  expect(failed.phase).toEqual({ kind: "nominate", president: BOB });
  // Only the chaos event forgets term limits [RB p4].
  expect(eligibleChancellors(failed)).not.toContain(CARA);
});

test("three failed elections enact the top policy by chaos, with no power and a reset tracker", () => {
  let checkpoint = withTracker(fiveTable("rules-chaos"), 2);
  // The top card is the last element; stack a fascist on top.
  checkpoint = withStackedPile(checkpoint, ["fascist", "liberal", "liberal"]);
  const nominated = nominate(checkpoint.state, ANN, CARA);
  const chaos = stepState(nominated, voteFrame(nominated, []));
  expect(chaos.fascistPolicies).toBe(1);
  expect(chaos.electionTracker).toBe(0);
  expect(chaos.phase.kind).toBe("nominate");
  expect(policiesConserved(chaos)).toBe(true);
});

test("the chaos enactment forgets term limits, so everyone is eligible again", () => {
  let checkpoint = withTracker(fiveTable("rules-chaos-terms"), 2);
  checkpoint = withTerms(checkpoint, ANN, CARA);
  checkpoint = withStackedPile(checkpoint, ["fascist", "liberal", "liberal"]);
  const nominated = nominate(checkpoint.state, ANN, DEE);
  const chaos = stepState(nominated, voteFrame(nominated, []));
  expect(chaos.lastElectedPresident).toBeNull();
  expect(chaos.lastElectedChancellor).toBeNull();
  expect(chaos.electionTracker).toBe(0);
});

test("five liberal policies win for the liberals", () => {
  let checkpoint = withTracks(fiveTable("rules-lib-win"), 4, 0);
  checkpoint = withStackedPile(checkpoint, ["liberal", "fascist", "liberal"]);
  const nominated = nominate(checkpoint.state, ANN, CARA);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA, DEE, EVE]));
  const enacted = legislate(passed, "liberal");
  expect(enacted.liberalPolicies).toBe(LIBERAL_LIMIT);
  expect(outcomeOf(enacted)).toEqual({ kind: "liberal-policies" });
  expect(secretHitler.isTerminal(enacted)).toBe(true);
});

test("six fascist policies win for the fascists", () => {
  let checkpoint = withTracks(fiveTable("rules-fasc-win"), 0, 5);
  checkpoint = withStackedPile(checkpoint, ["fascist", "fascist", "liberal"]);
  const nominated = nominate(checkpoint.state, ANN, CARA);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA, DEE, EVE]));
  const enacted = legislate(passed, "fascist");
  expect(enacted.fascistPolicies).toBe(boardLimit(FIVE));
  expect(outcomeOf(enacted)).toEqual({ kind: "fascist-policies" });
});

test("hitler elected chancellor with three fascist policies on the board wins for the fascists", () => {
  const checkpoint = withTracks(fiveTable("rules-hitler-chancellor"), 0, HITLER_CHANCELLOR_FASCIST);
  const nominated = nominate(checkpoint.state, ANN, BOB);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA, DEE, EVE]));
  expect(outcomeOf(passed)).toEqual({ kind: "hitler-chancellor", chancellor: BOB });
  expect(secretHitler.isTerminal(passed)).toBe(true);
});

test("hitler elected chancellor below three fascist policies does not end the game", () => {
  const checkpoint = withTracks(
    fiveTable("rules-hitler-early"),
    0,
    HITLER_CHANCELLOR_FASCIST - 1,
  );
  const nominated = nominate(checkpoint.state, ANN, BOB);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA, DEE, EVE]));
  expect(passed.phase.kind).toBe("president-discard");
  expect(outcomeOf(passed)).toBeNull();
});

test("executing hitler wins for the liberals", () => {
  let checkpoint = withTracks(fiveTable("rules-execute-hitler"), 0, 3);
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "execution" });
  const executed = stepState(checkpoint.state, [[ANN, { t: "execute", target: BOB }]]);
  expect(outcomeOf(executed)).toEqual({ kind: "hitler-executed", target: BOB });
  expect(secretHitler.isTerminal(executed)).toBe(true);
});

test("executing a non-hitler removes the seat without revealing its team", () => {
  let checkpoint = withTracks(fiveTable("rules-execute-other"), 0, 3);
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "execution" });
  const executed = stepState(checkpoint.state, [[ANN, { t: "execute", target: DEE }]]);
  expect(outcomeOf(executed)).toBeNull();
  expect(executed.players.find((entry) => entry.seat === DEE)?.executed).toBe(true);
  const view = project(executed, CARA);
  expect(view.players.find((entry) => entry.seat === DEE)?.executed).toBe(true);
  expect(Object.keys(view.players[0] ?? {})).not.toContain("role");
});

test("a fascist policy at a power slot opens the power phase with the board's power", () => {
  let checkpoint = withTracks(fiveTable("rules-power-open"), 0, 2);
  checkpoint = withStackedPile(checkpoint, ["fascist", "fascist", "liberal"]);
  const nominated = nominate(checkpoint.state, ANN, CARA);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA, DEE, EVE]));
  const enacted = legislate(passed, "fascist");
  expect(enacted.fascistPolicies).toBe(3);
  expect(enacted.phase).toEqual({ kind: "power", president: ANN, power: "policy-peek" });
  expect(powerFor(FIVE, 3)).toBe("policy-peek");
});

test("policy peek records the top three for the president alone and leaves the deck unchanged", () => {
  let checkpoint = withTracks(fiveTable("rules-peek"), 0, 3);
  checkpoint = withStackedPile(checkpoint, ["liberal", "fascist", "fascist"]);
  const before = checkpoint.state.drawPile;
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "policy-peek" });
  const peeked = stepState(checkpoint.state, [[ANN, { t: "ack" }]]);
  expect(peeked.drawPile).toEqual(before);
  const mine = project(peeked, ANN);
  expect(mine.myPeeks.length).toBe(1);
  // Top-first: the stacked top's first entry is the topmost card.
  expect(mine.myPeeks[0]?.cards).toEqual(["liberal", "fascist", "fascist"]);
  expect(project(peeked, BOB).myPeeks).toEqual([]);
});

test("investigate loyalty records a party, never Hitler-ness, and cannot repeat a target", () => {
  let checkpoint = withTracks(fiveTable("rules-investigate"), 0, 3);
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "investigate-loyalty" });
  const investigated = stepState(checkpoint.state, [[ANN, { t: "investigate", target: BOB }]]);
  expect(project(investigated, ANN).myInvestigations).toEqual([{ target: BOB, party: "fascist" }]);
  expect(project(investigated, CARA).myInvestigations).toEqual([]);
  const again = withPhase(
    { ...checkpoint, state: investigated },
    { kind: "power", president: ANN, power: "investigate-loyalty" },
  );
  const second = stepState(again.state, [[ANN, { t: "investigate", target: BOB }]]);
  const bobCount = second.investigations.filter((entry) => entry.target === BOB).length;
  expect(bobCount).toBe(1);
});

test("special election names the next candidate and the rotation resumes from the enactor's left", () => {
  let checkpoint = withTracks(fiveTable("rules-special"), 0, 3);
  checkpoint = withPhase(checkpoint, { kind: "power", president: ANN, power: "special-election" });
  const named = stepState(checkpoint.state, [[ANN, { t: "special-election", target: DEE }]]);
  expect(named.phase).toEqual({ kind: "nominate", president: DEE });
  expect(named.specialElectionResume).toBe(ANN);
  const nominated = nominate(named, DEE, CARA);
  const failed = stepState(nominated, voteFrame(nominated, []));
  // The next president is the seat after Ann, not after Dee, so nobody is skipped [RB p5].
  expect(failed.phase).toEqual({ kind: "nominate", president: BOB });
  expect(failed.specialElectionResume).toBeNull();
});

test("the veto unlocks only after five fascist policies and a refused veto reopens the enact", () => {
  let checkpoint = withTracks(fiveTable("rules-veto"), 0, 5);
  checkpoint = withStackedPile(checkpoint, ["liberal", "liberal", "fascist"]);
  const nominated = nominate(checkpoint.state, ANN, CARA);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA, DEE, EVE]));
  const discarded = stepState(passed, [[ANN, { t: "discard", index: 0 }]]);
  const phase = discarded.phase;
  if (phase.kind !== "chancellor-enact") throw new Error("expected chancellor-enact");
  expect(phase.veto).toBe(true);
  const proposed = stepState(discarded, [[CARA, { t: "propose-veto" }]]);
  expect(proposed.phase.kind).toBe("veto");
  const refused = stepState(proposed, [[ANN, { t: "reject-veto" }]]);
  expect(refused.phase.kind).toBe("chancellor-enact");
  if (refused.phase.kind !== "chancellor-enact") throw new Error("expected chancellor-enact");
  expect(refused.phase.veto).toBe(false);
});

test("an accepted veto discards all three tiles and advances the tracker", () => {
  let checkpoint = withTracks(fiveTable("rules-veto-accept"), 0, 5);
  checkpoint = withStackedPile(checkpoint, ["liberal", "liberal", "fascist"]);
  const nominated = nominate(checkpoint.state, ANN, CARA);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA, DEE, EVE]));
  const discarded = stepState(passed, [[ANN, { t: "discard", index: 0 }]]);
  const proposed = stepState(discarded, [[CARA, { t: "propose-veto" }]]);
  const accepted = stepState(proposed, [[ANN, { t: "accept-veto" }]]);
  expect(accepted.electionTracker).toBe(1);
  expect(accepted.fascistPolicies).toBe(5);
  expect(accepted.discardPile.length).toBe(3);
  expect(policiesConserved(accepted)).toBe(true);
});

test("term limits bar the last elected pair, but only the last chancellor at five players", () => {
  // At five players the last president may be renominated [RB p3]; use a
  // president who is not the last president so the self-nomination rule does not
  // also bar them.
  const base = withPresident(fiveTable("rules-term-limits"), DEE);
  const five = withTerms(base, ANN, CARA).state;
  expect(eligibleChancellors(five)).not.toContain(CARA);
  expect(eligibleChancellors(five)).toContain(ANN);
  // At six players the last president is barred too.
  const sixBase = withPresident(
    withRoles(rawGenesis(6, "rules-term-six"), [
      [ANN, "fascist"],
      [BOB, "hitler"],
      [CARA, "liberal"],
      [DEE, "liberal"],
      [EVE, "liberal"],
      [FINN, "liberal"],
    ]),
    DEE,
  );
  const six = withTerms(sixBase, ANN, CARA).state;
  expect(eligibleChancellors(six)).not.toContain(ANN);
  expect(eligibleChancellors(six)).not.toContain(CARA);
});

test("the five-player term-limit relaxation counts living seats, not roster size", () => {
  // Six seats with one executed leaves five players in the game, so the last
  // elected President may be renominated [RB p3].
  let checkpoint = withRoles(rawGenesis(6, "rules-term-living"), [
    [ANN, "fascist"],
    [BOB, "hitler"],
    [CARA, "liberal"],
    [DEE, "liberal"],
    [EVE, "liberal"],
    [FINN, "liberal"],
  ]);
  checkpoint = withExecuted(checkpoint, [FINN]);
  checkpoint = withPresident(checkpoint, DEE);
  const state = withTerms(checkpoint, ANN, CARA).state;
  expect(activeSeats(state).length).toBe(5);
  expect(eligibleChancellors(state)).toContain(ANN);
  expect(eligibleChancellors(state)).not.toContain(CARA);
});

test("a president who resigns at the nomination hands the round on, never a vote naming them", () => {
  const start = fiveTable("rules-resign-nominate");
  const after = stepResign(start.state, ANN);
  expect(after.phase).toEqual({ kind: "nominate", president: BOB });
  expect(after.resigned).toContain(ANN);
  // The next government seats a living President, so the resigned seat is never
  // recorded as elected by a later vote.
  const nominated = nominate(after, BOB, CARA);
  const passed = stepState(nominated, voteFrame(nominated, [BOB, CARA, DEE, EVE]));
  expect(passed.lastElectedPresident).toBe(BOB);
});

test("a table below the active floor is terminal and reads abandoned, never an empty owed set", () => {
  const checkpoint = withResigned(fiveTable("rules-abandoned"), [ANN, BOB, CARA]);
  expect(activeSeats(checkpoint.state).length).toBeLessThan(MIN_ACTIVE_SEATS);
  expect(secretHitler.isTerminal(checkpoint.state)).toBe(true);
  expect(outcomeOf(checkpoint.state)).toEqual({ kind: "abandoned" });
  expect(seatsOwedNow(checkpoint.state)).toEqual([]);
});

test("seatsOwed never returns empty while isTerminal is false, across a full drive", () => {
  let checkpoint = rawGenesis(7, "rules-owed-total");
  let steps = 0;
  while (!secretHitler.isTerminal(checkpoint.state) && steps < 300) {
    expect(seatsOwedNow(checkpoint.state).length).toBeGreaterThan(0);
    checkpoint = driveRaw(checkpoint, (state, seat) => {
      const options = legalActions(project(state, seat));
      return options.find((action) => action.t === "vote" && action.ja) ?? options[0] ?? null;
    }, steps);
    steps += 1;
  }
  expect(secretHitler.isTerminal(checkpoint.state)).toBe(true);
});

test("a hostile frame of garbage actions never throws and never strands the owed set", () => {
  const hostile: readonly (SecretHitlerAction | null)[] = [
    null,
    { t: "nominate", chancellor: ANN },
    { t: "vote", ja: true },
    { t: "discard", index: 99 },
    { t: "enact", index: -1 },
    { t: "propose-veto" },
    { t: "accept-veto" },
    { t: "reject-veto" },
    { t: "ack" },
    { t: "investigate", target: ANN },
    { t: "special-election", target: ANN },
    { t: "execute", target: ANN },
  ];
  let state = rawGenesis(6, "rules-hostile").state;
  let cursor = 0;
  for (let i = 0; i < 2000 && !secretHitler.isTerminal(state); i += 1) {
    const owed = seatsOwedNow(state);
    expect(owed.length).toBeGreaterThan(0);
    const inputs = owed.map((seat): readonly [SeatId, SecretHitlerAction | null] => {
      const action = hostile[cursor % hostile.length] ?? null;
      cursor += 1;
      return [seat, action];
    });
    state = stepState(state, inputs, 6);
    if (!secretHitler.isTerminal(state)) {
      expect(seatsOwedNow(state).length).toBeGreaterThan(0);
      expect(policiesConserved(state)).toBe(true);
    }
  }
  expect(secretHitler.isTerminal(state)).toBe(true);
});

test("a resigning president hands the round on and conserves the deck", () => {
  let checkpoint = withTracks(fiveTable("rules-resign-president"), 0, 3);
  checkpoint = withStackedPile(checkpoint, ["liberal", "liberal", "fascist"]);
  const nominated = nominate(checkpoint.state, ANN, CARA);
  const passed = stepState(nominated, voteFrame(nominated, [ANN, BOB, CARA, DEE, EVE]));
  const resigned = stepResign(passed, ANN);
  expect(policiesConserved(resigned)).toBe(true);
  expect(resigned.phase.kind).toBe("nominate");
  expect(resigned.resigned).toContain(ANN);
});
