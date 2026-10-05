<script setup lang="ts">
import { onMounted, ref } from "vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { parseRoomCode } from "#shared/rooms/code.ts"
import { joinRoom } from "@/composables/rooms-api"

definePageMeta({ layout: "shell" })

const route = useRoute()
const rawCode = route.params.code
const code = parseRoomCode(Array.isArray(rawCode) ? (rawCode[0] ?? "") : String(rawCode ?? ""))

const pending = ref(true)
const error = ref("")
const canRetry = ref(false)

const attempt = async () => {
  error.value = ""
  canRetry.value = false

  if (code === null) {
    pending.value = false
    error.value = "That room code is not valid. Check the link and try again."
    return
  }

  pending.value = true
  try {
    const outcome = await joinRoom(code)
    if (outcome.kind === "joined" || outcome.kind === "already-seated") {
      await navigateTo("/rooms/" + code, { replace: true })
      return
    }
    if (outcome.kind === "full") {
      error.value = "This room is full. Ask the host for a seat."
    } else if (outcome.kind === "missing") {
      error.value = "That room no longer exists. Check the code and try again."
    } else {
      error.value = outcome.reason
      canRetry.value = true
    }
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  void attempt()
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 pt-0">
    <h1 class="text-2xl leading-tight font-semibold">
      Join a room
    </h1>
    <Card>
      <CardContent class="pt-4">
        <div v-if="pending" class="flex items-center gap-3">
          <Spinner />
          <p role="status" class="text-muted-foreground text-sm leading-normal">
            Joining room…
          </p>
        </div>

        <div v-else class="flex flex-col gap-4">
          <p class="text-destructive text-sm leading-normal">
            {{ error }}
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <Button v-if="canRetry" type="button" variant="outline" @click="attempt">
              Try again
            </Button>
            <NuxtLink to="/" class="text-primary text-sm underline-offset-4 hover:underline">
              Back to the dashboard
            </NuxtLink>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
