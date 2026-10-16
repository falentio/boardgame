import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import type { Fullscreen } from "./fullscreen.ts";

export type SurfacePhase = "gate" | "play";

/** What the surface says when the browser declined the request. */
export const REFUSAL_NOTICE = "Fullscreen was refused — the game is running in the window";

export interface Surface {
  /** False when this browser has no element fullscreen, so the gate can say so before the tap. */
  readonly canEnter: ComputedRef<boolean>;
  /** Reveals the surface, then asks the browser. The reveal never waits on the answer. */
  enter(): void;
  /** Returns to the gate, leaving fullscreen when we hold it. */
  leave(): void;
  readonly notice: Ref<string | null>;
  /** Tries fullscreen again, without touching the phase. */
  retry(): void;
}

export const openSurface = (input: {
  readonly phase: Ref<SurfacePhase>;
  readonly fullscreen: Fullscreen;
}): Surface => {
  const { phase, fullscreen } = input;
  const notice = ref<string | null>(null);

  const attempt = (): void => {
    notice.value = null;
    void fullscreen.enter().then((outcome) => {
      notice.value = outcome === "refused" ? REFUSAL_NOTICE : null;
    });
  };

  const enter = (): void => {
    // The phase flips, and the request follows it, before anything awaits: the
    // request must ride the activation this tap granted, and a browser that
    // never answers must not hold the surface back.
    phase.value = "play";
    attempt();
  };

  const leave = (): void => {
    phase.value = "gate";
    if (fullscreen.active.value) void fullscreen.exit();
  };

  watch(fullscreen.active, (active) => {
    if (!active) phase.value = "gate";
  });

  return {
    canEnter: computed(() => fullscreen.support.value === "element"),
    enter,
    leave,
    notice,
    retry: attempt,
  };
};
