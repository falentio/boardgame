/**
 * Up to two initials from a display name or address. Reads the first and last
 * word so "Ana Maria Silva" yields "AS". Returns "?" when there is nothing.
 */
export function initialsOf(source: string | null | undefined): string {
  const parts = (source ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}
