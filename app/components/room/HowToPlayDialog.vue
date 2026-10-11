<script setup lang="ts">
import { CircleHelp } from "@lucide/vue"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import "@videojs/html/video/player"
import "@videojs/html/video/skin"

const HOW_TO_PLAY_TITLE = "How to play Coup: Rebellion G54"

type ViewportOrientation = "landscape" | "portrait"

// One cut of the tutorial per viewport aspect. The frame, the source, and the
// dialog width all follow this one choice.
type HowToPlayVariant = {
  src: string
  ratio: number
  maxWidth: string
}

const HOW_TO_PLAY_VARIANTS: Record<ViewportOrientation, HowToPlayVariant> = {
  landscape: { src: "/g54/how-to-play.mp4", ratio: 16 / 9, maxWidth: "sm:max-w-3xl" },
  portrait: { src: "/g54/how-to-play-portrait.mp4", ratio: 9 / 16, maxWidth: "sm:max-w-sm" },
}

const portraitViewport = ref(false)
const variant = computed<HowToPlayVariant>(() =>
  portraitViewport.value ? HOW_TO_PLAY_VARIANTS.portrait : HOW_TO_PLAY_VARIANTS.landscape,
)

const videoEl = ref<HTMLVideoElement | null>(null)
let portraitQuery: MediaQueryList | null = null

const onPortraitQueryChange = (event: MediaQueryListEvent) => {
  portraitViewport.value = event.matches
}

onMounted(() => {
  portraitQuery = matchMedia("(orientation: portrait)")
  portraitViewport.value = portraitQuery.matches
  portraitQuery.addEventListener("change", onPortraitQueryChange)
})

onBeforeUnmount(() => {
  portraitQuery?.removeEventListener("change", onPortraitQueryChange)
  portraitQuery = null
})

// Both files carry the same cut, so a rotation resumes the watch instead of
// sending the viewer back to the first frame.
watch(
  variant,
  (next, prev) => {
    if (prev === undefined) return
    const el = videoEl.value
    if (el === null) return
    const resumeAt = el.currentTime
    const wasPlaying = !el.paused
    nextTick(() => {
      // preload="none" leaves the swapped-in file unloaded until something asks
      // for it, so this asks for it.
      el.load()
      el.addEventListener(
        "loadedmetadata",
        () => {
          el.currentTime = resumeAt
          if (wasPlaying) void el.play()
        },
        { once: true },
      )
    })
  },
)

</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button type="button" variant="outline" class="w-full">
        <CircleHelp aria-hidden="true" />
        How to play
      </Button>
    </DialogTrigger>
    <DialogContent :class="['motion-reduce:animate-none', variant.maxWidth]">
      <DialogTitle>{{ HOW_TO_PLAY_TITLE }}</DialogTitle>
      <div class="how-to-play @container bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <video-player
          class="mx-auto aspect-[var(--how-to-play-ratio)] h-[min(60svh,calc(100cqw/var(--how-to-play-ratio)))]"
          :style="{ '--how-to-play-ratio': variant.ratio }"
        >
          <video-skin>
            <video ref="videoEl" :src="variant.src" preload="none" playsinline />
          </video-skin>
        </video-player>
      </div>
    </DialogContent>
  </Dialog>
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
