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

const genesis = (roles: readonly string[] = ROLES): G54State =>
  g54.genesis({ roles: [...roles] as G54State["roles"] }, makeRoster(SEATS), makeRandom(SEED))

const nameOf = (seat: SeatId): string =>
  ({ [ANN]: "Ada", [BOB]: "Bo", [CARA]: "Cy" })[seat] ?? seat

/** Fold one frame carrying the given seat reports; missing seats simply do not report. */
const fold = (state: G54State, ...reports: readonly (readonly [SeatId, G54Action])[]): G54State => {
  const frame: Frame<G54Action> = {
    index: frameIndex(0),
    seed: SEED,
    inputs: reports.map(([seat, action]) => [seat, act<G54Action>(action)] as const),
  }
  return g54.step(state, frame, makeRandom(SEED))
}

const project = (state: G54State, seat: SeatId): G54View => g54.project(state, seat)

const withCoins = (state: G54State, seat: SeatId, coins: number): G54State => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, coins } : player)),
})

const richView = (): G54View => {
  const state = genesis()
  const rich: G54State = {
    ...state,
    players: state.players.map((player) =>
      player.seat === ANN ? { ...player, coins: FORCED_COUP_COINS } : player,
    ),
  }
  return project(rich, ANN)
}

const optionOf = (options: readonly MenuOption[], id: string): MenuOption => {
  const option = options.find((candidate) => candidate.id === id)
  if (option === undefined) throw new Error(`no option ${id}`)
  return option
}

const targetOption = (
  menu: ReturnType<typeof menuOf>,
  id: string,
): Extract<MenuOption, { kind: "target" }> => {
  const option = optionOf(menu!.options, id)
  if (option.kind !== "target") throw new Error(`option ${id} is not a target option`)
  return option
}

test("the turn menu lists the general actions and the non-reactive role claims", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, nameOf)
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
  const menu = menuOf(project(genesis(), ANN), ANN, nameOf)!
  const politician = targetOption(menu, "claim-politician")
  expect(politician.choices.map((choice) => choice.seat)).toEqual([BOB, CARA])
  expect(politician.choices.map((choice) => choice.name)).toEqual(["Bo", "Cy"])
  expect(politician.action(BOB)).toEqual({ t: "claim", role: "politician", target: BOB })
})

test("a plain role claim builds a targetless claim", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, nameOf)!
  const banker = optionOf(menu.options, "claim-banker")
  expect(banker.kind).toBe("plain")
  if (banker.kind !== "plain") throw new Error("expected a plain option")
  expect(banker.action()).toEqual({ t: "claim", role: "banker", target: null })
})

test("a claim the viewer cannot afford is disabled with a reason", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, nameOf)!
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
  const projected = project(genesis(), ANN)
  expect(projected.owedSeats).toEqual([ANN])
  expect(menuOf(projected, BOB, nameOf)).toBeNull()
})

test("a purpose with no handler yet gets no menu", () => {
  const claimed = fold(genesis(["banker", "writer", "guerrilla", "politician", "peacekeeper"]), [
    ANN,
    { t: "claim", role: "writer", target: null },
  ])
  const resolved = fold(
    claimed,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("writer-draw")
  expect(projected.owedSeats).toContain(ANN)
  expect(menuOf(projected, ANN, nameOf)).toBeNull()
})

test("a general claim excludes the Peacekeeper but a Coup keeps it", () => {
  const state = genesis()
  const withPeacekeeper: G54State = { ...state, peacekeeping: CARA }
  const menu = menuOf(project(withPeacekeeper, ANN), ANN, nameOf)!
  expect(targetOption(menu, "claim-politician").choices.map((c) => c.seat)).toEqual([BOB])
  expect(targetOption(menu, "coup").choices.map((c) => c.seat)).toEqual([BOB, CARA])
})

test("a Treaty ally is excluded from both a general claim and a Coup", () => {
  const state = genesis()
  const allied: G54State = { ...state, treaty: [ANN, BOB] }
  const menu = menuOf(project(allied, ANN), ANN, nameOf)!
  expect(targetOption(menu, "claim-politician").choices.map((c) => c.seat)).toEqual([CARA])
  expect(targetOption(menu, "coup").choices.map((c) => c.seat)).toEqual([CARA])
})

test("a target role prices each target by its lives, not the flat cost", () => {
  const state = genesis(["banker", "director", "paramilitary", "politician", "peacekeeper"])
  const shaped: G54State = {
    ...state,
    players: state.players.map((player) =>
      player.seat === ANN
        ? { ...player, coins: 4 }
        : player.seat === BOB
          ? { ...player, hand: player.hand.slice(0, 1) }
          : player,
    ),
  }
  const menu = menuOf(project(shaped, ANN), ANN, nameOf)!
  const paramilitary = targetOption(menu, "claim-paramilitary")
  expect(paramilitary.detail).toBe("Costs 3–5")
  const bob = paramilitary.choices.find((choice) => choice.seat === BOB)!
  const cara = paramilitary.choices.find((choice) => choice.seat === CARA)!
  expect(bob.enabled).toBe(false)
  expect(cara.enabled).toBe(true)
  expect(paramilitary.enabled).toBe(true)
})

test("challenge-claim offers Challenge and Pass to every alive seat", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const projected = project(claimed, ANN)
  expect(projected.window?.purpose).toBe("challenge-claim")
  const menu = menuOf(projected, ANN, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["challenge", "pass"])
  const challenge = optionOf(menu.options, "challenge")
  if (challenge.kind !== "plain") throw new Error("expected a plain option")
  expect(challenge.action()).toEqual({ t: "challenge" })
  expect(optionOf(menu.options, "pass").enabled).toBe(true)
})

test("challenge-block offers Challenge and Pass to the seats that may challenge a block", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "politician", target: BOB }])
  const survived = fold(
    claimed,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  const blocked = fold(survived, [BOB, { t: "block", role: "politician" }])
  const projected = project(blocked, ANN)
  expect(projected.window?.purpose).toBe("challenge-block")
  expect(projected.owedSeats).toEqual([ANN, BOB, CARA])
  const menu = menuOf(projected, ANN, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["challenge", "pass"])
  expect(menuOf(projected, BOB, nameOf)?.options.map((option) => option.id)).toEqual([
    "challenge",
    "pass",
  ])
})

test("proof-claim disables Show when the viewer does not hold the claimed card", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const challenged = fold(claimed, [BOB, { t: "challenge" }])
  const projected = project(challenged, ANN)
  expect(projected.window?.purpose).toBe("proof-claim")
  const menu = menuOf(projected, ANN, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["show", "concede"])
  const show = optionOf(menu.options, "show")
  expect(show.enabled).toBe(false)
  expect(show.reason).toBe("You do not hold Banker")
  expect(optionOf(menu.options, "concede").enabled).toBe(true)
})

test("proof-claim enables Show when the viewer holds the claimed card", () => {
  const claimed = fold(withCoins(genesis(), ANN, 4), [
    ANN,
    { t: "claim", role: "guerrilla", target: BOB },
  ])
  const challenged = fold(claimed, [BOB, { t: "challenge" }])
  const projected = project(challenged, ANN)
  expect(projected.window?.purpose).toBe("proof-claim")
  expect(projected.myHand).toContain("guerrilla")
  const show = optionOf(menuOf(projected, ANN, nameOf)!.options, "show")
  expect(show.enabled).toBe(true)
  expect(show.reason).toBeNull()
})

test("proof-block derives the block role and disables Show when it is not held", () => {
  const claimed = fold(withCoins(genesis(), ANN, 4), [
    ANN,
    { t: "claim", role: "guerrilla", target: BOB },
  ])
  const survived = fold(
    claimed,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  const blocked = fold(survived, [BOB, { t: "block", role: "guerrilla" }])
  const challenged = fold(blocked, [ANN, { t: "challenge" }], [CARA, { t: "pass" }])
  const projected = project(challenged, BOB)
  expect(projected.window?.purpose).toBe("proof-block")
  expect(projected.myHand).not.toContain("guerrilla")
  const show = optionOf(menuOf(projected, BOB, nameOf)!.options, "show")
  expect(show.enabled).toBe(false)
  expect(show.reason).toBe("You do not hold Guerrilla")
})

test("proof-block enables Show when the blocker holds the block card", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "politician", target: BOB }])
  const survived = fold(
    claimed,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  const blocked = fold(survived, [BOB, { t: "block", role: "politician" }])
  const challenged = fold(blocked, [ANN, { t: "challenge" }], [CARA, { t: "pass" }])
  const projected = project(challenged, BOB)
  expect(projected.window?.purpose).toBe("proof-block")
  expect(projected.myHand).toContain("politician")
  expect(optionOf(menuOf(projected, BOB, nameOf)!.options, "show").enabled).toBe(true)
})

test("block offers a block with the claim's block role, plus Pass", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "politician", target: BOB }])
  const survived = fold(
    claimed,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  const projected = project(survived, BOB)
  expect(projected.window?.purpose).toBe("block")
  const menu = menuOf(projected, BOB, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["block", "pass"])
  const block = optionOf(menu.options, "block")
  if (block.kind !== "plain") throw new Error("expected a plain option")
  expect(block.label).toBe("Block with Politician")
  expect(block.action()).toEqual({ t: "block", role: "politician" })
})

test("a seat the open proof or block window does not owe gets no menu", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const challenged = fold(claimed, [BOB, { t: "challenge" }])
  const proof = project(challenged, ANN)
  expect(proof.owedSeats).toEqual([ANN])
  expect(menuOf(proof, BOB, nameOf)).toBeNull()

  const claimedTarget = fold(genesis(), [ANN, { t: "claim", role: "politician", target: BOB }])
  const survived = fold(
    claimedTarget,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  const block = project(survived, BOB)
  expect(block.owedSeats).toEqual([BOB])
  expect(menuOf(block, ANN, nameOf)).toBeNull()
})

/** Fold a Guerrilla hit on BOB through the challenge and block windows to his reveal. */
const toReveal = (): G54State => {
  const claimed = fold(withCoins(genesis(), ANN, 4), [
    ANN,
    { t: "claim", role: "guerrilla", target: BOB },
  ])
  const survived = fold(
    claimed,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  return fold(survived, [BOB, { t: "pass" }])
}

test("reveal offers one choice per hand card and builds a reveal action", () => {
  const projected = project(toReveal(), BOB)
  expect(projected.window?.purpose).toBe("reveal")
  expect(projected.owedSeats).toEqual([BOB])
  const menu = menuOf(projected, BOB, nameOf)!
  const option = optionOf(menu.options, "reveal")
  expect(option.kind).toBe("card")
  if (option.kind !== "card") throw new Error("expected a card option")
  expect(option.choices.map((choice) => choice.index)).toEqual(
    projected.myHand.map((_, index) => index),
  )
  expect(option.choices.map((choice) => choice.role)).toEqual([...projected.myHand])
  expect(option.action(1)).toEqual({ t: "reveal", index: 1 })
})

test("a seat the reveal window does not owe gets no menu", () => {
  const projected = project(toReveal(), BOB)
  expect(menuOf(projected, ANN, nameOf)).toBeNull()
})

test("keep offers the combined hand and draw pool and builds a keep action", () => {
  const claimed = fold(genesis(["banker", "director", "guerrilla", "politician", "peacekeeper"]), [
    ANN,
    { t: "claim", role: "director", target: null },
  ])
  const resolved = fold(
    claimed,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("keep")
  expect(projected.myDraw).not.toBeNull()
  const menu = menuOf(projected, ANN, nameOf)!
  const option = optionOf(menu.options, "keep")
  expect(option.kind).toBe("cards")
  if (option.kind !== "cards") throw new Error("expected a cards option")
  const combined = [...projected.myHand, ...(projected.myDraw ?? [])]
  expect(option.choices.map((choice) => choice.role)).toEqual(combined)
  expect(option.count).toBe(projected.myHand.length)
  expect(option.action([0, 1])).toEqual({ t: "keep", indices: [0, 1] })
})

test("an extra claim's proof window derives the extra's role, not the main claim", () => {
  const roles = ["banker", "director", "guerrilla", "intellectual", "politician"]
  let state = withCoins(genesis(roles), ANN, 4)
  state = fold(state, [ANN, { t: "claim", role: "guerrilla", target: BOB }])
  state = fold(state, [ANN, { t: "pass" }], [BOB, { t: "pass" }], [CARA, { t: "pass" }])
  state = fold(state, [BOB, { t: "pass" }])
  state = fold(state, [BOB, { t: "reveal", index: 0 }])
  state = fold(state, [BOB, { t: "claim", role: "intellectual", target: null }])
  state = fold(state, [CARA, { t: "challenge" }])
  const projected = project(state, BOB)
  expect(projected.window?.purpose).toBe("proof-claim")
  // The main claim is still the Guerrilla; the reactive extra is the active claim.
  expect(projected.pending?.role).toBe("intellectual")
  const show = optionOf(menuOf(projected, BOB, nameOf)!.options, "show")
  expect(show.detail).toBe("Intellectual")
})

test("a resigned rival is excluded from every target picker", () => {
  const resigned: G54State = { ...genesis(), resigned: [BOB] }
  const menu = menuOf(project(resigned, ANN), ANN, nameOf)!
  expect(targetOption(menu, "claim-politician").choices.map((choice) => choice.seat)).toEqual([
    CARA,
  ])
  expect(targetOption(menu, "coup").choices.map((choice) => choice.seat)).toEqual([CARA])
})
