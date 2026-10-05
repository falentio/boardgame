export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login" || to.path === "/signup") return
  const { signedIn } = await useAuthSession()
  if (!signedIn.value) {
    return navigateTo({ path: "/login", query: { redirect: to.fullPath } })
  }
})
