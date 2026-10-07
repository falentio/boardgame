<script setup lang="ts">
import { computed, ref } from "vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { parseRoomCode } from "#shared/rooms/code.ts"

definePageMeta({ layout: "shell" })

const code = ref("")
const submitted = ref(false)

const parsed = computed(() => parseRoomCode(code.value))
const invalid = computed(() => (submitted.value || code.value.trim().length > 0) && parsed.value === null)

const onJoin = async () => {
  submitted.value = true
  const target = parsed.value
  if (target === null) return
  await navigateTo("/join/" + target)
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
                <Input
                  id="room-code"
                  v-model="code"
                  placeholder="BAVOKUTI"
                  autocomplete="off"
                  autocapitalize="characters"
                  spellcheck="false"
                  class="uppercase"
                  :aria-invalid="invalid ? true : undefined"
                  :aria-describedby="invalid ? 'room-code-hint' : undefined"
                />
                <FieldDescription v-if="invalid" id="room-code-hint" class="text-destructive">
                  Room codes are 8 letters, like BAVOKUTI.
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
  </div>
</template>
