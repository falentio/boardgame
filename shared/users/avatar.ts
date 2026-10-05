export const DEFAULT_AVATAR_BASE = "https://api.dicebear.com/10.x/clay/svg";

const FALLBACK_SEED = "anonymous";

/**
 * The seed must be non-empty, or dicebear renders a shared default rather than
 * an identity-derived avatar.
 */
export function defaultAvatarUrl(userId: string): string {
  const trimmed = userId.trim();
  const seed = trimmed.length > 0 ? trimmed : FALLBACK_SEED;
  return `${DEFAULT_AVATAR_BASE}?seed=${encodeURIComponent(seed)}`;
}

export function resolveUserImage(
  provided: string | null | undefined,
  userId: string,
): string {
  return typeof provided === "string" && provided.trim().length > 0
    ? provided
    : defaultAvatarUrl(userId);
}
