<script setup lang="ts">
import type { Component } from "vue"
import type { CardFace } from "@/composables/window-menu.ts"
import { computed } from "vue"
import { Hand, Swords, Target, Zap } from "@lucide/vue"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { roleCardModel } from "@/composables/role-card"
import { resolveUserImage } from "#shared/users/avatar.ts"
import { initialsOf } from "#shared/users/initials.ts"

const props = defineProps<{ face: CardFace }>()

const ICONS: Readonly<Record<string, Component>> = {
  Challenge: Swords,
  Pass: Hand,
  Continue: Zap,
  Target,
}

const roleArt = computed(() => (props.face.kind === "role" ? roleCardModel(props.face.role).art : null))
const playerImage = computed(() =>
  props.face.kind === "player" ? resolveUserImage(props.face.image, props.face.seat) : null,
)
const playerInitials = computed(() => (props.face.kind === "player" ? initialsOf(props.face.name) : ""))
const actionLabel = computed(() => (props.face.kind === "action" ? props.face.card.label : null))
const actionArt = computed(() => (props.face.kind === "action" ? props.face.card.art : null))
const actionIcon = computed<Component | null>(() =>
  actionLabel.value === null ? null : (ICONS[actionLabel.value] ?? null),
)
</script>

<template>
  <span class="grid size-10 shrink-0 place-items-center" aria-hidden="true">
    <!-- role: the RoleCard crop (object-[50%_18%] on portrait art) -->
    <img
      v-if="roleArt"
      :src="roleArt"
      alt=""
      class="size-10 rounded-lg object-cover object-[50%_18%] ring-1 ring-foreground/10"
      loading="lazy"
      decoding="async"
    >
    <Avatar v-else-if="playerImage" class="size-10 rounded-full ring-1 ring-foreground/15">
      <AvatarImage :src="playerImage" alt="" />
      <AvatarFallback class="rounded-full text-xs">{{ playerInitials }}</AvatarFallback>
    </Avatar>
    <!-- general action: its square art, centred like GeneralActionCard -->
    <img
      v-else-if="actionArt"
      :src="actionArt"
      alt=""
      class="size-10 rounded-lg object-cover ring-1 ring-foreground/10"
      loading="lazy"
      decoding="async"
    >
    <span
      v-else-if="actionIcon"
      class="bg-muted text-foreground grid size-10 place-items-center rounded-lg"
    >
      <component :is="actionIcon" class="size-5" />
    </span>
    <span
      v-else
      class="bg-muted text-foreground grid size-10 place-items-center rounded-lg text-xs font-semibold"
    >
      {{ actionLabel?.slice(0, 1) ?? "?" }}
    </span>
  </span>
</template>
