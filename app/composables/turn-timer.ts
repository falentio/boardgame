/** The local seat's turn clock: what is left, and the wait it is a fraction of. */
export interface TurnClock {
  readonly remainingMs: number
  readonly totalMs: number
}

export type TimerTone = "calm" | "warn" | "urgent"

/** Whole seconds left, rounded up so the last second reads as `1`, never `0`. */
export const secondsOf = (remainingMs: number): number => Math.max(0, Math.ceil(remainingMs / 1000))

/** The escalation bands. The number is always rendered, so tone never carries meaning alone. */
export const toneOf = (seconds: number): TimerTone => {
  if (seconds <= 5) return "urgent"
  if (seconds <= 10) return "warn"
  return "calm"
}

/** Fraction of the wait still on the clock, clamped to `0..1`. */
export const fractionOf = (remainingMs: number, totalMs: number): number => {
  if (totalMs <= 0) return 0
  return Math.min(1, Math.max(0, remainingMs / totalMs))
}

/**
 * What the polite live region says, and only at the two thresholds. A countdown
 * announced every 250ms tick is unusable, so silence is the default.
 */
export const announcementOf = (seconds: number): string => {
  if (seconds === 10) return "10 seconds left"
  if (seconds === 5) return "5 seconds left"
  return ""
}

/** The clock's accessible name. The number is visible, so this only adds context. */
export const clockLabel = (seconds: number): string =>
  `${String(seconds)} ${seconds === 1 ? "second" : "seconds"} left`
