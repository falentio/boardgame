<script setup lang="ts">
import type { VideoPlayerElement } from "@videojs/html/video"
import { PauseIcon, PlayIcon } from "@lucide/vue"
import { onMounted, onUnmounted, ref, useTemplateRef } from "vue"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  autoplays,
  HOW_TO_PLAY_SRC,
  HOW_TO_PLAY_TITLE,
  isMuted,
  preloadOf,
  type HowToPlayPresence,
} from "@/composables/how-to-play"
import "@videojs/html/video/player"
import "@videojs/html/video/skin"

const props = defineProps<{ presence: HowToPlayPresence }>()

const player = useTemplateRef<VideoPlayerElement>("player")
const playing = ref(false)

type PlayerStore = VideoPlayerElement["store"]
let store: PlayerStore | null = null
let unsubscribe: (() => void) | null = null

const sync = () => {
  playing.value = store !== null && !store.paused
}

const start = () => {
  if (store === null) return
  void Promise.resolve(store.play()).catch(() => {})
}

onMounted(() => {
  const element = player.value
  if (element === null) return
  store = element.store
  sync()
  unsubscribe = store.subscribe(sync)
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (autoplays(props.presence, reducedMotion)) start()
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribe = null
  store = null
})

const toggle = () => {
  if (store === null) return
  if (store.paused) start()
  else store.pause()
}
</script>

<template>
  <div
    :class="
      cn(
        'how-to-play text-card-foreground bg-card relative overflow-hidden rounded-xl ring-1 ring-foreground/10',
        presence.aspect,
        presence.playerClass,
      )
    "
    :data-variant="presence.id"
    :data-placement="presence.placement"
  >
    <video-player ref="player">
      <video-skin>
        <video
          :src="HOW_TO_PLAY_SRC"
          :aria-label="HOW_TO_PLAY_TITLE"
          :muted="isMuted(presence)"
          :preload="preloadOf(presence)"
          playsinline
        />
      </video-skin>
    </video-player>

    <Button
      v-if="isMuted(presence)"
      type="button"
      variant="secondary"
      size="icon-sm"
      class="absolute top-2 left-2 z-10"
      :aria-pressed="playing"
      :aria-label="playing ? 'Pause how-to-play video' : 'Play how-to-play video'"
      @click="toggle"
    >
      <PauseIcon v-if="playing" />
      <PlayIcon v-else />
    </Button>
  </div>
</template>

<style scoped>
.how-to-play {
  --media-accent-color: var(--primary);
  --media-accent-text-color: var(--primary-foreground);
  --media-border-color: var(--border);
  --media-border-radius: var(--radius);
  --media-font-family: var(--font-sans);
  /* The skin defaults this to a fixed 16px; 1rem keeps the controls scaling with the
     user's font size. */
  --media-scale-unit: 1rem;
}

video-player {
  display: block;
  width: 100%;
  height: 100%;
}

video-skin {
  display: block;
  width: 100%;
  height: 100%;
}

video-skin:not(:defined) {
  visibility: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .how-to-play,
  .how-to-play * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>
