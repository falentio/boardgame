import { REDIRECT_QUERY } from "@/composables/auth-destination"

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login" || to.path === "/signup") return
  if (import.meta.dev && to.path.startsWith("/dev/")) return
  const { signedIn } = await useAuthSession()
  if (!signedIn.value) {
    return navigateTo({ path: "/login", query: { [REDIRECT_QUERY]: to.fullPath } })
  }
})
