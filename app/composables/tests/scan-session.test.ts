import { expect, test } from "vitest";
import { roomCode } from "#shared/rooms/ids.ts";
import { classifyCameraError, scanNext, type ScanState } from "../scan-session.ts";

const CODE = roomCode("BAWOLUTI");
const idle: ScanState = { kind: "idle" };

test("walks idle to starting to scanning to decoded", () => {
  const starting = scanNext(idle, { kind: "start" });
  expect(starting).toEqual({ kind: "starting" });
  const scanning = scanNext(starting, { kind: "started" });
  expect(scanning).toEqual({ kind: "scanning" });
  expect(scanNext(scanning, { kind: "frame", text: "bawoluti" })).toEqual({
    kind: "decoded",
    code: CODE,
  });
});

test("reads a frame's join URL and reports a non-join frame as unrecognized", () => {
  const scanning: ScanState = { kind: "scanning" };
  expect(scanNext(scanning, { kind: "frame", text: "https://board.example/join/BAWOLUTI" })).toEqual({
    kind: "decoded",
    code: CODE,
  });
  expect(scanNext(scanning, { kind: "frame", text: "WIFI:S:home;P:hunter2;;" })).toEqual({
    kind: "unrecognized",
    text: "WIFI:S:home;P:hunter2;;",
  });
});

test("a later frame still decodes after an unrecognized one", () => {
  const unrecognized = scanNext({ kind: "scanning" }, { kind: "frame", text: "not a code" });
  expect(scanNext(unrecognized, { kind: "frame", text: "BAWOLUTI" })).toEqual({
    kind: "decoded",
    code: CODE,
  });
});

test("surfaces each camera fault as its own state", () => {
  expect(scanNext({ kind: "starting" }, { kind: "denied" })).toEqual({ kind: "denied" });
  expect(scanNext(idle, { kind: "no-camera" })).toEqual({ kind: "no-camera" });
  expect(scanNext(idle, { kind: "insecure" })).toEqual({ kind: "insecure" });
  expect(scanNext(idle, { kind: "failed", reason: "boom" })).toEqual({
    kind: "failed",
    reason: "boom",
  });
});

test("start on a live session and reset on idle are no-ops", () => {
  const scanning: ScanState = { kind: "scanning" };
  expect(scanNext(scanning, { kind: "start" })).toBe(scanning);
  expect(scanNext({ kind: "starting" }, { kind: "start" })).toEqual({ kind: "starting" });
  expect(scanNext(idle, { kind: "reset" })).toBe(idle);
});

test("reset returns every state to idle", () => {
  expect(scanNext({ kind: "scanning" }, { kind: "reset" })).toEqual({ kind: "idle" });
  expect(scanNext({ kind: "denied" }, { kind: "reset" })).toEqual({ kind: "idle" });
});

test("decoded is terminal, so a late frame cannot fire a second navigation", () => {
  const decoded: ScanState = { kind: "decoded", code: CODE };
  expect(scanNext(decoded, { kind: "frame", text: "WIFI:S:x;;" })).toBe(decoded);
  expect(scanNext(decoded, { kind: "start" })).toBe(decoded);
  expect(scanNext(decoded, { kind: "reset" })).toEqual({ kind: "idle" });
});

test("a frame before the scanner starts is ignored", () => {
  expect(scanNext(idle, { kind: "frame", text: "BAWOLUTI" })).toBe(idle);
  expect(scanNext({ kind: "starting" }, { kind: "frame", text: "BAWOLUTI" })).toEqual({
    kind: "starting",
  });
});

test("classifies a permission rejection as denied", () => {
  expect(classifyCameraError({ name: "NotAllowedError" }).fault).toBe("denied");
  expect(classifyCameraError({ name: "SecurityError" }).fault).toBe("denied");
});

test("classifies a missing device as no-camera", () => {
  expect(classifyCameraError({ name: "NotFoundError" }).fault).toBe("no-camera");
});

test("classifies an unknown error and a null as failed, carrying the message", () => {
  expect(classifyCameraError(new Error("boom"))).toEqual({ fault: "failed", reason: "boom" });
  expect(classifyCameraError(null)).toEqual({ fault: "failed", reason: "the camera could not start" });
});
