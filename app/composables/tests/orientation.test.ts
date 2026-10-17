import { expect, test } from "vitest";
import { effectScope } from "vue";
import { useOrientation, type OrientationHost } from "../orientation.ts";

const fakeHost = (portrait: boolean) => {
  const listeners = new Set<(portrait: boolean) => void>();
  return {
    host: {
      portrait: () => portrait,
      subscribe: (listener: (portrait: boolean) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    } satisfies OrientationHost,
    flip: (next: boolean) => {
      portrait = next;
      for (const listener of listeners) listener(next);
    },
    listeners: () => listeners.size,
  };
};

test("the orientation is read from the host when it is built", () => {
  const scope = effectScope();
  const tall = fakeHost(true);
  const portrait = scope.run(() => useOrientation(tall.host));
  expect(portrait?.orientation.value).toBe("portrait");
  expect(portrait?.isPortrait.value).toBe(true);
  scope.stop();

  const wide = fakeHost(false);
  const other = effectScope().run(() => useOrientation(wide.host));
  expect(other?.orientation.value).toBe("landscape");
  expect(other?.isPortrait.value).toBe(false);
});

test("a change flips the orientation without rebuilding it", () => {
  const host = fakeHost(false);
  const scope = effectScope();
  const orientation = scope.run(() => useOrientation(host.host));
  host.flip(true);
  expect(orientation?.orientation.value).toBe("portrait");
  expect(orientation?.isPortrait.value).toBe(true);
  host.flip(false);
  expect(orientation?.orientation.value).toBe("landscape");
  scope.stop();
});

test("disposing the scope unsubscribes from the host", () => {
  const host = fakeHost(false);
  const scope = effectScope();
  scope.run(() => useOrientation(host.host));
  expect(host.listeners()).toBe(1);
  scope.stop();
  expect(host.listeners()).toBe(0);
});

test("without a host and without a window the read is the landscape default", () => {
  const scope = effectScope();
  const orientation = scope.run(() => useOrientation());
  expect(orientation?.orientation.value).toBe("landscape");
  expect(orientation?.isPortrait.value).toBe(false);
  scope.stop();
});
