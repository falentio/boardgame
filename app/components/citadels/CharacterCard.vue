<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts"
import { specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts"
import { computed } from "vue"
import { cn } from "@/lib/utils"
import { CARD_BADGE_CLASS, CARD_SHELL_CLASS, DISTRICT_ACCENT } from "@/composables/card-shell"

const props = withDefaults(
  defineProps<{
    character: CharacterId
    selectable?: boolean
    selected?: boolean
    disabled?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  {
    selectable: false,
    selected: false,
    disabled: false,
    class: undefined,
  },
)

const emit = defineEmits<{ select: [] }>()

const GRANT_LABEL: Readonly<Record<"gold" | "cards" | "gold-or-cards", string>> = {
  gold: "gold",
  cards: "a card",
  "gold-or-cards": "gold or a card",
}

const spec = computed(() => specOfCharacter(props.character))
const accent = computed(() =>
  spec.value.income === null ? null : DISTRICT_ACCENT[spec.value.income.counts],
)
const income = computed(() => {
  const bonus = spec.value.income
  return bonus === null ? null : `1 ${GRANT_LABEL[bonus.grants.kind]} per ${bonus.counts}`
})
const accessibleName = computed(
  () => `Rank ${String(spec.value.rank)}, ${spec.value.name}. ${spec.value.summary}`,
)

const onActivate = () => {
  if (!props.selectable || props.disabled) return
  emit("select")
}
</script>

<template>
  <component
    :is="selectable ? 'button' : 'div'"
    :type="selectable ? 'button' : undefined"
    :disabled="selectable ? disabled : undefined"
    :aria-pressed="selectable ? selected : undefined"
    :aria-label="accessibleName"
    :role="selectable ? undefined : 'group'"
    data-slot="character-card"
    :style="accent === null ? undefined : { '--accent': accent }"
    :class="
      cn(
        CARD_SHELL_CLASS,
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        selectable && 'cursor-pointer text-left',
        selected && 'ring-2 ring-primary',
        disabled && 'cursor-not-allowed opacity-50',
        props.class,
      )
    "
    @click="selectable && onActivate()"
  >
    <div class="flex min-h-36 flex-1 flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <span data-slot="character-card-name" class="font-semibold text-sm text-balance break-words">
          {{ spec.name }}
        </span>
        <span :class="CARD_BADGE_CLASS" class="shrink-0 tabular-nums">
          Rank {{ spec.rank }}
        </span>
      </div>
      <p class="line-clamp-5 text-xs leading-snug text-muted-foreground" :title="spec.summary">
        {{ spec.summary }}
      </p>
      <span
        v-if="income !== null"
        :class="CARD_BADGE_CLASS"
        class="mt-auto self-start"
        style="background: color-mix(in oklab, var(--accent) 18%, var(--muted))"
      >
        {{ income }}
      </span>
    </div>
  </component>
</template>
