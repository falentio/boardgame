<script setup lang="ts">
import { ref } from "vue"
import { Button } from "@/components/ui/button"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type {
  MenuCardChoice,
  MenuOption,
  MenuRoleChoice,
  MenuSeatChoice,
  WindowMenu,
} from "@/composables/window-menu.ts"

type TargetOption = Extract<MenuOption, { kind: "target" }>
type CardOption = Extract<MenuOption, { kind: "card" }>
type CardsOption = Extract<MenuOption, { kind: "cards" }>
type RoleOption = Extract<MenuOption, { kind: "role" }>
type SwapOption = Extract<MenuOption, { kind: "swap" }>

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const openId = ref<string | null>(null)
const picked = ref<readonly number[]>([])
const swapOwn = ref<number | null>(null)
const swapKeep = ref<number | null>(null)

const isDisabled = (option: MenuOption): boolean => props.busy === true || !option.enabled

const toggleOpen = (id: string): void => {
  openId.value = openId.value === id ? null : id
  picked.value = []
  swapOwn.value = null
  swapKeep.value = null
}

const choose = (option: MenuOption): void => {
  if (isDisabled(option)) return
  if (
    option.kind === "target" ||
    option.kind === "card" ||
    option.kind === "cards" ||
    option.kind === "role" ||
    option.kind === "swap"
  ) {
    toggleOpen(option.id)
    return
  }
  emit("act", option.action())
}

const pick = (option: TargetOption, choice: MenuSeatChoice): void => {
  if (isDisabled(option) || !choice.enabled) return
  openId.value = null
  emit("act", option.action(choice.seat))
}

const reveal = (option: CardOption, choice: MenuCardChoice): void => {
  if (isDisabled(option)) return
  openId.value = null
  emit("act", option.action(choice.index))
}

const toggleCard = (option: CardsOption, choice: MenuCardChoice): void => {
  if (isDisabled(option)) return
  const chosen = picked.value.includes(choice.index)
    ? picked.value.filter((index) => index !== choice.index)
    : picked.value.length < option.count
      ? [...picked.value, choice.index]
      : picked.value
  picked.value = [...chosen].sort((a, b) => a - b)
}

const confirmCards = (option: CardsOption): void => {
  if (isDisabled(option) || picked.value.length !== option.count) return
  const indices = picked.value
  openId.value = null
  picked.value = []
  emit("act", option.action(indices))
}

const markRole = (option: RoleOption, choice: MenuRoleChoice): void => {
  if (isDisabled(option)) return
  openId.value = null
  emit("act", option.action(choice.role))
}

const pickSwapOwn = (option: SwapOption, choice: MenuCardChoice): void => {
  if (isDisabled(option)) return
  swapOwn.value = choice.index
}

const pickSwapKeep = (option: SwapOption, choice: MenuCardChoice): void => {
  if (isDisabled(option)) return
  swapKeep.value = choice.index
}

const confirmSwap = (option: SwapOption): void => {
  if (isDisabled(option) || swapOwn.value === null) return
  const own = swapOwn.value
  const keep = swapKeep.value ?? own
  openId.value = null
  swapOwn.value = null
  swapKeep.value = null
  emit("act", option.action(own, keep))
}

const cardSelected = (choice: MenuCardChoice): boolean => picked.value.includes(choice.index)
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-card p-4"
    data-slot="window-menu"
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

    <ul class="flex flex-col gap-2">
      <li
        v-for="option in menu.options"
        :key="option.id"
        class="flex flex-col gap-1.5"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="isDisabled(option)"
            :aria-expanded="option.kind === 'plain' ? undefined : openId === option.id"
            @click="choose(option)"
          >
            {{ option.label }}
          </Button>
          <span v-if="option.detail" class="text-muted-foreground text-xs leading-none">
            {{ option.detail }}
          </span>
          <span
            v-if="option.reason && !busy"
            class="text-muted-foreground text-xs leading-none italic"
          >
            {{ option.reason }}
          </span>
        </div>

        <div
          v-if="option.kind === 'target' && openId === option.id"
          class="flex flex-wrap gap-1.5 ps-1"
          role="group"
          :aria-label="`${option.label} target`"
        >
          <Button
            v-for="choice in option.choices"
            :key="choice.seat"
            type="button"
            size="xs"
            variant="secondary"
            :disabled="isDisabled(option) || !choice.enabled"
            :title="choice.reason ?? undefined"
            @click="pick(option, choice)"
          >
            {{ choice.name }}
          </Button>
        </div>

        <div
          v-if="option.kind === 'card' && openId === option.id"
          class="flex flex-wrap gap-1.5 ps-1"
          role="group"
          :aria-label="`${option.label} card`"
        >
          <Button
            v-for="choice in option.choices"
            :key="choice.index"
            type="button"
            size="xs"
            variant="secondary"
            @click="reveal(option, choice)"
          >
            {{ choice.name }}
          </Button>
        </div>

        <div
          v-if="option.kind === 'cards' && openId === option.id"
          class="flex flex-col gap-1.5 ps-1"
          role="group"
          :aria-label="`${option.label} cards`"
        >
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="choice in option.choices"
              :key="choice.index"
              type="button"
              size="xs"
              :variant="cardSelected(choice) ? 'default' : 'secondary'"
              :aria-pressed="cardSelected(choice)"
              @click="toggleCard(option, choice)"
            >
              {{ choice.name }}
            </Button>
          </div>
          <div class="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              :disabled="isDisabled(option) || picked.length !== option.count"
              @click="confirmCards(option)"
            >
              Confirm
            </Button>
            <span class="text-muted-foreground text-xs leading-none tabular-nums">
              {{ picked.length }} / {{ option.count }}
            </span>
          </div>
        </div>

        <div
          v-if="option.kind === 'role' && openId === option.id"
          class="flex flex-wrap gap-1.5 ps-1"
          role="group"
          :aria-label="`${option.label} role`"
        >
          <Button
            v-for="choice in option.choices"
            :key="choice.role"
            type="button"
            size="xs"
            variant="secondary"
            @click="markRole(option, choice)"
          >
            {{ choice.name }}
          </Button>
        </div>

        <div
          v-if="option.kind === 'swap' && openId === option.id"
          class="flex flex-col gap-2 ps-1"
          role="group"
          :aria-label="`${option.label} swap`"
        >
          <div class="flex flex-col gap-1">
            <span class="text-muted-foreground text-xs leading-none">Give</span>
            <div class="flex flex-wrap gap-1.5">
              <Button
                v-for="choice in option.ownChoices"
                :key="`own-${choice.index}`"
                type="button"
                size="xs"
                :variant="swapOwn === choice.index ? 'default' : 'secondary'"
                :aria-pressed="swapOwn === choice.index"
                @click="pickSwapOwn(option, choice)"
              >
                {{ choice.name }}
              </Button>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-muted-foreground text-xs leading-none">Take</span>
            <div class="flex flex-wrap gap-1.5">
              <Button
                v-for="choice in option.poolChoices"
                :key="`pool-${choice.index}`"
                type="button"
                size="xs"
                :variant="swapKeep === choice.index ? 'default' : 'secondary'"
                :aria-pressed="swapKeep === choice.index"
                @click="pickSwapKeep(option, choice)"
              >
                {{ choice.name }}
              </Button>
              <span
                v-if="option.poolChoices.length === 0"
                class="text-muted-foreground text-xs leading-none italic"
              >
                No cards were given; give one and take it back.
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              :disabled="
                isDisabled(option) ||
                swapOwn === null ||
                (option.poolChoices.length > 0 && swapKeep === null)
              "
              @click="confirmSwap(option)"
            >
              Confirm
            </Button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
