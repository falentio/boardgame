<script setup lang="ts">
import { CircleHelp } from "@lucide/vue"
import { computed } from "vue"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import HowToPlayVideo from "@/components/room/HowToPlayVideo.vue"
import {
  HOW_TO_PLAY_TRIGGER,
  HOW_TO_PLAY_TITLE,
  type HowToPlayPresence,
} from "@/composables/how-to-play"
import { cn } from "@/lib/utils"

const props = defineProps<{ presence: HowToPlayPresence }>()

const playerPresence = computed(() => ({ ...props.presence, playerClass: "" }))
</script>

<template>
  <div :class="cn('flex', presence.playerClass)">
    <Dialog v-if="presence.reveal === 'dialog'">
      <DialogTrigger as-child>
        <Button type="button" variant="outline">
          <CircleHelp aria-hidden="true" />
          {{ HOW_TO_PLAY_TRIGGER }}
        </Button>
      </DialogTrigger>
      <DialogContent class="motion-reduce:animate-none">
        <DialogTitle>{{ HOW_TO_PLAY_TITLE }}</DialogTitle>
        <HowToPlayVideo :presence="playerPresence" />
      </DialogContent>
    </Dialog>

    <Popover v-else-if="presence.reveal === 'popover'">
      <PopoverTrigger as-child>
        <Button type="button" variant="outline">
          <CircleHelp aria-hidden="true" />
          {{ HOW_TO_PLAY_TRIGGER }}
        </Button>
      </PopoverTrigger>
      <PopoverContent class="motion-reduce:animate-none">
        <PopoverTitle>{{ HOW_TO_PLAY_TITLE }}</PopoverTitle>
        <HowToPlayVideo :presence="playerPresence" />
      </PopoverContent>
    </Popover>

    <Drawer v-else-if="presence.reveal === 'drawer'">
      <DrawerTrigger as-child>
        <Button type="button" variant="outline">
          <CircleHelp aria-hidden="true" />
          {{ HOW_TO_PLAY_TRIGGER }}
        </Button>
      </DrawerTrigger>
      <DrawerContent class="motion-reduce:animate-none">
        <DrawerTitle>{{ HOW_TO_PLAY_TITLE }}</DrawerTitle>
        <HowToPlayVideo :presence="playerPresence" />
      </DrawerContent>
    </Drawer>
  </div>
</template>
