import { expect, test } from "vitest"
import {
  act,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  type Frame,
} from "#shared/core/lockstep/index.ts"
import {
  g54,
  type G54Action,
  type G54State,
  type G54View,
} from "#shared/core/lockstep/games/g54/index.ts"
import { FORCED_COUP_COINS } from "#shared/core/lockstep/games/g54/windows.ts"
import { seatId, type SeatId } from "#shared/rooms/ids.ts"
import { menuOf, type MenuOption } from "../window-menu.ts"

const ANN = seatId("ann")
const BOB = seatId("bob")
const CARA = seatId("cara")
const SEATS = [ANN, BOB, CARA]
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"] as const
const SEED = genesisSeed("window-menu-tests")

const genesis = () =>
  g54.genesis({ roles: [...ROLES] }, makeRoster(SEATS), makeRandom(SEED))

const nameOf = (seat: SeatId): string =>
  ({ [ANN]: "Ada", [BOB]: "Bo", [CARA]: "Cy" })[seat] ?? seat

const richView = (): G54View => {
  const state = genesis()
  const rich: G54State = {
    ...state,
    players: state.players.map((player) =>
      player.seat === ANN ? { ...player, coins: FORCED_COUP_COINS } : player,
    ),
  }
  return g54.project(rich, ANN)
}

const optionOf = (options: readonly MenuOption[], id: string): MenuOption => {
  const option = options.find((candidate) => candidate.id === id)
  if (option === undefined) throw new Error(`no option ${id}`)
  return option
}

test("the turn menu lists the general actions and the non-reactive role claims", () => {
  const menu = menuOf(g54.project(genesis(), ANN), ANN, nameOf)
  expect(menu).not.toBeNull()
  const ids = menu!.options.map((option) => option.id)
  expect(ids).toEqual([
    "income",
    "coup",
    "claim-banker",
    "claim-director",
    "claim-guerrilla",
    "claim-politician",
    "claim-peacekeeper",
  ])
})

test("a target role carries a seat picker whose action builds a targeted claim", () => {
  const menu = menuOf(g54.project(genesis(), ANN), ANN, nameOf)!
  const politician = optionOf(menu.options, "claim-politician")
  expect(politician.kind).toBe("target")
  if (politician.kind !== "target") throw new Error("expected a target option")
  expect(politician.choices.map((choice) => choice.seat)).toEqual([BOB, CARA])
  expect(politician.choices.map((choice) => choice.name)).toEqual(["Bo", "Cy"])
  expect(politician.action(BOB)).toEqual({ t: "claim", role: "politician", target: BOB })
})

test("a plain role claim builds a targetless claim", () => {
  const menu = menuOf(g54.project(genesis(), ANN), ANN, nameOf)!
  const banker = optionOf(menu.options, "claim-banker")
  expect(banker.kind).toBe("plain")
  if (banker.kind !== "plain") throw new Error("expected a plain option")
  expect(banker.action()).toEqual({ t: "claim", role: "banker", target: null })
})

test("a claim the viewer cannot afford is disabled with a reason", () => {
  const menu = menuOf(g54.project(genesis(), ANN), ANN, nameOf)!
  const guerrilla = optionOf(menu.options, "claim-guerrilla")
  expect(guerrilla.enabled).toBe(false)
  expect(guerrilla.reason).not.toBeNull()
})

test("the forced-Coup mirror disables every non-Coup option", () => {
  const menu = menuOf(richView(), ANN, nameOf)!
  const coup = optionOf(menu.options, "coup")
  expect(coup.enabled).toBe(true)
  for (const option of menu.options) {
    if (option.id === "coup") continue
    expect(option.enabled).toBe(false)
    expect(option.reason).not.toBeNull()
  }
  expect(menu.note).not.toBeNull()
})

test("a seat the open window does not owe gets no menu", () => {
  const projected = g54.project(genesis(), ANN)
  expect(projected.owedSeats).toEqual([ANN])
  expect(menuOf(projected, BOB, nameOf)).toBeNull()
})

test("a purpose with no handler yet gets no menu", () => {
  const frame: Frame<G54Action> = {
    index: frameIndex(0),
    seed: SEED,
    inputs: [[ANN, act<G54Action>({ t: "claim", role: "banker", target: null })]],
  }
  const projected = g54.project(g54.step(genesis(), frame, makeRandom(SEED)), ANN)
  expect(projected.window?.purpose).toBe("challenge-claim")
  expect(projected.owedSeats).toContain(ANN)
  expect(menuOf(projected, ANN, nameOf)).toBeNull()
})
