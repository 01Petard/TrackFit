export default defineNuxtRouteMiddleware(async (to) => {
  const { ready, loggedIn, fetch } = useUserSession()
  if (!ready.value) await fetch()
  if (to.path === '/login') {
    if (loggedIn.value) return navigateTo('/')
    return
  }
  if (!loggedIn.value) return navigateTo('/login')
})
