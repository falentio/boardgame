import { expect, test } from "vitest"
import { ref, shallowRef } from "vue"
import {
  act,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  type Frame,
  type SeatInput,
} from "#shared/core/lockstep/index.ts"
import {
  g54,
  type G54Action,
  type G54State,
  type G54View,
} from "#shared/core/lockstep/games/g54/index.ts"
import { seatId, type SeatId } from "#shared/rooms/ids.ts"
import type { SeatIdentity } from "../board-view.ts"
import {
  deriveEvents,
  isContinuation,
  toastsFor,
  useGameToasts,
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
