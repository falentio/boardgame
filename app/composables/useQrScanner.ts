import { ref, shallowRef, onUnmounted, type Ref } from "vue";
import { classifyCameraError, scanNext, type ScanEvent, type ScanState } from "./scan-session";

/** The qr-scanner surface this adapter drives, named structurally so the only
 *  mention of the package is the client-only dynamic import inside start(). */
interface Scanner {
  start: () => Promise<void>;
  destroy: () => void;
}

export interface UseQrScanner {
  video: Ref<HTMLVideoElement | null>;
  state: Readonly<Ref<ScanState>>;
  start: () => Promise<void>;
  stop: () => void;
}

export const useQrScanner = (): UseQrScanner => {
  const video = ref<HTMLVideoElement | null>(null);
  const state = shallowRef<ScanState>({ kind: "idle" });
  let scanner: Scanner | null = null;
  let stream: MediaStream | null = null;
  let starting = false;
  // stop() during start()'s awaits must release the camera the awaits later open.
  let generation = 0;

  const dispatch = (event: ScanEvent): void => {
    state.value = scanNext(state.value, event);
  };

  const stop = (): void => {
    generation += 1;
    if (scanner !== null) {
      scanner.destroy();
      scanner = null;
    }
    if (stream !== null) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    if (video.value !== null) video.value.srcObject = null;
    starting = false;
    dispatch({ kind: "reset" });
  };

  const start = async (): Promise<void> => {
    if (starting || scanner !== null) return;
    const target = video.value;
    if (target === null) {
      dispatch({ kind: "failed", reason: "the video element is not ready" });
      return;
    }
    if (!window.isSecureContext) {
      dispatch({ kind: "insecure" });
      return;
    }
    if (!navigator.mediaDevices) {
      dispatch({ kind: "no-camera" });
      return;
    }
    dispatch({ kind: "start" });
    starting = true;
    const mine = ++generation;
    let created: Scanner | null = null;
    try {
      // Acquire the stream here, not inside qr-scanner: its own getUserMedia swallows every
      // failure into "Camera not found.", so a denied permission would read as no camera.
      const acquired = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      if (mine !== generation) {
        for (const track of acquired.getTracks()) track.stop();
        return;
      }
      stream = acquired;
      target.srcObject = acquired;
      const { default: Scanner } = await import("qr-scanner");
      if (mine !== generation) return;
      created = new Scanner(
        target,
        (result) => dispatch({ kind: "frame", text: result.data }),
        { onDecodeError: () => {}, highlightScanRegion: true, highlightCodeOutline: true },
      );
      scanner = created;
      await created.start();
      if (mine !== generation || scanner !== created) {
        if (scanner === created) scanner = null;
        created.destroy();
        return;
      }
      dispatch({ kind: "started" });
    } catch (error) {
      if (created !== null) {
        if (scanner === created) scanner = null;
        created.destroy();
      }
      if (mine === generation) {
        const { fault, reason } = classifyCameraError(error);
        if (fault === "denied") dispatch({ kind: "denied" });
        else if (fault === "no-camera") dispatch({ kind: "no-camera" });
        else dispatch({ kind: "failed", reason });
      }
    } finally {
      if (mine === generation) starting = false;
    }
  };

  onUnmounted(stop);

  return { video, state, start, stop };
};
