import { parseHTML } from 'linkedom'

const { document, window } = parseHTML('<!DOCTYPE html><html><body><div id="root"></div></body></html>')

// Patch globals for React and component tests
Object.assign(globalThis, {
  document,
  window,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLButtonElement: (window as any).HTMLButtonElement ?? window.HTMLElement,
  HTMLInputElement: (window as any).HTMLInputElement ?? window.HTMLElement,
  HTMLSelectElement: (window as any).HTMLSelectElement ?? window.HTMLElement,
  HTMLFormElement: (window as any).HTMLFormElement ?? window.HTMLElement,
  SVGElement: (window as any).SVGElement ?? window.HTMLElement,
  Element: window.Element,
  Node: window.Node,
  Text: window.Text,
  DocumentFragment: window.DocumentFragment,
  Event: window.Event,
  MouseEvent: (window as any).MouseEvent ?? window.Event,
  KeyboardEvent: (window as any).KeyboardEvent ?? window.Event,
  CustomEvent: window.CustomEvent,
  MutationObserver: (window as any).MutationObserver ?? class { observe() {} disconnect() {} takeRecords() { return [] } },
  requestAnimationFrame: (cb: Function) => setTimeout(cb, 0),
  cancelAnimationFrame: clearTimeout,
  getComputedStyle: () => ({}),
  matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
  URL: globalThis.URL,
  EventSource: class MockEventSource {
    url: string
    readyState = 0
    onmessage: ((e: any) => void) | null = null
    onerror: (() => void) | null = null
    private listeners = new Map<string, Function[]>()
    constructor(url: string) { this.url = url; this.readyState = 1 }
    addEventListener(type: string, fn: Function) {
      const list = this.listeners.get(type) ?? []
      list.push(fn)
      this.listeners.set(type, list)
    }
    removeEventListener(type: string, fn: Function) {
      const list = this.listeners.get(type) ?? []
      this.listeners.set(type, list.filter(f => f !== fn))
    }
    close() { this.readyState = 2 }
    // Test helper: simulate an event
    _emit(type: string, data: any) {
      const event = { data: typeof data === 'string' ? data : JSON.stringify(data), type }
      for (const fn of this.listeners.get(type) ?? []) fn(event)
      if (type === 'message' && this.onmessage) this.onmessage(event)
    }
  },
})
