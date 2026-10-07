<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import RoleCard from "@/components/g54/RoleCard.vue"
import SeatList from "@/components/room/SeatList.vue"
import ShareLink from "@/components/room/ShareLink.vue"
import { parseRoomCode } from "#shared/rooms/code.ts"
import { userId, type UserId } from "#shared/rooms/ids.ts"
import { useAuthSession } from "@/composables/useAuthSession"
import { useLobby } from "@/composables/useLobby"
import { formatRemaining } from "@/composables/room-time.ts"
import {
  kickMember,
  leaveRoom,
  startRoom,
  type KickOutcome,
  type LeaveOutcome,
  type StartOutcome,
} from "@/composables/rooms-api.ts"

definePageMeta({ layout: "shell" })

const route = useRoute()
const rawCode = route.params.code
const code = parseRoomCode(Array.isArray(rawCode) ? (rawCode[0] ?? "") : String(rawCode ?? ""))

const { user } = await useAuthSession()
const viewer = computed(() => (user.value ? userId(user.value.id) : null))

const { lobby, refetch, join } = useLobby(code, viewer)

const joining = ref(false)
const joinError = ref("")
const starting = ref(false)
const startError = ref("")
const leaving = ref(false)
const leaveError = ref("")
const leaveOpen = ref(false)
const kicking = ref(false)
const kickError = ref("")
const pendingKick = ref<{ user: UserId; name: string } | null>(null)
const redirecting = ref(false)
const seatsRegion = ref<HTMLElement | null>(null)
const nowMs = ref<number | null>(null)
let expiryTimer: ReturnType<typeof setInterval> | null = null

const plural = (count: number, singular: string): string => (count === 1 ? singular : `${singular}s`)

const startMessage = (outcome: StartOutcome): string => {
  if (outcome.kind === "not-host") return "Only the host can start the game."
  if (outcome.kind === "not-full") return "Every seat must be filled before you start."
  if (outcome.kind === "missing") return "That room no longer exists."
  return outcome.kind === "failed" ? outcome.reason : ""
}

const leaveMessage = (outcome: LeaveOutcome): string => {
  if (outcome.kind === "not-seated") return "You are not seated in this room."
  if (outcome.kind === "missing") return "That room no longer exists."
  return outcome.kind === "failed" ? outcome.reason : ""
}

const kickMessage = (outcome: KickOutcome): string => {
  if (outcome.kind === "not-host") return "Only the host can remove a player."
  if (outcome.kind === "not-seated") return "That player is no longer seated."
  if (outcome.kind === "missing") return "That room no longer exists."
  return outcome.kind === "failed" ? outcome.reason : ""
}

const leaveConsequence = computed((): string => {
  const current = lobby.value
  if (current.kind !== "room") return ""
  const seated = current.seats.filter((seat) => seat.occupant !== null).length
  if (seated <= 1) return "This closes the room."
  if (current.amIHost) return "The host moves to another player."
  return "You can rejoin with the link."
})

const expiry = computed((): { iso: string; absolute: string; label: string; closed: boolean } | null => {
  const current = lobby.value
  if (current.kind !== "room" || current.expiresAt === null || nowMs.value === null) return null
  const at = new Date(current.expiresAt)
  const remainingMs = current.expiresAt - nowMs.value
  return {
    iso: at.toISOString(),
    absolute: new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(at),
    label: remainingMs <= 0 ? "closed" : formatRemaining(remainingMs),
    closed: remainingMs <= 0,
  }
})

const redirectPending = computed(
  () => lobby.value.kind === "room" && lobby.value.gameRedirect,
)

onMounted(() => {
  nowMs.value = Date.now()
  expiryTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 60_000)
})

onUnmounted(() => {
  if (expiryTimer !== null) clearInterval(expiryTimer)
})

watch(
  () => lobby.value.kind === "room" && lobby.value.gameRedirect,
  (yes) => {
    if (!yes || redirecting.value || !import.meta.client || code === null) return
    redirecting.value = true
    void navigateTo(`/games/${code}`, { replace: true })
  },
  { immediate: true },
)

const onStart = async () => {
  const current = lobby.value
  if (current.kind !== "room" || !current.canStart) return
  startError.value = ""
  starting.value = true
  try {
    const outcome = await startRoom(current.room.code)
    if (outcome.kind === "started") {
      await navigateTo(`/games/${current.room.code}`)
      return
    }
    startError.value = startMessage(outcome)
  } finally {
    starting.value = false
  }
}

const onConfirmLeave = async () => {
  const current = lobby.value
  if (current.kind !== "room") return
  leaveError.value = ""
  leaving.value = true
  try {
    const outcome = await leaveRoom(current.room.code)
    if (outcome.kind === "left" || outcome.kind === "missing") {
      leaveOpen.value = false
      await navigateTo("/")
      return
    }
    leaveError.value = leaveMessage(outcome)
  } finally {
    leaving.value = false
  }
}

const onAskKick = (occupant: UserId) => {
  const current = lobby.value
  if (current.kind !== "room") return
  const seat = current.seats.find((row) => row.occupant === occupant)
  pendingKick.value = { user: occupant, name: seat?.name ?? "this player" }
}

const onConfirmKick = async () => {
  const current = lobby.value
  const target = pendingKick.value
  if (current.kind !== "room" || target === null) return
  kickError.value = ""
  kicking.value = true
  try {
    const outcome = await kickMember(current.room.code, target.user)
    if (outcome.kind === "kicked") {
      pendingKick.value = null
      refetch()
      await nextTick()
      seatsRegion.value?.focus()
      return
    }
    kickError.value = kickMessage(outcome)
  } finally {
    kicking.value = false
  }
}

const onJoin = async () => {
  joinError.value = ""
  joining.value = true
  try {
    const outcome = await join()
    if (outcome.kind === "full") {
      joinError.value = "This room is full. Ask the host for a seat."
    } else if (outcome.kind === "already-started") {
      joinError.value = "This game has already started."
    } else if (outcome.kind === "missing") {
      joinError.value = "That room no longer exists. Check the code and try again."
    } else if (outcome.kind === "failed") {
      joinError.value = outcome.reason
    }
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 pt-0">
    <Card>
      <CardContent class="pt-4">
        <div v-if="lobby.kind === 'loading'" class="flex flex-col gap-3">
          <h1 class="sr-only">
            Room
          </h1>
          <div class="flex items-center gap-3">
            <Spinner />
            <p role="status" class="text-muted-foreground text-sm leading-normal">
              Loading room…
            </p>
          </div>
        </div>

        <div v-else-if="lobby.kind === 'invalid'" class="flex flex-col gap-3">
          <h1 class="text-2xl leading-tight font-semibold">
            Room
          </h1>
          <p class="text-sm leading-normal">
            That room code is not valid.
          </p>
          <NuxtLink to="/" class="text-primary text-sm underline-offset-4 hover:underline">
            Back to the dashboard
          </NuxtLink>
        </div>

        <div v-else-if="lobby.kind === 'missing'" class="flex flex-col gap-3">
          <h1 class="text-2xl leading-tight font-semibold">
            Room
          </h1>
          <p class="text-sm leading-normal">
            That room no longer exists. Check the code and try again.
          </p>
          <NuxtLink to="/" class="text-primary text-sm underline-offset-4 hover:underline">
            Back to the dashboard
          </NuxtLink>
        </div>

        <div v-else-if="lobby.kind === 'failed'" class="flex flex-col gap-3">
          <h1 class="text-2xl leading-tight font-semibold">
            Room
          </h1>
          <p class="text-destructive text-sm leading-normal">
            {{ lobby.reason }}
          </p>
          <div>
            <Button type="button" variant="outline" @click="refetch">
              Retry
            </Button>
          </div>
        </div>

        <div v-else-if="redirectPending" class="flex flex-col gap-3">
          <h1 class="sr-only">
            Room
          </h1>
          <div class="flex items-center gap-3">
            <Spinner />
            <p role="status" class="text-muted-foreground text-sm leading-normal">
              Taking you to the game…
            </p>
          </div>
        </div>

        <div v-else class="flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <h1 class="truncate text-balance text-2xl leading-tight font-semibold" :title="lobby.room.name">
              {{ lobby.room.name }}
            </h1>
            <p class="text-muted-foreground text-sm leading-normal">
              Room code
              <span class="text-foreground font-mono tabular-nums">{{ lobby.room.code }}</span>
            </p>
            <p v-if="expiry" class="text-muted-foreground text-sm leading-normal">
              <template v-if="expiry.closed">
                This room has
                <time :datetime="expiry.iso" class="tabular-nums">closed</time>.
              </template>
              <template v-else>
                This room closes in
                <time :datetime="expiry.iso" class="tabular-nums">{{ expiry.label }}</time>
              </template>
              <span class="sr-only">({{ expiry.absolute }})</span>
            </p>
          </div>

          <ShareLink :link="lobby.room.link" />

          <div class="flex flex-col gap-3" ref="seatsRegion" tabindex="-1">
            <p class="text-sm leading-none font-medium">
              Seats
            </p>
            <SeatList :seats="lobby.seats" :can-kick="lobby.canKick" @kick="onAskKick" />
            <p role="status" class="text-muted-foreground text-sm leading-normal tabular-nums">
              {{ lobby.status.kind === "full"
                ? "All seats filled"
                : `Waiting for ${lobby.status.total - lobby.status.filled} more ${plural(lobby.status.total - lobby.status.filled, "player")}` }}
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <p class="text-sm leading-none font-medium">
              Roles
            </p>
            <div data-slot="role-strip" class="flex gap-3 overflow-x-auto pb-2">
              <RoleCard
                v-for="role in lobby.room.roles"
                :key="role"
                :role="role"
                class="w-40 shrink-0"
              />
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <template v-if="lobby.amIHost">
              <div v-if="lobby.started" class="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
                <p class="text-sm leading-none font-medium">
                  Game in progress
                </p>
                <p class="text-muted-foreground text-sm leading-normal">
                  You started this game. Jump back in.
                </p>
                <div>
                  <Button as-child>
                    <NuxtLink :to="`/games/${lobby.room.code}`">
                      Go to game
                    </NuxtLink>
                  </Button>
                </div>
              </div>

              <template v-else>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button type="button" :disabled="!lobby.canStart || starting" @click="onStart">
                    <Spinner v-if="starting" />
                    Start game
                  </Button>
                  <p
                    v-if="lobby.status.kind === 'waiting'"
                    class="text-muted-foreground text-sm leading-normal tabular-nums"
                  >
                    Waiting for {{ lobby.status.total - lobby.status.filled }} more
                  </p>
                </div>
                <p v-if="startError" role="alert" class="text-destructive text-sm leading-normal">
                  {{ startError }}
                </p>
              </template>
            </template>

            <p v-else-if="lobby.amISeated" class="text-muted-foreground text-sm leading-normal">
              Only the host can start the game.
            </p>

            <template v-else-if="lobby.started">
              <p class="text-sm leading-normal">
                This game has already started.
              </p>
            </template>

            <template v-else-if="lobby.status.kind === 'waiting'">
              <div>
                <Button type="button" :disabled="joining" @click="onJoin">
                  <Spinner v-if="joining" />
                  Join room
                </Button>
              </div>
              <p v-if="joinError" class="text-destructive text-sm leading-normal">
                {{ joinError }}
              </p>
            </template>

            <p v-else class="text-sm leading-normal">
              This room is full. Ask the host for a seat.
            </p>

            <div v-if="lobby.canLeave">
              <Button type="button" variant="outline" data-leave-room @click="leaveOpen = true">
                Leave room
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <AlertDialog :open="leaveOpen" @update:open="(open) => { if (!open && !leaving) leaveOpen = false }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this room?</AlertDialogTitle>
          <AlertDialogDescription>{{ leaveConsequence }}</AlertDialogDescription>
        </AlertDialogHeader>
        <p v-if="leaveError" role="alert" class="text-destructive text-sm leading-normal">
          {{ leaveError }}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="leaving">
            Cancel
          </AlertDialogCancel>
          <Button type="button" variant="destructive" :disabled="leaving" @click="onConfirmLeave">
            <Spinner v-if="leaving" />
            Leave room
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="pendingKick !== null" @update:open="(open) => { if (!open && !kicking) pendingKick = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {{ pendingKick?.name ?? "this player" }}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose their seat and can rejoin only if the room is still open.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p v-if="kickError" role="alert" class="text-destructive text-sm leading-normal">
          {{ kickError }}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="kicking">
            Cancel
          </AlertDialogCancel>
          <Button type="button" variant="destructive" :disabled="kicking" @click="onConfirmKick">
            <Spinner v-if="kicking" />
            Remove
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
