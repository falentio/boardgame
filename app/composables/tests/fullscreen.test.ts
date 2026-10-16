import { afterEach, expect, test, vi } from "vitest";
import { effectScope, shallowRef, type Ref } from "vue";
import {
  REQUEST_DEADLINE_MS,
  refusalOf,
  useFullscreen,
  type EnterOutcome,
  type FullscreenHost,
} from "../fullscreen.ts";

type Answer = "grant" | "refuse" | "unsupported" | "lost-activation" | "hang";

interface FakeHost extends FullscreenHost {
  readonly root: Element;
  readonly requests: Element[];
  readonly exits: () => number;
  /** Deliver a fullscreenchange with the element the browser now holds. */
  fire(element: Element | null): void;
  answer(next: Answer): void;
  release(): void;
  canRequest(value: boolean): void;
}

/** The fake host only needs identity, and a node test has no DOM to mint one from. */
const fakeElement = (): Element => ({}) as Element;

const fakeHost = (): FakeHost => {
  const listeners = new Set<(element: Element | null) => void>();
  const requests: Element[] = [];
  const root = fakeElement();
  let current: Element | null = null;
  let exitCount = 0;
  let supported = true;
  let answer: Answer = "grant";
  let release = (): void => {};
  return {
    root,
    requests,
    exits: () => exitCount,
    fire: (element) => {
      current = element;
      for (const listener of listeners) listener(element);
    },
    answer: (next) => {
      answer = next;
    },
    release: () => {
      release();
    },
    supported: () => supported,
    element: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    request: (target) => {
      requests.push(target);
      if (answer === "grant") return Promise.resolve();
      if (answer === "refuse") return Promise.reject(new DOMException("denied", "NotAllowedError"));
      if (answer === "unsupported") {
        return Promise.reject(new DOMException("no element fullscreen", "NotSupportedError"));
      }
      if (answer === "lost-activation") {
        return Promise.reject(new TypeError("API can only be initiated by a user gesture."));
      }
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    exit: () => {
      exitCount += 1;
      return Promise.resolve();
    },
    canRequest: (value) => {
      supported = value;
    },
  };
};

/**
 * A fake element is a plain object, which a deep ref would proxy; the real target
 * is a DOM element, which Vue hands over untouched.
 */
const harness = (options: { canRequest?: boolean; mounted?: boolean } = {}) => {
  const host = fakeHost();
  if (options.canRequest === false) host.canRequest(false);
  const target: Ref<Element | null> = shallowRef(options.mounted === false ? null : host.root);
  const scope = effectScope();
  const fullscreen = scope.run(() => useFullscreen({ target, host }));
  if (fullscreen === undefined) throw new Error("the composable did not build");
  return { host, target, fullscreen, stop: () => scope.stop() };
};

afterEach(() => {
  vi.useRealTimers();
});

test("active follows fullscreenchange, not the request's promise", async () => {
  const { host, fullscreen, stop } = harness();
  await expect(fullscreen.enter()).resolves.toBe("entered");
  expect(fullscreen.active.value).toBe(false);
  host.fire(host.root);
  expect(fullscreen.active.value).toBe(true);
  expect(fullscreen.element.value).toBe(host.root);
  host.fire(null);
  expect(fullscreen.active.value).toBe(false);
  stop();
});

test("a second enter joins the attempt already in flight", async () => {
  const { host, fullscreen, stop } = harness();
  const first = fullscreen.enter();
  const second = fullscreen.enter();
  expect(host.requests).toHaveLength(1);
  await expect(first).resolves.toBe("entered");
  await expect(second).resolves.toBe("entered");
  stop();
});

test("a refused request reports refused, and never reads as a grant", async () => {
  const { host, fullscreen, stop } = harness();
  host.answer("refuse");
  await expect(fullscreen.enter()).resolves.toBe<EnterOutcome>("refused");
  expect(host.element()).toBeNull();
  expect(fullscreen.active.value).toBe(false);
  expect(fullscreen.support.value).toBe("element");
  stop();
});

test("a lost user activation is a refusal, not a missing capability", async () => {
  const { host, fullscreen, stop } = harness();
  host.answer("lost-activation");
  await expect(fullscreen.enter()).resolves.toBe<EnterOutcome>("refused");
  expect(fullscreen.support.value).toBe("element");
  stop();
});

test("a browser that refuses to start the request reports unsupported", async () => {
  const { host, fullscreen, stop } = harness();
  host.answer("unsupported");
  await expect(fullscreen.enter()).resolves.toBe<EnterOutcome>("unsupported");
  stop();
});

test("a browser without the API is unsupported without asking it", async () => {
  const { host, fullscreen, stop } = harness({ canRequest: false });
  expect(fullscreen.support.value).toBe("none");
  await expect(fullscreen.enter()).resolves.toBe<EnterOutcome>("unsupported");
  expect(host.requests).toHaveLength(0);
  stop();
});

test("an unmounted target is unsupported rather than a request on null", async () => {
  const { host, fullscreen, stop } = harness({ mounted: false });
  expect(fullscreen.support.value).toBe("element");
  await expect(fullscreen.enter()).resolves.toBe<EnterOutcome>("unsupported");
  expect(host.requests).toHaveLength(0);
  stop();
});

test("a hung request frees the retry control at the deadline", async () => {
  vi.useFakeTimers();
  const { host, fullscreen, stop } = harness();
  host.answer("hang");
  void fullscreen.enter();
  expect(host.requests).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS);
  host.answer("grant");
  await expect(fullscreen.enter()).resolves.toBe<EnterOutcome>("entered");
  expect(host.requests).toHaveLength(2);
  stop();
});

test("a late answer to a cleared attempt changes nothing", async () => {
  vi.useFakeTimers();
  const { host, fullscreen, stop } = harness();
  host.answer("hang");
  void fullscreen.enter();
  await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS);
  host.answer("grant");
  await expect(fullscreen.enter()).resolves.toBe<EnterOutcome>("entered");
  host.release();
  await vi.advanceTimersByTimeAsync(0);
  expect(fullscreen.element.value).toBeNull();
  expect(fullscreen.active.value).toBe(false);
  host.answer("grant");
  await expect(fullscreen.enter()).resolves.toBe<EnterOutcome>("entered");
  expect(host.requests).toHaveLength(3);
  stop();
});

test("exit is a no-op when nothing is fullscreen", async () => {
  const { host, fullscreen, stop } = harness();
  await expect(fullscreen.exit()).resolves.toBeUndefined();
  expect(host.exits()).toBe(0);
  stop();
});

test("exit leaves when the browser holds the target", async () => {
  const { host, fullscreen, stop } = harness();
  host.fire(host.root);
  await expect(fullscreen.exit()).resolves.toBeUndefined();
  expect(host.exits()).toBe(1);
  stop();
});

test("a browser that refuses to leave keeps the DOM as the source of truth", async () => {
  const host = fakeHost();
  const refusing: FullscreenHost = {
    ...host,
    exit: () => Promise.reject(new DOMException("cannot leave", "NotAllowedError")),
  };
  const scope = effectScope();
  const fullscreen = scope.run(() =>
    useFullscreen({ target: shallowRef<Element | null>(host.root), host: refusing }),
  );
  if (fullscreen === undefined) throw new Error("the composable did not build");
  host.fire(host.root);
  expect(fullscreen.active.value).toBe(true);
  await expect(fullscreen.exit()).resolves.toBeUndefined();
  expect(fullscreen.active.value).toBe(true);
  host.fire(null);
  expect(fullscreen.active.value).toBe(false);
  scope.stop();
});

test("unmounting while the target is fullscreen leaves fullscreen", () => {
  const { host, fullscreen, stop } = harness();
  host.fire(host.root);
  expect(fullscreen.active.value).toBe(true);
  stop();
  expect(host.exits()).toBe(1);
});

test("unmounting while nothing is fullscreen leaves nothing", () => {
  const { host, stop } = harness();
  stop();
  expect(host.exits()).toBe(0);
});

test("refusalOf maps a lost activation and an unknown failure to refused", () => {
  expect(refusalOf(new DOMException("denied", "NotAllowedError"))).toBe("refused");
  expect(refusalOf(new DOMException("blocked", "SecurityError"))).toBe("refused");
  expect(refusalOf(new TypeError("API can only be initiated by a user gesture."))).toBe("refused");
  expect(refusalOf(new Error("who knows"))).toBe("refused");
  expect(refusalOf("denied")).toBe("refused");
  expect(refusalOf(new DOMException("no", "NotSupportedError"))).toBe("unsupported");
});
