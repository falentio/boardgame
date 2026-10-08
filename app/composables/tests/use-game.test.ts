import { expect, test } from "vitest";
import { ref } from "vue";
import { genesisSeed, seatId } from "../../../shared/core/lockstep/index.ts";
import { STARTER_ROLES } from "../../../shared/core/lockstep/games/g54/roles.ts";
import { g54 } from "../../../shared/core/lockstep/games/g54/index.ts";
import { roomCode, userId } from "../../../shared/rooms/ids.ts";
import { genesisFor, seatOf } from "../../../shared/game/seats.ts";
import { useGame } from "../useGame.ts";

const CODE = roomCode("BAVOKUTI");

test("seatOf and genesisFor agree on the viewer's seat and the room seed", () => {
  const seats = [
    { id: "room-1:seat:0", occupant: userId("ann") },
    { id: "room-1:seat:1", occupant: userId("bob") },
  ];
  const seat = seatOf(seats, userId("bob"));
  expect(seat).toBe(seatId("room-1:seat:1"));

  const genesis = genesisFor({ code: CODE, roles: STARTER_ROLES, seats, startedAt: null });
  expect(genesis.seed).toBe(genesisSeed(CODE));
  expect(genesis.roster.order).toContain(seat!);
});

test("useGame is SSR-safe: it returns the waiting stub and no-op actions", () => {
  const game = useGame({
    game: g54,
    room: ref(null),
    viewer: ref(null),
  });

  expect(game.view.value).toBeNull();
  expect(game.status.value).toBe("waiting");
  expect(game.acted.value).toBe(false);
  expect(() => game.report({ kind: "idle" })).not.toThrow();
  expect(() => game.resign()).not.toThrow();
  expect(game.status.value).toBe("waiting");
});
