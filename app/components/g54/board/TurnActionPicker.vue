<script setup lang="ts">
import { computed, ref } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type {
  MenuFace,
  MenuOption,
  MenuSeatChoice,
  WindowMenu,
} from "@/composables/window-menu.ts"
import { isTurnMenu } from "@/composables/window-menu.ts"
import RoleCard from "@/components/g54/RoleCard.vue"
import GeneralActionCard from "@/components/g54/GeneralActionCard.vue"

/** A turn option carries a card face: a plain general or a target claim. */
type FaceOption = Extract<MenuOption, { kind: "plain" | "target" }>
type FacedOption<Kind extends MenuFace["kind"]> = FaceOption & {
  face: Extract<MenuFace, { kind: Kind }>
}

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const hasFace = (option: MenuOption): option is FaceOption =>
  (option.kind === "plain" || option.kind === "target") && option.face !== null

/** The picker owns the turn window only, so it renders when every option is a card. */
const isTurn = computed(() => isTurnMenu(props.menu))
const faced = computed(() => props.menu.options.filter(hasFace))
const general = computed<readonly FacedOption<"general">[]>(() =>
  faced.value.filter((option): option is FacedOption<"general"> => option.face?.kind === "general"),
)
const roles = computed<readonly FacedOption<"role">[]>(() =>
  faced.value.filter((option): option is FacedOption<"role"> => option.face?.kind === "role"),
)

const openId = ref<string | null>(null)

const isDisabled = (option: FaceOption): boolean => props.busy === true || !option.enabled

const choose = (option: FaceOption): void => {
  if (isDisabled(option)) return
  if (option.kind === "target") {
    openId.value = openId.value === option.id ? null : option.id
    return
  }
  emit("act", option.action())
}

const pick = (option: FaceOption, choice: MenuSeatChoice): void => {
  if (option.kind !== "target") return
  if (isDisabled(option) || !choice.enabled) return
  openId.value = null
  emit("act", option.action(choice.seat))
}
</script>

<template>
  <div
    v-if="isTurn"
    class="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-card p-4"
    data-slot="turn-action-picker"
    role="group"
    :aria-label="menu.title"
  >
    <div class="flex flex-col gap-0.5">
      <h2 class="text-sm leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground text-xs leading-snug">
        {{ menu.note }}
      </p>
    </div>

    <div
      class="grid grid-flow-col grid-rows-[auto_auto_auto] items-stretch gap-x-3 gap-y-1.5 overflow-x-auto pb-3"
    >
      <!-- A card spans the strip's three rows and takes its own track for each, so an
           opened target row cannot shrink the card. -->
      <div
        v-for="option in general"
        :key="option.id"
        class="row-span-3 grid w-40 min-w-0 shrink-0 grid-rows-subgrid gap-1.5"
      >
        <GeneralActionCard
          :action="option.face.action"
          selectable
          :selected="openId === option.id"
          :disabled="isDisabled(option)"
          @select="choose(option)"
        />

        <!-- Reserved on every card so a card with a reason is not shorter. -->
        <span class="text-muted-foreground min-h-3 text-xs leading-none italic">
          {{ option.reason && !busy ? option.reason : "" }}
        </span>

        <div
          v-if="option.kind === 'target' && openId === option.id"
          class="flex flex-wrap gap-1.5"
          role="group"
          :aria-label="`${option.label} target`"
        >
          <button
            v-for="choice in option.choices"
            :key="choice.seat"
            type="button"
            class="h-6 rounded-md bg-secondary px-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isDisabled(option) || !choice.enabled"
            :title="choice.reason ?? undefined"
            @click="pick(option, choice)"
          >
            {{ choice.name }}
          </button>
        </div>
      </div>

      <div class="mx-1 row-span-3 w-px shrink-0 self-stretch bg-foreground/15" aria-hidden="true" />

      <div
        v-for="option in roles"
        :key="option.id"
        class="row-span-3 grid w-40 min-w-0 shrink-0 grid-rows-subgrid gap-1.5"
      >
        <RoleCard
          :role="option.face.role"
          selectable
          :selected="openId === option.id"
          :disabled="isDisabled(option)"
          @select="choose(option)"
        />

        <span class="text-muted-foreground min-h-3 text-xs leading-none italic">
          {{ option.reason && !busy ? option.reason : "" }}
        </span>

        <div
          v-if="option.kind === 'target' && openId === option.id"
          class="flex flex-wrap gap-1.5"
          role="group"
          :aria-label="`${option.label} target`"
        >
          <button
            v-for="choice in option.choices"
            :key="choice.seat"
            type="button"
            class="h-6 rounded-md bg-secondary px-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isDisabled(option) || !choice.enabled"
            :title="choice.reason ?? undefined"
            @click="pick(option, choice)"
          >
            {{ choice.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
