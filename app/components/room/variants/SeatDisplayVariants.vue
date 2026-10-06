<script setup lang="ts">
import { computed } from "vue"
import type { SeatRow } from "@/composables/room-domain.ts"
import VariantPicker from "./VariantPicker.vue"
import SeatListList from "./SeatListList.vue"
import SeatListRoster from "./SeatListRoster.vue"
import SeatListGrid from "./SeatListGrid.vue"
import SeatListChips from "./SeatListChips.vue"
import SeatListStage from "./SeatListStage.vue"

defineProps<{ seats: readonly SeatRow[] }>()

const OPTIONS = [
  { id: "list", label: "List" },
  { id: "roster", label: "Roster" },
  { id: "grid", label: "Grid" },
  { id: "chips", label: "Chips" },
  { id: "stage", label: "Stage" },
] as const

const COMPONENTS = {
  list: SeatListList,
  roster: SeatListRoster,
  grid: SeatListGrid,
  chips: SeatListChips,
  stage: SeatListStage,
} as const

type VariantId = keyof typeof COMPONENTS

const route = useRoute()
const router = useRouter()

const isVariantId = (value: unknown): value is VariantId =>
  typeof value === "string" && value in COMPONENTS

const variant = computed<VariantId>({
  get() {
    const raw = route.query.variant
    const value = Array.isArray(raw) ? raw[0] : raw
    return isVariantId(value) ? value : "list"
  },
  set(next) {
    router.replace({ query: { ...route.query, variant: next } })
  },
})

const active = computed(() => COMPONENTS[variant.value])
</script>

<template>
  <div>
    <component :is="active" :seats="seats" />
    <VariantPicker v-model="variant" :options="OPTIONS" />
  </div>
</template>
