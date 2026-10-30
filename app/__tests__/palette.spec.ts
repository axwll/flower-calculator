import type { VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import type { EventPlan } from '@engine'

import type { useEventStore } from '../stores/event'
import { splitText } from '../wording'
import { mountEvent } from './helpers'

type Store = ReturnType<typeof useEventStore>

function designIndex(store: Store, designId: string): number {
  return (store.current as EventPlan).designs.findIndex((item) => item.designId === designId)
}

function section(wrapper: VueWrapper, role: string) {
  return wrapper.find(`[data-role="${role}"]`)
}

async function tick(wrapper: VueWrapper, role: string, flowerId: string) {
  await section(wrapper, role).find(`[data-flower="${flowerId}"] input[name="tick"]`).setValue(true)
}

async function paletteWithTopTable() {
  const mounted = await mountEvent('palette')
  mounted.store.setQuantity(designIndex(mounted.store, 'top-table'), 1)
  await mounted.wrapper.vm.$nextTick()
  return mounted
}

describe('splitText', () => {
  const line = { total: 7, equalShare: 2, floating: 1, eligibleFlowerIds: ['a', 'b', 'c'] }

  it('matches the wording in the plan', () => {
    expect(splitText(line)).toBe('7 stems across 3 flowers: 2, 2, 2 + 1 floating')
  })

  it('leaves out floating when a line divides evenly', () => {
    expect(splitText({ ...line, total: 6, floating: 0 })).toBe('6 stems across 3 flowers: 2, 2, 2')
  })

  it('handles a single flower', () => {
    expect(splitText({ total: 1, equalShare: 1, floating: 0, eligibleFlowerIds: ['a'] })).toBe(
      '1 stem across 1 flower: 1',
    )
  })

  it('says when nothing is ticked', () => {
    expect(splitText({ total: 7, equalShare: 0, floating: 0, eligibleFlowerIds: [] })).toBe(
      '7 stems with no flowers ticked',
    )
  })
})

describe('palette step', () => {
  it('asks for designs first when none are chosen', async () => {
    const { wrapper } = await mountEvent('palette')

    expect(wrapper.text()).toContain('Add some designs first')
  })

  it('shows only the roles the chosen designs use', async () => {
    const { wrapper } = await paletteWithTopTable()

    expect(wrapper.findAll('[data-role]').map((item) => item.attributes('data-role'))).toEqual([
      'focal',
      'secondary',
      'filler',
    ])
  })

  it('shows role-eligible flowers until asked for the rest', async () => {
    const { wrapper } = await paletteWithTopTable()
    const flowers = () =>
      section(wrapper, 'secondary')
        .findAll('[data-flower]')
        .map((item) => item.attributes('data-flower'))

    expect(flowers()).toEqual(['lisianthus', 'ms-rose', 'orange-rose'])

    await section(wrapper, 'secondary').find('button.show-all').trigger('click')

    expect(flowers()).toContain('focus-rose')
    expect(flowers().slice(0, 3)).toEqual(['lisianthus', 'ms-rose', 'orange-rose'])
  })

  it('shows source, bunch size and price', async () => {
    const { wrapper } = await paletteWithTopTable()

    expect(section(wrapper, 'focal').find('[data-flower="focus-rose"]').text()).toContain(
      'Wholesaler A · 48 stems · £40.00',
    )
  })

  it('updates the split as flowers are ticked', async () => {
    const { wrapper } = await paletteWithTopTable()
    const focal = () => section(wrapper, 'focal').text()

    expect(focal()).toContain('Top table: 7 stems with no flowers ticked')

    await tick(wrapper, 'focal', 'focus-rose')
    expect(focal()).toContain('7 stems across 1 flower: 7')

    await tick(wrapper, 'focal', 'hydrangea')
    expect(focal()).toContain('7 stems across 2 flowers: 3, 3 + 1 floating')
  })

  it('unticks a flower', async () => {
    const { wrapper, store } = await paletteWithTopTable()
    await tick(wrapper, 'focal', 'focus-rose')
    await section(wrapper, 'focal')
      .find('[data-flower="focus-rose"] input[name="tick"]')
      .setValue(false)

    expect(store.current?.palette.focal).toEqual([])
  })

  it('keeps a ticked flower visible even if it is not role-eligible', async () => {
    const { wrapper, store } = await paletteWithTopTable()
    store.togglePalette('secondary', 'focus-rose')
    await wrapper.vm.$nextTick()

    expect(section(wrapper, 'secondary').find('[data-flower="focus-rose"]').exists()).toBe(true)
  })

  it('badges a flower used in two roles with its combined stems', async () => {
    const { wrapper, store } = await paletteWithTopTable()
    store.togglePalette('focal', 'focus-rose')
    store.togglePalette('secondary', 'focus-rose')
    await wrapper.vm.$nextTick()

    expect(section(wrapper, 'focal').find('[data-flower="focus-rose"]').text()).toContain(
      'Shared: 20 stems',
    )
  })

  it('does not badge a flower used in one role', async () => {
    const { wrapper } = await paletteWithTopTable()
    await tick(wrapper, 'focal', 'focus-rose')

    expect(section(wrapper, 'focal').text()).not.toContain('Shared')
  })

  it('leaves a flower out of one design only', async () => {
    const { wrapper, store } = await paletteWithTopTable()
    const pedestal = designIndex(store, 'pedestal')
    store.setQuantity(pedestal, 1)
    await tick(wrapper, 'focal', 'focus-rose')
    await tick(wrapper, 'focal', 'hydrangea')

    await section(wrapper, 'focal')
      .find(`[data-flower="focus-rose"] input[name="use-${pedestal}"]`)
      .setValue(false)

    expect(store.current?.designs[pedestal]?.excludedFlowerIds).toEqual(['focus-rose'])
    expect(store.current?.designs[designIndex(store, 'top-table')]?.excludedFlowerIds).toEqual([])
    expect(section(wrapper, 'focal').text()).toContain('Pedestals: 5 stems across 1 flower: 5')
  })
})
