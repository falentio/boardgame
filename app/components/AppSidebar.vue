<script setup lang="ts">
import type { SidebarProps } from "@/components/ui/sidebar"

import { Dices, LayoutDashboard } from "@lucide/vue"
import NavMain from "@/components/NavMain.vue"
import NavUser from "@/components/NavUser.vue"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: "icon",
})

const { user, signOut } = await useAuthSession()

const navMain = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    isActive: true,
  },
]
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <div class="flex items-center gap-2 px-2 py-1.5">
        <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Dices class="size-4" />
        </div>
        <div class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-medium">Boardgame</span>
        </div>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navMain" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser v-if="user" :user="user" :sign-out="signOut" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
