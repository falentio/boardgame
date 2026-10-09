/** The shell and badge classes the G54 role and general-action cards share, so they cannot drift. */
export const CARD_SHELL_CLASS =
  "relative flex w-full flex-col overflow-hidden rounded-xl bg-card text-card-foreground text-sm ring-1 ring-foreground/10"

export const CARD_BADGE_CLASS =
  "rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-foreground ring-1 ring-foreground/10"

/** The strip the lobby and the new-room role picker lay their roles out in, so they cannot drift. */
export const ROLE_STRIP_CLASS = "flex gap-3 overflow-x-auto -mx-1 -mt-1 px-1 pt-1 pb-3"

export const ROLE_STRIP_CARD_CLASS = "w-40 shrink-0"
