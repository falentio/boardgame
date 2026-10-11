import { expect, test } from "vitest";
import {
  autoplays,
  DEFAULT_HOW_TO_PLAY_VARIANT,
  HOW_TO_PLAY_VARIANTS,
  HOW_TO_PLAY_VARIANT_IDS,
  isHowToPlayVariantId,
  isMuted,
  parseHowToPlayVariant,
  presenceOf,
  preloadOf,
} from "../how-to-play.ts";

test("the six ids round-trip through the parser", () => {
  expect(HOW_TO_PLAY_VARIANT_IDS).toHaveLength(6);
  for (const id of HOW_TO_PLAY_VARIANT_IDS) {
    expect(parseHowToPlayVariant(id)).toBe(id);
    expect(presenceOf(id).id).toBe(id);
  }
});

test("the picker order ramps from smallest to largest", () => {
  expect(HOW_TO_PLAY_VARIANT_IDS).toEqual(["dock", "rail", "trail", "lead", "band", "hero"]);
  expect(HOW_TO_PLAY_VARIANT_IDS).toContain(DEFAULT_HOW_TO_PLAY_VARIANT);
});

test("an absent or unknown ?variant= falls back to the default", () => {
  expect(parseHowToPlayVariant(undefined)).toBe(DEFAULT_HOW_TO_PLAY_VARIANT);
  expect(parseHowToPlayVariant(null)).toBe(DEFAULT_HOW_TO_PLAY_VARIANT);
  expect(parseHowToPlayVariant("nope")).toBe(DEFAULT_HOW_TO_PLAY_VARIANT);
  expect(parseHowToPlayVariant("")).toBe(DEFAULT_HOW_TO_PLAY_VARIANT);
});

test("a repeated param takes its first value", () => {
  expect(parseHowToPlayVariant(["hero", "rail"])).toBe("hero");
  expect(parseHowToPlayVariant(["nope", "rail"])).toBe(DEFAULT_HOW_TO_PLAY_VARIANT);
});

test("prototype keys never resolve to a variant", () => {
  expect(parseHowToPlayVariant("__proto__")).toBe(DEFAULT_HOW_TO_PLAY_VARIANT);
  expect(parseHowToPlayVariant("constructor")).toBe(DEFAULT_HOW_TO_PLAY_VARIANT);
  expect(parseHowToPlayVariant("toString")).toBe(DEFAULT_HOW_TO_PLAY_VARIANT);
  expect(isHowToPlayVariantId("__proto__")).toBe(false);
  expect(isHowToPlayVariantId("hero")).toBe(true);
  expect(isHowToPlayVariantId(7)).toBe(false);
});

test("only the muted-autoplay presence may autoplay, and never under reduced motion", () => {
  expect(isMuted(presenceOf("dock"))).toBe(true);
  expect(isMuted(presenceOf("lead"))).toBe(false);
  expect(autoplays(presenceOf("dock"), false)).toBe(true);
  expect(autoplays(presenceOf("dock"), true)).toBe(false);
  expect(autoplays(presenceOf("hero"), false)).toBe(false);
});

test("preload maps the autoplaying presence to metadata and the rest to none", () => {
  expect(preloadOf(presenceOf("dock"))).toBe("metadata");
  expect(preloadOf(presenceOf("lead"))).toBe("none");
});

test("no two presences share a footprint", () => {
  const seen = new Set<string>();
  for (const id of HOW_TO_PLAY_VARIANT_IDS) {
    const p = HOW_TO_PLAY_VARIANTS[id];
    const footprint = [p.placement, p.aspect, p.columnClass, p.playerClass].join("|");
    expect(seen.has(footprint), `${id} duplicates another presence`).toBe(false);
    seen.add(footprint);
  }
});

test("every presence carries picker text, a note, and an aspect", () => {
  for (const id of HOW_TO_PLAY_VARIANT_IDS) {
    const presence = HOW_TO_PLAY_VARIANTS[id];
    expect(presence.label.length).toBeGreaterThan(0);
    expect(presence.note.length).toBeGreaterThan(0);
    expect(presence.aspect).toMatch(/^aspect-/);
  }
});
