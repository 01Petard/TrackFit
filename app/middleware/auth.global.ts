export default defineNuxtRouteMiddleware(async (to) => {
  const { ready, loggedIn, fetch } = useUserSession()
  const localePath = useLocalePath()
  const loginPath = localePath('/login')
  if (!ready.value) await fetch()
  if (to.path === loginPath) {
    if (loggedIn.value) return navigateTo(localePath('/'))
    return
  }
  if (!loggedIn.value) return navigateTo(loginPath)
})
