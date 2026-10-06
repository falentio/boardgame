<script setup lang="ts">
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import { ref } from "vue"
import { STARTER_ROLES } from "#shared/core/lockstep/games/g54/roles.ts"
import RoleCard from "@/components/g54/RoleCard.vue"

const board: readonly RoleId[] = STARTER_ROLES
const edgeCases: readonly RoleId[] = ["judge", "paramilitary", "intellectual", "crime-boss", "anarchist"]
const revealed: readonly RoleId[] = ["banker"]
const selectedDraft = ref<RoleId>("guerrilla")
const overlayTokens = [
  { role: "customs-officer" as RoleId, art: "/g54/token/tax.webp", alt: "Tax" },
  { role: "foreign-consular" as RoleId, art: "/g54/token/treaty.webp", alt: "Treaty" },
  { role: "peacekeeper" as RoleId, art: "/g54/token/peacekeeping.webp", alt: "Peacekeeping" },
  { role: "mercenary" as RoleId, art: "/g54/role-categories/disappear.webp", alt: "Disappear" },
]
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-8 pb-16">
    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold text-balance">
        Role card preview
      </h1>
      <p class="text-muted-foreground text-sm">
        The promoted card across its three surfaces.
      </p>
    </header>

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-medium">
        Board
        <span class="text-muted-foreground font-normal">· starter set, five active roles</span>
      </h2>
      <div class="flex gap-3 overflow-x-auto pb-2">
        <RoleCard v-for="role in board" :key="role" :role="role" class="w-48 shrink-0" />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-medium">
        Edge cases
        <span class="text-muted-foreground font-normal">· Judge gives, Paramilitary 3 / 5, Intellectual reactive, long summary, holdless</span>
      </h2>
      <div class="flex gap-3 overflow-x-auto pb-2">
        <RoleCard v-for="role in edgeCases" :key="role" :role="role" class="w-48 shrink-0" />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-medium">
        Hand
        <span class="text-muted-foreground font-normal">· two face down, one spent</span>
      </h2>
      <div class="flex gap-3">
        <RoleCard role="guerrilla" face-down class="w-40" />
        <RoleCard role="politician" face-down class="w-40" />
        <RoleCard v-for="role in revealed" :key="role" :role="role" spent class="w-40" />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-medium">
        Draft
        <span class="text-muted-foreground font-normal">· selectable, one selected, one disabled</span>
      </h2>
      <div class="flex flex-wrap gap-3">
        <RoleCard
          v-for="role in (['banker', 'guerrilla', 'intellectual'] as RoleId[])"
          :key="role"
          :role="role"
          selectable
          :selected="selectedDraft === role"
          :disabled="role === 'intellectual'"
          class="w-48"
          @select="selectedDraft = role"
        />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-medium">
        Selected states
        <span class="text-muted-foreground font-normal">· resting, selected, disabled</span>
      </h2>
      <div class="flex flex-wrap gap-3">
        <RoleCard role="guerrilla" selectable class="w-48" />
        <RoleCard role="guerrilla" selectable selected class="w-48" />
        <RoleCard role="guerrilla" selectable disabled class="w-48" />
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-medium">
        Token overlays
        <span class="text-muted-foreground font-normal">· overlay slot with real token art</span>
      </h2>
      <div class="flex flex-wrap gap-3">
        <RoleCard v-for="token in overlayTokens" :key="token.role" :role="token.role" class="w-48">
          <template #overlay>
            <img :src="token.art" :alt="token.alt" class="size-6 rounded-full ring-2 ring-background">
          </template>
        </RoleCard>
      </div>
    </section>
  </div>
</template>
