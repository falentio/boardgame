import { parseJoinInput } from "#shared/rooms/link.ts";
import type { RoomCode } from "#shared/rooms/ids.ts";

export type ScanState =
  | { readonly kind: "idle" }
  | { readonly kind: "starting" }
  | { readonly kind: "scanning" }
  | { readonly kind: "decoded"; readonly code: RoomCode }
  | { readonly kind: "unrecognized"; readonly text: string }
  | { readonly kind: "denied" }
  | { readonly kind: "no-camera" }
  | { readonly kind: "insecure" }
  | { readonly kind: "failed"; readonly reason: string };

export type ScanEvent =
  | { readonly kind: "start" }
  | { readonly kind: "started" }
  | { readonly kind: "frame"; readonly text: string }
  | { readonly kind: "denied" }
  | { readonly kind: "no-camera" }
  | { readonly kind: "insecure" }
  | { readonly kind: "failed"; readonly reason: string }
  | { readonly kind: "reset" };

const live = (kind: ScanState["kind"]): boolean =>
  kind === "starting" || kind === "scanning" || kind === "unrecognized";

/** Pure reducer. Idempotent: start on a live session and reset on idle are no-ops.
 *  decoded is terminal, so a late frame cannot fire a second navigation. */
export const scanNext = (state: ScanState, event: ScanEvent): ScanState => {
  if (event.kind === "reset") return state.kind === "idle" ? state : { kind: "idle" };
  if (state.kind === "decoded") return state;
  switch (event.kind) {
    case "start":
      return live(state.kind) ? state : { kind: "starting" };
    case "started":
      return state.kind === "starting" ? { kind: "scanning" } : state;
    case "frame": {
      if (state.kind !== "scanning" && state.kind !== "unrecognized") return state;
      const code = parseJoinInput(event.text);
      return code === null ? { kind: "unrecognized", text: event.text } : { kind: "decoded", code };
    }
    case "denied":
      return { kind: "denied" };
    case "no-camera":
      return { kind: "no-camera" };
    case "insecure":
      return { kind: "insecure" };
    case "failed":
      return { kind: "failed", reason: event.reason };
  }
};

export type CameraFault = "denied" | "no-camera" | "failed";

const nameOf = (error: unknown): string => {
  if (typeof error !== "object" || error === null || !("name" in error)) return "";
  const name: unknown = error.name;
  return typeof name === "string" ? name : "";
};

const messageOf = (error: unknown): string => {
  if (typeof error === "string" && error !== "") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message: unknown = error.message;
    if (typeof message === "string" && message !== "") return message;
  }
  return "the camera could not start";
};

/** Pure. Maps a getUserMedia / qr-scanner rejection to a fault. DOMException names
 *  are the boundary's contract; the app only sees CameraFault. */
export const classifyCameraError = (error: unknown): { fault: CameraFault; reason: string } => {
  switch (nameOf(error)) {
    case "NotAllowedError":
    case "SecurityError":
      return { fault: "denied", reason: "camera access was denied" };
    case "NotFoundError":
      return { fault: "no-camera", reason: "no camera is available" };
    default:
      return { fault: "failed", reason: messageOf(error) };
  }
};
