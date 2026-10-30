import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installHelp } from '../install'
import { requestPersistentStorage } from '../storage/persistence'
import { useInstallStore } from '../stores/install'
import { mountApp } from './helpers'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/140 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140 Safari/537.36'

function device(userAgent: string, maxTouchPoints = 0, standalone = false, canPrompt = false) {
  return { userAgent, maxTouchPoints, standalone, canPrompt }
}

describe('installHelp', () => {
  it.each([
    ['iPhone', device(IPHONE, 5), 'iphone'],
    ['iPad, which reports as a Mac', device(IPAD, 5), 'iphone'],
    ['Android with a prompt ready', device(ANDROID, 5, false, true), 'prompt'],
    ['Android without one', device(ANDROID, 5), 'android'],
    ['desktop with a prompt ready', device(DESKTOP, 0, false, true), 'prompt'],
    ['desktop without one', device(DESKTOP), 'none'],
    ['an installed iPhone', device(IPHONE, 5, true), 'installed'],
    ['an installed Android', device(ANDROID, 5, true, true), 'installed'],
  ])('handles %s', (_label, info, help) => {
    expect(installHelp(info)).toBe(help)
  })
})

describe('requestPersistentStorage', () => {
  it('reports when the data will be kept', async () => {
    const persist = vi.fn<() => Promise<boolean>>().mockResolvedValue(true)

    expect(await requestPersistentStorage({ persist })).toBe('kept')
  })

  it('reports when the browser says no', async () => {
    const persist = vi.fn<() => Promise<boolean>>().mockResolvedValue(false)

    expect(await requestPersistentStorage({ persist })).toBe('may-clear')
  })

  it('reports when the browser fails', async () => {
    const persist = vi.fn<() => Promise<boolean>>().mockRejectedValue(new Error('No'))

    expect(await requestPersistentStorage({ persist })).toBe('may-clear')
  })

  it('copes with a browser that has no such feature', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('may-clear')
  })
})

describe('install guide', () => {
  function pretendToBe(userAgent: string, touchPoints = 5) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true })
  }

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('walks an iPhone through Add to Home Screen', async () => {
    pretendToBe(IPHONE)
    const { wrapper } = await mountApp('/events')
    const guide = wrapper.find('[data-install-guide]')

    expect(guide.text()).toContain('Add to Home Screen')
    expect(guide.text()).toContain('Share')
  })

  it('gives Android a menu route when no prompt is ready', async () => {
    pretendToBe(ANDROID)
    const { wrapper } = await mountApp('/events')

    expect(wrapper.find('[data-install-guide]').text()).toContain('browser menu')
  })

  it('offers an install button once the browser allows it', async () => {
    pretendToBe(ANDROID)
    const { wrapper } = await mountApp('/events')
    const prompt = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt })
    window.dispatchEvent(event)
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)

    await wrapper.find('button.install-app').trigger('click')

    expect(prompt).toHaveBeenCalledOnce()
    expect(useInstallStore().canPrompt).toBe(false)
  })

  it('stays away on a desktop', async () => {
    pretendToBe(DESKTOP, 0)
    const { wrapper } = await mountApp('/events')

    expect(wrapper.find('[data-install-guide]').exists()).toBe(false)
  })

  it('remembers being dismissed', async () => {
    pretendToBe(IPHONE)
    const first = await mountApp('/events')
    await first.wrapper.find('button.dismiss-install').trigger('click')

    expect(first.wrapper.find('[data-install-guide]').exists()).toBe(false)

    const second = await mountApp('/events')

    expect(second.wrapper.find('[data-install-guide]').exists()).toBe(false)
  })

  it('stays available in Settings after being dismissed', async () => {
    pretendToBe(IPHONE)
    const first = await mountApp('/events')
    await first.wrapper.find('button.dismiss-install').trigger('click')

    const second = await mountApp('/settings')

    expect(second.wrapper.find('[data-install-guide]').text()).toContain('Add to Home Screen')
    expect(second.wrapper.find('button.dismiss-install').exists()).toBe(false)
  })

  it('copes when the browser blocks storage', async () => {
    pretendToBe(IPHONE)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked')
    })
    const { wrapper } = await mountApp('/events')
    await wrapper.find('button.dismiss-install').trigger('click')

    expect(wrapper.find('[data-install-guide]').exists()).toBe(false)
  })
})

describe('storage status in Settings', () => {
  it('says when events will be kept', async () => {
    const { wrapper } = await mountApp('/settings')
    useInstallStore().storageStatus = 'kept'
    await flushPromises()

    expect(wrapper.find('[data-storage-status]').text()).toContain('will keep your events')
  })

  it('says when events could be cleared', async () => {
    const { wrapper } = await mountApp('/settings')
    useInstallStore().storageStatus = 'may-clear'
    await flushPromises()

    expect(wrapper.find('[data-storage-status]').text()).toContain('may clear')
  })
})
