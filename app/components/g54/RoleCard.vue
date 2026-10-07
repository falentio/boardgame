<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import { computed } from "vue"
import { cn } from "@/lib/utils"
import { CARD_BADGE_CLASS, CARD_SHELL_CLASS } from "@/composables/card-shell"
import { roleCardModel } from "@/composables/role-card"

const props = withDefaults(
  defineProps<{
    role: RoleId
    faceDown?: boolean
    spent?: boolean
    selected?: boolean
    disabled?: boolean
    selectable?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  {
    faceDown: false,
    spent: false,
    selected: false,
    disabled: false,
    selectable: false,
    class: undefined,
  },
)

const emit = defineEmits<{ select: [] }>()

const model = computed(() => roleCardModel(props.role))

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
    data-slot="role-card"
    :data-face="faceDown ? 'down' : 'up'"
    :style="{ '--accent': model.accent }"
    :class="
      cn(
        'group/role-card',
        CARD_SHELL_CLASS,
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        selectable && 'cursor-pointer text-left',
        selected && 'ring-2 ring-primary',
        disabled && 'cursor-not-allowed opacity-50',
        spent && 'grayscale',
        props.class,
      )
    "
    @click="selectable && onActivate()"
  >
    <template v-if="!faceDown">
      <div class="flex min-h-36 flex-1">
        <div
          data-slot="role-card-spine"
          class="flex w-8 shrink-0 flex-col items-center gap-2 border-r border-foreground/10 py-2"
          style="background: color-mix(in oklab, var(--accent) 14%, transparent)"
        >
          <img
            :src="model.categoryArt"
            :alt="`${model.categoryLabel} category`"
            class="size-6 rounded-[0.3rem] object-cover ring-1 ring-foreground/10"
            loading="lazy"
            decoding="async"
          >
          <span
            class="text-[0.625rem] font-medium tracking-wide uppercase"
            style="color: var(--accent); writing-mode: vertical-rl"
          >
            {{ model.categoryLabel }}
          </span>
        </div>

        <div class="flex min-w-0 flex-1 flex-col">
          <span data-slot="role-card-name" class="px-3 pt-3 font-semibold text-sm text-balance break-words">
            {{ model.name }}
          </span>

          <div class="aspect-square w-full overflow-hidden border-b-2" style="border-color: var(--accent)">
            <img
              :src="model.art"
              alt=""
              class="size-full object-cover object-[50%_18%]"
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

          <div
            v-if="model.cost !== null || model.block !== null"
            class="mt-auto flex flex-wrap items-center gap-1.5 px-3 pb-3"
          >
            <span
              v-if="model.cost !== null"
              :class="CARD_BADGE_CLASS"
              style="background: color-mix(in oklab, var(--accent) 18%, var(--muted))"
            >
              {{ model.cost }}
            </span>
            <span
              v-if="model.block !== null"
              :class="CARD_BADGE_CLASS"
            >
              {{ model.block }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="spent || $slots.overlay"
        data-slot="role-card-status"
        class="flex flex-wrap items-center gap-1 border-t border-foreground/10 px-2 py-1"
      >
        <span
          v-if="spent"
          class="rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase ring-1 ring-foreground/10"
        >
          Spent
        </span>
        <slot name="overlay" />
      </div>
    </template>

    <div
      v-else
      data-slot="role-card-back"
      class="flex aspect-[848/1264] flex-col items-center justify-center gap-2 bg-neutral-900 text-neutral-100"
    >
      <span class="text-2xl font-semibold tracking-[0.3em]">G54</span>
      <span class="text-[0.625rem] tracking-[0.2em] text-neutral-400 uppercase">Role</span>
    </div>
  </component>
</template>
