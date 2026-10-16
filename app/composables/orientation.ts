import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from "vue";

export type SurfaceOrientation = "landscape" | "portrait";

/** The viewport's orientation. Injectable so a node test can flip it. */
export interface OrientationHost {
  portrait(): boolean;
  subscribe(listener: (portrait: boolean) => void): () => void;
}

export interface Orientation {
  readonly orientation: Ref<SurfaceOrientation>;
  readonly isPortrait: ComputedRef<boolean>;
}

/** The query room/HowToPlayDialog.vue already branches on, read from the viewport rather than the display. */
export const domOrientationHost = (view: Window = window): OrientationHost => {
  const query = view.matchMedia("(orientation: portrait)");
  return {
    portrait: () => query.matches,
    subscribe: (listener) => {
      const read = (event: MediaQueryListEvent): void => listener(event.matches);
      query.addEventListener("change", read);
      return () => {
        query.removeEventListener("change", read);
      };
    },
  };
};

export const useOrientation = (host?: OrientationHost): Orientation => {
  const orientation = ref<SurfaceOrientation>("landscape");
  if (host !== undefined || import.meta.client) {
    const source = host ?? domOrientationHost();
    orientation.value = source.portrait() ? "portrait" : "landscape";
    onScopeDispose(
      source.subscribe((portrait) => {
        orientation.value = portrait ? "portrait" : "landscape";
      }),
    );
  }
  return { orientation, isPortrait: computed(() => orientation.value === "portrait") };
};
