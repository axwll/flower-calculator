import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EventPlan } from '@engine'

import { backupFileName, buildBackup, parseBackup } from '../storage/backup'
import { useEventStore } from '../stores/event'
import { mountApp, setDesign } from './helpers'

const NOW = '2026-06-30T12:00:00.000Z'

function sampleEvents(): EventPlan[] {
  const store = useEventStore()
  store.open(store.createEvent({ name: 'June wedding' }))
  setDesign(store, 'pedestal', 2)
  return JSON.parse(JSON.stringify(store.events)) as EventPlan[]
}

async function pickFile(wrapper: VueWrapper, text: string) {
  const input = wrapper.find('input[type="file"]')
  const file = new File([text], 'backup.json', { type: 'application/json' })
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('backup files', () => {
  it('round trips every event', async () => {
    await mountApp()
    const events = sampleEvents()

    expect(parseBackup(buildBackup(events, NOW))).toEqual(events)
  })

  it('names the file by date', () => {
    expect(backupFileName(NOW)).toBe('flower-calculator-backup-2026-06-30.json')
  })

  it.each([
    ['broken JSON', '{ nope', "isn't a backup"],
    ['some other JSON', '{"hello":1}', "isn't a backup"],
    ['a list', '[]', "isn't a backup"],
  ])('refuses %s', (_label, text, message) => {
    expect(() => parseBackup(text)).toThrow(message)
  })

  it('refuses a backup with one bad event', async () => {
    await mountApp()
    const events = sampleEvents()
    const text = JSON.stringify({
      app: 'flower-calculator',
      backupVersion: 1,
      events: [...events, { id: 'broken' }],
    })

    expect(() => parseBackup(text)).toThrow('event 2')
  })

  it('refuses a backup from a newer version of the app', () => {
    const text = JSON.stringify({ app: 'flower-calculator', backupVersion: 99, events: [] })

    expect(() => parseBackup(text)).toThrow('newer version')
  })
})

describe('settings: export', () => {
  it('downloads a file holding every event', async () => {
    const created = vi.fn<(blob: Blob) => string>(() => 'blob:backup')
    vi.stubGlobal('URL', { ...URL, createObjectURL: created, revokeObjectURL: vi.fn<() => void>() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { wrapper } = await mountApp('/settings')
    sampleEvents()
    await flushPromises()
    await wrapper.find('button.export-backup').trigger('click')

    expect(click).toHaveBeenCalledOnce()
    const blob = created.mock.calls[0]?.[0] as Blob
    expect(parseBackup(await blob.text()).map((event) => event.name)).toEqual(['June wedding'])
    expect(wrapper.text()).toContain('Backup saved')
  })

  it('has nothing to export with no events', async () => {
    const { wrapper } = await mountApp('/settings')

    expect(wrapper.find('button.export-backup').attributes('disabled')).toBeDefined()
  })
})

describe('settings: import', () => {
  it('adds events from a backup', async () => {
    const { wrapper } = await mountApp('/settings')
    const text = buildBackup(sampleEvents(), NOW)
    const store = useEventStore()
    store.events = []
    await pickFile(wrapper, text)

    expect(store.events.map((event) => event.name)).toEqual(['June wedding'])
    expect(wrapper.text()).toContain('1 event restored')
  })

  it('keeps events that are not in the backup', async () => {
    const { wrapper } = await mountApp('/settings')
    const text = buildBackup(sampleEvents(), NOW)
    const store = useEventStore()
    store.events = []
    store.createEvent({ name: 'Newer event' })
    await pickFile(wrapper, text)

    expect(store.events.map((event) => event.name).sort()).toEqual(['June wedding', 'Newer event'])
  })

  it('asks before replacing an event', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { wrapper } = await mountApp('/settings')
    const [event] = sampleEvents()
    const store = useEventStore()
    const text = buildBackup([{ ...(event as EventPlan), name: 'From backup' }], NOW)
    await pickFile(wrapper, text)

    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0]?.[0]).toContain('replace 1 event')
    expect(store.events.map((item) => item.name)).toEqual(['From backup'])
  })

  it('changes nothing when replacing is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { wrapper } = await mountApp('/settings')
    const [event] = sampleEvents()
    const store = useEventStore()
    await pickFile(wrapper, buildBackup([{ ...(event as EventPlan), name: 'From backup' }], NOW))

    expect(store.events.map((item) => item.name)).toEqual(['June wedding'])
    expect(wrapper.text()).not.toContain('restored')
  })

  it('shows why a file was refused and changes nothing', async () => {
    const { wrapper } = await mountApp('/settings')
    sampleEvents()
    await pickFile(wrapper, 'not a backup')

    expect(wrapper.find('[role="alert"]').text()).toContain("isn't a backup")
    expect(useEventStore().events).toHaveLength(1)
  })

  it('can pick the same file twice', async () => {
    const { wrapper } = await mountApp('/settings')
    await pickFile(wrapper, 'not a backup')

    expect((wrapper.find('input[type="file"]').element as HTMLInputElement).value).toBe('')
  })
})
