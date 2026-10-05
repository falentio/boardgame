import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts";
import type { RoomCode } from "#shared/rooms/ids.ts";
import { parseRoom, roomErrorKind, type Room, type RoomLoad } from "./room-domain.ts";

export type CreateOutcome =
  | { kind: "created"; code: RoomCode }
  | { kind: "invalid" | "failed"; reason: string };

export type JoinOutcome =
  | { kind: "joined" }
  | { kind: "already-seated" }
  | { kind: "full" }
  | { kind: "missing" }
  | { kind: "failed"; reason: string };

const bodyOf = (error: unknown): Record<string, unknown> | null => {
  if (typeof error !== "object" || error === null) return null;
  const data = "data" in error ? error.data : undefined;
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
};

const errorReason = (error: unknown): string | null => {
  const body = bodyOf(error);
  const errorField = body !== null && "error" in body ? body.error : undefined;
  if (typeof errorField !== "object" || errorField === null) return null;
  const reason = "reason" in errorField ? errorField.reason : undefined;
  return typeof reason === "string" ? reason : null;
};

const statusOf = (error: unknown): number | null => {
  if (typeof error !== "object" || error === null) return null;
  const status = "status" in error ? error.status : undefined;
  if (typeof status === "number") return status;
  const statusCode = "statusCode" in error ? error.statusCode : undefined;
  return typeof statusCode === "number" ? statusCode : null;
};

const failureReason = (error: unknown): string => {
  const reason = errorReason(error);
  if (reason !== null) return reason;
  return error instanceof Error ? error.message : "Request failed";
};

const roomFrom = (data: unknown): Room | null => {
  if (typeof data !== "object" || data === null) return null;
  return "room" in data ? parseRoom(data.room) : null;
};

export const fetchRoom = async (code: RoomCode): Promise<RoomLoad> => {
  try {
    const data = await $fetch<unknown>(`/api/rooms/${code}`);
    const room = roomFrom(data);
    return room === null ? { kind: "failed", reason: "malformed room payload" } : { kind: "loaded", room };
  } catch (error) {
    if (statusOf(error) === 404) return { kind: "missing" };
    return { kind: "failed", reason: failureReason(error) };
  }
};

export const createRoom = async (input: {
  name: string;
  seats: number;
  roles: readonly RoleId[];
}): Promise<CreateOutcome> => {
  try {
    const data = await $fetch<unknown>("/api/rooms", {
      method: "POST",
      body: { name: input.name, seats: input.seats, roles: [...input.roles] },
    });
    const room = roomFrom(data);
    return room === null
      ? { kind: "failed", reason: "malformed room payload" }
      : { kind: "created", code: room.code };
  } catch (error) {
    const kind = roomErrorKind(error);
    const reason = failureReason(error);
    return kind !== null && kind.startsWith("invalid")
      ? { kind: "invalid", reason }
      : { kind: "failed", reason };
  }
};

export const joinRoom = async (code: RoomCode): Promise<JoinOutcome> => {
  try {
    await $fetch<unknown>(`/api/rooms/${code}/join`, { method: "POST" });
    return { kind: "joined" };
  } catch (error) {
    const kind = roomErrorKind(error);
    if (kind === "already-seated") return { kind: "already-seated" };
    if (kind === "room-full") return { kind: "full" };
    if (statusOf(error) === 404 || kind === "not-found") return { kind: "missing" };
    return { kind: "failed", reason: failureReason(error) };
  }
};
