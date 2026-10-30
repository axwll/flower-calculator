import { describe, expect, it, vi } from 'vitest'

import type { MasterData, PriceReport } from '@engine'

import { TABS, bumpVersion, handlePost, readMaster, respondRead, runSetup } from './core'
import { fakeCache, fakeDeps, fakeSheets } from './fakeSheets'
import { seed } from './seedData'

function seededDeps(overrides: Parameters<typeof fakeDeps>[1] = {}) {
  const sheets = fakeSheets()
  const deps = fakeDeps(sheets, overrides)
  runSetup(sheets, seed, deps.now())
  return { sheets, deps }
}

function report(overrides: Partial<PriceReport> = {}): PriceReport {
  return {
    id: 'report-1',
    flowerId: 'focus-rose',
    supplierId: 'wholesaler-a',
    pricePence: 4500,
    stemsPerBunch: 48,
    reportedAt: '2026-06-30T10:00:00.000Z',
    reportedBy: 'Sam',
    status: 'active',
    ...overrides,
  }
}

function post(deps: ReturnType<typeof fakeDeps>, body: unknown) {
  return JSON.parse(handlePost(JSON.stringify(body), deps)) as Record<string, unknown>
}

function send(
  deps: ReturnType<typeof fakeDeps>,
  extra: Partial<PriceReport> = {},
  key = 'app-key',
) {
  return post(deps, { action: 'reportPrice', key, report: report(extra) })
}

function voidIt(deps: ReturnType<typeof fakeDeps>, extra: Record<string, unknown> = {}) {
  return post(deps, {
    action: 'voidPrice',
    key: 'app-key',
    reportId: 'report-1',
    nickname: 'Sam',
    ...extra,
  })
}

function master(deps: ReturnType<typeof fakeDeps>): MasterData {
  return readMaster(deps.sheets)
}

function currentRow(deps: ReturnType<typeof fakeDeps>, id = 'report-1') {
  return master(deps).prices.find((price) => price.id === id)
}

describe('runSetup', () => {
  it('creates every tab with its headers', () => {
    const { sheets } = seededDeps()

    expect([...sheets.tabs.keys()].sort()).toEqual(Object.keys(TABS).sort())
  })

  it('gives each plan tab the section 9 name', () => {
    expect(Object.keys(TABS).sort()).toEqual([
      'Changelog',
      'Designs',
      'Flowers',
      'Meta',
      'Prices',
      'RecipeLines',
      'Recipes',
      'SharedPlans',
      'Suppliers',
    ])
  })

  it('seeds data that reads back the same', () => {
    const { deps } = seededDeps()
    const data = master(deps)

    expect(data.flowers).toEqual(seed.flowers)
    expect(data.suppliers).toEqual(seed.suppliers)
    expect(data.designs).toEqual(seed.designs)
    expect(data.recipes).toEqual(seed.recipes)
    expect(data.prices).toHaveLength(seed.prices.length)
  })

  it('stamps seed prices with the setup time', () => {
    const { deps } = seededDeps()

    expect(master(deps).prices.every((price) => price.reportedAt === deps.now())).toBe(true)
  })

  it('adds nothing when run twice', () => {
    const { sheets, deps } = seededDeps()
    const before = JSON.stringify([...sheets.tabs])
    runSetup(sheets, seed, deps.now())

    expect(JSON.stringify([...sheets.tabs])).toBe(before)
  })

  it('starts the version at 1', () => {
    const { sheets } = seededDeps()

    expect(sheets.readMeta('dataVersion')).toBe('1')
  })

  it('logs the seeding once', () => {
    const { sheets, deps } = seededDeps()
    runSetup(sheets, seed, deps.now())

    expect(sheets.readRows('Changelog')).toHaveLength(1)
  })
})

describe('reading rows', () => {
  it('uses the latest row for a flower', () => {
    const { sheets, deps } = seededDeps()
    const row = sheets.readRows('Flowers')[0] ?? []
    sheets.appendRows('Flowers', [[row[0] ?? '', 'Renamed', ...row.slice(2)]])
    const flowers = master(deps).flowers

    expect(flowers).toHaveLength(seed.flowers.length)
    expect(flowers.find((flower) => flower.id === row[0])?.name).toBe('Renamed')
  })

  it('keeps inactive rows', () => {
    const { sheets, deps } = seededDeps()
    const row = sheets.readRows('Suppliers')[0] ?? []
    sheets.appendRows('Suppliers', [[...row.slice(0, 3), 'FALSE', row[4] ?? '']])

    expect(master(deps).suppliers.find((item) => item.id === row[0])?.active).toBe(false)
  })

  it('uses the highest recipe version', () => {
    const { sheets, deps } = seededDeps()
    sheets.appendRows('Recipes', [['groom', 'Fixed', '2', deps.now()]])
    sheets.appendRows('RecipeLines', [['groom', 'Fixed', '2', '0', 'named', '', 'santini', '9']])
    const recipes = master(deps).recipes.filter((recipe) => recipe.designId === 'groom')

    expect(recipes).toEqual([
      {
        designId: 'groom',
        size: 'Fixed',
        version: 2,
        lines: [{ kind: 'named', flowerId: 'santini', stemsPerUnit: 9 }],
      },
    ])
  })

  it('keeps recipe lines in line order, whatever the row order', () => {
    const { sheets, deps } = seededDeps()
    sheets.appendRows('Recipes', [['groom', 'Fixed', '3', deps.now()]])
    sheets.appendRows('RecipeLines', [
      ['groom', 'Fixed', '3', '1', 'role', 'filler', '', '2'],
      ['groom', 'Fixed', '3', '0', 'named', '', 'santini', '1'],
    ])
    const recipe = master(deps).recipes.find((item) => item.designId === 'groom')

    expect(recipe?.lines.map((line) => line.stemsPerUnit)).toEqual([1, 2])
  })

  it('reads optional price fields back', () => {
    const { deps } = seededDeps()
    send(deps, { offerEndsAt: '2026-07-01T00:00:00.000Z', note: 'offer on' })

    expect(currentRow(deps)).toMatchObject({
      offerEndsAt: '2026-07-01T00:00:00.000Z',
      note: 'offer on',
    })
  })

  it('leaves empty optional price fields out', () => {
    const { deps } = seededDeps()
    send(deps)

    expect(currentRow(deps)).not.toHaveProperty('note')
    expect(currentRow(deps)).not.toHaveProperty('offerEndsAt')
  })
})

describe('respondRead', () => {
  it('returns everything for a client with no version', () => {
    const { deps } = seededDeps()
    const reply = JSON.parse(respondRead(undefined, deps))

    expect(reply).toMatchObject({ status: 'ok', data: { version: 1 } })
    expect(reply.data.flowers).toHaveLength(seed.flowers.length)
  })

  it('says unchanged for a client that is up to date', () => {
    const { deps } = seededDeps()

    expect(JSON.parse(respondRead(1, deps))).toEqual({ status: 'unchanged', version: 1 })
  })

  it('returns everything for a client that is behind', () => {
    const { deps } = seededDeps()
    send(deps)

    expect(JSON.parse(respondRead(1, deps))).toMatchObject({
      status: 'ok',
      data: { version: 2 },
    })
  })

  it('caches by version, so a second read skips the Sheet', () => {
    const cache = fakeCache()
    const { sheets, deps } = seededDeps({ cache })
    respondRead(undefined, deps)
    const read = vi.spyOn(sheets, 'readRows')
    respondRead(undefined, deps)

    expect(read).not.toHaveBeenCalled()
  })

  it('still answers when the data is too big to cache', () => {
    const cache = {
      get: () => null,
      put: () => {
        throw new Error('Too large')
      },
    }
    const { deps } = seededDeps({ cache })

    expect(JSON.parse(respondRead(undefined, deps)).status).toBe('ok')
  })
})

describe('bumpVersion', () => {
  it('adds one, which is how a hand edit reaches the app', () => {
    const { sheets } = seededDeps()
    bumpVersion(sheets)

    expect(sheets.readMeta('dataVersion')).toBe('2')
  })
})

describe('reporting a price', () => {
  it('adds a row and bumps the version', () => {
    const { deps } = seededDeps()

    expect(send(deps)).toEqual({ status: 'ok', version: 2 })
    expect(currentRow(deps)).toMatchObject({
      pricePence: 4500,
      reportedBy: 'Sam',
      status: 'active',
    })
  })

  it('keeps the original time for a report sent later', () => {
    const { deps } = seededDeps()
    send(deps, { reportedAt: '2026-06-01T08:00:00.000Z' })

    expect(currentRow(deps)?.reportedAt).toBe('2026-06-01T08:00:00.000Z')
  })

  it('holds the lock while writing', () => {
    let locks = 0
    const { deps } = seededDeps({
      withLock: (work) => {
        locks += 1
        return work()
      },
    })
    send(deps)

    expect(locks).toBe(1)
  })

  it('ignores a repeated report, so a retry cannot duplicate', () => {
    const { sheets, deps } = seededDeps()
    send(deps)
    const rows = sheets.readRows('Prices').length

    expect(send(deps)).toEqual({ status: 'ok', version: 2, duplicate: true })
    expect(sheets.readRows('Prices')).toHaveLength(rows)
  })

  it('refuses a wrong app key', () => {
    const { sheets, deps } = seededDeps()
    const rows = sheets.readRows('Prices').length

    expect(send(deps, {}, 'wrong')).toMatchObject({ status: 'error', code: 'bad-key' })
    expect(sheets.readRows('Prices')).toHaveLength(rows)
  })

  it.each<[string, Partial<PriceReport>]>([
    ['an unknown flower', { flowerId: 'ghost' }],
    ['an unknown supplier', { supplierId: 'ghost' }],
    ['a fractional price', { pricePence: 10.5 }],
    ['a negative price', { pricePence: -1 }],
    ['no bunch size', { stemsPerBunch: 0 }],
    ['a fractional bunch size', { stemsPerBunch: 2.5 }],
    ['an unreadable time', { reportedAt: 'yesterday' }],
    ['an unreadable offer end', { offerEndsAt: 'soon' }],
    ['no nickname', { reportedBy: '   ' }],
    ['no id', { id: '' }],
    ['a very long note', { note: 'x'.repeat(501) }],
  ])('refuses %s', (_label, extra) => {
    const { deps } = seededDeps()

    expect(send(deps, extra)).toMatchObject({ status: 'error', code: 'invalid' })
  })

  it('always stores a new report as active', () => {
    const { deps } = seededDeps()
    send(deps, { status: 'voided' })

    expect(currentRow(deps)?.status).toBe('active')
  })
})

describe('voiding a price', () => {
  it('lets someone void their own report', () => {
    const { deps } = seededDeps()
    send(deps)

    expect(voidIt(deps)).toEqual({ status: 'ok', version: 3 })
    expect(currentRow(deps)?.status).toBe('voided')
  })

  it('adds a row and removes nothing', () => {
    const { sheets, deps } = seededDeps()
    send(deps)
    const rows = sheets.readRows('Prices').length
    voidIt(deps)

    expect(sheets.readRows('Prices')).toHaveLength(rows + 1)
  })

  it('logs the void', () => {
    const { sheets, deps } = seededDeps()
    send(deps)
    voidIt(deps)

    expect(sheets.readRows('Changelog').at(-1)).toEqual([
      deps.now(),
      'Sam',
      'void-price',
      'report-1',
    ])
  })

  it("refuses someone else's report", () => {
    const { deps } = seededDeps()
    send(deps)

    expect(voidIt(deps, { nickname: 'Jo' })).toMatchObject({ status: 'error', code: 'not-yours' })
    expect(currentRow(deps)?.status).toBe('active')
  })

  it("lets the admin key void anyone's report", () => {
    const { deps } = seededDeps()
    send(deps)

    expect(voidIt(deps, { nickname: 'Jo', adminKey: 'admin-key' }).status).toBe('ok')
  })

  it('refuses a wrong admin key', () => {
    const { deps } = seededDeps()
    send(deps)

    expect(voidIt(deps, { nickname: 'Jo', adminKey: 'guess' })).toMatchObject({
      code: 'not-yours',
    })
  })

  it('refuses an admin key when none has been set', () => {
    const { deps } = seededDeps({ adminKey: () => null })
    send(deps)

    expect(voidIt(deps, { nickname: 'Jo', adminKey: '' })).toMatchObject({ code: 'not-yours' })
  })

  it('reports an unknown id', () => {
    const { deps } = seededDeps()

    expect(voidIt(deps)).toMatchObject({ status: 'error', code: 'not-found' })
  })

  it('treats a repeated void as done', () => {
    const { sheets, deps } = seededDeps()
    send(deps)
    voidIt(deps)
    const rows = sheets.readRows('Prices').length

    expect(voidIt(deps)).toMatchObject({ status: 'ok', duplicate: true })
    expect(sheets.readRows('Prices')).toHaveLength(rows)
  })

  it('needs the shared app key too', () => {
    const { deps } = seededDeps()
    send(deps)

    expect(voidIt(deps, { key: 'wrong' })).toMatchObject({ code: 'bad-key' })
  })
})

describe('bad requests', () => {
  it('refuses broken JSON', () => {
    const { deps } = seededDeps()

    expect(JSON.parse(handlePost('{ nope', deps))).toMatchObject({ code: 'invalid' })
  })

  it('refuses an unknown action', () => {
    const { deps } = seededDeps()

    expect(post(deps, { action: 'dropTables', key: 'app-key' })).toMatchObject({ code: 'invalid' })
  })

  it('says busy, so the app retries, when the lock times out', () => {
    const { deps } = seededDeps({
      withLock: () => {
        throw new Error('Lock timed out')
      },
    })

    expect(send(deps)).toMatchObject({ status: 'error', code: 'busy' })
  })
})
