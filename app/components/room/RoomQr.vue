<script setup lang="ts">
import { computed } from "vue"
import { renderSVG } from "uqr"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const props = defineProps<{ link: string }>()

const qrSrc = computed(() => "data:image/svg+xml," + encodeURIComponent(
  renderSVG(props.link, { ecc: "M", border: 2, blackColor: "#000000", whiteColor: "#ffffff" }),
))
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button type="button" variant="outline" class="sm:shrink-0">
        Show QR
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Room QR code</DialogTitle>
        <DialogDescription>
          Scan this code with a phone camera to join.
        </DialogDescription>
      </DialogHeader>
      <div class="flex justify-center">
        <img
          :src="qrSrc"
          alt="QR code for the room link"
          class="w-full max-w-72 rounded-lg bg-white p-3"
        >
      </div>
    </DialogContent>
  </Dialog>
</template>
