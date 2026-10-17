import type { Directive } from "vue"

/** Re-runs a CSS entrance whenever the harness re-mounts a variant. */
export const vRise: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    const delay = binding.value ?? 0
    el.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 260, delay, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" },
    )
  },
}
