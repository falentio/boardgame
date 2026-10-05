<script setup lang="ts">
import { computed, ref } from "vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { parseRoomCode } from "../../shared/rooms/code.ts"

definePageMeta({ layout: "shell" })

const code = ref("")

const parsed = computed(() => parseRoomCode(code.value))
const invalid = computed(() => code.value.trim().length > 0 && parsed.value === null)

const onJoin = async () => {
  const target = parsed.value
  if (target === null) return
  await navigateTo("/join/" + target)
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 class="text-balance text-2xl leading-tight font-semibold">
            Play a game
          </h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup class="gap-6">
          <Field>
            <div>
              <Button as-child>
                <NuxtLink to="/rooms/new">
                  Create room
                </NuxtLink>
              </Button>
            </div>
            <FieldDescription>
              Pick the roles and open a lobby for your friends.
            </FieldDescription>
          </Field>
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
                <FieldDescription v-else>
                  Enter the code from a shared link.
                </FieldDescription>
              </Field>
              <Field>
                <div>
                  <Button type="submit" variant="outline" :disabled="parsed === null">
                    Join room
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </form>
        </FieldGroup>
      </CardContent>
    </Card>
    <div class="grid auto-rows-min gap-4 md:grid-cols-3">
      <div class="bg-muted/50 aspect-video rounded-xl" />
      <div class="bg-muted/50 aspect-video rounded-xl" />
      <div class="bg-muted/50 aspect-video rounded-xl" />
    </div>
    <div class="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
  </div>
</template>
