import { expect, test } from "vitest";
import { roomCode, type RoomCode } from "../ids.ts";
import { joinPath, joinUrl, parseJoinInput } from "../link.ts";

const CODE = roomCode("BAVOKUTI");

test("accepts a bare code in any case and surrounding space", () => {
  expect(parseJoinInput("BAVOKUTI")).toBe(CODE);
  expect(parseJoinInput("bavokuti")).toBe(CODE);
  expect(parseJoinInput("  bavokuti\t")).toBe(CODE);
});

test("accepts an absolute join URL", () => {
  expect(parseJoinInput("https://board.example/join/BAVOKUTI")).toBe(CODE);
  expect(parseJoinInput("https://board.example/join/bavokuti")).toBe(CODE);
});

test("accepts a site-relative join path, with or without a trailing slash", () => {
  expect(parseJoinInput("/join/BAVOKUTI")).toBe(CODE);
  expect(parseJoinInput("/join/BAVOKUTI/")).toBe(CODE);
});

test("strips a query and a hash from the pathname", () => {
  expect(parseJoinInput("/join/BAVOKUTI?from=qr#seat")).toBe(CODE);
  expect(parseJoinInput("https://board.example/join/BAVOKUTI?from=qr#seat")).toBe(CODE);
});

test("accepts a protocol-relative URL because only the pathname is read", () => {
  expect(parseJoinInput("//evil.example.com/join/BAVOKUTI")).toBe(CODE);
});

test("rejects a non-join path, random text, and the empty string", () => {
  expect(parseJoinInput("/rooms/BAVOKUTI")).toBeNull();
  expect(parseJoinInput("https://board.example/join/too/long")).toBeNull();
  expect(parseJoinInput("hello world")).toBeNull();
  expect(parseJoinInput("")).toBeNull();
  expect(parseJoinInput("   ")).toBeNull();
});

test("joinUrl and joinPath round-trip back through parseJoinInput", () => {
  const url = joinUrl("https://board.example", CODE);
  expect(url).toBe("https://board.example/join/BAVOKUTI");
  expect(joinPath(CODE)).toBe("/join/BAVOKUTI");
  expect(parseJoinInput(url)).toBe(CODE);
  expect(parseJoinInput(joinPath(CODE))).toBe(CODE);
});

test("the parsed result is always a branded RoomCode", () => {
  const parsed: RoomCode | null = parseJoinInput("https://board.example/join/BAVOKUTI");
  expect(parsed).toBe(CODE);
});
