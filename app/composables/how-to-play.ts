export const HOW_TO_PLAY_SRC = "/g54/how-to-play.mp4"
export const HOW_TO_PLAY_TITLE = "How to play Coup: Rebellion G54"

export type HowToPlayPlacement = "stack" | "rail" | "overlay"

export type HowToPlayPlayback = "manual" | "muted-autoplay"

export interface HowToPlayPresence {
  /** A string, not HowToPlayVariantId: the union derives from this table's keys, so
   *  annotating the field with it is circular. */
  readonly id: string
  readonly label: string
  readonly note: string
  readonly placement: HowToPlayPlacement
  readonly playback: HowToPlayPlayback
  /** A whole Tailwind utility literal: v4 only emits classes it can see in source. */
  readonly aspect: string
  /** Classes for the lobby column that contains the player. */
  readonly columnClass: string
  /** Classes for the player's own box inside that column. */
  readonly playerClass: string
  /** The viewport edge the player sits against. The picker takes the opposite one. */
  readonly edge: "top" | "bottom"
}

export const HOW_TO_PLAY_VARIANTS = {
  dock: {
    id: "dock",
    label: "Dock",
    note: "Floating corner player, muted autoplay",
    placement: "overlay",
    playback: "muted-autoplay",
    aspect: "aspect-video",
    columnClass: "",
    playerClass: "max-lg:order-first lg:fixed lg:right-6 lg:bottom-6 lg:z-30 lg:w-80",
    edge: "bottom",
  },
  rail: {
    id: "rail",
    label: "Rail",
    note: "Narrow column beside the card",
    placement: "rail",
    playback: "manual",
    aspect: "aspect-video",
    columnClass: "lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start",
    playerClass: "lg:col-start-2 lg:row-start-1",
    edge: "top",
  },
  trail: {
    id: "trail",
    label: "Trail",
    note: "Card width, below the card",
    placement: "stack",
    playback: "manual",
    aspect: "aspect-video",
    columnClass: "",
    playerClass: "",
    edge: "top",
  },
  lead: {
    id: "lead",
    label: "Lead",
    note: "Card width, above the card",
    placement: "stack",
    playback: "manual",
    aspect: "aspect-video",
    columnClass: "",
    playerClass: "order-first",
    edge: "top",
  },
  band: {
    id: "band",
    label: "Band",
    note: "Wide and short banner, above the card",
    placement: "stack",
    playback: "manual",
    aspect: "aspect-[21/9]",
    columnClass: "",
    playerClass: "order-first",
    edge: "top",
  },
  hero: {
    id: "hero",
    label: "Hero",
    note: "Wider than the card, above the card",
    placement: "stack",
    playback: "manual",
    aspect: "aspect-video",
    columnClass: "",
    playerClass: "order-first xl:-mx-16 xl:w-[calc(100%+8rem)]",
    edge: "top",
  },
} as const satisfies Record<string, HowToPlayPresence>

export type HowToPlayVariantId = keyof typeof HOW_TO_PLAY_VARIANTS

export const HOW_TO_PLAY_VARIANT_IDS = Object.keys(
  HOW_TO_PLAY_VARIANTS,
) as readonly HowToPlayVariantId[]

export const DEFAULT_HOW_TO_PLAY_VARIANT: HowToPlayVariantId = "lead"

export const isHowToPlayVariantId = (value: unknown): value is HowToPlayVariantId =>
  typeof value === "string" && Object.hasOwn(HOW_TO_PLAY_VARIANTS, value)

export const parseHowToPlayVariant = (raw: unknown): HowToPlayVariantId => {
  const first = Array.isArray(raw) ? raw[0] : raw
  return isHowToPlayVariantId(first) ? first : DEFAULT_HOW_TO_PLAY_VARIANT
}

export const presenceOf = (id: HowToPlayVariantId): HowToPlayPresence =>
  HOW_TO_PLAY_VARIANTS[id]

export const isMuted = (presence: HowToPlayPresence): boolean =>
  presence.playback === "muted-autoplay"

export const preloadOf = (presence: HowToPlayPresence): "none" | "metadata" =>
  isMuted(presence) ? "metadata" : "none"

export const autoplays = (presence: HowToPlayPresence, reducedMotion: boolean): boolean =>
  isMuted(presence) && !reducedMotion
