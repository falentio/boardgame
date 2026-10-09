import { expect, test } from "vitest";
import { makeRandom } from "../../core/lockstep/hash.ts";
import { seed } from "../../core/lockstep/ids.ts";
import { CODE_LENGTHS, CODE_SPACE_SIZE, generateCode, parseRoomCode } from "../code.ts";
import {
  CODE_PAIRS,
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

test("the code space is 6 * 15^4 * 5^4 = 189,843,750", () => {
  expect(CODE_LENGTHS).toEqual([8, 9]);
  expect(CODE_SPACE_SIZE).toBe(6 * 15 ** 4 * 5 ** 4);
  expect(CODE_SPACE_SIZE).toBe(189_843_750);
});

test("the accepted pattern uses exactly the generator alphabet, in optional-vowel + CVCVCVCV order", () => {
  const [c, v] = [CONSONANTS[0]!, VOWELS[0]!];
  expect(isRoomCode([c, v, c, v, c, v, c, v].join(""))).toBe(true);
  expect(isRoomCode([v, c, v, c, v, c, v, c, v].join(""))).toBe(true);
  expect(isRoomCode([v, v, c, v, c, v, c, v].join(""))).toBe(false);
  expect(isRoomCode([c, c, c, v, c, v, c, v].join(""))).toBe(false);
  expect(isRoomCode("AAAAAAAAA")).toBe(false);
  expect(isRoomCode("BABABABAB")).toBe(false);
});

test("parseRoomCode normalizes case and whitespace, and rejects anything off-shape or off-length", () => {
  expect(parseRoomCode("GAJUDIRU")).toBe("GAJUDIRU");
  expect(parseRoomCode("gajudiru")).toBe("GAJUDIRU");
  expect(parseRoomCode("  gajudiru  ")).toBe("GAJUDIRU");
  expect(parseRoomCode("AGAJUDIRU")).toBe("AGAJUDIRU");
  expect(parseRoomCode("agajudiru")).toBe("AGAJUDIRU");
  expect(parseRoomCode("  agajudiru  ")).toBe("AGAJUDIRU");
  expect(parseRoomCode("GAJUDIR")).toBeNull();
  expect(parseRoomCode("GAJUDIRUGA")).toBeNull();
  expect(parseRoomCode("GAJUDIR1")).toBeNull();
  expect(parseRoomCode("")).toBeNull();
  expect(parseRoomCode("AAAA")).toBeNull();
});

test("roomCode brands a valid code and rejects anything else with RoomIdError", () => {
  expect(roomCode("GAJUDIRU")).toBe("GAJUDIRU");
  expect(roomCode("AGAJUDIRU")).toBe("AGAJUDIRU");
  expect(() => roomCode("gajudiru")).toThrow(RoomIdError);
  expect(() => roomCode("ABABCDCD")).toThrow(RoomIdError);
  expect(() => roomCode("")).toThrow(RoomIdError);
});

test("a code using a removed consonant is rejected", () => {
  for (const letter of "QKXSFV") {
    expect(isRoomCode([letter, "A", "B", "A", "B", "A", "B", "A"].join(""))).toBe(false);
  }
  for (const letter of "QK") {
    expect(isRoomCode(`A${letter}ABABABA`)).toBe(false);
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
  expect(CODE_LENGTHS).toContain(first.length);
});

test("generateCode draws the prefix, then a consonant and a vowel per pair", () => {
  const calls: number[] = [];
  const zeroes = {
    int: (maxExclusive: number): number => {
      calls.push(maxExclusive);
      return 0;
    },
  };
  expect(generateCode(zeroes)).toBe("BABABABA");
  expect(calls).toEqual([6, 15, 5, 15, 5, 15, 5, 15, 5]);

  let first = true;
  const prefixed = {
    int: (): number => {
      if (first) {
        first = false;
        return 1;
      }
      return 0;
    },
  };
  expect(generateCode(prefixed)).toBe("ABABABABA");
});

test("every generated character comes from the alphabet at its slot", () => {
  const code = generateCode(makeRandom(seed("ffffffffffffffff")));
  const offset = code.length - CODE_PAIRS * 2;
  if (offset === 1) expect(VOWELS).toContain(code[0]!);
  for (let index = offset; index < code.length; index += 1) {
    const letter = code[index]!;
    if ((index - offset) % 2 === 0) expect(CONSONANTS).toContain(letter);
    else expect(VOWELS).toContain(letter);
  }
});

test("seeded draws produce both lengths at roughly the uniform one-sixth split", () => {
  const lengths = new Set<number>();
  let eights = 0;
  const total = 3000;
  for (let index = 0; index < total; index += 1) {
    const code = generateCode(makeRandom(seed(index.toString(16).padStart(16, "0"))));
    lengths.add(code.length);
    if (code.length === 8) eights += 1;
  }
  expect([...lengths].sort()).toEqual([8, 9]);
  expect(eights).toBeGreaterThan(total / 6 - 60);
  expect(eights).toBeLessThan(total / 6 + 60);
});

test("distinct entropy spreads across the code space", () => {
  const codes = new Set<string>();
  for (let index = 0; index < 2000; index += 1) {
    codes.add(generateCode(makeRandom(seed(index.toString(16).padStart(16, "0")))));
  }
  expect(codes.size).toBeGreaterThan(1990);
});
