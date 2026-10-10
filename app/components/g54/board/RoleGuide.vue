<script setup lang="ts">
import { CircleQuestionMark } from "@lucide/vue"
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import RoleCard from "@/components/g54/RoleCard.vue"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { ROLE_STRIP_CARD_CLASS, ROLE_STRIP_CLASS } from "@/composables/card-shell"

defineProps<{ roles: readonly RoleId[] }>()
</script>

<template>
  <Drawer>
    <DrawerTrigger as-child>
      <Button type="button" variant="outline" size="icon-sm" aria-label="Role guide">
        <CircleQuestionMark :stroke-width="1.5" aria-hidden="true" />
      </Button>
    </DrawerTrigger>
    <DrawerContent data-slot="role-guide">
      <DrawerHeader>
        <DrawerTitle>Roles in play</DrawerTitle>
        <DrawerDescription>
          The roles dealt into this game. Claim one to act, or challenge a claim.
        </DrawerDescription>
      </DrawerHeader>
      <div data-slot="role-strip" :class="ROLE_STRIP_CLASS">
        <RoleCard
          v-for="role in roles"
          :key="role"
          :role="role"
          :class="ROLE_STRIP_CARD_CLASS"
        />
      </div>
    </DrawerContent>
  </Drawer>
</template>
