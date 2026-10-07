<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { SeatId } from "#shared/rooms/ids.ts"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsOf } from "#shared/users/initials.ts"
import { cn } from "@/lib/utils"
import { CARD_SHELL_CLASS } from "@/composables/card-shell"

const props = withDefaults(
  defineProps<{
    seat: SeatId
    name: string
    image: string | null
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
    :aria-label="name"
    :role="selectable ? undefined : 'group'"
    :data-seat="seat"
    data-slot="player-card"
    :class="
      cn(
        'group/player-card',
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
    <div class="flex items-center gap-3 p-3">
      <Avatar class="size-11 shrink-0 rounded-full ring-1 ring-foreground/15">
        <AvatarImage v-if="image" :src="image" :alt="name" />
        <AvatarFallback class="rounded-full text-xs">
          {{ initialsOf(name) }}
        </AvatarFallback>
      </Avatar>
      <span data-slot="player-card-name" class="min-w-0 truncate font-semibold text-sm">
        {{ name }}
      </span>
    </div>
  </component>
</template>
