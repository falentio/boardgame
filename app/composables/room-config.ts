import type { RoleSet } from "./roles.ts"

/** A validated create request: the object the confirm dialog renders and the page sends. */
export interface CreateRoomConfig {
  readonly name: string
  readonly seats: number
  readonly roles: RoleSet
}
