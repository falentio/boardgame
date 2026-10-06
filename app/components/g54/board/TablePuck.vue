<script setup lang="ts">
import { Coins, Layers } from "@lucide/vue"
import { specOf } from "#shared/core/lockstep/games/g54/roles.ts"
import { purposeLabel, type BoardTable } from "@/composables/board-view.ts"

defineProps<{ table: BoardTable }>()
</script>

<template>
  <div class="flex flex-col items-center gap-3" data-slot="table-puck">
    <div class="flex flex-col items-center gap-1.5">
      <span class="text-muted-foreground text-[0.625rem] leading-none font-semibold tracking-[0.2em] uppercase">
        Turn {{ table.turn }}
      </span>
      <div class="flex items-center gap-2 text-sm">
        <span class="inline-flex items-center gap-1.5 font-semibold tabular-nums">
          <Coins class="text-amber-500 size-4" aria-hidden="true" />
          {{ table.treasury }}
          <span class="text-muted-foreground text-xs font-normal">Treasury</span>
        </span>
        <template v-if="table.bank > 0">
          <span class="text-border" aria-hidden="true">·</span>
          <span class="inline-flex items-center gap-1.5 font-semibold tabular-nums">
            <Coins class="text-muted-foreground size-4" aria-hidden="true" />
            {{ table.bank }}
            <span class="text-muted-foreground text-xs font-normal">Bank</span>
          </span>
        </template>
        <span class="text-border" aria-hidden="true">·</span>
        <span class="inline-flex items-center gap-1.5 font-semibold tabular-nums">
          <Layers class="text-muted-foreground size-4" aria-hidden="true" />
          {{ table.courtCount }}
          <span class="text-muted-foreground text-xs font-normal">Court</span>
        </span>
      </div>
    </div>

    <div class="flex items-center gap-1.5" aria-label="Roles in play">
      <span
        v-for="role in table.roles"
        :key="role"
        class="relative block h-9 w-6 shrink-0 overflow-hidden rounded-[0.3rem] ring-1 ring-foreground/15"
        :title="specOf(role).name"
      >
        <img :src="`/roles/${role}.webp`" :alt="specOf(role).name" class="size-full object-cover object-[50%_18%]">
      </span>
    </div>

    <p
      v-if="table.terminal"
      role="status"
      class="rounded-full bg-primary/10 px-3 py-1 text-center text-xs leading-none font-semibold text-primary ring-1 ring-primary/30"
    >
      Game over
    </p>
    <p
      v-else-if="table.pending"
      role="status"
      class="rounded-full bg-muted px-3 py-1 text-center text-xs leading-none font-medium ring-1 ring-foreground/10"
    >
      {{ table.pending }}
    </p>
    <p
      v-if="table.window"
      role="status"
      class="rounded-full bg-muted/60 px-3 py-1 text-center text-[0.6875rem] leading-none font-medium text-muted-foreground ring-1 ring-foreground/10"
    >
      {{ purposeLabel(table.window.purpose) }}
    </p>
  </div>
</template>
