import { parseRoomCode } from "./code.ts";
import type { RoomCode } from "./ids.ts";

/** The one place that knows the join route's shape. */
export const joinPath = (code: RoomCode): string => `/join/${code}`;

/** Full shareable URL. origin has no trailing slash, as new URL(...).origin. */
export const joinUrl = (origin: string, code: RoomCode): string => `${origin}${joinPath(code)}`;

const JOIN_PATH = /^\/join\/([^/]+)\/?$/;

/**
 * The inverse of joinUrl and the parser for every untrusted join string: a typed
 * code, a pasted link, or a decoded QR payload. Accepts a bare code (any case,
 * surrounding space) or a URL / site-relative path whose pathname is /join/<CODE>.
 * The origin is not checked: callers only ever navigate to joinPath(code) built
 * from this result, so a hostile URL can at worst name a room that does not exist.
 */
export const parseJoinInput = (raw: string): RoomCode | null => {
  const asCode = parseRoomCode(raw);
  if (asCode !== null) return asCode;
  let pathname: string;
  try {
    pathname = new URL(raw.trim(), "http://join.invalid").pathname;
  } catch {
    return null;
  }
  const match = JOIN_PATH.exec(pathname);
  return match === null ? null : parseRoomCode(match[1]!);
};
