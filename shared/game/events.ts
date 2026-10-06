import { asJson, type Json } from "../core/lockstep/json.ts";
import { parseRoomCode } from "../rooms/code.ts";
import { roomCode, type RoomCode } from "../rooms/ids.ts";

export const PROTOCOL_VERSION = 1;
export const GAME_EVENT = "game";
export const GAME_CHANNEL_PREFIX = "private-game-";

export const gameChannel = (code: RoomCode): `private-game-${string}` =>
  `${GAME_CHANNEL_PREFIX}${code}`;

export const parseGameChannel = (channel: string): RoomCode | null => {
  if (!channel.startsWith(GAME_CHANNEL_PREFIX)) return null;
  const code = parseRoomCode(channel.slice(GAME_CHANNEL_PREFIX.length));
  return code === null ? null : roomCode(code);
};

export interface GameEnvelope {
  readonly v: number;
  readonly body: Json;
}

export type EnvelopeRead =
  | { readonly kind: "ok"; readonly body: Json }
  | { readonly kind: "stale"; readonly seen: number }
  | { readonly kind: "malformed" };

export const encodeEnvelope = (body: Json): GameEnvelope => ({ v: PROTOCOL_VERSION, body });

export const parseEnvelope = (data: unknown): EnvelopeRead => {
  let json: Json;
  try {
    json = asJson(data);
  } catch {
    return { kind: "malformed" };
  }
  if (!isJsonObject(json)) return { kind: "malformed" };
  const v = json["v"];
  if (typeof v !== "number" || !Number.isInteger(v)) return { kind: "malformed" };
  if (v !== PROTOCOL_VERSION) return { kind: "stale", seen: v };
  const body = json["body"];
  return body === undefined ? { kind: "malformed" } : { kind: "ok", body };
};

const isJsonObject = (value: Json): value is { readonly [key: string]: Json } =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export interface GameEvents {
  published(code: RoomCode, envelope: GameEnvelope): Promise<void>;
}
