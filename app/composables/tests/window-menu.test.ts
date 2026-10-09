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
import {
  confirmable,
  forcedAction,
  menuOf,
  type CardChoice,
  type DirectCard,
  type SeatIdentity,
  type StagedCard,
  type WindowMenu,
} from "../window-menu.ts"

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

const identityOf = (seat: SeatId): SeatIdentity => ({ name: nameOf(seat), image: null })

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

const cardOf = (menu: WindowMenu, id: string): CardChoice => {
  const card = menu.cards.find((candidate) => candidate.id === id)
  if (card === undefined) throw new Error(`no card ${id}`)
  return card
}

const directOf = (menu: WindowMenu, id: string): DirectCard => {
  const card = cardOf(menu, id)
  if (card.target !== null) throw new Error(`card ${id} is not direct`)
  return card
}

const stagedOf = (menu: WindowMenu, id: string): StagedCard => {
  const card = cardOf(menu, id)
  if (card.target === null) throw new Error(`card ${id} is not staged`)
  return card
}

const actionLabelOf = (menu: WindowMenu, id: string): string => {
  const face = cardOf(menu, id).face
  if (face.kind !== "action") throw new Error(`card ${id} is not an action face`)
  return face.card.label
}

const roleOfFace = (menu: WindowMenu, id: string): RoleId => {
  const face = cardOf(menu, id).face
  if (face.kind !== "role") throw new Error(`card ${id} is not a role face`)
  return face.role
}

const playerSeatsOf = (card: StagedCard, groupIndex: number): readonly SeatId[] =>
  (card.target[groupIndex]?.cards ?? []).map((target) => {
    if (target.face.kind !== "player") throw new Error(`card ${target.id} is not a player face`)
    return target.face.seat
  })

const playerNamesOf = (card: StagedCard, groupIndex: number): readonly string[] =>
  (card.target[groupIndex]?.cards ?? []).map((target) => {
    if (target.face.kind !== "player") throw new Error(`card ${target.id} is not a player face`)
    return target.face.name
  })

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
  const menu = menuOf(project(genesis(), ANN), ANN, identityOf)
  expect(menu).not.toBeNull()
  expect(menu!.cards.map((card) => card.id)).toEqual([
    "income",
    "coup",
    "claim-banker",
    "claim-director",
    "claim-guerrilla",
    "claim-politician",
    "claim-peacekeeper",
  ])
})

test("turn cards carry a face: an action model or a role", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, identityOf)!
  expect(actionLabelOf(menu, "income")).toBe("Income")
  expect(actionLabelOf(menu, "coup")).toBe("Coup")
  expect(roleOfFace(menu, "claim-banker")).toBe("banker")
  expect(roleOfFace(menu, "claim-politician")).toBe("politician")
})

test("a seat the open window does not owe gets no menu", () => {
  const projected = project(genesis(), ANN)
  expect(projected.owedSeats).toEqual([ANN])
  expect(menuOf(projected, BOB, identityOf)).toBeNull()
})

test("a target claim carries a player-card group and builds a targeted claim", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, identityOf)!
  const politician = stagedOf(menu, "claim-politician")
  expect(politician.target).toHaveLength(1)
  expect(politician.target[0]!.cards.map((card) => card.face.kind)).toEqual(["player", "player"])
  expect(playerSeatsOf(politician, 0)).toEqual([BOB, CARA])
  expect(playerNamesOf(politician, 0)).toEqual(["Bo", "Cy"])
  expect(politician.resolve([politician.target[0]!.cards[0]!])).toEqual({
    t: "claim",
    role: "politician",
    target: BOB,
  })
})

test("a targetless role claim is a direct card that builds a targetless claim", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, identityOf)!
  const banker = directOf(menu, "claim-banker")
  expect(banker.target).toBeNull()
  expect(banker.resolve()).toEqual({ t: "claim", role: "banker", target: null })
})

test("a claim the viewer cannot afford is disabled with a reason", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, identityOf)!
  const guerrilla = cardOf(menu, "claim-guerrilla")
  expect(guerrilla.enabled).toBe(false)
  expect(guerrilla.reason).not.toBeNull()
})

test("the forced-Coup mirror disables every non-Coup card", () => {
  const menu = menuOf(richView(), ANN, identityOf)!
  expect(cardOf(menu, "coup").enabled).toBe(true)
  for (const card of menu.cards) {
    if (card.id === "coup") continue
    expect(card.enabled).toBe(false)
    expect(card.reason).not.toBeNull()
  }
  expect(menu.note).not.toBeNull()
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
  const menu = menuOf(projected, ANN, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["pay", "no"])
  const pay = directOf(menu, "pay")
  expect(pay.resolve()).toEqual({ t: "pay" })
  expect(pay.enabled).toBe(false)
  expect(pay.reason).not.toBeNull()
  expect(directOf(menu, "no").resolve()).toEqual({ t: "no" })
})

test("writer-draw enables the pay card at 1 coin", () => {
  const claimed = fold(genesis(["banker", "writer", "guerrilla", "politician", "peacekeeper"]), [
    ANN,
    { t: "claim", role: "writer", target: null },
  ])
  const resolved = allPass(claimed)
  const menu = menuOf(project(withCoins(resolved, ANN, 1), ANN), ANN, identityOf)!
  expect(directOf(menu, "pay").enabled).toBe(true)
})

test("a general claim excludes the Peacekeeper but a Coup keeps it", () => {
  const state = genesis()
  const withPeacekeeper: G54State = { ...state, peacekeeping: CARA }
  const menu = menuOf(project(withPeacekeeper, ANN), ANN, identityOf)!
  expect(playerSeatsOf(stagedOf(menu, "claim-politician"), 0)).toEqual([BOB])
  expect(playerSeatsOf(stagedOf(menu, "coup"), 0)).toEqual([BOB, CARA])
})

test("a Treaty ally is excluded from both a general claim and a Coup", () => {
  const state = genesis()
  const allied: G54State = { ...state, treaty: [ANN, BOB] }
  const menu = menuOf(project(allied, ANN), ANN, identityOf)!
  expect(playerSeatsOf(stagedOf(menu, "claim-politician"), 0)).toEqual([CARA])
  expect(playerSeatsOf(stagedOf(menu, "coup"), 0)).toEqual([CARA])
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
  const menu = menuOf(project(shaped, ANN), ANN, identityOf)!
  const paramilitary = stagedOf(menu, "claim-paramilitary")
  const bob = paramilitary.target[0]!.cards.find(
    (target) => target.face.kind === "player" && target.face.seat === BOB,
  )!
  const cara = paramilitary.target[0]!.cards.find(
    (target) => target.face.kind === "player" && target.face.seat === CARA,
  )!
  expect(bob.enabled).toBe(false)
  expect(cara.enabled).toBe(true)
  expect(paramilitary.enabled).toBe(true)
})

test("challenge-claim offers Pass alone to the claimant and Challenge to the rest", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const projected = project(claimed, ANN)
  expect(projected.window?.purpose).toBe("challenge-claim")
  const claimant = menuOf(projected, ANN, identityOf)!
  expect(claimant.cards.map((card) => card.id)).toEqual(["pass"])
  const rival = menuOf(projected, BOB, identityOf)!
  expect(rival.cards.map((card) => card.id)).toEqual(["challenge", "pass"])
  expect(directOf(rival, "challenge").resolve()).toEqual({ t: "challenge" })
  expect(directOf(rival, "pass").enabled).toBe(true)
})

test("the claimant's one-card challenge window is a forced Pass, not a choice", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const claimant = menuOf(project(claimed, ANN), ANN, identityOf)!
  expect(forcedAction(claimant)).toEqual({ t: "pass" })
})

test("a challenge window with a real choice is not forced", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const rival = menuOf(project(claimed, BOB), BOB, identityOf)!
  expect(forcedAction(rival)).toBeNull()
})

test("the turn window is not forced", () => {
  expect(forcedAction(menuOf(project(genesis(), ANN), ANN, identityOf)!)).toBeNull()
})

test("an acknowledge-only window is forced", () => {
  const menu: WindowMenu = {
    title: "Plantation payout",
    note: null,
    cards: [
      {
        id: "continue",
        face: { kind: "action", card: { label: "Continue", summary: "Acknowledge.", art: null, costLabel: null, accessibleName: "Continue" } },
        enabled: true,
        reason: null,
        group: null,
        target: null,
        resolve: () => ({ t: "no" }),
      },
    ],
  }
  expect(forcedAction(menu)).toEqual({ t: "no" })
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
  expect(menuOf(projected, ANN, identityOf)!.cards.map((card) => card.id)).toEqual([
    "challenge",
    "pass",
  ])
  expect(menuOf(projected, BOB, identityOf)!.cards.map((card) => card.id)).toEqual(["pass"])
})

test("proof-claim disables Show when the viewer does not hold the claimed card", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const challenged = fold(claimed, [BOB, { t: "challenge" }])
  const projected = project(challenged, ANN)
  expect(projected.window?.purpose).toBe("proof-claim")
  const menu = menuOf(projected, ANN, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["show", "concede"])
  const show = cardOf(menu, "show")
  expect(show.enabled).toBe(false)
  expect(show.reason).toBe("You do not hold Banker")
  expect(cardOf(menu, "concede").enabled).toBe(true)
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
  const show = cardOf(menuOf(projected, ANN, identityOf)!, "show")
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
  const show = cardOf(menuOf(projected, BOB, identityOf)!, "show")
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
  expect(cardOf(menuOf(projected, BOB, identityOf)!, "show").enabled).toBe(true)
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
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["block", "pass"])
  expect(roleOfFace(menu, "block")).toBe("politician")
  expect(directOf(menu, "block").resolve()).toEqual({ t: "block", role: "politician" })
})

test("a seat the open proof or block window does not owe gets no menu", () => {
  const claimed = fold(genesis(), [ANN, { t: "claim", role: "banker", target: null }])
  const challenged = fold(claimed, [BOB, { t: "challenge" }])
  const proof = project(challenged, ANN)
  expect(proof.owedSeats).toEqual([ANN])
  expect(menuOf(proof, BOB, identityOf)).toBeNull()

  const claimedTarget = fold(genesis(), [ANN, { t: "claim", role: "politician", target: BOB }])
  const survived = fold(
    claimedTarget,
    [ANN, { t: "pass" }],
    [BOB, { t: "pass" }],
    [CARA, { t: "pass" }],
  )
  const block = project(survived, BOB)
  expect(block.owedSeats).toEqual([BOB])
  expect(menuOf(block, ANN, identityOf)).toBeNull()
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

test("reveal offers one direct role card per hand slot that reveals that index", () => {
  const projected = project(toReveal(), BOB)
  expect(projected.window?.purpose).toBe("reveal")
  expect(projected.owedSeats).toEqual([BOB])
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(
    projected.myHand.map((_, index) => `reveal-${String(index)}`),
  )
  expect(menu.cards.map((card) => card.face.kind)).toEqual(projected.myHand.map(() => "role"))
  expect(menu.cards.map((card) => roleOfFace(menu, card.id))).toEqual([...projected.myHand])
  expect(directOf(menu, "reveal-1").resolve()).toEqual({ t: "reveal", index: 1 })
})

test("a seat the reveal window does not owe gets no menu", () => {
  const projected = project(toReveal(), BOB)
  expect(menuOf(projected, ANN, identityOf)).toBeNull()
})

test("keep is a staged card over the combined hand and draw pool, keeping `count`", () => {
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
  const menu = menuOf(projected, ANN, identityOf)!
  const keep = stagedOf(menu, "keep")
  const combined = [...projected.myHand, ...(projected.myDraw ?? [])]
  expect(
    keep.target[0]!.cards.map((card) =>
      card.face.kind === "role" ? card.face.role : null,
    ),
  ).toEqual(combined)
  expect(keep.target[0]!.count).toBe(projected.myHand.length)
  expect(keep.resolve(keep.target[0]!.cards.slice(0, 2))).toEqual({ t: "keep", indices: [0, 1] })
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
  const face = cardOf(menuOf(projected, BOB, identityOf)!, "show").face
  if (face.kind !== "action") throw new Error("show is not an action face")
  expect(face.card.summary).toBe("Intellectual")
})

test("a resigned rival is excluded from every target picker", () => {
  const resigned: G54State = { ...genesis(), resigned: [BOB] }
  const menu = menuOf(project(resigned, ANN), ANN, identityOf)!
  expect(playerSeatsOf(stagedOf(menu, "claim-politician"), 0)).toEqual([CARA])
  expect(playerSeatsOf(stagedOf(menu, "coup"), 0)).toEqual([CARA])
})

test("a resigned rival is excluded from the menu's role-claim picker", () => {
  // The engine's `targetable` now rejects a resigned seat, so the picker must too.
  const resigned: G54State = { ...genesis(), resigned: [BOB] }
  const politician = stagedOf(menuOf(project(resigned, ANN), ANN, identityOf)!, "claim-politician")
  expect(playerSeatsOf(politician, 0)).not.toContain(BOB)
})

test("crime-pay offers Pay 2 or Refuse to the target only", () => {
  const state = withCoins(
    genesis(["banker", "director", "crime-boss", "peacekeeper", "politician"]),
    ANN,
    5,
  )
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "crime-boss", target: BOB }]))
  expect(project(resolved, BOB).window?.purpose).toBe("crime-pay")
  const menu = menuOf(project(resolved, BOB), BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["pay", "no"])
  expect(directOf(menu, "pay").resolve()).toEqual({ t: "pay" })
  expect(directOf(menu, "no").resolve()).toEqual({ t: "no" })
  expect(menuOf(project(resolved, ANN), ANN, identityOf)).toBeNull()
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
  const menu = menuOf(projected, ANN, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["pay", "no"])
  expect(directOf(menu, "pay").enabled).toBe(false)
  expect(directOf(menu, "pay").resolve()).toEqual({ t: "pay" })
  expect(directOf(menu, "no").resolve()).toEqual({ t: "no" })
  expect(menuOf(projected, BOB, identityOf)).toBeNull()
  const funded = withCoins(resolved, CARA, 3)
  expect(directOf(menuOf(project(funded, CARA), CARA, identityOf)!, "pay").enabled).toBe(true)
  expect(project(fold(funded, [CARA, { t: "pay" }]), ANN).window?.purpose).toBe("block")
})

test("producer-give offers one direct role card per hand slot", () => {
  const state = genesis(["banker", "producer", "guerrilla", "peacekeeper", "politician"])
  const survived = allPass(fold(state, [ANN, { t: "claim", role: "producer", target: BOB }]))
  expect(project(survived, BOB).window?.purpose).toBe("block")
  const give = fold(survived, [BOB, { t: "pass" }])
  const projected = project(give, BOB)
  expect(projected.window?.purpose).toBe("producer-give")
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(
    projected.myHand.map((_, index) => `give-${String(index)}`),
  )
  expect(menu.cards.map((card) => roleOfFace(menu, card.id))).toEqual([...projected.myHand])
  expect(directOf(menu, "give-1").resolve()).toEqual({ t: "give", index: 1 })
  expect(menuOf(projected, ANN, identityOf)).toBeNull()
})

test("customs-mark offers one direct role card per role in play", () => {
  const state = genesis(["banker", "director", "guerrilla", "customs-officer", "politician"])
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "customs-officer", target: null }]))
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("customs-mark")
  const menu = menuOf(projected, ANN, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(
    projected.roles.map((role) => `mark-${role}`),
  )
  expect(roleOfFace(menu, "mark-banker")).toBe("banker")
  expect(directOf(menu, "mark-banker").resolve()).toEqual({
    t: "claim",
    role: "banker",
    target: null,
  })
  const marked = fold(resolved, [ANN, { t: "claim", role: "banker", target: null }])
  expect(project(marked, ANN).tokens.tax).toEqual({ role: "banker", holder: ANN })
})

test("socialist-give offers one give card per hand slot and Pay 1 to the target", () => {
  const state = genesis(["banker", "director", "guerrilla", "socialist", "politician"])
  const survived = allPass(fold(state, [ANN, { t: "claim", role: "socialist", target: null }]))
  const give = fold(survived, [BOB, { t: "pass" }])
  const projected = project(give, BOB)
  expect(projected.window?.purpose).toBe("socialist-give")
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual([
    ...projected.myHand.map((_, index) => `give-${String(index)}`),
    "pay",
  ])
  expect(directOf(menu, "give-0").resolve()).toEqual({ t: "give", index: 0 })
  expect(directOf(menu, "pay").resolve()).toEqual({ t: "pay" })
  expect(menuOf(projected, ANN, identityOf)).toBeNull()
})

test("socialist-keep offers one staged card per hand slot over the collected pile", () => {
  const state = genesis(["banker", "director", "guerrilla", "socialist", "politician"])
  let s = allPass(fold(state, [ANN, { t: "claim", role: "socialist", target: null }]))
  s = fold(s, [BOB, { t: "pass" }])
  s = fold(s, [BOB, { t: "pay" }])
  s = fold(s, [CARA, { t: "pass" }])
  s = fold(s, [CARA, { t: "give", index: 0 }])
  const projected = project(s, ANN)
  expect(projected.window?.purpose).toBe("socialist-keep")
  expect(projected.mySocialist).toHaveLength(1)
  const menu = menuOf(projected, ANN, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(
    projected.myHand.map((_, index) => `keep-${String(index)}`),
  )
  const keep = stagedOf(menu, "keep-0")
  expect(keep.target[0]!.count).toBe(1)
  expect(keep.target[0]!.cards).toHaveLength(1)
  expect(keep.target[0]!.cards.map((card) => card.face.kind)).toEqual(["role"])
  const pool = keep.target[0]!.cards[0]!
  expect(keep.resolve([pool])).toEqual({ t: "keep", indices: [0, projected.myHand.length] })
  expect(menuOf(projected, BOB, identityOf)).toBeNull()
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
  const keep = stagedOf(menuOf(projected, ANN, identityOf)!, "keep-0")
  expect(keep.enabled).toBe(true)
  expect(keep.target[0]!.cards).toEqual([])
  expect(keep.target[0]!.count).toBe(0)
  expect(keep.resolve([])).toEqual({ t: "keep", indices: [0, 0] })
})

test("capitalist offers Claim to collect with the pending role, or Pass", () => {
  const state = genesis(["capitalist", "director", "guerrilla", "peacekeeper", "politician"])
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "capitalist", target: null }]))
  const projected = project(resolved, BOB)
  expect(projected.window?.purpose).toBe("capitalist")
  expect(projected.pending?.role).toBe("capitalist")
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["claim", "no"])
  expect(roleOfFace(menu, "claim")).toBe("capitalist")
  expect(directOf(menu, "claim").resolve()).toEqual({
    t: "claim",
    role: "capitalist",
    target: null,
  })
  expect(directOf(menu, "no").resolve()).toEqual({ t: "no" })
  expect(menuOf(project(resolved, ANN), ANN, identityOf)).toBeNull()
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
  const menu = menuOf(projected, ANN, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["claim", "no"])
  expect(roleOfFace(menu, "claim")).toBe("lawyer")
  expect(directOf(menu, "claim").resolve()).toEqual({ t: "claim", role: "lawyer", target: null })
  expect(directOf(menu, "no").resolve()).toEqual({ t: "no" })
  expect(
    menuOf(project(resolved, CARA), CARA, identityOf)!.cards.map((card) => card.id),
  ).toEqual(["claim", "no"])
})

test("reactive-intellectual offers Claim Intellectual or Decline", () => {
  const projected = project(toReactive("intellectual"), BOB)
  expect(projected.window?.purpose).toBe("reactive-intellectual")
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["claim", "no"])
  expect(directOf(menu, "claim").resolve()).toEqual({
    t: "claim",
    role: "intellectual",
    target: null,
  })
  expect(menuOf(projected, ANN, identityOf)).toBeNull()
})

test("reactive-missionary offers Claim Missionary or Decline", () => {
  const projected = project(toReactive("missionary"), BOB)
  expect(projected.window?.purpose).toBe("reactive-missionary")
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["claim", "no"])
  expect(directOf(menu, "claim").resolve()).toEqual({
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
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["pass", "defuse"])
  const pass = stagedOf(menu, "pass")
  // Ann is a prior holder, so Cara is the only legal next holder.
  expect(playerSeatsOf(pass, 0)).toEqual([CARA])
  const cara = pass.target[0]!.cards[0]!
  expect(pass.resolve([cara])).toEqual({ t: "claim", role: "anarchist", target: CARA })
  expect(directOf(menu, "defuse").resolve()).toEqual({
    t: "claim",
    role: "anarchist",
    target: null,
  })
  expect(menuOf(projected, ANN, identityOf)).toBeNull()
  expect(project(fold(bombed, [BOB, pass.resolve([cara])]), BOB).window?.purpose).toBe(
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
  const menu = menuOf(projected, BOB, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["continue"])
  expect(directOf(menu, "continue").resolve()).toEqual({ t: "no" })
})

test("spy-second reuses the turn menu and adds a Stop", () => {
  const state = genesis(["spy", "director", "guerrilla", "peacekeeper", "politician"])
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "spy", target: null }]))
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("spy-second")
  const menu = menuOf(projected, ANN, identityOf)!
  const ids = menu.cards.map((card) => card.id)
  expect(ids).toContain("income")
  expect(ids).toContain("coup")
  expect(ids[ids.length - 1]).toBe("stop")
  expect(directOf(menu, "stop").resolve()).toEqual({ t: "pass" })
  expect(menuOf(projected, BOB, identityOf)).toBeNull()
})

test("spy-second mutes Spy with a reason instead of hiding it", () => {
  const state = genesis(["spy", "director", "guerrilla", "peacekeeper", "politician"])
  const resolved = allPass(fold(state, [ANN, { t: "claim", role: "spy", target: null }]))
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("spy-second")
  const menu = menuOf(projected, ANN, identityOf)!
  const spy = cardOf(menu, "claim-spy")
  expect(spy.enabled).toBe(false)
  expect(spy.reason).toBe("Once per turn")
  // The other roles stay live, so the mute reads as one unavailable card, not a broken menu.
  expect(directOf(menu, "claim-director").enabled).toBe(true)
})

test("plantation-payout offers a single Continue acknowledgement", () => {
  const state = genesis(["plantation-owner", "director", "guerrilla", "peacekeeper", "politician"])
  const massClaim = allPass(fold(state, [ANN, { t: "claim", role: "plantation-owner", target: null }]))
  expect(project(massClaim, ANN).window?.purpose).toBe("capitalist")
  const resolved = allPass(massClaim)
  const projected = project(resolved, ANN)
  expect(projected.window?.purpose).toBe("plantation-payout")
  const menu = menuOf(projected, ANN, identityOf)!
  expect(menu.cards.map((card) => card.id)).toEqual(["continue"])
  expect(directOf(menu, "continue").resolve()).toEqual({ t: "no" })
  expect(menuOf(projected, BOB, identityOf)).toBeNull()
  const paid = fold(resolved, [ANN, { t: "no" }])
  expect(project(paid, ANN).players.find((player) => player.seat === ANN)?.coins).toBe(4)
})

test("confirmable clears a direct card when it is enabled, and never when it is not", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, identityOf)!
  expect(confirmable(directOf(menu, "claim-banker"), [])).toBe(true)
  expect(confirmable(cardOf(menu, "claim-guerrilla"), [])).toBe(false)
})

test("confirmable needs exactly one enabled pick for a single-target staged card", () => {
  const menu = menuOf(project(genesis(), ANN), ANN, identityOf)!
  const politician = stagedOf(menu, "claim-politician")
  expect(confirmable(politician, [])).toBe(false)
  expect(confirmable(politician, [politician.target[0]!.cards[0]!])).toBe(true)
  const disabled = politician.target[0]!.cards.find((card) => !card.enabled)
  expect(disabled).toBeUndefined()
})

test("confirmable counts only enabled picks for a multi-select keep", () => {
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
  const menu = menuOf(project(resolved, ANN), ANN, identityOf)!
  const keep = stagedOf(menu, "keep")
  const group = keep.target[0]!
  expect(confirmable(keep, [])).toBe(false)
  expect(confirmable(keep, group.cards.slice(0, group.count))).toBe(true)
  expect(confirmable(keep, group.cards.slice(0, group.count + 1))).toBe(false)
})
