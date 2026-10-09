<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { initialsOf } from "#shared/users/initials.ts"

export type WinnerCardState =
  | { kind: "winner"; name: string; image: string | null }
  | { kind: "over" }

defineProps<{ state: WinnerCardState }>()
</script>

<template>
  <Card>
    <CardContent class="flex flex-col gap-3">
      <template v-if="state.kind === 'winner'">
        <span class="text-muted-foreground text-xs leading-tight">
          Winner
        </span>
        <div class="flex min-w-0 items-center gap-3">
          <Avatar class="size-11 shrink-0 rounded-full ring-1 ring-foreground/15">
            <AvatarImage v-if="state.image" :src="state.image" :alt="state.name" />
            <AvatarFallback class="rounded-full text-xs">
              {{ initialsOf(state.name) }}
            </AvatarFallback>
          </Avatar>
          <h2 class="min-w-0 truncate text-lg leading-snug font-semibold" :title="state.name">
            {{ state.name }}
          </h2>
        </div>
      </template>
      <h2 v-else class="text-lg leading-snug font-semibold">
        Game over
      </h2>
      <Button as-child class="self-start">
        <NuxtLink to="/">
          Back to home
        </NuxtLink>
      </Button>
    </CardContent>
  </Card>
</template>
