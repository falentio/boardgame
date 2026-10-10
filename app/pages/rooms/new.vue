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
import RolePicker from "@/components/room/RolePicker.vue"
import { completeRoles, defaultDraft, missingLabels, pickRole, type RoleDraft } from "@/composables/roles"
import { createRoom } from "@/composables/rooms-api"
import type { CreateRoomConfig } from "@/composables/room-config"
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"

definePageMeta({ layout: "shell" })

const seatOptions = [2, 3, 4, 5, 6, 7]

const name = ref("New room")
const seats = ref(5)
const draft = ref<RoleDraft>(defaultDraft())
const submitting = ref(false)
const error = ref("")
const errorField = ref<"name" | "roles" | null>(null)
const formEl = ref<HTMLFormElement | null>(null)
const pendingCreate = ref<CreateRoomConfig | null>(null)
const createError = ref("")

const roles = computed(() => completeRoles(draft.value))
const canSubmit = computed(() => roles.value !== null && !submitting.value)

const onChange = (next: RoleDraft) => {
  draft.value = next
}

const missing = computed(() => missingLabels(draft.value))

const focusFirstProblem = () => {
  const form = formEl.value
  if (form === null) return
  if (errorField.value === "roles") {
    form.querySelector<HTMLButtonElement>("[data-role-option]")?.focus()
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

  const selected = roles.value
  if (selected === null) {
    error.value = `Choose the remaining roles: ${missing.value.join(", ")}.`
    errorField.value = "roles"
    focusFirstProblem()
    return
  }

  createError.value = ""
  pendingCreate.value = { name: trimmed, seats: seats.value, roles: selected }
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
                Choose 2 to 7 seats, including you as host.
              </FieldDescription>
            </Field>
            <Field>
              <div
                role="group"
                aria-labelledby="roles-label"
                :aria-invalid="errorField === 'roles' ? true : undefined"
                :aria-describedby="errorField === 'roles' ? 'create-error' : undefined"
                class="flex flex-col gap-3"
              >
                <p id="roles-label" class="text-sm leading-none font-medium">
                  Roles
                </p>
                <RolePicker :draft="draft" @change="onChange" />
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
