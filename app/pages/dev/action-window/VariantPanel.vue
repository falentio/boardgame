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
    class="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-card p-4"
    data-slot="window-panel"
    role="group"
    :aria-label="menu.title"
  >
    <div class="flex flex-col gap-0.5">
      <h2 class="text-sm leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground text-xs leading-snug">
        {{ menu.note }}
      </p>
    </div>

    <WindowCardStrip :menu="menu" :busy="busy" :selection="selection" />

    <div class="flex items-center gap-2">
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
