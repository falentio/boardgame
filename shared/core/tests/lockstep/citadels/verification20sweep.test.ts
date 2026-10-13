import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, advance, openPurpose, rawGenesis, rawGold, rawHand, cityIds,
  type CitadelsAction, type CitadelsState,
} from "./driver.ts";
import type { SeatId } from "../../../lockstep/index.ts";
import {
  CHARACTER_CATALOG, charactersOfRank, specOfCharacter, type CharacterId, type Rank,
} from "../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../lockstep/games/citadels/districts.ts";

const CHEAP: readonly DistrictId[] = [
  "tavern", "temple", "watchtower", "manor", "market", "church", "docks", "prison", "barracks",
];
const HAND: readonly DistrictId[] = ["market", "docks", "harbor", "palace", "temple", "church"];

const castWithWitch = (target: CharacterId): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1 as Rank; rank <= 8; rank = (rank + 1) as Rank) {
    const at = charactersOfRank(rank);
    cast.push(at.includes(target) ? target : (at[0] as CharacterId));
  }
  if (specOfCharacter(target).rank === 9) cast.push(target);
  cast[0] = "witch";
  return cast;
};
const claimsOf = (pairs: readonly (readonly [SeatId, CharacterId])[]) =>
  [...pairs].sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

const board = (
  cast: readonly CharacterId[], seed: string,
  golds: Readonly<Record<string, number>>,
  hands: Readonly<Record<string, readonly DistrictId[]>>,
  cities: Readonly<Record<string, readonly DistrictId[]>> = {},
): CitadelsState => {
  const base = rawGenesis(SEATS3, cast, seed);
  return {
    ...base, phase: "turn", draft: null, callRank: 1, active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }], pending: null, threats: [], builtThisTurn: 0,
    deck: [...CHEAP, ...base.deck],
    players: base.players.map((player) => ({
      ...player,
      gold: golds[player.seat] ?? 0,
      hand: hands[player.seat] ?? [],
      city: (cities[player.seat] ?? []).map((id) => ({ id, gold: 0 })),
    })),
  };
};

const buildPolicy = (name: CharacterId) =>
  (seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const purpose = openPurpose(s);
    if (purpose === "turn" || purpose === "trader-build") {
      const hand = rawHand(s, ANN);
      const city = cityIds(s, ANN);
      const index = hand.findIndex((id) => !city.includes(id));
      return index >= 0 ? { t: "build", card: index } : { t: "gold" };
    }
    if (purpose === "keep" || purpose === "scholar-keep") return { t: "keep", index: 0 };
    if (purpose === "choose-character") return { t: "name-character", character: name };
    if (purpose === "witch-takeover" || purpose === "witch-resume") return { t: "pass" };
    if (purpose === "cardinal-gold") return { t: "target", seat: CARA };
    if (purpose === "magician-swap") return { t: "target", seat: CARA };
    if (purpose === "magician-discard") return { t: "keep", index: 0 };
    if (purpose === "seer-give" || purpose === "seer-receive") return { t: "keep", index: 0 };
    if (purpose === "wizard-take") return { t: "keep", index: 0 };
    if (purpose === "diplomat-exchange") { const n = s.pending?.note; return n === "diplomat-target" ? { t: "target", seat: CARA } : { t: "keep", index: 0 }; }
    if (purpose === "marshal-seize") return s.pending?.note === "marshal-seize" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    if (purpose === "warlord-destroy") return s.pending?.note === "warlord-destroy" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    if (purpose === "artist-beautify") return { t: "keep", index: 0 };
    if (purpose === "magistrate-confiscate") return { t: "keep", index: 0 };
    if (purpose === "spy-seat" || purpose === "choose-seat") return { t: "target", seat: CARA };
    if (purpose === "choose-type") return { t: "name-type", type: "trade" };
    if (purpose === "abbot-split") return { t: "choose", value: "0" };
    if (purpose === "emperor-crown") return { t: "target", seat: CARA };
    if (purpose === "tax-collect") return { t: "pass" } as CitadelsAction;
    if (purpose === "blackmailer-resolve") return { t: "choose", value: "no" };
    if (purpose === "queen-income") return { t: "choose", value: "gold" };
    return { t: "pass" } as CitadelsAction;
  };

const annTurnDone = (s: CitadelsState): boolean => {
  if (s.phase !== "turn") return true;
  const top = s.steps[0];
  if (top === undefined || top.kind !== "window") return false;
  if (top.window.purpose === "draft-pick") return true;
  const seats = top.window.seats;
  return seats.length > 0 && !seats.includes(ANN);
};

const fold = (state: CitadelsState, name: CharacterId) => {
  let s = state;
  const purposes: string[] = [];
  for (let i = 0; i < 400 && !annTurnDone(s); i += 1) {
    purposes.push(openPurpose(s) ?? "-");
    s = advance(s, buildPolicy(name));
  }
  return { end: s, purposes };
};

const foldResume = (name: CharacterId, seed: string, golds: Readonly<Record<string, number>>, hands: Readonly<Record<string, readonly DistrictId[]>>, cities?: Readonly<Record<string, readonly DistrictId[]>>) =>
  fold({ ...board(castWithWitch(name), seed, golds, hands, cities), claimed: claimsOf([[ANN, "witch"], [BOB, name]]) }, name);

const foldPlain = (name: CharacterId, seed: string, golds: Readonly<Record<string, number>>, hands: Readonly<Record<string, readonly DistrictId[]>>, cities?: Readonly<Record<string, readonly DistrictId[]>>) =>
  fold({ ...board(castWithWitch(name), seed, golds, hands, cities), claimed: claimsOf([[ANN, name]]), callRank: specOfCharacter(name).rank, active: ANN, resume: null, bewitched: null }, name);

const key = (s: CitadelsState) =>
  "gold=" + rawGold(s, ANN) + " hand=" + [...rawHand(s, ANN)].sort().join(",") +
  " city=" + [...cityIds(s, ANN)].sort().join(",") +
  " caraGold=" + rawGold(s, CARA) + " caraHand=" + [...rawHand(s, CARA)].sort().join(",");

const RICH = { [ANN]: 12, [BOB]: 5, [CARA]: 5 };
const POOR = { [ANN]: 1, [BOB]: 5, [CARA]: 5 };

test("the resume reaches the plain turn's end state for every character (rich board)", () => {
  const bad: string[] = [];
  for (const spec of CHARACTER_CATALOG) {
    const name = spec.id;
    if (name === "witch") continue;
    if (spec.rank < 2) continue; // rank 1 cannot share a cast with the Witch
    const g = foldResume(name, "sweep-rich-" + name, RICH, { [ANN]: [...HAND], [CARA]: ["tavern", "market"] });
    const p = foldPlain(name, "sweep-rich-" + name, RICH, { [ANN]: [...HAND], [CARA]: ["tavern", "market"] });
    const heldGather = name === "navigator" ? 2 : 0;
    const gk = key(g.end).replace("gold=" + rawGold(g.end, ANN), "gold=" + (rawGold(g.end, ANN) - heldGather));
    if (gk !== key(p.end)) bad.push(name + ": resume [" + gk + "] windows " + g.purposes.join(",") + " vs plain [" + key(p.end) + "] windows " + p.purposes.join(","));
  }
  expect(bad, "resume/plain divergences:\n" + bad.join("\n")).toEqual([]);
});

test("the resume reaches the plain turn's end state for every character (poor board)", () => {
  const bad: string[] = [];
  for (const spec of CHARACTER_CATALOG) {
    const name = spec.id;
    if (name === "witch") continue;
    if (spec.rank < 2) continue; // rank 1 cannot share a cast with the Witch
    const g = foldResume(name, "sweep-poor-" + name, POOR, { [ANN]: ["palace", "harbor"], [CARA]: ["tavern", "market"] });
    const p = foldPlain(name, "sweep-poor-" + name, POOR, { [ANN]: ["palace", "harbor"], [CARA]: ["tavern", "market"] });
    const heldGather = name === "navigator" ? 2 : 0;
    const gk = key(g.end).replace("gold=" + rawGold(g.end, ANN), "gold=" + (rawGold(g.end, ANN) - heldGather));
    if (gk !== key(p.end)) bad.push(name + ": resume [" + gk + "] windows " + g.purposes.join(",") + " vs plain [" + key(p.end) + "] windows " + p.purposes.join(","));
  }
  expect(bad, "resume/plain divergences:\n" + bad.join("\n")).toEqual([]);
});
