import { flushPromises } from '@vue/test-utils'
import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { offlineClient, setApiClient } from '../api/client'
import type { ApiAction, ApiClient, SendResult } from '../api/client'
import { useCatalogueStore } from '../stores/catalogue'
import { useEventStore } from '../stores/event'
import { answerConfirm, mountApp, mountEvent, setDesign } from './helpers'

let sent: ApiAction[]
let reply: SendResult

function client(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    ...offlineClient,
    fetchMaster: async () => ({ status: 'unchanged' }),
    send: async (action) => {
      sent.push(action)
      return reply
    },
    ...overrides,
  }
}

async function mountAdmin(path: string) {
  localStorage.setItem('nickname', 'Mum')
  localStorage.setItem('admin-key', 'the-key')
  localStorage.setItem('admin-on', 'yes')
  return mountApp(path)
}

function byText(wrapper: VueWrapper, text: string): DOMWrapper<Element> {
  const found = wrapper.findAll('button').find((button) => button.text() === text)
  if (!found) throw new Error(`No button: ${text}`)
  return found
}

function isGrey(button: DOMWrapper<Element>): boolean {
  return button.attributes('disabled') !== undefined
}

/** A reply that waits, so a screen can be checked while it's saving. */
function heldReply() {
  let finish: (result: SendResult) => void = () => undefined
  setApiClient(
    client({
      send: (action) => {
        sent.push(action)
        return new Promise((resolve) => (finish = resolve))
      },
    }),
  )
  return (result: SendResult = { status: 'sent' }) => finish(result)
}

beforeEach(() => {
  localStorage.clear()
  sent = []
  reply = { status: 'sent' }
  setApiClient(client())
})

afterEach(() => {
  setApiClient(null)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('back links', () => {
  function back(wrapper: VueWrapper) {
    const link = wrapper.find('.back-link')
    return { text: link.text(), href: link.attributes('href') }
  }

  it.each([
    ['/events/new', 'Back to Events', '/events'],
    ['/shared', 'Back to Events', '/events'],
    ['/prices/shop', 'Back to Prices', '/prices'],
    ['/prices/scabious', 'Back to Prices', '/prices'],
    [
      '/prices/scabious?supplier=wholesaler-a&from=shop',
      'Back to Shop mode',
      '/prices/shop?supplier=wholesaler-a',
    ],
    ['/prices/scabious?from=library', 'Back to flower', '/library/flowers/scabious'],
  ])('%s goes back to its parent', async (path, text, href) => {
    const { wrapper } = await mountApp(path)

    expect(back(wrapper)).toEqual({ text, href })
  })

  it.each([
    ['/library/designs/new', '/library?show=recipes'],
    ['/library/designs/groom', '/library?show=recipes'],
    ['/library/flowers/new', '/library?show=flowers'],
    ['/library/flowers/scabious', '/library?show=flowers'],
    ['/library/suppliers/new', '/library?show=suppliers'],
    ['/library/suppliers/wholesaler-a', '/library?show=suppliers'],
  ])('%s goes back to its Library section', async (path, href) => {
    const { wrapper } = await mountAdmin(path)

    expect(back(wrapper)).toEqual({ text: 'Back to Library', href })
  })

  it.each(['designs', 'palette', 'review', 'work-plan'] as const)(
    'the %s step goes back to Events',
    async (step) => {
      const { wrapper } = await mountEvent(step)

      expect(back(wrapper)).toEqual({ text: 'Back to Events', href: '/events' })
    },
  )

  it('the purchase screen goes back to Review', async () => {
    const { wrapper, router, store } = await mountEvent()
    await router.push(`/events/${store.current?.id}/purchase`)
    await flushPromises()

    expect(back(wrapper)).toEqual({
      text: 'Back to Review',
      href: `/events/${store.current?.id}/review`,
    })
  })

  it.each(['/events', '/prices', '/library', '/settings'])(
    '%s is a tab, so it has none',
    async (path) => {
      const { wrapper } = await mountAdmin(path)

      expect(wrapper.find('.back-link').exists()).toBe(false)
    },
  )

  it('sends a price added from the Library back to the flower', async () => {
    const { wrapper, router } = await mountAdmin('/prices/scabious?from=library')
    await wrapper.find('input[name="price"]').setValue('5.00')
    await wrapper.find('input[name="stems"]').setValue('10')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/library/flowers/scabious')
  })

  it('links from a flower to its price with the way back', async () => {
    const { wrapper } = await mountAdmin('/library/flowers/scabious')

    expect(wrapper.find('a[href="/prices/scabious?from=library"]').exists()).toBe(true)
  })
})

describe('save buttons', () => {
  it('greys a supplier until something changes, and for a new one until something is typed', async () => {
    const { wrapper } = await mountAdmin('/library/suppliers/new')
    const save = () => byText(wrapper, 'Save supplier')

    expect(isGrey(save())).toBe(true)

    await wrapper.find('input[name="name"]').setValue('Bloom')
    expect(isGrey(save())).toBe(false)

    await wrapper.find('input[name="name"]').setValue('')
    expect(isGrey(save())).toBe(true)
  })

  it('greys an existing flower until it changes', async () => {
    const { wrapper } = await mountAdmin('/library/flowers/scabious')
    const save = () => byText(wrapper, 'Save flower')

    expect(isGrey(save())).toBe(true)

    await wrapper.find('input[name="colour"]').setValue('Burgundy')
    expect(isGrey(save())).toBe(false)
  })

  it('greys a design, and goes grey again after saving', async () => {
    const { wrapper } = await mountAdmin('/library/designs/groom')
    const save = () => byText(wrapper, 'Save design')

    expect(isGrey(save())).toBe(true)

    await wrapper.find('input[name="optional"]').setValue(true)
    expect(isGrey(save())).toBe(false)

    await save().trigger('click')
    await wrapper.find('form.design-form').trigger('submit')
    await flushPromises()

    expect(isGrey(save())).toBe(true)
    expect(wrapper.find('.design-form [role="status"]').text()).toBe('Saved.')
  })

  it('greys a recipe until it changes', async () => {
    const { wrapper } = await mountAdmin('/library/designs/groom')
    const save = () => byText(wrapper, 'Save recipe')

    expect(isGrey(save())).toBe(true)

    await wrapper.find('button[aria-label^="Remove"]').trigger('click')
    expect(isGrey(save())).toBe(false)
  })

  it('lets a new size be saved straight away, as its copy is new', async () => {
    const { wrapper } = await mountAdmin('/library/designs/pedestal')
    const catalogue = useCatalogueStore()
    catalogue.recipes = catalogue.recipes.filter(
      ({ designId, size }) => !(designId === 'pedestal' && size === 'Large'),
    )
    await flushPromises()

    await wrapper.find('select[name="add-size"]').setValue('Large')
    await flushPromises()

    expect(isGrey(byText(wrapper, 'Save recipe'))).toBe(false)
  })

  it('greys Copy design until the variant has a name', async () => {
    const { wrapper } = await mountAdmin('/library/designs/groom')
    await byText(wrapper, 'Make a variant').trigger('click')

    expect(isGrey(byText(wrapper, 'Copy design'))).toBe(true)

    await wrapper.find('input[name="variant-name"]').setValue('No dahlia')
    expect(isGrey(byText(wrapper, 'Copy design'))).toBe(false)
  })

  it('greys Save thresholds until they change', async () => {
    const { wrapper } = await mountApp('/settings')
    const save = () => byText(wrapper, 'Save thresholds')

    expect(isGrey(save())).toBe(true)

    await wrapper.find('input[name="thin-bunch"]').setValue('40')
    expect(isGrey(save())).toBe(false)

    await wrapper.find('form.thresholds').trigger('submit')
    await flushPromises()
    expect(isGrey(save())).toBe(true)
  })

  it('keeps Save price on, because confirming the same price is a report', async () => {
    localStorage.setItem('nickname', 'Mum')
    const { wrapper } = await mountApp('/prices/scabious')

    expect(isGrey(byText(wrapper, 'Save price'))).toBe(false)
  })
})

describe('leaving with unsaved changes', () => {
  const dialog = (wrapper: VueWrapper) => wrapper.find('[role="alertdialog"]')

  it('asks first, and stays if told to', async () => {
    const { wrapper, router } = await mountAdmin('/library/suppliers/wholesaler-a')
    await wrapper.find('input[name="name"]').setValue('Changed')

    const leaving = router.push('/library')
    await flushPromises()
    expect(dialog(wrapper).text()).toContain('Leave without saving?')

    await answerConfirm(wrapper, false)
    await leaving

    expect(router.currentRoute.value.path).toBe('/library/suppliers/wholesaler-a')
  })

  it('leaves if told to', async () => {
    const { wrapper, router } = await mountAdmin('/library/suppliers/wholesaler-a')
    await wrapper.find('input[name="name"]').setValue('Changed')

    const leaving = router.push('/library')
    await flushPromises()
    await answerConfirm(wrapper, true)
    await leaving

    expect(router.currentRoute.value.path).toBe('/library')
  })

  it('does not ask when nothing changed', async () => {
    const { wrapper, router } = await mountAdmin('/library/suppliers/wholesaler-a')

    await router.push('/library')
    await flushPromises()

    expect(dialog(wrapper).exists()).toBe(false)
  })

  it('does not ask after a save', async () => {
    const { wrapper, router } = await mountAdmin('/library/suppliers/wholesaler-a')
    await wrapper.find('input[name="name"]').setValue('Changed')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(dialog(wrapper).exists()).toBe(false)
    expect(router.currentRoute.value.path).toBe('/library')
  })

  it('asks about a recipe too', async () => {
    const { wrapper, router } = await mountAdmin('/library/designs/groom')
    await wrapper.find('button[aria-label^="Remove"]').trigger('click')

    const leaving = router.push('/library')
    await flushPromises()
    expect(dialog(wrapper).exists()).toBe(true)

    await answerConfirm(wrapper, false)
    await leaving
  })
})

describe('one thing saving at a time', () => {
  it('shows Copying on the copy button only, and greys the rest', async () => {
    const finish = heldReply()
    const { wrapper } = await mountAdmin('/library/designs/groom')
    await byText(wrapper, 'Make a variant').trigger('click')
    await wrapper.find('input[name="variant-name"]').setValue('No dahlia')

    await byText(wrapper, 'Copy design').trigger('click')

    const copying = byText(wrapper, 'Copying…')
    expect(isGrey(copying)).toBe(true)
    expect(isGrey(byText(wrapper, 'Save design'))).toBe(true)
    expect(isGrey(byText(wrapper, 'Save recipe'))).toBe(true)
    expect(wrapper.text()).not.toContain('Saving…')

    finish()
    await flushPromises()
  })

  it('shows Saving on the design button only', async () => {
    const finish = heldReply()
    const { wrapper } = await mountAdmin('/library/designs/groom')
    await wrapper.find('input[name="optional"]').setValue(true)

    await wrapper.find('form.design-form').trigger('submit')

    expect(wrapper.findAll('button').filter((b) => b.text() === 'Saving…')).toHaveLength(1)
    expect(byText(wrapper, 'Save recipe').exists()).toBe(true)

    finish()
    await flushPromises()
  })

  it('shows Saving on the recipe button only', async () => {
    const finish = heldReply()
    const { wrapper } = await mountAdmin('/library/designs/groom')
    await wrapper.find('button[aria-label^="Remove"]').trigger('click')

    await wrapper.find('form.recipe-form').trigger('submit')

    expect(wrapper.findAll('button').filter((b) => b.text() === 'Saving…')).toHaveLength(1)
    expect(byText(wrapper, 'Save design').exists()).toBe(true)

    finish()
    await flushPromises()
  })

  it('shows Saving on one Save to library button only', async () => {
    const finish = heldReply()
    localStorage.setItem('nickname', 'Mum')
    localStorage.setItem('admin-key', 'the-key')
    localStorage.setItem('admin-on', 'yes')
    const { wrapper } = await mountEvent()
    await wrapper.find('[data-design="top-table"] .recipe-toggle').trigger('click')
    await wrapper.find('.save-to-library').trigger('click')
    await wrapper.find('input[name="new-design-name"]').setValue('New one')

    await wrapper.find('.save-new-design').trigger('click')

    expect(wrapper.find('.save-new-design').text()).toBe('Saving…')
    expect(wrapper.find('.update-recipe').text()).not.toBe('Saving…')

    finish()
    await flushPromises()
  })
})

describe('Save as PDF feedback', () => {
  async function workPlan() {
    const mounted = await mountEvent('work-plan')
    setDesign(mounted.store, 'pedestal', 1)
    mounted.store.togglePalette('focal', 'focus-rose')
    await flushPromises()
    return mounted
  }

  it('shows it is opening straight away', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const { wrapper } = await workPlan()
    vi.useFakeTimers()

    await wrapper.find('button.save-pdf').trigger('click')

    expect(wrapper.find('button.save-pdf').text()).toBe('Opening…')
  })

  it('says nothing more when the print screen opens', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })
    const { wrapper } = await workPlan()
    vi.useFakeTimers()

    await wrapper.find('button.save-pdf').trigger('click')
    await vi.advanceTimersByTimeAsync(5000)

    expect(wrapper.find('[data-print-help]').exists()).toBe(false)
    expect(wrapper.find('button.save-pdf').text()).toBe('Save as PDF')
  })

  it('explains what to do when the print screen never opens', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const { wrapper } = await workPlan()
    vi.useFakeTimers()

    await wrapper.find('button.save-pdf').trigger('click')
    await vi.advanceTimersByTimeAsync(5000)

    expect(wrapper.find('[data-print-help]').text()).toContain('Safari')
    expect(wrapper.find('button.save-pdf').text()).toBe('Save as PDF')
  })

  it('explains the same when printing throws', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('Not allowed')
    })
    const { wrapper } = await workPlan()

    await wrapper.find('button.save-pdf').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-print-help]').exists()).toBe(true)
  })

  it('keeps the help off the printout', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const { wrapper } = await workPlan()
    vi.useFakeTimers()

    await wrapper.find('button.save-pdf').trigger('click')
    await vi.advanceTimersByTimeAsync(5000)

    expect(wrapper.find('.no-print [data-print-help]').exists()).toBe(true)
  })
})

describe('event cards', () => {
  it('shows each event as a card link', async () => {
    const { router, wrapper } = await mountApp('/events')
    useEventStore().createEvent({ name: 'Card test' })
    await flushPromises()
    await router.push('/events')

    const card = wrapper.find('a.card-link')
    expect(card.text()).toContain('Card test')
  })

  it('shows the date with the days until it, greyed', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 2, 12) })
    const { router, wrapper } = await mountApp('/events')
    useEventStore().createEvent({ name: 'Dated', date: '2026-11-30' })
    await router.push('/events')
    await vi.runAllTimersAsync()

    const date = wrapper.find('[data-event-date]')
    expect(date.text()).toBe('30 Nov 2026 in 28 days')
    expect(date.find('.muted').text()).toBe('in 28 days')
  })
})
