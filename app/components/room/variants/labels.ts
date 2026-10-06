import type { SeatRow } from "@/composables/room-domain.ts"

export const labelOf = (seat: SeatRow): string => {
  if (seat.occupant === null) return "Open"
  if (seat.isMe) return "You"
  if (seat.isHost) return "Host"
  return "Player"
}

export const initialsOf = (name: string | null): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (first + last).toUpperCase()
}
