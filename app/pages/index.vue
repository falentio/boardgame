<script setup lang="ts">
import { computed, ref } from "vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import JoinScanDialog from "@/components/room/JoinScanDialog.vue"
import type { RoomCode } from "#shared/rooms/ids.ts"
import { joinPath, parseJoinInput } from "#shared/rooms/link.ts"

definePageMeta({ layout: "shell" })

const code = ref("")
const submitted = ref(false)

const parsed = computed(() => parseJoinInput(code.value))
const invalid = computed(() => (submitted.value || code.value.trim().length > 0) && parsed.value === null)

const joinWith = async (target: RoomCode) => {
  await navigateTo(joinPath(target))
}

const onJoin = async () => {
  submitted.value = true
  const target = parsed.value
  if (target === null) return
  await joinWith(target)
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 pt-0">
    <h1 class="text-2xl leading-tight font-semibold">
      Play a game
    </h1>
    <div class="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 class="text-lg leading-snug font-semibold">
              Create a room
            </h2>
          </CardTitle>
          <CardDescription>
            Pick the roles and open a lobby for your friends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button as-child>
            <NuxtLink to="/rooms/new">
              Create room
            </NuxtLink>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 class="text-lg leading-snug font-semibold">
              Join a room
            </h2>
          </CardTitle>
          <CardDescription>
            Enter the code from a shared link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="onJoin">
            <FieldGroup>
              <Field>
                <FieldLabel for="room-code">
                  Room code
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="room-code"
                    v-model="code"
                    placeholder="BAWOLUTI"
                    autocomplete="off"
                    autocapitalize="characters"
                    spellcheck="false"
                    class="uppercase"
                    :aria-invalid="invalid ? true : undefined"
                    :aria-describedby="invalid ? 'room-code-hint' : undefined"
                  />
                  <InputGroupAddon align="inline-end">
                    <JoinScanDialog @join="joinWith" />
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription v-if="invalid" id="room-code-hint" class="text-destructive">
                  Room codes are 8 letters, like BAWOLUTI.
                </FieldDescription>
                <FieldDescription v-else id="room-code-hint">
                  Enter the 8-letter code, or scan the QR code from a shared link.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" variant="outline">
                  Join room
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
    <section class="flex flex-col gap-4">
      <h2 class="text-lg leading-snug font-semibold">
        Project
      </h2>
      <p class="text-muted-foreground text-sm leading-normal">
        Boardgame plays Coup: Rebellion G54 in the browser. Rooms and games are shared by code or QR link.
      </p>
      <a
        href="https://github.com/falentio/boardgame"
        target="_blank"
        rel="noreferrer"
        class="text-primary text-sm underline-offset-4 hover:underline"
      >
        falentio/boardgame on GitHub
      </a>
    </section>
  </div>
</template>
