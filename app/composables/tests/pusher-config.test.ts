import { expect, test } from "vitest";
import { pusherConfigFrom } from "../useRoomChannel.ts";

test("a host with no port keeps the pusher default", () => {
  expect(pusherConfigFrom({ key: "k", host: "wss.vask.dev" })).toEqual({
    key: "k",
    host: "wss.vask.dev",
  });
});

test("a host with a port splits into the host and wssPort", () => {
  expect(pusherConfigFrom({ key: "k", host: "127.0.0.1:4443" })).toEqual({
    key: "k",
    host: "127.0.0.1",
    wssPort: 4443,
  });
});

test("a malformed port is refused rather than silently dialing 443", () => {
  for (const host of ["h:", "h:-1", "h:0", "h:65536", "h:0x10", "h:44 43", "h:4443.0", "::1", ":4443"]) {
    expect(pusherConfigFrom({ key: "k", host }), host).toBeNull();
  }
});

test("a config without a usable key or host is refused", () => {
  expect(pusherConfigFrom({ host: "wss.vask.dev" })).toBeNull();
  expect(pusherConfigFrom({ key: "k" })).toBeNull();
  expect(pusherConfigFrom({ key: "", host: "wss.vask.dev" })).toBeNull();
  expect(pusherConfigFrom(null)).toBeNull();
  expect(pusherConfigFrom("wss.vask.dev")).toBeNull();
});
