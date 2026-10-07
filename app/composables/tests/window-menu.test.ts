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
import { specOf, type RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import { FORCED_COUP_COINS } from "#shared/core/lockstep/games/g54/windows.ts"
import { seatId, type SeatId } from "#shared/rooms/ids.ts"
import { isTurnMenu, menuOf, type MenuOption } from "../window-menu.ts"

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

const withHand = (state: G54State, seat: SeatId, hand: readonly RoleId[]): G54State => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, hand } : player)),
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

const cardOption = (
  menu: ReturnType<typeof menuOf>,
  id: string,
): Extract<MenuOption, { kind: "card" }> => {
  const option = optionOf(menu!.options, id)
  if (option.kind !== "card") throw new Error(`option ${id} is not a card option`)
  return option
}

const roleOption = (
  menu: ReturnType<typeof menuOf>,
  id: string,
): Extract<MenuOption, { kind: "role" }> => {
  const option = optionOf(menu!.options, id)
  if (option.kind !== "role") throw new Error(`option ${id} is not a role option`)
  return option
}

const swapOption = (
  menu: ReturnType<typeof menuOf>,
  id: string,
): Extract<MenuOption, { kind: "swap" }> => {
  const option = optionOf(menu!.options, id)
  if (option.kind !== "swap") throw new Error(`option ${id} is not a swap option`)
  return option
}

const plainOption = (
  menu: ReturnType<typeof menuOf>,
  id: string,
): Extract<MenuOption, { kind: "plain" }> => {
  const option = optionOf(menu!.options, id)
  if (option.kind !== "plain") throw new Error(`option ${id} is not a plain option`)
  return option
}

/** Fold a challenge or block window with every seat passing. */
const allPass = (state: G54State): G54State =>
  fold(state, [ANN, { t: "pass" }], [BOB, { t: "pass" }], [CARA, { t: "pass" }])

/** Fold a claim through its challenge window with every seat passing. */
const claimSurvives = (state: G54State, claim: G54Action): G54State =>
  allPass(fold(state, [ANN, claim]))

/** A Guerrilla hit on BOB driven through the block and execution to his reactive window. */
const toReactive = (role: string): G54State => {
  const armed = withCoins(genesis(["banker", "director", "guerrilla", role, "politician"]), ANN, 4)
  const claimed = claimSurvives(armed, { t: "claim", role: "guerrilla", target: BOB })
  const blocked = fold(claimed, [BOB, { t: "pass" }])
  return fold(blocked, [BOB, { t: "reveal", index: 0 }])
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

test("turn options carry the card face that names the general action or the role", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, nameOf)!
  expect(plainOption(menu, "income").face).toEqual({ kind: "general", action: "income" })
  expect(targetOption(menu, "coup").face).toEqual({ kind: "general", action: "coup" })
  expect(plainOption(menu, "claim-banker").face).toEqual({ kind: "role", role: "banker" })
  expect(targetOption(menu, "claim-politician").face).toEqual({
    kind: "role",
    role: "politician",
  })
})

test("a non-turn window leaves every option face null", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const projected = project(claimed, BOB)
  expect(projected.window?.purpose).toBe("challenge-claim")
  const menu = menuOf(projected, BOB, nameOf)!
  for (const option of menu.options) {
    if (option.kind === "plain" || option.kind === "target") {
      expect(option.face).toBeNull()
    }
  }
})

test("isTurnMenu is true for the turn menu, whose every option carries a card", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, nameOf)!
  expect(isTurnMenu(menu)).toBe(true)
})

test("isTurnMenu is false for a challenge-claim window", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const projected = project(claimed, BOB)
  expect(projected.window?.purpose).toBe("challenge-claim")
  expect(isTurnMenu(menuOf(projected, BOB, nameOf)!)).toBe(false)
})

test("isTurnMenu is false for spy-second, whose appended Stop carries no card", () => {
  const state = genesis(["spy", "director", "guerrilla", "peacekeeper", "politician"])
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "spy", target: null }]))
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("spy-second")
  const menu = menuOf(projected, ANN, nameOf)!
  expect(plainOption(menu, "stop").face).toBeNull()
  expect(isTurnMenu(menu)).toBe(false)
})

test("a plain non-turn option and a bomb target option both carry face null", () => {
  const state = withCoins(
    genesis(["banker", "director", "anarchist", "peacekeeper", "politician"]),
    ANN,
    3,
  )
  const bombed = fold(state, [ANN, { t: "claim", role: "anarchist", target: BOB }])
  const menu = menuOf(project(bombed, BOB), BOB, nameOf)!
  expect(targetOption(menu, "pass").face).toBeNull()
  expect(plainOption(menu, "defuse").face).toBeNull()
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

test("writer-draw offers another draw or keep, and disables pay under 1 coin", () => {
  const claimed = fold(genesis(["banker", "writer", "guerrilla", "politician", "peacekeeper"]), [
    ANN,
    { t: "claim", role: "writer", target: null },
  ])
  const resolved = allPass(claimed)
  const broke = withCoins(resolved, ANN, 0)
  const projected = project(broke, ANN)
  expect(projected.window?.purpose).toBe("writer-draw")
  expect(projected.owedSeats).toContain(ANN)
  const menu = menuOf(projected, ANN, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["pay", "no"])
  const pay = plainOption(menu, "pay")
  expect(pay.action()).toEqual({ t: "pay" })
  expect(pay.enabled).toBe(false)
  expect(pay.reason).not.toBeNull()
  expect(plainOption(menu, "no").action()).toEqual({ t: "no" })
})

test("writer-draw enables the pay option at 1 coin", () => {
  const claimed = fold(genesis(["banker", "writer", "guerrilla", "politician", "peacekeeper"]), [
    ANN,
    { t: "claim", role: "writer", target: null },
  ])
  const resolved = allPass(claimed)
  const menu = menuOf(project(withCoins(resolved, ANN, 1), ANN), ANN, nameOf)!
  expect(plainOption(menu, "pay").enabled).toBe(true)
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

test("challenge-claim offers Pass alone to the claimant and Challenge to the rest", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const projected = project(claimed, ANN)
  expect(projected.window?.purpose).toBe("challenge-claim")
  const claimant = menuOf(projected, ANN, nameOf)!
  expect(claimant.options.map((option) => option.id)).toEqual(["pass"])
  const rival = menuOf(projected, BOB, nameOf)!
  expect(rival.options.map((option) => option.id)).toEqual(["challenge", "pass"])
  const challenge = optionOf(rival.options, "challenge")
  if (challenge.kind !== "plain") throw new Error("expected a plain option")
  expect(challenge.action()).toEqual({ t: "challenge" })
  expect(optionOf(rival.options, "pass").enabled).toBe(true)
})

test("challenge-block offers Pass alone to the blocker and Challenge to the rest", () => {
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
  expect(menuOf(projected, BOB, nameOf)?.options.map((option) => option.id)).toEqual(["pass"])
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
  expect(option.choices.map((choice) => choice.name)).toEqual(
    projected.myHand.map((role) => specOf(role).name),
  )
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
  expect(option.choices.map((choice) => choice.name)).toEqual(
    combined.map((role) => specOf(role).name),
  )
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

test("a resigned rival is excluded from the menu's role-claim picker", () => {
  // The engine's `targetable` now rejects a resigned seat, so the picker must too.
  const resigned: G54State = { ...genesis(), resigned: [BOB] }
  const politician = targetOption(menuOf(project(resigned, ANN), ANN, nameOf)!, "claim-politician")
  expect(politician.choices.map((choice) => choice.seat)).not.toContain(BOB)
})

test("crime-pay offers Pay 2 or Refuse to the target only", () => {
  const state = withCoins(
    genesis(["banker", "director", "crime-boss", "peacekeeper", "politician"]),
    ANN,
    5,
  )
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "crime-boss", target: BOB }]))
  expect(project(resolved, BOB).window?.purpose).toBe("crime-pay")
  const menu = menuOf(project(resolved, BOB), BOB, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["pay", "no"])
  expect(plainOption(menu, "pay").action()).toEqual({ t: "pay" })
  expect(plainOption(menu, "no").action()).toEqual({ t: "no" })
  expect(menuOf(project(resolved, ANN), ANN, nameOf)).toBeNull()
  const paid = fold(resolved, [BOB, { t: "pay" }])
  expect(project(paid, ANN).players.find((player) => player.seat === ANN)?.coins).toBe(7)
  expect(project(paid, BOB).players.find((player) => player.seat === BOB)?.coins).toBe(0)
})

test("protestor-fund offers Fund for 3 or Decline to every rival but the target", () => {
  const state = withCoins(
    genesis(["banker", "director", "guerrilla", "protestor", "politician"]),
    ANN,
    2,
  )
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "protestor", target: BOB }]))
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("protestor-fund")
  expect(projected.owedSeats).toEqual([ANN, CARA])
  const menu = menuOf(projected, ANN, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["pay", "no"])
  expect(plainOption(menu, "pay").enabled).toBe(false)
  expect(plainOption(menu, "pay").action()).toEqual({ t: "pay" })
  expect(plainOption(menu, "no").action()).toEqual({ t: "no" })
  expect(menuOf(projected, BOB, nameOf)).toBeNull()
  const funded = withCoins(resolved, CARA, 3)
  expect(plainOption(menuOf(project(funded, CARA), CARA, nameOf)!, "pay").enabled).toBe(true)
  expect(project(fold(funded, [CARA, { t: "pay" }]), ANN).window?.purpose).toBe("block")
})

test("producer-give offers a card picker over the partner's hand", () => {
  const state = genesis(["banker", "producer", "guerrilla", "peacekeeper", "politician"])
  const survived = allPass(fold(state, [ANN, { t: "claim", role: "producer", target: BOB }]))
  expect(project(survived, BOB).window?.purpose).toBe("block")
  const give = fold(survived, [BOB, { t: "pass" }])
  const projected = project(give, BOB)
  expect(projected.window?.purpose).toBe("producer-give")
  const option = cardOption(menuOf(projected, BOB, nameOf)!, "give")
  expect(option.choices.map((choice) => choice.index)).toEqual(projected.myHand.map((_, i) => i))
  expect(option.choices.map((choice) => choice.name)).toEqual(
    projected.myHand.map((role) => specOf(role).name),
  )
  expect(option.action(1)).toEqual({ t: "give", index: 1 })
  expect(menuOf(projected, ANN, nameOf)).toBeNull()
})

test("customs-mark offers a role picker and builds a targetless claim", () => {
  const state = genesis(["banker", "director", "guerrilla", "customs-officer", "politician"])
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "customs-officer", target: null }]))
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("customs-mark")
  const option = roleOption(menuOf(projected, ANN, nameOf)!, "mark")
  expect(option.choices.map((choice) => choice.role)).toEqual([...projected.roles])
  expect(option.action("banker")).toEqual({ t: "claim", role: "banker", target: null })
  const marked = fold(resolved, [ANN, { t: "claim", role: "banker", target: null }])
  expect(project(marked, ANN).tokens.tax).toEqual({ role: "banker", holder: ANN })
})

test("socialist-give offers a card picker and Pay 1 to the target", () => {
  const state = genesis(["banker", "director", "guerrilla", "socialist", "politician"])
  const survived = allPass(fold(state, [ANN, { t: "claim", role: "socialist", target: null }]))
  const give = fold(survived, [BOB, { t: "pass" }])
  const projected = project(give, BOB)
  expect(projected.window?.purpose).toBe("socialist-give")
  const menu = menuOf(projected, BOB, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["give", "pay"])
  expect(cardOption(menu, "give").action(0)).toEqual({ t: "give", index: 0 })
  expect(plainOption(menu, "pay").action()).toEqual({ t: "pay" })
  expect(menuOf(projected, ANN, nameOf)).toBeNull()
})

test("socialist-keep offers a two-card swap with the pool offset past the hand", () => {
  const state = genesis(["banker", "director", "guerrilla", "socialist", "politician"])
  let s = allPass(fold(state, [ANN, { t: "claim", role: "socialist", target: null }]))
  s = fold(s, [BOB, { t: "pass" }])
  s = fold(s, [BOB, { t: "pay" }])
  s = fold(s, [CARA, { t: "pass" }])
  s = fold(s, [CARA, { t: "give", index: 0 }])
  const projected = project(s, ANN)
  expect(projected.window?.purpose).toBe("socialist-keep")
  expect(projected.mySocialist).toHaveLength(1)
  const option = swapOption(menuOf(projected, ANN, nameOf)!, "keep")
  expect(option.ownChoices.map((choice) => choice.index)).toEqual(
    projected.myHand.map((_, i) => i),
  )
  expect(option.poolChoices.map((choice) => choice.index)).toEqual([projected.myHand.length])
  expect(option.poolChoices.map((choice) => choice.name)).toEqual(
    (projected.mySocialist ?? []).map((role) => specOf(role).name),
  )
  expect(option.action(0, projected.myHand.length)).toEqual({
    t: "keep",
    indices: [0, projected.myHand.length],
  })
  expect(menuOf(projected, BOB, nameOf)).toBeNull()
})

test("socialist-keep stays actionable when both rivals paid coins and the pool is empty", () => {
  const state = genesis(["banker", "director", "guerrilla", "socialist", "politician"])
  let s = allPass(fold(state, [ANN, { t: "claim", role: "socialist", target: null }]))
  s = fold(s, [BOB, { t: "pass" }])
  s = fold(s, [BOB, { t: "pay" }])
  s = fold(s, [CARA, { t: "pass" }])
  s = fold(s, [CARA, { t: "pay" }])
  const projected = project(s, ANN)
  expect(projected.window?.purpose).toBe("socialist-keep")
  expect(projected.mySocialist).toEqual([])
  const option = swapOption(menuOf(projected, ANN, nameOf)!, "keep")
  expect(option.enabled).toBe(true)
  expect(option.poolChoices).toEqual([])
  expect(option.action(0, 0)).toEqual({ t: "keep", indices: [0, 0] })
})

test("capitalist offers Claim to collect with the pending role, or Pass", () => {
  const state = genesis(["capitalist", "director", "guerrilla", "peacekeeper", "politician"])
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "capitalist", target: null }]))
  const projected = project(resolved, BOB)
  expect(projected.window?.purpose).toBe("capitalist")
  expect(projected.pending?.role).toBe("capitalist")
  const menu = menuOf(projected, BOB, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["claim", "no"])
  expect(plainOption(menu, "claim").action()).toEqual({
    t: "claim",
    role: "capitalist",
    target: null,
  })
  expect(plainOption(menu, "no").action()).toEqual({ t: "no" })
  expect(menuOf(project(resolved, ANN), ANN, nameOf)).toBeNull()
  const collected = fold(resolved, [BOB, { t: "claim", role: "capitalist", target: null }])
  expect(project(collected, ANN).window?.purpose).toBe("challenge-claim")
})

test("lawyer offers Claim the estate to every alive seat", () => {
  const state = withCoins(
    genesis(["banker", "director", "guerrilla", "lawyer", "politician"]),
    ANN,
    8,
  )
  const armed = withCoins(withHand(state, BOB, ["banker"]), BOB, 6)
  const coup = fold(armed, [ANN, { t: "coup", target: BOB }])
  const resolved = fold(coup, [BOB, { t: "reveal", index: 0 }])
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("lawyer")
  const menu = menuOf(projected, ANN, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["claim", "no"])
  expect(plainOption(menu, "claim").action()).toEqual({ t: "claim", role: "lawyer", target: null })
  expect(plainOption(menu, "no").action()).toEqual({ t: "no" })
  expect(menuOf(project(resolved, CARA), CARA, nameOf)?.options.map((option) => option.id)).toEqual([
    "claim",
    "no",
  ])
})

test("reactive-intellectual offers Claim Intellectual or Decline", () => {
  const projected = project(toReactive("intellectual"), BOB)
  expect(projected.window?.purpose).toBe("reactive-intellectual")
  const menu = menuOf(projected, BOB, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["claim", "no"])
  expect(plainOption(menu, "claim").action()).toEqual({
    t: "claim",
    role: "intellectual",
    target: null,
  })
  expect(menuOf(projected, ANN, nameOf)).toBeNull()
})

test("reactive-missionary offers Claim Missionary or Decline", () => {
  const projected = project(toReactive("missionary"), BOB)
  expect(projected.window?.purpose).toBe("reactive-missionary")
  const menu = menuOf(projected, BOB, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["claim", "no"])
  expect(plainOption(menu, "claim").action()).toEqual({
    t: "claim",
    role: "missionary",
    target: null,
  })
})

test("bomb offers the legal next holders and Defuse, mirroring bombPassable", () => {
  const state = withCoins(
    genesis(["banker", "director", "anarchist", "peacekeeper", "politician"]),
    ANN,
    3,
  )
  const bombed = fold(state, [ANN, { t: "claim", role: "anarchist", target: BOB }])
  const projected = project(bombed, BOB)
  expect(projected.window?.purpose).toBe("bomb")
  expect(projected.tokens.bomb).toEqual({ holder: BOB, prior: [ANN], move: null })
  const menu = menuOf(projected, BOB, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["pass", "defuse"])
  const pass = targetOption(menu, "pass")
  // Ann is a prior holder, so Cara is the only legal next holder.
  expect(pass.choices.map((choice) => choice.seat)).toEqual([CARA])
  expect(pass.action(CARA)).toEqual({ t: "claim", role: "anarchist", target: CARA })
  expect(plainOption(menu, "defuse").action()).toEqual({
    t: "claim",
    role: "anarchist",
    target: null,
  })
  expect(menuOf(projected, ANN, nameOf)).toBeNull()
  expect(project(fold(bombed, [BOB, pass.action(CARA)]), BOB).window?.purpose).toBe(
    "challenge-claim",
  )
})

test("bomb with a live move offers only Continue, since the resolver ignores input", () => {
  const state = withCoins(
    genesis(["banker", "director", "anarchist", "peacekeeper", "politician"]),
    ANN,
    3,
  )
  let s = fold(state, [ANN, { t: "claim", role: "anarchist", target: BOB }])
  // Bob lies about defusing; Cara challenges and Bob concedes, leaving a live move.
  s = fold(s, [BOB, { t: "claim", role: "anarchist", target: null }])
  s = fold(s, [CARA, { t: "challenge" }])
  s = fold(s, [BOB, { t: "concede" }])
  s = fold(s, [BOB, { t: "reveal", index: 0 }])
  const projected = project(s, BOB)
  expect(projected.window?.purpose).toBe("bomb")
  expect(projected.tokens.bomb?.move).toBe("defuse")
  const menu = menuOf(projected, BOB, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["continue"])
  expect(plainOption(menu, "continue").action()).toEqual({ t: "no" })
})

test("spy-second reuses the turn menu and adds a Stop", () => {
  const state = genesis(["spy", "director", "guerrilla", "peacekeeper", "politician"])
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "spy", target: null }]))
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("spy-second")
  const menu = menuOf(projected, ANN, nameOf)!
  const ids = menu.options.map((option) => option.id)
  expect(ids).toContain("income")
  expect(ids).toContain("coup")
  expect(ids[ids.length - 1]).toBe("stop")
  expect(plainOption(menu, "stop").action()).toEqual({ t: "pass" })
  expect(menuOf(projected, BOB, nameOf)).toBeNull()
})

test("plantation-payout offers a single Continue acknowledgement", () => {
  const state = genesis(["plantation-owner", "director", "guerrilla", "peacekeeper", "politician"])
  const massClaim = allPass(fold(state, [ANN, { t: "claim", role: "plantation-owner", target: null }]))
  expect(project(massClaim, ANN).window?.purpose).toBe("capitalist")
  const resolved = allPass(massClaim)
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("plantation-payout")
  const menu = menuOf(projected, ANN, nameOf)!
  expect(menu.options.map((option) => option.id)).toEqual(["continue"])
  expect(plainOption(menu, "continue").action()).toEqual({ t: "no" })
  expect(menuOf(projected, BOB, nameOf)).toBeNull()
  const paid = fold(resolved, [ANN, { t: "no" }])
  expect(project(paid, ANN).players.find((player) => player.seat === ANN)?.coins).toBe(4)
})

