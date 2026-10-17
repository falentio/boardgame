import { expect, test } from "vitest";
import { computed, nextTick, ref, shallowRef, type Ref } from "vue";
import { REFUSAL_NOTICE, openSurface, type SurfacePhase } from "../immersive-surface.ts";
import type { EnterOutcome, Fullscreen, FullscreenSupport } from "../fullscreen.ts";

interface FakeFullscreen extends Fullscreen {
  readonly enters: () => number;
  readonly exits: () => number;
  answer(outcome: EnterOutcome): void;
  hang(): void;
  grant(): void;
}

const fakeFullscreen = (support: FullscreenSupport = "element"): FakeFullscreen => {
  const supportRef = ref<FullscreenSupport>(support);
  const element = shallowRef<Element | null>(null);
  let enters = 0;
  let exits = 0;
  let answer: EnterOutcome = "entered";
  let hangs = false;
  return {
    support: supportRef,
    element,
    active: computed(() => element.value !== null),
    enters: () => enters,
    exits: () => exits,
    answer: (outcome) => {
      answer = outcome;
    },
    hang: () => {
      hangs = true;
    },
    grant: () => {
      element.value = {} as Element;
    },
    enter: () => {
      enters += 1;
      return hangs ? new Promise<EnterOutcome>(() => {}) : Promise.resolve(answer);
    },
    exit: () => {
      exits += 1;
      return Promise.resolve();
    },
  };
};

const settle = async (): Promise<void> => {
  await Promise.resolve();
  await nextTick();
};

test("enter reveals the surface before the browser answers", () => {
  const phase = ref<SurfacePhase>("gate");
  const fullscreen = fakeFullscreen();
  const surface = openSurface({ phase, fullscreen });
  surface.enter();
  expect(phase.value).toBe("play");
  expect(fullscreen.enters()).toBe(1);
});

test("a refusal lands on the surface with the notice and a retry", async () => {
  const phase = ref<SurfacePhase>("gate");
  const fullscreen = fakeFullscreen();
  const surface = openSurface({ phase, fullscreen });
  fullscreen.answer("refused");
  surface.enter();
  await settle();
  expect(phase.value).toBe("play");
  expect(surface.notice.value).toBe(REFUSAL_NOTICE);
});

test("a granted request leaves no notice", async () => {
  const phase = ref<SurfacePhase>("gate");
  const fullscreen = fakeFullscreen();
  const surface = openSurface({ phase, fullscreen });
  surface.enter();
  await settle();
  expect(surface.notice.value).toBeNull();
});

test("an unsupported browser lands on the surface without a notice", async () => {
  const phase = ref<SurfacePhase>("gate");
  const fullscreen = fakeFullscreen("none");
  const surface = openSurface({ phase, fullscreen });
  fullscreen.answer("unsupported");
  surface.enter();
  await settle();
  expect(phase.value).toBe("play");
  expect(surface.notice.value).toBeNull();
  expect(surface.canEnter.value).toBe(false);
});

test("canEnter follows the capability probe", () => {
  const phase = ref<SurfacePhase>("gate");
  const fullscreen = fakeFullscreen();
  const surface = openSurface({ phase, fullscreen });
  expect(surface.canEnter.value).toBe(true);
  (fullscreen.support as Ref<FullscreenSupport>).value = "none";
  expect(surface.canEnter.value).toBe(false);
});

test("retry tries again without touching the phase", async () => {
  const phase = ref<SurfacePhase>("play");
  const fullscreen = fakeFullscreen();
  const surface = openSurface({ phase, fullscreen });
  fullscreen.answer("refused");
  surface.enter();
  await settle();
  phase.value = "gate";
  fullscreen.answer("entered");
  surface.retry();
  expect(fullscreen.enters()).toBe(2);
  expect(phase.value).toBe("gate");
  await settle();
  expect(surface.notice.value).toBeNull();
});

test("a hung request leaves the retry available", async () => {
  const phase = ref<SurfacePhase>("gate");
  const fullscreen = fakeFullscreen();
  const surface = openSurface({ phase, fullscreen });
  fullscreen.hang();
  surface.enter();
  await settle();
  expect(phase.value).toBe("play");
  expect(surface.notice.value).toBeNull();
  expect(surface.canRetry.value).toBe(true);
  fullscreen.grant();
  await settle();
  expect(surface.canRetry.value).toBe(false);
});

test("leave returns to the gate and exits only while we hold fullscreen", () => {
  const phase = ref<SurfacePhase>("play");
  const fullscreen = fakeFullscreen();
  const surface = openSurface({ phase, fullscreen });
  surface.leave();
  expect(phase.value).toBe("gate");
  expect(fullscreen.exits()).toBe(0);
  fullscreen.grant();
  phase.value = "play";
  surface.leave();
  expect(phase.value).toBe("gate");
  expect(fullscreen.exits()).toBe(1);
});

test("fullscreen going away returns to the gate", async () => {
  const phase = ref<SurfacePhase>("play");
  const fullscreen = fakeFullscreen();
  openSurface({ phase, fullscreen });
  fullscreen.grant();
  await settle();
  expect(phase.value).toBe("play");
  fullscreen.element.value = null;
  await settle();
  expect(phase.value).toBe("gate");
});
