import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from "vue";

/** What this document can do about element fullscreen. `none` is iPhone Safari, today. */
export type FullscreenSupport = "element" | "none";

export type EnterOutcome = "entered" | "refused" | "unsupported";

/** How long a request may hang before the retry control is free again. */
export const REQUEST_DEADLINE_MS = 1500;

export interface FullscreenHost {
  supported(target: Element): boolean;
  request(target: Element): Promise<void>;
  exit(): Promise<void>;
  /** Read live, never cached. */
  element(): Element | null;
  /** fullscreenchange, both prefixes; returns its own unsubscribe. */
  subscribe(listener: (element: Element | null) => void): () => void;
}

export interface Fullscreen {
  readonly support: Ref<FullscreenSupport>;
  /** The live fullscreen element. Written only by the fullscreenchange subscription. */
  readonly element: ShallowRef<Element | null>;
  readonly active: ComputedRef<boolean>;
  enter(): Promise<EnterOutcome>;
  exit(): Promise<void>;
}

export interface UseFullscreenOptions {
  readonly target: Readonly<Ref<Element | null>>;
  readonly host?: FullscreenHost;
}

type FullscreenElement = Element & {
  requestFullscreen?: Element["requestFullscreen"];
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

const prefixed = (doc: Document): FullscreenDocument => doc as FullscreenDocument;

/**
 * `NotSupportedError` is the browser saying it cannot do this at all. Everything else
 * it declines with is a refusal, a `TypeError` from a lost user activation included.
 */
export const refusalOf = (error: unknown): EnterOutcome =>
  error instanceof DOMException && error.name === "NotSupportedError" ? "unsupported" : "refused";

export const domFullscreenHost = (doc: Document = document): FullscreenHost => {
  const vendor = prefixed(doc);
  const requestOf = (target: Element): (() => Promise<void> | void) | undefined => {
    const element = target as FullscreenElement;
    const call = element.requestFullscreen ?? element.webkitRequestFullscreen;
    return call === undefined ? undefined : () => call.call(target);
  };
  const fullscreenElement = (): Element | null =>
    doc.fullscreenElement ?? vendor.webkitFullscreenElement ?? null;
  return {
    supported: (target) =>
      requestOf(target) !== undefined &&
      (doc.fullscreenEnabled ?? vendor.webkitFullscreenEnabled) !== false,
    request: async (target) => {
      const call = requestOf(target);
      if (call === undefined) {
        throw new DOMException("element fullscreen is unavailable", "NotSupportedError");
      }
      await call();
    },
    exit: async () => {
      const call = doc.exitFullscreen ?? vendor.webkitExitFullscreen;
      if (call === undefined) return;
      await call.call(doc);
    },
    element: fullscreenElement,
    subscribe: (listener) => {
      const read = (): void => listener(fullscreenElement());
      doc.addEventListener("fullscreenchange", read);
      doc.addEventListener("webkitfullscreenchange", read);
      return () => {
        doc.removeEventListener("fullscreenchange", read);
        doc.removeEventListener("webkitfullscreenchange", read);
      };
    },
  };
};

const unsupportedHost: FullscreenHost = {
  supported: () => false,
  request: () => Promise.resolve(),
  exit: () => Promise.resolve(),
  element: () => null,
  subscribe: () => () => {},
};

export const useFullscreen = (options: UseFullscreenOptions): Fullscreen => {
  const host = options.host ?? (import.meta.client ? domFullscreenHost() : unsupportedHost);
  const support = ref<FullscreenSupport>("element");
  const element = shallowRef<Element | null>(null);
  const active = computed(() => element.value !== null && element.value === options.target.value);
  let inflight: Promise<EnterOutcome> | null = null;
  let attemptId = 0;
  let deadline: ReturnType<typeof setTimeout> | null = null;

  element.value = host.element();
  watch(
    options.target,
    (target) => {
      if (target !== null) support.value = host.supported(target) ? "element" : "none";
    },
    { immediate: true },
  );
  onScopeDispose(
    host.subscribe((current) => {
      element.value = current;
    }),
  );

  const settle = (id: number): void => {
    if (id !== attemptId) return;
    inflight = null;
    if (deadline !== null) {
      clearTimeout(deadline);
      deadline = null;
    }
  };

  const enter = (): Promise<EnterOutcome> => {
    if (inflight !== null) return inflight;
    const target = options.target.value;
    if (target === null || !host.supported(target)) return Promise.resolve("unsupported");
    const id = ++attemptId;
    const attempt = (async (): Promise<EnterOutcome> => {
      try {
        await host.request(target);
        return "entered";
      } catch (error) {
        return refusalOf(error);
      } finally {
        settle(id);
      }
    })();
    inflight = attempt;
    // A browser that never settles the request must not latch the retry control off.
    deadline = setTimeout(() => {
      settle(id);
    }, REQUEST_DEADLINE_MS);
    return attempt;
  };

  const exit = async (): Promise<void> => {
    if (host.element() === null) return;
    try {
      await host.exit();
    } catch {
      // The DOM stays the source of truth, so a refused exit leaves the state to fullscreenchange.
    }
  };

  onScopeDispose(() => {
    if (active.value) void exit();
  });

  return { support, element, active, enter, exit };
};
