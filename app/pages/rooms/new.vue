<script setup lang="ts">
import { computed, nextTick, ref } from "vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import CreateRoomConfirmDialog from "@/components/room/CreateRoomConfirmDialog.vue"
import { GAME_UI } from "@/composables/game-ui"
import { createRoom } from "@/composables/rooms-api"
import type { CreateRoomConfig } from "@/composables/room-config"
import { boundsFor, defaultSetupFor, type GameKind, type RoomSetup } from "#shared/rooms/games.ts"

definePageMeta({ layout: "shell" })

const name = ref("New room")
const kind = ref<GameKind>("g54")
const seats = ref(5)
const setup = ref<RoomSetup | null>(defaultSetupFor("g54"))
const missing = ref<readonly string[]>([])
const submitting = ref(false)
const error = ref("")
const errorField = ref<"name" | "setup" | null>(null)
const formEl = ref<HTMLFormElement | null>(null)
const pendingCreate = ref<CreateRoomConfig | null>(null)
const createError = ref("")

const seatOptions = computed(() => {
  const { min, max } = boundsFor(kind.value)
  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
})

const canSubmit = computed(() => setup.value !== null && !submitting.value)

const onSetupChange = (next: RoomSetup | null, nextMissing: readonly string[]) => {
  setup.value = next
  missing.value = nextMissing
}

const onGameChange = (next: GameKind) => {
  kind.value = next
  setup.value = defaultSetupFor(next)
  missing.value = []
  const { min, max } = boundsFor(next)
  seats.value = Math.min(Math.max(seats.value, min), max)
}

const focusFirstProblem = () => {
  const form = formEl.value
  if (form === null) return
  if (errorField.value === "setup") {
    form
      .querySelector<HTMLButtonElement>("[data-setup-option], [data-role-option]")
      ?.focus()
    return
  }
  form.querySelector<HTMLInputElement>("#room-name")?.focus()
}

const onSubmit = () => {
  error.value = ""
  errorField.value = null

  const trimmed = name.value.trim()
  if (trimmed.length === 0) {
    error.value = "Enter a room name."
    errorField.value = "name"
    focusFirstProblem()
    return
  }

  const selected = setup.value
  if (selected === null) {
    const label = GAME_UI[kind.value].setupLabel.toLowerCase()
    error.value = `Choose the remaining ${label}: ${missing.value.join(", ")}.`
    errorField.value = "setup"
    focusFirstProblem()
    return
  }

  createError.value = ""
  pendingCreate.value = { name: trimmed, seats: seats.value, setup: selected }
}

const onConfirmCreate = async () => {
  const request = pendingCreate.value
  if (request === null || submitting.value) return
  submitting.value = true
  try {
    const outcome = await createRoom(request)
    if (outcome.kind === "created") {
      pendingCreate.value = null
      await navigateTo("/rooms/" + outcome.code)
      return
    }
    createError.value = outcome.reason
  } finally {
    submitting.value = false
  }
}

const onCancelCreate = async () => {
  pendingCreate.value = null
  createError.value = ""
  await nextTick()
  formEl.value?.querySelector<HTMLButtonElement>("button[type=submit]")?.focus()
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 pt-0">
    <h1 class="text-2xl leading-tight font-semibold">
      Create a room
    </h1>
    <Card>
      <CardContent class="pt-4">
        <form ref="formEl" novalidate @submit.prevent="onSubmit">
          <FieldGroup>
            <Field>
              <FieldLabel for="room-name">
                Room name
              </FieldLabel>
              <Input
                id="room-name"
                v-model="name"
                maxlength="60"
                placeholder="Movie night"
                :aria-invalid="errorField === 'name' ? true : undefined"
                :aria-describedby="errorField === 'name' ? 'create-error' : undefined"
              />
            </Field>
            <Field>
              <FieldLabel for="game">
                Game
              </FieldLabel>
              <Select :model-value="kind" @update:model-value="(value) => onGameChange(value as GameKind)">
                <SelectTrigger id="game" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="(game, key) in GAME_UI" :key="key" :value="key">
                    {{ game.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel for="seats">
                Seats
              </FieldLabel>
              <Select v-model="seats">
                <SelectTrigger id="seats" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="option in seatOptions" :key="option" :value="option">
                    {{ option }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>
                Choose {{ seatOptions[0] }} to {{ seatOptions[seatOptions.length - 1] }} seats, including you as host.
              </FieldDescription>
            </Field>
            <Field>
              <div
                role="group"
                aria-labelledby="setup-label"
                :aria-invalid="errorField === 'setup' ? true : undefined"
                :aria-describedby="errorField === 'setup' ? 'create-error' : undefined"
                class="flex flex-col gap-3"
              >
                <p id="setup-label" class="text-sm leading-none font-medium">
                  {{ GAME_UI[kind].setupLabel }}
                </p>
                <component
                  :is="GAME_UI[kind].createPicker"
                  :key="kind"
                  :setup="setup"
                  @change="onSetupChange"
                />
                <p
                  v-if="missing.length > 0"
                  class="text-muted-foreground text-sm leading-normal"
                >
                  Still to choose: {{ missing.join(", ") }}.
                </p>
              </div>
            </Field>
            <FieldError id="create-error" :errors="error ? [error] : []" />
            <Field>
              <Button type="submit" :disabled="!canSubmit">
                <Spinner v-if="submitting" />
                Create room
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>

    <CreateRoomConfirmDialog
      :request="pendingCreate"
      :pending="submitting"
      :error="createError"
      @confirm="onConfirmCreate"
      @cancel="onCancelCreate"
    />
  </div>
</template>
