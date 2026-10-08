import { expect, test } from "vitest"
import { ref, shallowRef } from "vue"
import {
  act,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  resign,
  type Frame,
  type SeatInput,
} from "#shared/core/lockstep/index.ts"
import {
  g54,
  type G54Action,
  type G54State,
  type G54View,
  type RoleId,
} from "#shared/core/lockstep/games/g54/index.ts"
import { seatId, type SeatId } from "#shared/rooms/ids.ts"
import type { SeatIdentity } from "../board-view.ts"
import {
  CATALOGUE,
  deriveEvents,
  isContinuation,
  toastsFor,
  useGameToasts,
  type GameEvent,
  type Toast,
} from "../useGameToasts.ts"

const ANN = seatId("ann")
const BOB = seatId("bob")
const CARA = seatId("cara")
const SEATS = [ANN, BOB, CARA]
const ROLES = ["banker", "producer", "guerrilla", "politician", "socialist"] as const
const SEED = genesisSeed("use-game-toasts-tests")

const IDENTITIES: ReadonlyMap<SeatId, SeatIdentity> = new Map([
  [ANN, { name: "Ada", image: null }],
  [BOB, { name: "Bo", image: null }],
  [CARA, { name: "Cy", image: null }],
])
const nameOf = (seat: SeatId): string => IDENTITIES.get(seat)?.name ?? seat

const genesis = (): G54State =>
  g54.genesis({ roles: [...ROLES] }, makeRoster(SEATS), makeRandom(SEED))

const frame = (
  index: number,
  inputs: readonly (readonly [SeatId, SeatInput<G54Action>])[],
): Frame<G54Action> => ({ index: frameIndex(index), seed: SEED, inputs })

const pass = act<G54Action>({ t: "pass" })

const fold = (
  start: G54State,
  frames: readonly Frame<G54Action>[],
  seat: SeatId = ANN,
): G54View => {
  let state = start
  for (const entry of frames) state = g54.step(state, entry, makeRandom(SEED))
  return g54.project(state, seat)
}

const viewAfter = (frames: readonly Frame<G54Action>[], seat: SeatId = ANN): G54View =>
  fold(genesis(), frames, seat)

/** Events per interval: project after each step, then diff consecutive projections. */
const intervalEvents = (
  start: G54State,
  frames: readonly Frame<G54Action>[],
  seat: SeatId = ANN,
): readonly (readonly GameEvent[])[] => {
  const events: GameEvent[][] = []
  let state = start
  let prev = g54.project(state, seat)
  for (const entry of frames) {
    state = g54.step(state, entry, makeRandom(SEED))
    const next = g54.project(state, seat)
    events.push([...deriveEvents(prev, next)])
    prev = next
  }
  return events
}

const incomeFrames: readonly Frame<G54Action>[] = [
  frame(0, [[ANN, act<G54Action>({ t: "income" })]]),
]

const claimFrames: readonly Frame<G54Action>[] = [
  frame(0, [[ANN, act<G54Action>({ t: "claim", role: "banker", target: null })]]),
  frame(1, [[ANN, pass], [BOB, act<G54Action>({ t: "challenge" })], [CARA, pass]]),
  frame(2, [[ANN, act<G54Action>({ t: "concede" })]]),
  frame(3, [[ANN, act<G54Action>({ t: "reveal", index: 0 })]]),
]

const producerFrames: readonly Frame<G54Action>[] = [
  frame(0, [[ANN, act<G54Action>({ t: "claim", role: "producer", target: BOB })]]),
  frame(1, [[ANN, pass], [BOB, pass], [CARA, pass]]),
  frame(2, [[BOB, pass]]),
  frame(3, [[BOB, act<G54Action>({ t: "give", index: 0 })]]),
]

const coupSetup = (): G54State => {
  const state = genesis()
  return {
    ...state,
    players: state.players.map((player) => {
      if (player.seat === ANN) return { ...player, coins: 7 }
      if (player.seat === BOB) return { ...player, coins: 4, hand: player.hand.slice(0, 1) }
      return player
    }),
  }
}

const coupFrames: readonly Frame<G54Action>[] = [
  frame(0, [[ANN, act<G54Action>({ t: "coup", target: BOB })]]),
  frame(1, [[BOB, act<G54Action>({ t: "reveal", index: 0 })]]),
]

const growHand = (): G54State => {
  const state = genesis()
  return {
    ...state,
    players: state.players.map((player) =>
      player.seat === ANN
        ? { ...player, hand: [...player.hand, ...state.roles.slice(0, 1)] }
        : player,
    ),
  }
}

test("a coin gain reaches the actor and stays off a rival's toasts", () => {
  const before = viewAfter([])
  const after = viewAfter(incomeFrames)
  expect(toastsFor(before, after, ANN, nameOf)).toEqual<readonly Toast[]>([
    { severity: "success", title: "You gained 1 coin (3 total)." },
  ])
  expect(toastsFor(before, after, BOB, nameOf)).toEqual([])
})

test("a lost card reaches every seat as influence-lost", () => {
  const before = viewAfter([])
  const after = viewAfter(claimFrames)
  const expected: readonly Toast[] = [
    { severity: "warning", title: "Ada lost a card (1 left)." },
  ]
  expect(toastsFor(before, after, ANN, nameOf)).toEqual(expected)
  expect(toastsFor(before, after, BOB, nameOf)).toEqual(expected)
  expect(toastsFor(before, after, CARA, nameOf)).toEqual(expected)
})

test("a give that drops a hand with no reveal produces no card-loss toast", () => {
  const before = viewAfter(producerFrames.slice(0, 3))
  const after = viewAfter(producerFrames)
  const bobBefore = before.players.find((player) => player.seat === BOB)!
  const bobAfter = after.players.find((player) => player.seat === BOB)!
  expect(bobAfter.handCount).toBe(bobBefore.handCount - 1)
  expect(bobAfter.revealed).toHaveLength(bobBefore.revealed.length)
  expect(toastsFor(before, after, ANN, nameOf)).toEqual([])
  expect(toastsFor(before, after, BOB, nameOf)).toEqual([])
})

test("elimination suppresses the settled coin drop and toasts as eliminated", () => {
  const before = fold(coupSetup(), [], ANN)
  const after = fold(coupSetup(), coupFrames, ANN)
  const bob = after.players.find((player) => player.seat === BOB)!
  expect(bob.handCount).toBe(0)
  expect(bob.coins).toBe(0)
  expect(toastsFor(before, after, BOB, nameOf)).toEqual<readonly Toast[]>([
    { severity: "error", title: "Bo is out of the game." },
  ])
  expect(toastsFor(before, after, ANN, nameOf)).toEqual<readonly Toast[]>([
    { severity: "error", title: "Bo is out of the game." },
    { severity: "warning", title: "You paid 7 coins (0 total)." },
  ])
})

test("turn-started is detected but stays silent", () => {
  const before = viewAfter([])
  const after = viewAfter(incomeFrames)
  expect(deriveEvents(before, after).map((event) => event.kind)).toContain("turn-started")
  expect(toastsFor(before, after, BOB, nameOf)).toEqual([])
})

test("card-gained is detected but stays silent", () => {
  const before = g54.project(genesis(), ANN)
  const after = g54.project(growHand(), ANN)
  expect(deriveEvents(before, after).map((event) => event.kind)).toEqual(["card-gained"])
  expect(toastsFor(before, after, ANN, nameOf)).toEqual([])
})

test("the mount baseline yields no toasts", () => {
  expect(toastsFor(null, viewAfter([]), ANN, nameOf)).toEqual([])
})

test("a resync that jumps the turn backwards is not a continuation", () => {
  const base = viewAfter([])
  expect(isContinuation(base, base)).toBe(true)
  expect(isContinuation(base, { ...base, turn: base.turn + 1 })).toBe(true)
  expect(isContinuation(base, { ...base, seat: BOB })).toBe(false)
  expect(isContinuation({ ...base, terminal: true }, base)).toBe(false)
})

const genesisWith = (roles: readonly RoleId[]): G54State =>
  g54.genesis({ roles }, makeRoster(SEATS), makeRandom(SEED))

const withCoins = (state: G54State, seat: SeatId, coins: number): G54State => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, coins } : player)),
})

const withHand = (state: G54State, seat: SeatId, hand: readonly RoleId[]): G54State => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, hand } : player)),
})

const withCourt = (state: G54State, court: readonly RoleId[]): G54State => ({ ...state, court })

const withTreaty = (state: G54State, treaty: readonly SeatId[]): G54State => ({
  ...state,
  treaty: [...treaty],
})

const armsSet: readonly RoleId[] = ["banker", "director", "guerrilla", "arms-dealer", "politician"]

const armsFrames = (named: RoleId): readonly Frame<G54Action>[] => [
  frame(0, [[ANN, act<G54Action>({ t: "claim", role: "arms-dealer", target: null, named })]]),
  frame(1, [[ANN, pass], [BOB, pass], [CARA, pass]]),
]

test("arms-reveal toasts the room on a match and on a no-match", () => {
  const matchStart = withCourt(
    genesisWith(armsSet),
    ["banker", "banker", "director", "guerrilla", "politician", "peacekeeper"],
  )
  const matchBefore = fold(matchStart, [], ANN)
  const matchAfter = fold(matchStart, armsFrames("banker"), ANN)
  expect(toastsFor(matchBefore, matchAfter, BOB, nameOf)).toEqual<readonly Toast[]>([
    { severity: "info", title: "Ada revealed Banker, Banker and matched Banker." },
  ])
  expect(toastsFor(matchBefore, matchAfter, CARA, nameOf)).toEqual<readonly Toast[]>([
    { severity: "info", title: "Ada revealed Banker, Banker and matched Banker." },
  ])

  const missStart = withCourt(
    genesisWith(armsSet),
    ["director", "guerrilla", "banker", "banker", "politician", "peacekeeper"],
  )
  const missBefore = fold(missStart, [], ANN)
  const missAfter = fold(missStart, armsFrames("banker"), ANN)
  expect(toastsFor(missBefore, missAfter, BOB, nameOf)).toEqual<readonly Toast[]>([
    { severity: "info", title: "Ada revealed Director, Guerrilla with no match for Banker." },
  ])
})

test("treaty-formed is detected and stays silent", () => {
  const start = genesisWith(["banker", "director", "guerrilla", "foreign-consular", "politician"])
  const frames: readonly Frame<G54Action>[] = [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "foreign-consular", target: BOB })]]),
    frame(1, [[ANN, pass], [BOB, pass], [CARA, pass]]),
  ]
  const before = fold(start, [], ANN)
  const after = fold(start, frames, ANN)
  expect(after.tokens.treaty).toEqual([ANN, BOB])
  expect(deriveEvents(before, after).map((event) => event.kind)).toContain("treaty-formed")
  expect(toastsFor(before, after, ANN, nameOf)).toEqual([])
  expect(toastsFor(before, after, BOB, nameOf)).toEqual([])
})

test("treaty-expired is suppressed on a member's departure but fires on a genuine expiry", () => {
  const base = genesisWith(["banker", "director", "guerrilla", "politician", "socialist"])

  const eliminatedStart = withTreaty(
    {
      ...base,
      active: CARA,
      steps: [{ kind: "window", window: { kind: "turn", purpose: "turn", seats: [CARA], cause: null } }],
      players: base.players.map((player) =>
        player.seat === ANN ? { ...player, hand: player.hand.slice(0, 1) } : player,
      ),
    },
    [ANN, BOB],
  )
  const eliminatedStart2 = withCoins(eliminatedStart, CARA, 7)
  const eliminatedBefore = fold(eliminatedStart2, [], ANN)
  const eliminatedAfter = fold(eliminatedStart2, [
    frame(0, [[CARA, act<G54Action>({ t: "coup", target: ANN })]]),
    frame(1, [[ANN, act<G54Action>({ t: "reveal", index: 0 })]]),
  ], ANN)
  expect(eliminatedAfter.tokens.treaty).toEqual([])
  const eliminatedKinds = deriveEvents(eliminatedBefore, eliminatedAfter).map((event) => event.kind)
  expect(eliminatedKinds).toContain("eliminated")
  expect(eliminatedKinds).not.toContain("treaty-expired")

  const resignedStart = withTreaty(base, [ANN, BOB])
  const resignedBefore = fold(resignedStart, [], ANN)
  const resignedAfter = fold(resignedStart, [frame(0, [[BOB, resign<G54Action>()]])], ANN)
  expect(resignedAfter.tokens.treaty).toEqual([])
  const resignedKinds = deriveEvents(resignedBefore, resignedAfter).map((event) => event.kind)
  expect(resignedKinds).toContain("resigned")
  expect(resignedKinds).not.toContain("treaty-expired")

  const expiryStart = withCoins(
    withTreaty(
      {
        ...base,
        players: base.players.map((player) =>
          player.seat === CARA ? { ...player, hand: player.hand.slice(0, 1) } : player,
        ),
      },
      [ANN, BOB],
    ),
    ANN,
    7,
  )
  const expiryBefore = fold(expiryStart, [], ANN)
  const expiryAfter = fold(expiryStart, [
    frame(0, [[ANN, act<G54Action>({ t: "coup", target: CARA })]]),
    frame(1, [[CARA, act<G54Action>({ t: "reveal", index: 0 })]]),
  ], ANN)
  expect(expiryAfter.tokens.treaty).toEqual([])
  expect(deriveEvents(expiryBefore, expiryAfter).map((event) => event.kind)).toContain(
    "treaty-expired",
  )
})

test("bomb-cleared fires wherever the Bomb leaves the table, real or caught", () => {
  const bombSet: readonly RoleId[] = ["banker", "director", "anarchist", "peacekeeper", "politician"]
  const base = genesisWith(bombSet)

  // A real defuse: the Bomb clears in the interval after the defuse claim passes.
  const realStart = withCoins(withHand(base, BOB, ["anarchist", "banker"]), ANN, 3)
  const realFrames: readonly Frame<G54Action>[] = [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "anarchist", target: BOB })]]),
    frame(1, [[BOB, act<G54Action>({ t: "claim", role: "anarchist", target: null })]]),
    frame(2, [[ANN, pass], [BOB, pass], [CARA, pass]]),
  ]
  const realIntervals = intervalEvents(realStart, realFrames)
  expect(realIntervals[2]!.map((event) => event.kind)).toContain("bomb-cleared")

  // A caught defuse: the reveal lands a frame BEFORE the Bomb clears, so the
  // clearing interval shows no card loss. The old guard missed exactly here.
  const caughtStart = withCoins(withHand(base, BOB, ["banker", "banker", "banker"]), ANN, 3)
  const caughtFrames: readonly Frame<G54Action>[] = [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "anarchist", target: BOB })]]),
    frame(1, [[BOB, act<G54Action>({ t: "claim", role: "anarchist", target: null })]]),
    frame(2, [[CARA, act<G54Action>({ t: "challenge" })]]),
    frame(3, [[BOB, act<G54Action>({ t: "concede" })]]),
    frame(4, [[BOB, act<G54Action>({ t: "reveal", index: 0 })]]),
    frame(5, [[BOB, pass]]),
  ]
  const caughtIntervals = intervalEvents(caughtStart, caughtFrames)
  expect(caughtIntervals[4]!.map((event) => event.kind)).toContain("influence-lost")
  expect(caughtIntervals[4]!.map((event) => event.kind)).not.toContain("bomb-cleared")
  expect(caughtIntervals[5]!.map((event) => event.kind)).toContain("bomb-cleared")
})

test("claim-blocked fires on a real block but not on a claim swap", () => {
  const blockSet: readonly RoleId[] = ["banker", "director", "guerrilla", "peacekeeper", "politician"]
  const blockStart = withCoins(
    withHand(genesisWith(blockSet), BOB, ["guerrilla", "banker"]),
    ANN,
    4,
  )
  const blockFrames: readonly Frame<G54Action>[] = [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "guerrilla", target: BOB })]]),
    frame(1, [[ANN, pass], [BOB, pass], [CARA, pass]]),
    frame(2, [[BOB, act<G54Action>({ t: "block", role: "guerrilla" })]]),
  ]
  const blockBefore = fold(blockStart, blockFrames.slice(0, 2), ANN)
  const blockAfter = fold(blockStart, blockFrames.slice(0, 3), ANN)
  expect(blockBefore.pending?.blocker).toBeNull()
  expect(blockAfter.pending?.blocker).toBe(BOB)
  expect(deriveEvents(blockBefore, blockAfter).map((event) => event.kind)).toContain("claim-blocked")

  const spySet: readonly RoleId[] = ["spy", "director", "guerrilla", "peacekeeper", "politician"]
  const spyStart = withCoins(
    withHand(genesisWith(spySet), ANN, ["spy", "guerrilla"]),
    ANN,
    4,
  )
  const spyStart2 = withHand(spyStart, BOB, ["guerrilla", "banker"])
  const spyFrames: readonly Frame<G54Action>[] = [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "spy", target: null })]]),
    frame(1, [[ANN, pass], [BOB, pass], [CARA, pass]]),
    frame(2, [[ANN, act<G54Action>({ t: "claim", role: "guerrilla", target: BOB })]]),
    frame(3, [[ANN, pass], [BOB, pass], [CARA, pass]]),
    frame(4, [[BOB, act<G54Action>({ t: "block", role: "guerrilla" })]]),
  ]
  const spyBefore = fold(spyStart2, spyFrames.slice(0, 2), ANN)
  const spyAfter = fold(spyStart2, spyFrames, ANN)
  expect(spyBefore.pending?.role).toBe("spy")
  expect(spyAfter.pending?.blocker).toBe(BOB)
  expect(deriveEvents(spyBefore, spyAfter).map((event) => event.kind)).not.toContain(
    "claim-blocked",
  )
})

test("targeted fires on a genuine victim but not during a mass claim", () => {
  const hitSet: readonly RoleId[] = ["banker", "director", "guerrilla", "peacekeeper", "politician"]
  const hitStart = withCoins(genesisWith(hitSet), ANN, 4)
  const hitBefore = fold(hitStart, [], ANN)
  const hitAfter = fold(hitStart, [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "guerrilla", target: BOB })]]),
  ], ANN)
  expect(deriveEvents(hitBefore, hitAfter).map((event) => event.kind)).toContain("targeted")

  const massSet: readonly RoleId[] = ["banker", "director", "general", "peacekeeper", "politician"]
  const massStart = withCoins(genesisWith(massSet), ANN, 5)
  const massBefore = fold(massStart, [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "general", target: null })]]),
  ], ANN)
  const massAfter = fold(massStart, [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "general", target: null })]]),
    frame(1, [[ANN, pass], [BOB, pass], [CARA, pass]]),
  ], ANN)
  expect(massBefore.pending?.target).toBeNull()
  expect(massAfter.pending?.target).toBe(BOB)
  expect(deriveEvents(massBefore, massAfter).map((event) => event.kind)).not.toContain("targeted")
})

test("you-owe-input fires on a private window but excludes a broadcast window", () => {
  const start = genesisWith(["banker", "director", "guerrilla", "peacekeeper", "politician"])
  const before = fold(start, [], ANN)
  const incomeAfter = fold(start, [frame(0, [[ANN, act<G54Action>({ t: "income" })]]), frame(1, [[BOB, pass], [CARA, pass]])], ANN)
  expect(deriveEvents(before, incomeAfter).map((event) => event.kind)).toContain("you-owe-input")

  const claimAfter = fold(start, [
    frame(0, [[ANN, act<G54Action>({ t: "claim", role: "banker", target: null })]]),
  ], ANN)
  expect(claimAfter.window?.kind).toBe("any")
  expect(claimAfter.owedSeats).toContain(BOB)
  expect(deriveEvents(before, claimAfter).map((event) => event.kind)).not.toContain("you-owe-input")
})

const ALL_KINDS: Readonly<Record<GameEvent["kind"], true>> = {
  "coins-gained": true,
  "coins-lost": true,
  "influence-lost": true,
  eliminated: true,
  resigned: true,
  "arms-reveal": true,
  "card-gained": true,
  "turn-started": true,
  "claim-opened": true,
  targeted: true,
  "you-owe-input": true,
  "game-over": true,
  "claim-blocked": true,
  "treaty-formed": true,
  "treaty-expired": true,
  "peacekeeping-gained": true,
  "tax-marked": true,
  "disappear-placed": true,
  "bomb-placed": true,
  "bomb-passed": true,
  "bomb-cleared": true,
}

test("every GameEvent kind has a catalogue row", () => {
  for (const kind of Object.keys(ALL_KINDS) as GameEvent["kind"][]) {
    expect(CATALOGUE[kind]).toBeDefined()
  }
  expect(Object.keys(CATALOGUE).sort()).toEqual(Object.keys(ALL_KINDS).sort())
})

test("the composable baselines on mount and forwards only continuations", () => {
  const view = shallowRef<G54View | null>(null)
  const shown: Toast[] = []
  useGameToasts({
    view,
    identities: ref<ReadonlyMap<SeatId, SeatIdentity>>(IDENTITIES),
    sink: { show: (toast) => shown.push(toast) },
  })

  view.value = viewAfter([])
  expect(shown).toEqual([])

  view.value = viewAfter(incomeFrames)
  expect(shown).toEqual<readonly Toast[]>([
    { severity: "success", title: "You gained 1 coin (3 total)." },
  ])

  view.value = null
  view.value = viewAfter([])
  expect(shown).toHaveLength(1)
})
