<script setup lang="ts">
import type { CreateRoomConfig } from "@/composables/room-config"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import RoleStrip from "@/components/room/RoleStrip.vue"

const props = defineProps<{
  request: CreateRoomConfig | null
  pending?: boolean
  error?: string
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const onOpenChange = (open: boolean) => {
  if (open || props.pending) return
  emit("cancel")
}
</script>

<template>
  <AlertDialog :open="request !== null" @update:open="onOpenChange">
    <!-- reka-ui falls back to the last-focused element (the form's Seats select)
         on close; the page owns focus restoration to the submit button instead. -->
    <AlertDialogContent
      class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      @close-auto-focus.prevent
    >
      <AlertDialogHeader>
        <AlertDialogTitle>Create this room?</AlertDialogTitle>
        <AlertDialogDescription>
          {{ request?.name }} · {{ request?.seats }} seats. These are the roles every player picks from.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <dl class="flex flex-col gap-3 text-sm">
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-muted-foreground">Name</dt>
          <dd class="min-w-0 truncate font-medium" :title="request?.name">{{ request?.name }}</dd>
        </div>
        <div class="flex items-baseline justify-between gap-4">
          <dt class="text-muted-foreground">Seats</dt>
          <dd class="font-medium tabular-nums">{{ request?.seats }}</dd>
        </div>
        <div class="flex flex-col gap-3">
          <dt class="text-muted-foreground">Roles</dt>
          <dd><RoleStrip v-if="request" :roles="request.roles" /></dd>
        </div>
      </dl>

      <p v-if="error" role="alert" class="text-destructive text-sm leading-normal">{{ error }}</p>

      <AlertDialogFooter>
        <AlertDialogCancel :disabled="pending">Cancel</AlertDialogCancel>
        <Button type="button" :disabled="pending" @click="emit('confirm')">
          <Spinner v-if="pending" />
          Create room
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
