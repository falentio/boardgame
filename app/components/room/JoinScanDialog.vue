<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { ScanQrCodeIcon } from "@lucide/vue"
import type { RoomCode } from "#shared/rooms/ids.ts"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { InputGroupButton } from "@/components/ui/input-group"
import { useQrScanner } from "@/composables/useQrScanner"
import type { ScanState } from "@/composables/scan-session"

const emit = defineEmits<{
  join: [code: RoomCode]
}>()

const open = ref(false)
const { video, state, start, stop } = useQrScanner()

const copyFor = (current: ScanState): { tone: "muted" | "destructive"; text: string } | null => {
  switch (current.kind) {
    case "idle":
    case "starting":
    case "decoded":
      return null
    case "scanning":
      return { tone: "muted", text: "Looking for a QR code…" }
    case "unrecognized":
      return { tone: "destructive", text: "That code is not a room link. Point the camera at the room's QR code." }
    case "denied":
      return { tone: "destructive", text: "Camera access is blocked. Allow camera access in your browser settings, then scan again. You can also type the room code." }
    case "no-camera":
      return { tone: "destructive", text: "This device has no camera. Type the room code instead." }
    case "insecure":
      return { tone: "destructive", text: "The camera only works on a secure connection (https). Type the room code instead." }
    case "failed":
      return { tone: "destructive", text: "Unable to start the camera. Type the room code instead." }
  }
}

const needsManual = (current: ScanState): boolean => {
  switch (current.kind) {
    case "idle":
    case "starting":
    case "scanning":
    case "decoded":
      return false
    case "unrecognized":
    case "denied":
    case "no-camera":
    case "insecure":
    case "failed":
      return true
  }
}

const copy = computed(() => copyFor(state.value))
const manual = computed(() => needsManual(state.value))

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    void start()
  } else {
    stop()
  }
})

watch(state, (current) => {
  if (current.kind === "decoded") {
    stop()
    open.value = false
    emit("join", current.code)
  }
})

const retry = () => {
  stop()
  void start()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <InputGroupButton size="icon-xs" aria-label="Scan a room code">
        <ScanQrCodeIcon />
      </InputGroupButton>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Scan a room code</DialogTitle>
        <DialogDescription>
          Point a phone camera at the room's QR code.
        </DialogDescription>
      </DialogHeader>

      <div class="relative overflow-hidden rounded-lg bg-black">
        <video
          ref="video"
          class="aspect-square w-full object-cover"
          playsinline
          muted
        />
        <p
          v-if="state.kind === 'starting'"
          role="status"
          class="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white"
        >
          Starting the camera…
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <p
          v-if="copy"
          role="status"
          :class="copy.tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'"
          class="text-sm"
        >
          {{ copy.text }}
        </p>

        <div v-if="manual" class="flex flex-wrap gap-2">
          <Button v-if="state.kind === 'denied'" type="button" variant="outline" @click="retry">
            Try again
          </Button>
          <Button type="button" variant="ghost" @click="open = false">
            Type the room code
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
