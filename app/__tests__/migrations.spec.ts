import { describe, expect, it } from 'vitest'

import { CURRENT_SCHEMA_VERSION, migrateEvent } from '../storage/migrations'

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: 'event-1',
    name: 'June wedding',
    designs: [],
    palette: { focal: [], secondary: [], filler: [], foliage: [], accent: [] },
    supplierChoice: {},
    settings: { thinBunchPercent: 15, priceAmberDays: 14, priceRedDays: 30, bigChangePercent: 50 },
    ...overrides,
  }
}

describe('migrateEvent', () => {
  it('leaves a current event unchanged', () => {
    const event = validEvent()

    expect(migrateEvent(event)).toEqual(event)
  })

  it('runs each step in order from the event version', () => {
    const steps = {
      1: (raw: Record<string, unknown>) => ({
        ...raw,
        name: `${String(raw.name)} a`,
        schemaVersion: 2,
      }),
      2: (raw: Record<string, unknown>) => ({
        ...raw,
        name: `${String(raw.name)} b`,
        schemaVersion: 3,
      }),
    }

    expect(migrateEvent(validEvent({ schemaVersion: 1 }), steps, 3)).toMatchObject({
      name: 'June wedding a b',
      schemaVersion: 3,
    })
  })

  it('starts part way through the chain for a newer event', () => {
    const steps = {
      1: (raw: Record<string, unknown>) => ({ ...raw, name: 'wrong', schemaVersion: 2 }),
      2: (raw: Record<string, unknown>) => ({ ...raw, name: 'right', schemaVersion: 3 }),
    }

    expect(migrateEvent(validEvent({ schemaVersion: 2 }), steps, 3).name).toBe('right')
  })

  it('refuses an event from a newer version of the app', () => {
    expect(() => migrateEvent(validEvent({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }))).toThrow(
      'newer version',
    )
  })

  it('refuses a version with no migration step', () => {
    expect(() => migrateEvent(validEvent({ schemaVersion: 1 }), {}, 2)).toThrow('version 1')
  })

  it.each([
    ['nothing', null],
    ['text', 'hello'],
    ['a list', []],
    ['no version', validEvent({ schemaVersion: undefined })],
    ['a fractional version', validEvent({ schemaVersion: 1.5 })],
    ['no id', validEvent({ id: undefined })],
    ['no name', validEvent({ name: 7 })],
    ['no designs', validEvent({ designs: 'none' })],
    ['no palette', validEvent({ palette: undefined })],
    ['a palette role that is not a list', validEvent({ palette: { focal: 'x' } })],
    ['no settings', validEvent({ settings: undefined })],
    ['a design with no recipe', validEvent({ designs: [{ designId: 'a', quantity: 1 }] })],
  ])('refuses %s', (_label, raw) => {
    expect(() => migrateEvent(raw)).toThrow('not a valid event')
  })
})
