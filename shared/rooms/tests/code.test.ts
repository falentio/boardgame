import { expect, test } from "vitest";
import { makeRandom } from "../../core/lockstep/hash.ts";
import { seed } from "../../core/lockstep/ids.ts";
import { CODE_LENGTH, CODE_SPACE_SIZE, generateCode, parseRoomCode } from "../code.ts";
import {
  CONSONANTS,
  RoomIdError,
  VOWELS,
  isRoomCode,
  roomCode,
  roomId,
  userId,
} from "../ids.ts";

test("the alphabet is 15 consonants and 5 vowels with no overlap", () => {
  expect(CONSONANTS).toBe("BCDGHJLMNPRTWYZ");
  expect(VOWELS).toBe("AEIOU");
  expect(CONSONANTS).toHaveLength(15);
  expect(VOWELS).toHaveLength(5);
  expect([...CONSONANTS].some((letter) => VOWELS.includes(letter))).toBe(false);
});

test("the code space is 15^4 * 5^4 = 31,640,625", () => {
  expect(CODE_LENGTH).toBe(8);
  expect(CODE_SPACE_SIZE).toBe(15 ** 4 * 5 ** 4);
  expect(CODE_SPACE_SIZE).toBe(31_640_625);
});

test("the accepted pattern uses exactly the generator alphabet, in CVCVCVCV order", () => {
  const [c, v] = [CONSONANTS[0]!, VOWELS[0]!];
  const valid = [c, v, c, v, c, v, c, v].join("");
  expect(isRoomCode(valid)).toBe(true);
  expect(isRoomCode([v, v, c, v, c, v, c, v].join(""))).toBe(false);
  expect(isRoomCode([c, c, c, v, c, v, c, v].join(""))).toBe(false);
});

test("parseRoomCode normalizes case and whitespace, and rejects anything not CVCVCVCV", () => {
  expect(parseRoomCode("GAJUDIRU")).toBe("GAJUDIRU");
  expect(parseRoomCode("gajudiru")).toBe("GAJUDIRU");
  expect(parseRoomCode("  gajudiru  ")).toBe("GAJUDIRU");
  expect(parseRoomCode("GAJUDIR")).toBeNull();
  expect(parseRoomCode("GAJUDIRUX")).toBeNull();
  expect(parseRoomCode("GAJUDIR1")).toBeNull();
  expect(parseRoomCode("")).toBeNull();
  expect(parseRoomCode("AAAA")).toBeNull();
});

test("roomCode brands a valid code and rejects anything else with RoomIdError", () => {
  expect(roomCode("GAJUDIRU")).toBe("GAJUDIRU");
  expect(() => roomCode("gajudiru")).toThrow(RoomIdError);
  expect(() => roomCode("ABABCDCD")).toThrow(RoomIdError);
  expect(() => roomCode("")).toThrow(RoomIdError);
});

test("a code using a removed consonant is rejected", () => {
  for (const letter of "QKXSFV") {
    expect(isRoomCode([letter, "A", "B", "A", "B", "A", "B", "A"].join(""))).toBe(false);
  }
});

test("roomId and userId brand any non-empty string and reject empty", () => {
  expect(roomId("room-1")).toBe("room-1");
  expect(userId("user-1")).toBe("user-1");
  expect(() => roomId("")).toThrow(RoomIdError);
  expect(() => userId("")).toThrow(RoomIdError);
});

test("generateCode is deterministic for a given entropy stream and always valid", () => {
  const first = generateCode(makeRandom(seed("00000000000000ff")));
  const second = generateCode(makeRandom(seed("00000000000000ff")));
  expect(first).toBe(second);
  expect(isRoomCode(first)).toBe(true);
  expect(first).toHaveLength(CODE_LENGTH);
});

test("generateCode draws a consonant then a vowel per pair", () => {
  const calls: number[] = [];
  const entropy = {
    int: (maxExclusive: number): number => {
      calls.push(maxExclusive);
      return 0;
    },
  };
  expect(generateCode(entropy)).toBe("BABABABA");
  expect(calls).toEqual([15, 5, 15, 5, 15, 5, 15, 5]);
});

test("every generated character comes from the alphabet at its slot", () => {
  const code = generateCode(makeRandom(seed("ffffffffffffffff")));
  for (let index = 0; index < code.length; index += 1) {
    const letter = code[index]!;
    if (index % 2 === 0) expect(CONSONANTS).toContain(letter);
    else expect(VOWELS).toContain(letter);
  }
});

test("distinct entropy spreads across the code space", () => {
  const codes = new Set<string>();
  for (let index = 0; index < 2000; index += 1) {
    codes.add(generateCode(makeRandom(seed(index.toString(16).padStart(16, "0")))));
  }
  expect(codes.size).toBeGreaterThan(1990);
});
