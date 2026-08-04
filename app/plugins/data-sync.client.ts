export default defineNuxtPlugin(async () => {
  const store = useTrackFitData()
  const { loggedIn } = useUserSession()
  if (loggedIn.value) await store.ensureLoaded().catch(() => undefined)

  const refresh = () => {
    if (loggedIn.value && document.visibilityState === 'visible') store.refresh().catch(() => undefined)
  }
  const interval = window.setInterval(refresh, 10_000)
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('focus', refresh)

  return {
    provide: {
      stopDataSync: () => {
        window.clearInterval(interval)
        document.removeEventListener('visibilitychange', refresh)
        window.removeEventListener('focus', refresh)
      },
    },
  }
})
