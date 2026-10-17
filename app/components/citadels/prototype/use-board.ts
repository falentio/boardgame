import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts"
import { CHARACTER_CATALOG, specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts"
import { BASIC_DISTRICTS, UNIQUE_DISTRICTS } from "#shared/core/lockstep/games/citadels/districts.ts"
import type { Ref } from "vue"
import { computed, ref } from "vue"

export interface ProtoCard {
  readonly id: string
  readonly gold: number
}

export interface ProtoSeat {
  readonly seat: string
  readonly name: string
  readonly gold: number
  readonly city: readonly ProtoCard[]
  readonly handCount: number
  readonly crown: boolean
  readonly character: CharacterId | null
  readonly worn: boolean
}

export interface PrototypeBoard {
  readonly focused: Readonly<Ref<string>>
  readonly focus: (seat: string) => void
  readonly subject: Readonly<Ref<ProtoSeat>>
  readonly hand: Readonly<Ref<readonly string[]>>
  readonly city: Readonly<Ref<readonly ProtoCard[]>>
  readonly gold: Readonly<Ref<number>>
  readonly selected: Readonly<Ref<string | null>>
  readonly selectCard: (id: string | null) => void
  readonly build: (id: string) => void
  readonly cast: readonly CharacterId[]
  readonly drafted: Readonly<Ref<CharacterId | null>>
  readonly draft: (id: CharacterId) => void
  readonly rivals: readonly ProtoSeat[]
  readonly roster: typeof ROSTER
  readonly produced: readonly string[]
  readonly discarded: readonly string[]
}

const card = (id: string, gold = 0): ProtoCard => ({ id, gold })

const RIVALS: readonly ProtoSeat[] = [
  {
    seat: "mara",
    name: "Mara",
    gold: 4,
    city: [card("dragon-gate"), card("barracks"), card("church"), card("tavern"), card("town-hall")],
    handCount: 2,
    crown: true,
    character: "assassin",
    worn: true,
  },
  {
    seat: "ilya",
    name: "Ilya",
    gold: 11,
    city: [
      card("harbor"),
      card("museum", 3),
      card("palace"),
      card("fortress"),
      card("prison"),
      card("manor"),
    ],
    handCount: 1,
    crown: false,
    character: null,
    worn: false,
  },
  {
    seat: "jo",
    name: "Jo",
    gold: 2,
    city: [card("great-wall"), card("watchtower"), card("monastery"), card("tavern")],
    handCount: 4,
    crown: false,
    character: "merchant",
    worn: true,
  },
  {
    seat: "tan",
    name: "Tan",
    gold: 6,
    city: [card("keep"), card("temple"), card("prison"), card("market")],
    handCount: 3,
    crown: false,
    character: null,
    worn: false,
  },
]

const STARTING_HAND: readonly string[] = [
  "palace",
  "cathedral",
  "laboratory",
  "gold-mine",
  "watchtower",
]

const STARTING_CITY: readonly ProtoCard[] = [
  card("castle"),
  card("keep"),
  card("watchtower"),
  card("manor"),
  card("docks"),
]

const CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
]

const ROSTER = CHARACTER_CATALOG.filter((spec) => spec.rank <= 8)

const DISTRICT_POOL = [...BASIC_DISTRICTS, ...UNIQUE_DISTRICTS.slice(0, 14)]

const NAME_OF = new Map(ROSTER.map((spec) => [spec.id, spec.name]))
const COST_OF = new Map(DISTRICT_POOL.map((spec) => [spec.id, spec.cost]))

export const characterName = (id: CharacterId | null): string | null =>
  id === null ? null : (NAME_OF.get(id) ?? id)

export const districtCost = (id: string): number => COST_OF.get(id) ?? specOfDistrict(id).cost

export const createPrototypeBoard = (): PrototypeBoard => {
  const focused = ref("you")
  const gold = ref(7)
  const hand = ref<readonly string[]>([...STARTING_HAND])
  const city = ref<readonly ProtoCard[]>([...STARTING_CITY])
  const drafted = ref<CharacterId | null>("merchant")
  const selected = ref<string | null>(null)

  const mine = computed<ProtoSeat>(() => ({
    seat: "you",
    name: "You",
    gold: gold.value,
    city: city.value,
    handCount: hand.value.length,
    crown: false,
    character: drafted.value,
    worn: false,
  }))

  const subject = computed<ProtoSeat>(() =>
    focused.value === "you"
      ? mine.value
      : (RIVALS.find((seat) => seat.seat === focused.value) ?? mine.value),
  )

  const build = (id: string) => {
    if (focused.value !== "you") return
    if (!hand.value.includes(id)) return
    const cost = districtCost(id)
    if (gold.value < cost) return
    gold.value -= cost
    hand.value = hand.value.filter((entry) => entry !== id)
    city.value = [...city.value, card(id)]
    selected.value = null
  }

  return {
    focused,
    focus: (seat: string) => {
      focused.value = seat
      selected.value = null
    },
    subject,
    hand,
    city,
    gold,
    selected,
    selectCard: (id: string | null) => {
      selected.value = id
    },
    build,
    cast: CAST,
    drafted,
    draft: (id: CharacterId) => {
      drafted.value = id
    },
    rivals: RIVALS,
    roster: ROSTER,
    produced: ["spy"],
    discarded: ["framework", "necropolis"],
  }
}
