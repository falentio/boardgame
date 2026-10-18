<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts";
import type { CastSlot, CitadelsBoard } from "@/composables/citadels-board.ts";
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";
import { defaultAvatarUrl } from "#shared/users/avatar.ts";
import { INCOME_GRANT_WORDS } from "@/composables/citadels-income-words.ts";
import CitadelsCharacterCard from "./CitadelsCharacterCard.vue";

const props = defineProps<{ board: CitadelsBoard }>();
const emit = defineEmits<{ pick: [character: CharacterId] }>();

const table = computed(() => props.board.table);

/** The picker is the draft: it opens while the draft is running and the viewer owes a pick. */
const open = computed(
  () => table.value.phase === "draft" && table.value.window?.owedByMe === true && table.value.myPick === null,
);

const picked = ref<CastSlot | null>(null);
watch(open, (still) => {
  if (!still) picked.value = null;
});

const emblemOf = (character: CharacterId): string => defaultAvatarUrl(character);
const specOf = (character: CharacterId) => specOfCharacter(character);

/** "1 gold per 3 trade districts" — the bonus, in words. */
const incomeLine = (character: CharacterId): string | null => {
  const spec = specOfCharacter(character);
  if (spec.income === null) return null;
  return `1 ${INCOME_GRANT_WORDS[spec.income.grants.kind].withArticle} per ${spec.income.counts} district`;
};

const takenBy = (slot: CastSlot): string | null => {
  if (slot.state === "available") return null;
  if (slot.state === "mine") return "in your hand";
  if (slot.state === "pending") return "being claimed";
  return "shown faceup";
};

const confirm = (): void => {
  const slot = picked.value;
  if (slot === null) return;
  emit("pick", slot.character);
  picked.value = null;
};

const section = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);

/** The picker is mounted inside the self column; the overlay belongs to the game surface. */
const surface = ref<HTMLElement | null>(null);
onMounted(() => {
  surface.value = document.querySelector<HTMLElement>("[data-slot=citadels-surface]");
});

const FOCUSABLE =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** The confirmation dialog owns the keyboard while it is up; the card grid owns it otherwise. */
const ring = (): HTMLElement[] => {
  const scope = picked.value === null ? section.value : panel.value;
  return scope === null ? [] : [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)];
};

const close = (): void => {
  picked.value = null;
};

const choose = (slot: CastSlot): void => {
  const active = document.activeElement;
  trigger.value =
    active instanceof HTMLElement && section.value?.contains(active) === true ? active : null;
  picked.value = slot;
};

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" && picked.value !== null) {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab") return;
  const elements = ring();
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (first === undefined || last === undefined) return;
  const active = document.activeElement;
  const outside = active instanceof HTMLElement ? !elements.includes(active) : true;
  if (event.shiftKey && (outside || active === first)) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && (outside || active === last)) {
    event.preventDefault();
    first.focus();
  }
};

watch(picked, async (slot) => {
  if (slot !== null) {
    await nextTick();
    ring()[0]?.focus();
    return;
  }
  const back = trigger.value;
  trigger.value = null;
  if (back !== null && back.isConnected) back.focus();
});

watch(open, async (still) => {
  if (!still) return;
  await nextTick();
  section.value?.focus();
});
</script>
<template>
  <Teleport :to="surface ?? 'body'">
    <Transition name="citadels-overlay">
      <section
        v-if="open"
        ref="section"
        data-slot="citadels-picker"
        role="region"
        aria-label="Choose a character"
        tabindex="-1"
        class="absolute inset-0 z-40 flex flex-col gap-3 overflow-y-auto bg-monokai-bg/30 p-4 backdrop-blur-[2px] focus-visible:outline-none"
        @keydown="onKeydown"
      >
        <header class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="font-mono text-sm leading-none font-bold tracking-[0.18em] uppercase">
            Pick a character
          </h2>
          <span class="font-mono text-[0.625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase">
            round {{ table.round }} · {{ table.cast.length }} in the draft
          </span>
        </header>

        <p v-if="table.pending" role="status" class="font-mono text-[0.6875rem] leading-tight text-monokai-comment">
          {{ table.pending.actorName }} claims {{ table.pending.characterName ?? "a character" }}
        </p>

        <ul data-slot="citadels-picker-grid" class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          <li v-for="slot in table.cast" :key="slot.character" class="min-w-0">
            <CitadelsCharacterCard
              :slot="slot"
              :picked="picked?.character === slot.character"
              @choose="choose(slot)"
            />
          </li>
        </ul>

        <div
          v-if="picked"
          data-slot="citadels-picker-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="`Choose ${specOf(picked.character).name}?`"
          class="absolute inset-0 z-50 flex items-center justify-center bg-monokai-bg/30 p-4 backdrop-blur-[2px]"
          @click="close"
        >
          <div
            ref="panel"
            class="flex w-full max-w-sm flex-col gap-3 border border-monokai-yellow bg-monokai-panel p-3"
            @click.stop
          >
            <header class="flex items-start gap-2">
              <span class="size-16 shrink-0 overflow-hidden border border-monokai-line bg-monokai-bg">
                <img :src="emblemOf(picked.character)" alt="" class="size-full object-cover" />
              </span>
              <span class="flex min-w-0 flex-col gap-1">
                <span class="font-mono text-sm leading-none font-bold tracking-[0.03em] uppercase">
                  {{ specOf(picked.character).name }}
                </span>
                <span class="font-mono text-[0.625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase">
                  rank {{ String(specOf(picked.character).rank).padStart(2, "0") }}
                </span>
              </span>
            </header>

            <p class="font-mono text-[0.6875rem] leading-snug text-monokai-fg" data-slot="citadels-picker-ability">
              {{ specOf(picked.character).summary }}
            </p>

            <p
              v-if="incomeLine(picked.character)"
              class="font-mono text-[0.625rem] leading-none tracking-[0.16em] text-monokai-yellow uppercase"
            >
              {{ incomeLine(picked.character) }}
            </p>
            <p v-if="takenBy(picked)" class="font-mono text-[0.625rem] leading-none tracking-[0.16em] text-monokai-pink uppercase">
              {{ takenBy(picked) }}
            </p>

            <p class="font-mono text-[0.6875rem] leading-snug text-monokai-comment">
              Choose {{ specOf(picked.character).name }}?
            </p>

            <footer class="flex justify-end gap-2">
              <button
                type="button"
                data-slot="citadels-picker-cancel"
                class="border border-monokai-line px-2.5 py-1 font-mono text-[0.625rem] tracking-[0.16em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monokai-yellow"
                @click="close"
              >
                Cancel
              </button>
              <button
                type="button"
                data-slot="citadels-picker-confirm"
                class="bg-monokai-yellow px-2.5 py-1 font-mono text-[0.625rem] font-bold tracking-[0.16em] text-monokai-bg uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monokai-fg"
                @click="confirm"
              >
                Choose {{ specOf(picked.character).name }}
              </button>
            </footer>
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>
