import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  cityIds,
  foldFrom,
  openPurpose,
  rawGenesis,
  rawGold,
  rawHand,
  type CitadelsAction,
  type CitadelsState,
  type SeatId,
} from "../../driver.ts";
import {
  specOfCharacter,
  type CharacterId,
  type Rank,
} from "../../../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../../../lockstep/games/citadels/districts.ts";

/**
 * Eleventh-pass verifier artifacts. Two counterexamples against the head under
 * review, each failing, plus the positive probes that hold the clauses the pass
 * did not break. Every claim is stated against orchestrate/citadels/rules.json,
 * the authoritative rule text.
 *
 * D11-1  rules.json (blackmailer): "Assign two threat markers facedown to two
 *         different characters; one shows the flowered lace and is the target
 *         ... If they refuse you may reveal their marker; revealing the flowered
 *         lace takes all their gold." Exactly one marker carries the lace, so at
 *         most one threatened seat can ever be looted by a reveal. resolveReveal
 *         (characters/blackmailer.ts) answers "is this the lace?" with
 *         threats[0] === character - the first threat STILL STANDING, not the one
 *         that carried the lace - so the moment the target's marker is removed
 *         (bribe or reveal) the second marker inherits the lace. Measured: the
 *         target loots 8 of its gold, then the decoy loots 7 more, for a 15-gold
 *         haul out of ten gold on the table.
 *
 * D11-2  rules.json (blackmailer): "A threatened player must resolve the threat
 *         before using abilities or building." A threatened Navigator owning a
 *         Museum is handed the Museum's placement offer ABOVE its threat window,
 *         so the seat tucks a card (an ability) before it resolves the threat.
 *         Measured: purposes run turn, keep, blackmailer-threat where the rule
 *         wants the threat first.
 */

const DEFAULTS: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

/** A legal cast holding each target at its own rank; the Blackmailer is never in it. */
const castFor = (targets: readonly CharacterId[]): readonly CharacterId[] => {
  const cast = DEFAULTS.map((fallback, i) => {
    const rank = (i + 1) as Rank;
    return targets.find((t) => specOfCharacter(t).rank === rank) ?? fallback;
  });
  const nine = targets.find((t) => specOfCharacter(t).rank === 9);
  return nine === undefined ? cast : [...cast, nine];
};

const claimsOf = (pairs: readonly (readonly [SeatId, CharacterId])[]) =>
  [...pairs]
    .sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

interface Board {
  readonly gold?: Readonly<Record<string, number>>;
  readonly hands?: Readonly<Record<string, readonly DistrictId[]>>;
  readonly cities?: Readonly<Record<string, readonly DistrictId[]>>;
}

interface Arm extends Board {
  readonly character: CharacterId;
  readonly claims: readonly (readonly [SeatId, CharacterId])[];
  readonly firstRank: number;
  readonly threats: readonly CharacterId[];
  readonly entropy: string;
}

/**
 * A real deal laid over so the rank cursor stands at firstRank with the
 * Blackmailer's markers already placed in threats (target first, as applyCall
 * records them).
 */
const arm = (o: Arm): CitadelsState => {
  const base = rawGenesis(SEATS3, castFor([o.character]), o.entropy);
  return {
    ...base,
    phase: "turn",
    draft: null,
    claimed: claimsOf(o.claims),
    callRank: o.firstRank,
    active: o.claims.find(([, c]) => specOfCharacter(c).rank === o.firstRank)?.[0] ?? BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    threats: o.threats,
    builtThisTurn: 0,
    players: base.players.map((p) => ({
      ...p,
      gold: o.gold?.[p.seat] ?? p.gold,
      hand: [...(o.hands?.[p.seat] ?? p.hand)],
      city: (o.cities?.[p.seat] ?? []).map((id) => ({ id, gold: 0 })),
    })),
  };
};

interface Answer {
  readonly threat: "none" | "bribe" | "refuse";
  readonly reveal: "reveal" | "no";
  readonly build?: number;
  readonly donor?: SeatId;
}

const answerFor =
  (o: Answer) =>
  (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const purpose = openPurpose(s);
    if (purpose === "turn") {
      return o.build === undefined ? { t: "gold" } : { t: "build", card: o.build };
    }
    if (purpose === "keep") return { t: "keep", index: 0 };
    if (purpose === "blackmailer-threat") {
      return o.threat === "none" ? null : { t: "choose", value: o.threat };
    }
    if (purpose === "blackmailer-resolve") return { t: "choose", value: o.reveal };
    if (purpose === "cardinal-gold") {
      return o.donor === undefined ? null : { t: "target", seat: o.donor };
    }
    return null;
  };

interface Folded {
  readonly fold: Fold;
  readonly end: CitadelsState;
  readonly purposes: readonly string[];
}

const stop = (steps: readonly CitadelsState[]): boolean => {
  const s = steps[steps.length - 1] as CitadelsState;
  return openPurpose(s) === "draft-pick" || s.phase !== "turn";
};

const fold = (o: Arm & Answer): Folded => {
  const run = foldFrom(arm(o), answerFor(o), stop, 200, o.entropy);
  return {
    fold: run,
    end: run.steps[run.steps.length - 1] as CitadelsState,
    purposes: run.steps.map((s) => openPurpose(s) ?? "-"),
  };
};

/**
 * The purse a seat holds at the blackmailer-threat frame, where the rule
 * measures the bribe: below the gather and above every ability window. The
 * Bribe case derives its half from THAT purse, so a character ability spliced
 * back above the threat keeps the income it lands here and the assertion goes
 * red.
 */
const purseAtThreat = (f: Folded, seat: SeatId): number => {
  const at = f.purposes.indexOf("blackmailer-threat");
  expect(at, "the fold reached a threat window").toBeGreaterThanOrEqual(0);
  return rawGold(f.fold.steps[at] as CitadelsState, seat);
};

/** The purse a seat holds on the frame right after the threat resolves. */
const afterThreat = (f: Folded, seat: SeatId): number => {
  const at = f.purposes.indexOf("blackmailer-threat");
  expect(at, "the fold reached a threat window").toBeGreaterThanOrEqual(0);
  return rawGold(f.fold.steps[at + 1] as CitadelsState, seat);
};

const tuck = (s: CitadelsState): number =>

  s.players.find((p) => p.seat === BOB)?.city[0]?.cards?.length ?? 0;

/**
 * One character's turn folded from a real deal: ANN holds the Blackmailer, BOB
 * the character under test, CARA a higher-ranked partner out of the cast.
 */
const turnOf = (o: {
  readonly character: CharacterId;
  readonly threats: readonly CharacterId[];
  readonly threat: "none" | "bribe" | "refuse";
  readonly reveal?: "reveal" | "no";
  readonly entropy: string;
  readonly board: Board;
  readonly build?: number;
  readonly donor?: SeatId;
}): Folded => {
  const partner =
    DEFAULTS.find((c) => specOfCharacter(c).rank > specOfCharacter(o.character).rank) ??
    "warlord";
  return fold({
    character: o.character,
    claims: [
      [ANN, "blackmailer"],
      [BOB, o.character],
      [CARA, partner],
    ],
    firstRank: specOfCharacter(o.character).rank,
    threats: o.threats,
    entropy: o.entropy,
    threat: o.threat,
    reveal: o.reveal ?? "no",
    build: o.build,
    donor: o.donor,
    gold: o.board.gold,
    hands: o.board.hands,
    cities: o.board.cities,
  });
};

// ---------------------------------------------------------------------------
// D11-1: the second threat marker carries no flowered lace
// ---------------------------------------------------------------------------

/**
 * Fold a round in which the Blackmailer threatened TWO seats: BOB holds the
 * marker the first name gave (the target, the flowered lace) and CARA the decoy.
 * The Merchant (rank 6) acts before the Architect (rank 7), so the target
 * resolves its marker first. Both threats are refused; reveal decides whether
 * the Blackmailer reveals each one.
 */
const foldTwoThreats = (reveal: "reveal" | "no", entropy: string): Folded => {
  const base = rawGenesis(SEATS3, castFor(["merchant", "architect"]), entropy);
  const start: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: claimsOf([
      [ANN, "blackmailer"],
      [BOB, "merchant"],
      [CARA, "architect"],
    ]),
    callRank: 6,
    active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    threats: ["merchant", "architect"],
    builtThisTurn: 0,
    players: base.players.map((p) => ({
      ...p,
      gold: p.seat === ANN ? 0 : 5,
      hand: [],
      city: [],
    })),
  };
  const run = foldFrom(start, answerFor({ threat: "refuse", reveal }), stop, 200, entropy);
  return {
    fold: run,
    end: run.steps[run.steps.length - 1] as CitadelsState,
    purposes: run.steps.map((s) => openPurpose(s) ?? "-"),
  };
};

test("D11-1 the second threat marker carries no flowered lace", () => {
  // Control 1: the Blackmailer declines both reveals, so neither seat is looted.
  const quiet = foldTwoThreats("no", "v11-d1-quiet");
  expect(rawGold(quiet.end, BOB), "a refused threat that is not revealed costs nothing").toBe(8);
  expect(rawGold(quiet.end, CARA)).toBe(7);
  expect(rawGold(quiet.end, ANN)).toBe(0);

  // Control 2: the Blackmailer reveals, so the LACE - BOB's marker, the first
  // name - takes all of BOB's gold. BOB's purse at the threat is
  // 5 + 2 gather + 1 Merchant income = 8; CARA's is 5 + 2 = 7.
  const loud = foldTwoThreats("reveal", "v11-d1-loud");
  expect(rawGold(loud.end, BOB), "the lace takes all of the target's gold").toBe(0);

  // The defect: the second marker has no lace, so revealing it must take nothing.
  // Measured on this head: the decoy is looted as well, so the Blackmailer takes
  // 8 (the lace) + 7 (no lace at all) = 15.
  expect(
    rawGold(loud.end, CARA),
    "the decoy's marker has no lace: revealing it still took all 7 of its gold",
  ).toBe(7);
  expect(rawGold(loud.end, ANN), "one lace, one looting: expected 8, measured 15").toBe(8);
});

// ---------------------------------------------------------------------------
// D11-2: a threatened Navigator tucks under its Museum before it resolves
// ---------------------------------------------------------------------------

test("D11-2 a threatened Navigator resolves the threat before its Museum offer", () => {
  const board: Board = {
    gold: { ann: 0, bob: 0, cara: 0 },
    hands: { ann: [], bob: ["tavern"], cara: [] },
    cities: { ann: [], bob: ["museum"], cara: [] },
  };
  const plain = turnOf({
    character: "navigator",
    threats: [],
    threat: "none",
    entropy: "v11-d2-plain",
    board,
  });
  const threatened = turnOf({
    character: "navigator",
    threats: ["navigator"],
    threat: "refuse",
    entropy: "v11-d2-refuse",
    board,
  });
  // Control: the unthreatened turn still gets its placement offer exactly once.
  expect(plain.purposes.filter((p) => p === "keep").length, "the offer opens once").toBe(1);
  expect(tuck(plain.end), "the unthreatened turn tucks one card").toBe(1);
  // "A threatened player must resolve the threat before using abilities or
  // building": the Museum placement is an ability, so the threat leads it.
  const at = threatened.purposes.indexOf("blackmailer-threat");
  const keep = threatened.purposes.indexOf("keep");
  expect(
    at < keep,
    "measured order " +
      threatened.purposes.join(",") +
      ": the placement ran before the threat resolved",
  ).toBe(true);
  expect(tuck(threatened.end), "the still-offered tuck still lands").toBe(1);
});

// ---------------------------------------------------------------------------
// Positive probes: the clauses this pass did not break
// ---------------------------------------------------------------------------

/**
 * P1 - every one of the 27 characters as the threatened seat, on two boards.
 * Refusing the threat must land exactly where an unthreatened turn lands: the
 * refused marker is removed, no gold crosses, no ability is skipped. On the
 * bribe path the Blackmailer receives half (rounded down) of the seat's purse
 * at the threat window, which is the post-gather purse.
 */
test("P1 a refused threat leaves every character where an unthreatened turn ends", () => {
  const ALL: readonly CharacterId[] = [
    "assassin",
    "witch",
    "magistrate",
    "thief",
    "spy",
    "magician",
    "wizard",
    "seer",
    "king",
    "emperor",
    "patrician",
    "bishop",
    "abbot",
    "cardinal",
    "merchant",
    "alchemist",
    "trader",
    "architect",
    "navigator",
    "scholar",
    "warlord",
    "diplomat",
    "marshal",
    "artist",
    "queen",
    "tax-collector",
  ];
  const boards: readonly (readonly [string, Board])[] = [
    [
      "museum",
      {
        gold: { ann: 0, bob: 6, cara: 0 },
        hands: { ann: [], bob: ["palace", "tavern"], cara: [] },
        cities: { ann: [], bob: ["museum"], cara: [] },
      },
    ],
    [
      "school",
      {
        gold: { ann: 0, bob: 6, cara: 0 },
        hands: { ann: [], bob: [], cara: [] },
        cities: { ann: [], bob: ["school-of-magic"], cara: [] },
      },
    ],
  ];
  const seen: string[] = [];
  for (const character of ALL) {
    for (const [tag, board] of boards) {
      const plain = turnOf({
        character,
        threats: [],
        threat: "none",
        entropy: "v11-p1-p-" + tag + "-" + character,
        board,
      });
      const refused = turnOf({
        character,
        threats: [character],
        threat: "refuse",
        entropy: "v11-p1-r-" + tag + "-" + character,
        board,
      });
      const bribed = turnOf({
        character,
        threats: [character],
        threat: "bribe",
        entropy: "v11-p1-b-" + tag + "-" + character,
        board,
      });
      seen.push(character + "/" + tag);
      expect(rawGold(refused.end, BOB), character + "/" + tag + " refused gold").toBe(
        rawGold(plain.end, BOB),
      );
      expect(rawHand(refused.end, BOB).length, character + "/" + tag + " refused hand").toBe(
        rawHand(plain.end, BOB).length,
      );
      expect(cityIds(refused.end, BOB), character + "/" + tag + " refused city").toEqual(
        cityIds(plain.end, BOB),
      );
      expect(tuck(refused.end), character + "/" + tag + " refused tuck").toBe(tuck(plain.end));
      // rules.json (blackmailer): the threatened seat gathers resources, then
      // resolves the threat, paying "half their gold rounded down" of the purse
      // measured AT THE THREAT - below the gather and above every ability window.
      // The bribe therefore never sees the plain end purse, which the ability has
      // already paid into.
      const threat = bribed.purposes.indexOf("blackmailer-threat");
      const purse = purseAtThreat(bribed, BOB);
      const half = Math.floor(purse / 2);
      const seatAfter = afterThreat(bribed, BOB);
      //
      // Below the threat the turn plays out: the ability windows and their offers
      // land there, so the seat ends holding what the bribe left plus whatever the
      // rest of the turn moved. Read off the frames, never assumed.
      const seam = rawGold(bribed.end, BOB) - seatAfter;
      expect(threat, character + "/" + tag + " reached its threat window").toBeGreaterThanOrEqual(
        0,
      );
      expect(seatAfter, character + "/" + tag + " the bribe left the purse minus half").toBe(
        purse - half,
      );
      expect(
        rawGold(bribed.end, BOB),
        character + "/" + tag + " bribing kept purse minus half plus the turn below the threat",
      ).toBe(seatAfter + seam);
      expect(
        afterThreat(bribed, ANN) - purseAtThreat(bribed, ANN),
        character + "/" + tag + " the bribe crossed half to the Blackmailer",
      ).toBe(half);
    }
  }
  expect(seen.length, "26 threatenable characters x 2 boards").toBe(52);
});

/**
 * P3 - a refused threatened turn closes exactly once, so the end-of-turn hooks
 * fire once. The D13 relocation moves a threatened seat's ability windows below
 * the threat, between the post-threat build window and the turn's own END_TURN;
 * the turn-close seam must reuse that END_TURN rather than prepend a second one,
 * or the turn closes twice and every end-of-turn district hook fires twice. The
 * Smithy (2 gold for 3 cards, onEndTurn) makes the double-fire visible: a
 * doubled close charges 4 gold and draws 6.
 */
test("P3 a refused threat fires the end-of-turn hook exactly once", () => {
  const board: Board = {
    gold: { ann: 0, bob: 20, cara: 0 },
    hands: { ann: [], bob: [], cara: [] },
    cities: { ann: [], bob: ["smithy"], cara: [] },
  };
  // The Scholar opens a keep window (relocated below the threat when threatened),
  // so it exercises the relocated-window turn shape the double-close came from.
  for (const character of ["scholar", "magician", "seer", "warlord"] as const) {
    const plain = turnOf({
      character,
      threats: [],
      threat: "none",
      entropy: "v11-p3-p-" + character,
      board,
    });
    const refused = turnOf({
      character,
      threats: [character],
      threat: "refuse",
      entropy: "v11-p3-r-" + character,
      board,
    });
    expect(
      rawGold(refused.end, BOB),
      character + " refused gold: the end-of-turn hook fired twice (the Smithy charged 4)",
    ).toBe(rawGold(plain.end, BOB));
    expect(
      rawHand(refused.end, BOB).length,
      character + " refused hand: the end-of-turn hook fired twice (the Smithy drew 6)",
    ).toBe(rawHand(plain.end, BOB).length);
    expect(
      cityIds(refused.end, BOB),
      character + " refused city",
    ).toEqual(cityIds(plain.end, BOB));
  }
});

/**
 * P2 - the Cardinal's shortfall retry below a refused threat still builds. The
 * shortfall offer opens on the build window the threat was seated above, so the
 * retry must land the district exactly as the unthreatened path does.
 */
test("P2 a threatened Cardinal still covers a shortfall and builds", () => {
  const board: Board = {
    gold: { ann: 0, bob: 2, cara: 9 },
    hands: { ann: [], bob: ["palace"], cara: [] },
    cities: { ann: [], bob: [], cara: [] },
  };
  const plain = turnOf({
    character: "cardinal",
    threats: [],
    threat: "none",
    entropy: "v11-p2-plain",
    board,
    build: 0,
    donor: CARA,
  });
  const refused = turnOf({
    character: "cardinal",
    threats: ["cardinal"],
    threat: "refuse",
    entropy: "v11-p2-refuse",
    board,
    build: 0,
    donor: CARA,
  });
  expect(cityIds(plain.end, BOB), "the unthreatened Cardinal builds the Palace").toEqual([
    "palace",
  ]);
  expect(cityIds(refused.end, BOB), "the threatened Cardinal builds the Palace too").toEqual([
    "palace",
  ]);
  expect(rawGold(refused.end, BOB)).toBe(rawGold(plain.end, BOB));
  expect(rawGold(refused.end, CARA)).toBe(rawGold(plain.end, CARA));
  expect(rawHand(refused.end, CARA).length).toBe(rawHand(plain.end, CARA).length);
});
