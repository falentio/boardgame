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
  <section
    class="flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-sm"
    data-slot="window-stage"
    role="group"
    :aria-label="menu.title"
  >
    <header class="border-b border-foreground/10 bg-muted/40 px-6 py-4">
      <h2 class="text-base leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground mt-0.5 text-sm leading-snug">
        {{ menu.note }}
      </p>
    </header>

    <div class="flex min-w-0 flex-1 flex-col justify-center px-6 py-5">
      <WindowCardStrip :menu="menu" :busy="busy" :selection="selection" />
    </div>

    <footer
      class="flex items-center justify-end gap-2 border-t border-foreground/10 bg-muted/40 px-6 py-3"
    >
      <Button
        type="button"
        size="lg"
        :disabled="busy === true || !confirmReady"
        :aria-label="confirmLabel"
        @click="confirm"
      >
        Confirm
      </Button>
    </footer>
  </section>
</template>
