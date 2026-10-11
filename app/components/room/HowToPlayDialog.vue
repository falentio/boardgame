<script setup lang="ts">
import { CircleHelp } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import "@videojs/html/video/player"
import "@videojs/html/video/skin"

const HOW_TO_PLAY_SRC = "/g54/how-to-play.mp4"
const HOW_TO_PLAY_TITLE = "How to play Coup: Rebellion G54"
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button type="button" variant="outline" class="w-full">
        <CircleHelp aria-hidden="true" />
        How to play
      </Button>
    </DialogTrigger>
    <DialogContent class="motion-reduce:animate-none sm:max-w-3xl">
      <DialogTitle>{{ HOW_TO_PLAY_TITLE }}</DialogTitle>
      <div class="how-to-play bg-card ring-foreground/10 aspect-video overflow-hidden rounded-xl ring-1">
        <video-player>
          <video-skin>
            <video :src="HOW_TO_PLAY_SRC" preload="none" playsinline />
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

video-player,
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
