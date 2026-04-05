import { atom, action, reatomBoolean } from "@reatom/core"

export function createLiveMode<T>(config: {
  url: string
  eventName?: string
  name: string
}) {
  const { url, eventName = "update", name } = config

  const data = atom<T | null>(null, `${name}.data`)
  const isLive = reatomBoolean(false, `${name}.isLive`)

  let eventSource: EventSource | null = null
  let pending: T | null = null
  let rafId: number | null = null

  function applyUpdate() {
    if (pending) data.set(pending)
    pending = null
    rafId = null
  }

  function disconnect() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
    pending = null
    if (eventSource) { eventSource.close(); eventSource = null }
  }

  const start = action(() => {
    disconnect()
    eventSource = new EventSource(url)
    eventSource.addEventListener(eventName, event => {
      try {
        pending = JSON.parse((event as MessageEvent).data)
        if (rafId === null) rafId = requestAnimationFrame(applyUpdate)
      } catch { /* ignore */ }
    })
    eventSource.onerror = () => {
      disconnect()
      isLive.setFalse()
    }
    isLive.setTrue()
  }, `${name}.start`)

  const stop = action(() => {
    disconnect()
    isLive.setFalse()
    data.set(null)
  }, `${name}.stop`)

  return { data, isLive, start, stop }
}
