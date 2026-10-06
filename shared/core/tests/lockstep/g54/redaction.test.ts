import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  STARTER,
  advance,
  craftSet,
  crafted,
  openPurpose,
  rawGenesis,
  withCoins,
} from "./driver.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";
import { makeRoster, makeRandom, genesisSeed } from "../../../index.ts";

test("project hides the Court order from every seat", () => {
  const state = rawGenesis(STARTER, SEATS3, "redact-court");
  const view = g54.project(state, ANN);
  expect(Object.keys(view)).not.toContain("court");
  expect(view.courtCount).toBe(state.court.length);
});

test("project hides every other seat's hand and reveals only the viewer's own", () => {
  const state = rawGenesis(STARTER, SEATS3, "redact-hands");
  const view = g54.project(state, ANN);
  expect(view.myHand).toEqual(state.players[0]?.hand ?? []);
  for (const player of view.players) {
    expect(Object.keys(player)).not.toContain("hand");
    expect(player.handCount).toBeGreaterThanOrEqual(0);
  }
  // A seat's own hand is never present under another seat's entry.
  const bobEntry = view.players.find((p) => p.seat === BOB);
  expect(Object.keys(bobEntry ?? {})).not.toContain("myHand");
});

test("the Director's drawn pool is visible only to the actor", () => {
  let state = crafted("redact-draw");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  state = advance(state, () => null);
  // The keep window is open; Ann sees the pool, Bob does not.
  expect(g54.project(state, ANN).myDraw).toHaveLength(2);
  expect(g54.project(state, BOB).myDraw).toBeNull();
});

test("project follows the active extra claim, not the main pending", () => {
  const roles = ["banker", "director", "guerrilla", "intellectual", "politician"] as const;
  let state = withCoins(
    craftSet(roles, [[BOB, ["banker", "intellectual"]]], "redact-extra"),
    ANN,
    4,
  );
  // Ann attacks Bob; Bob survives, flips a card, and claims his reactive Intellectual.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, () => null);
  state = advance(state, () => null);
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("reactive-intellectual");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "intellectual", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  // The main pending is still the guerrilla claim; the extra is the active claim.
  expect(state.pending?.role).toBe("guerrilla");
  expect(state.extras.at(-1)?.role).toBe("intellectual");
  expect(g54.project(state, BOB).pending?.role).toBe("intellectual");
});

test("project exposes token holders but never hidden hands or the Court order", () => {
  const state = {
    ...rawGenesis(STARTER, SEATS3, "redact-tokens"),
    peacekeeping: ANN,
    treaty: [ANN, BOB],
    tax: { role: "banker" as const, holder: BOB },
    disappear: [{ target: CARA, turns: 1 }],
  };
  const view = g54.project(state, ANN);
  expect(view.tokens.peacekeeping).toBe(ANN);
  expect(view.tokens.treaty).toEqual([ANN, BOB]);
  expect(view.tokens.tax).toEqual({ role: "banker", holder: BOB });
  expect(view.tokens.disappear).toEqual([{ target: CARA, turns: 1 }]);
  expect(Object.keys(view)).not.toContain("court");
});

test("genesis is reproducible from the same seed on independent peers", () => {
  const roster = makeRoster(SEATS3);
  const a = g54.genesis({ roles: STARTER }, roster, makeRandom(genesisSeed("same-seed")));
  const b = g54.genesis({ roles: STARTER }, roster, makeRandom(genesisSeed("same-seed")));
  expect(g54.state.encode(a)).toEqual(g54.state.encode(b));
});
