<script setup lang="ts">
import { useId } from "vue"
import { CheckIcon, CopyIcon } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import RoomQr from "@/components/room/RoomQr.vue"

const props = defineProps<{ link: string }>()

const linkId = useId()
const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

const copy = async () => {
  if (!import.meta.client) return
  if (!("clipboard" in navigator)) return
  try {
    await navigator.clipboard.writeText(props.link)
    copied.value = true
    if (resetTimer !== null) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    copied.value = false
  }
}

const selectLink = (event: FocusEvent) => {
  const target = event.target
  if (target instanceof HTMLInputElement) target.select()
}

onUnmounted(() => {
  if (resetTimer !== null) clearTimeout(resetTimer)
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <Label :for="linkId">Room link</Label>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        :id="linkId"
        :model-value="link"
        readonly
        class="sm:flex-1"
        @focus="selectLink"
      />
      <Button type="button" variant="outline" class="sm:shrink-0" @click="copy">
        <component :is="copied ? CheckIcon : CopyIcon" />
        Copy link
      </Button>
      <RoomQr :link="link" />
    </div>
    <p role="status" class="min-h-5 text-sm text-muted-foreground">
      {{ copied ? "Copied" : "" }}
    </p>
  </div>
</template>
