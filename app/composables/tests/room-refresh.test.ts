import { expect, test } from "vitest";
import { createRoomRefresher } from "../room-refresh.ts";

interface Deferred {
  resolve: (value: string) => void;
  promise: Promise<string>;
}

const deferred = (): Deferred => {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((r) => {
    resolve = r;
  });
  return { resolve, promise };
};

test("a leading signal fires one refetch immediately and forwards the room", async () => {
  const rooms: string[] = [];
  let calls = 0;
  const refresh = createRoomRefresher({
    fetchRoom: async () => {
      calls += 1;
      return `room-${String(calls)}`;
    },
    onRoom: (room) => rooms.push(room),
  });

  refresh();
  await Promise.resolve();
  await Promise.resolve();
  expect(calls).toBe(1);
  expect(rooms).toEqual(["room-1"]);
});

test("signals during an in-flight refetch coalesce into exactly one trailing refetch", async () => {
  const rooms: string[] = [];
  const first = deferred();
  let calls = 0;
  const refresh = createRoomRefresher({
    fetchRoom: () => {
      calls += 1;
      return calls === 1 ? first.promise : Promise.resolve(`room-${String(calls)}`);
    },
    onRoom: (room) => rooms.push(room),
  });

  refresh();
  refresh();
  refresh();
  expect(calls).toBe(1);

  first.resolve("room-1");
  await first.promise;
  await Promise.resolve();
  await Promise.resolve();

  expect(calls).toBe(2);
  expect(rooms).toEqual(["room-1", "room-2"]);
});

test("a settle with no pending signal does not schedule a trailing refetch", async () => {
  let calls = 0;
  const refresh = createRoomRefresher({
    fetchRoom: async () => {
      calls += 1;
      return "room";
    },
    onRoom: () => {},
  });

  refresh();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(calls).toBe(1);
});

test("a failed refetch does not throw and leaves room for the next signal", async () => {
  const rooms: string[] = [];
  let calls = 0;
  const refresh = createRoomRefresher({
    fetchRoom: async () => {
      calls += 1;
      if (calls === 1) throw new Error("network down");
      return "room-2";
    },
    onRoom: (room) => rooms.push(room),
  });

  refresh();
  await Promise.resolve();
  await Promise.resolve();
  expect(rooms).toEqual([]);

  refresh();
  await Promise.resolve();
  await Promise.resolve();
  expect(rooms).toEqual(["room-2"]);
});
