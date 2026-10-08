import { expect, test } from "vitest"
import { announcementOf, clockLabel, fractionOf, secondsOf, toneOf } from "../turn-timer.ts"

test("secondsOf rounds up so the final second reads as 1, never 0", () => {
  expect(secondsOf(30_000)).toBe(30)
  expect(secondsOf(29_001)).toBe(30)
  expect(secondsOf(1)).toBe(1)
  expect(secondsOf(0)).toBe(0)
  expect(secondsOf(-500)).toBe(0)
})

test("toneOf escalates at 10 and 5 seconds", () => {
  expect(toneOf(30)).toBe("calm")
  expect(toneOf(11)).toBe("calm")
  expect(toneOf(10)).toBe("warn")
  expect(toneOf(6)).toBe("warn")
  expect(toneOf(5)).toBe("urgent")
  expect(toneOf(1)).toBe("urgent")
  expect(toneOf(0)).toBe("urgent")
})

test("fractionOf is the remaining share of the wait, clamped to 0..1", () => {
  expect(fractionOf(30_000, 30_000)).toBe(1)
  expect(fractionOf(15_000, 30_000)).toBe(0.5)
  expect(fractionOf(0, 30_000)).toBe(0)
  expect(fractionOf(-1, 30_000)).toBe(0)
  expect(fractionOf(60_000, 30_000)).toBe(1)
})

test("fractionOf survives a zero or negative total without dividing by zero", () => {
  expect(fractionOf(5, 0)).toBe(0)
  expect(fractionOf(5, -1)).toBe(0)
})

test("announcementOf speaks only at the two thresholds", () => {
  expect(announcementOf(30)).toBe("")
  expect(announcementOf(11)).toBe("")
  expect(announcementOf(10)).toBe("10 seconds left")
  expect(announcementOf(9)).toBe("")
  expect(announcementOf(5)).toBe("5 seconds left")
  expect(announcementOf(4)).toBe("")
})

test("clockLabel names the number so the countdown is not read as a bare digit", () => {
  expect(clockLabel(30)).toBe("30 seconds left")
  expect(clockLabel(1)).toBe("1 second left")
  expect(clockLabel(0)).toBe("0 seconds left")
})
