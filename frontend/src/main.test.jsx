import { afterEach, describe, expect, it, vi } from 'vitest'

describe('service worker registration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    document.body.innerHTML = ''
  })

  it('registers the service worker once the window has loaded', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    const register = vi.fn().mockResolvedValue({})
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { register },
      configurable: true,
    })

    await import('./main.jsx')
    window.dispatchEvent(new Event('load'))

    expect(register).toHaveBeenCalledWith('/service-worker.js')
  })
})
