<script setup lang="ts">
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { WindowMenu } from "@/composables/window-menu.ts"
import { Button } from "@/components/ui/button"
import { useWindowSelection } from "./useWindowSelection.ts"
import WindowCardStrip from "./WindowCardStrip.vue"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const selection = useWindowSelection(
  () => props.menu,
  () => props.busy === true,
  (action) => emit("act", action),
)
const { confirmReady, confirmLabel, confirm } = selection
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:gap-4"
    data-slot="window-dock"
    role="group"
    :aria-label="menu.title"
  >
    <div class="flex min-w-0 shrink-0 flex-col gap-0.5 sm:w-44">
      <h2 class="text-sm leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground text-xs leading-snug">
        {{ menu.note }}
      </p>
    </div>

    <div class="min-w-0 flex-1">
      <WindowCardStrip :menu="menu" :busy="busy" :selection="selection" />
    </div>

    <div class="flex shrink-0 items-center sm:ps-2">
      <Button
        type="button"
        size="sm"
        :disabled="busy === true || !confirmReady"
        :aria-label="confirmLabel"
        @click="confirm"
      >
        Confirm
      </Button>
    </div>
  </div>
</template>
