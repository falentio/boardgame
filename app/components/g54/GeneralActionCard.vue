<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { GeneralActionId } from "#shared/core/lockstep/games/g54/generals.ts"
import { computed } from "vue"
import { cn } from "@/lib/utils"
import { CARD_BADGE_CLASS, CARD_SHELL_CLASS } from "@/composables/card-shell"
import { generalCardModel } from "@/composables/general-card"

const props = withDefaults(
  defineProps<{
    action: GeneralActionId
    selected?: boolean
    disabled?: boolean
    selectable?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  {
    selected: false,
    disabled: false,
    selectable: false,
    class: undefined,
  },
)

const emit = defineEmits<{ select: [] }>()

const model = computed(() => generalCardModel(props.action))

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
    :aria-label="model.accessibleName"
    :role="selectable ? undefined : 'group'"
    data-slot="general-action-card"
    style="--accent: var(--primary)"
    :class="
      cn(
        'group/general-card',
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
    <span
      data-slot="general-action-card-name"
      class="px-3 pt-3 font-semibold text-sm text-balance break-words"
    >
      {{ model.label }}
    </span>

    <div class="aspect-square w-full overflow-hidden border-b-2" style="border-color: var(--accent)">
      <img
        :src="model.art"
        alt=""
        class="size-full object-cover"
        loading="lazy"
        decoding="async"
      >
    </div>

    <p
      class="line-clamp-5 px-3 py-2 text-xs leading-snug text-muted-foreground"
      :title="model.summary"
    >
      {{ model.summary }}
    </p>

    <div v-if="model.costLabel !== null" class="mt-auto flex flex-wrap items-center gap-1.5 px-3 pb-3">
      <span
        :class="CARD_BADGE_CLASS"
        style="background: color-mix(in oklab, var(--accent) 18%, var(--muted))"
      >
        {{ model.costLabel }}
      </span>
    </div>
  </component>
</template>
