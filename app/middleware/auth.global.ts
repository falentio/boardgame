export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login") return
  const { signedIn } = await useAuthSession()
  if (!signedIn.value) {
    return navigateTo({ path: "/login", query: { redirect: to.fullPath } })
  }
})
