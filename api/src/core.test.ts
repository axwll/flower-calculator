import { describe, expect, it, vi } from 'vitest'

import type {
  Design,
  Flower,
  MasterData,
  PriceReport,
  RecipeDraft,
  Role,
  Size,
  SoldAs,
  Supplier,
} from '@engine'

import {
  MAX_SHARE_CHARS,
  TABS,
  bumpVersion,
  handlePost,
  readMaster,
  respondRead,
  respondShared,
  runSetup,
} from './core'
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

function admin(
  deps: ReturnType<typeof fakeDeps>,
  action: string,
  extra: Record<string, unknown>,
  adminKey: unknown = 'admin-key',
) {
  return post(deps, { action, key: 'app-key', adminKey, nickname: 'Mum', ...extra })
}

function flower(overrides: Partial<Flower> = {}): Flower {
  return {
    id: 'peony-a1b2',
    name: 'Peony',
    roles: ['focal'],
    soldAs: 'stem',
    trackLeftovers: true,
    active: true,
    ...overrides,
  }
}

const supplier: Supplier = { id: 'market-a1', name: 'Market', type: 'other', active: true }

const design: Design = { id: 'posy-a1', name: 'Posy', group: 'Bridal', optional: false }

function recipe(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    designId: 'buttonhole',
    size: 'Fixed',
    lines: [{ kind: 'named', flowerId: 'focus-rose', stemsPerUnit: 2 }],
    ...overrides,
  }
}

function changelog(sheets: ReturnType<typeof seededDeps>['sheets']) {
  return sheets.readRows('Changelog').slice(1)
}

describe('old Sheets', () => {
  it('adds missing columns on setup, leaving rows alone', () => {
    const { sheets, deps } = seededDeps()
    sheets.headers.set('Designs', [
      'id',
      'name',
      'group',
      'optional',
      'isLeftoverPool',
      'updatedAt',
    ])
    const rows = JSON.stringify(sheets.readRows('Designs'))
    runSetup(sheets, seed, deps.now())

    expect(sheets.readHeaders('Designs')).toEqual([...TABS.Designs])
    expect(JSON.stringify(sheets.readRows('Designs'))).toBe(rows)
  })

  it('changes no headers when none are missing', () => {
    const { sheets, deps } = seededDeps()
    const written = vi.spyOn(sheets, 'writeHeaders')
    runSetup(sheets, seed, deps.now())

    expect(written).not.toHaveBeenCalled()
  })

  it('counts rows from before the new columns as active', () => {
    const { sheets, deps } = seededDeps()
    sheets.appendRows('Designs', [['old', 'Old', 'Bridal', 'FALSE', 'FALSE', 'now']])
    sheets.appendRows('Recipes', [['old', 'Fixed', '1', 'now']])
    sheets.appendRows('RecipeLines', [['old', 'Fixed', '1', '0', 'role', 'filler', '', '3']])
    const data = master(deps)

    expect(data.designs.find(({ id }) => id === 'old')).toEqual({
      id: 'old',
      name: 'Old',
      group: 'Bridal',
      optional: false,
    })
    expect(data.recipes.find(({ designId }) => designId === 'old')).toEqual({
      designId: 'old',
      size: 'Fixed',
      version: 1,
      lines: [{ kind: 'role', role: 'filler', stemsPerUnit: 3 }],
    })
  })
})

describe('checkAdmin', () => {
  it('accepts the right key', () => {
    const { deps } = seededDeps()

    expect(admin(deps, 'checkAdmin', {}).status).toBe('ok')
  })

  it('refuses the wrong key', () => {
    const { deps } = seededDeps()

    expect(admin(deps, 'checkAdmin', {}, 'guess').code).toBe('not-admin')
  })

  it('refuses every key when none is set on the server', () => {
    const { deps } = seededDeps({ adminKey: () => null })

    expect(admin(deps, 'checkAdmin', {}, null).code).toBe('not-admin')
    expect(admin(deps, 'checkAdmin', {}, '').code).toBe('not-admin')
  })

  it('still needs the app key', () => {
    const { deps } = seededDeps()

    expect(post(deps, { action: 'checkAdmin', key: 'old', adminKey: 'admin-key' }).code).toBe(
      'bad-key',
    )
  })
})

describe.each([
  ['saveFlower', { flower: flower() }],
  ['saveSupplier', { supplier }],
  ['saveDesign', { design }],
  ['saveRecipe', { recipe: recipe() }],
])('%s permissions', (action, body) => {
  it('refuses a wrong key and writes nothing', () => {
    const { sheets, deps } = seededDeps()
    const before = JSON.stringify([...sheets.tabs])

    expect(admin(deps, action, body, 'guess').code).toBe('not-admin')
    expect(JSON.stringify([...sheets.tabs])).toBe(before)
  })

  it('needs a nickname for the Changelog', () => {
    const { deps } = seededDeps()

    expect(admin(deps, action, { ...body, nickname: ' ' }).code).toBe('invalid')
  })

  it('bumps the version and logs who did it', () => {
    const { sheets, deps } = seededDeps()
    const reply = admin(deps, action, body)

    expect(reply).toMatchObject({ status: 'ok', version: 2 })
    expect(changelog(sheets).at(-1)?.slice(0, 2)).toEqual([deps.now(), 'Mum'])
  })
})

describe('saveFlower', () => {
  it('adds a flower', () => {
    const { deps } = seededDeps()
    admin(deps, 'saveFlower', { flower: flower({ colour: 'Pink' }) })

    expect(master(deps).flowers.find(({ id }) => id === 'peony-a1b2')).toEqual(
      flower({ colour: 'Pink' }),
    )
  })

  it('replaces an existing flower with a new row', () => {
    const { sheets, deps } = seededDeps()
    const rows = sheets.readRows('Flowers').length
    admin(deps, 'saveFlower', { flower: flower({ id: 'scabious', name: 'Scabious' }) })

    expect(master(deps).flowers.find(({ id }) => id === 'scabious')?.name).toBe('Scabious')
    expect(sheets.readRows('Flowers')).toHaveLength(rows + 1)
  })

  it('writes a readable log line', () => {
    const { sheets, deps } = seededDeps()
    admin(deps, 'saveFlower', { flower: flower() })

    expect(changelog(sheets).at(-1)?.slice(2)).toEqual(['save-flower', 'peony-a1b2: Peony'])
  })

  it.each([
    ['no id', { id: '' }, 'A flower needs an id.'],
    ['no name', { name: ' ' }, 'A flower needs a name.'],
    ['a very long name', { name: 'x'.repeat(81) }, 'That name is too long.'],
    ['no roles', { roles: [] }, 'A flower needs at least one role.'],
    ['an unknown role', { roles: ['star'] as unknown as Role[] }, 'Unknown role.'],
    ['an unknown sold as', { soldAs: 'box' as SoldAs }, 'Unknown sold-as choice.'],
    ['a text flag', { active: 'yes' as unknown as boolean }, 'Invalid flower details.'],
  ])('refuses %s', (_name, overrides, message) => {
    const { deps } = seededDeps()

    expect(admin(deps, 'saveFlower', { flower: flower(overrides) })).toMatchObject({
      code: 'invalid',
      message,
    })
  })
})

describe('saveSupplier', () => {
  it('adds a supplier', () => {
    const { deps } = seededDeps()
    admin(deps, 'saveSupplier', { supplier })

    expect(master(deps).suppliers).toContainEqual(supplier)
  })

  it('retires a supplier and keeps its prices', () => {
    const { deps } = seededDeps()
    const prices = master(deps).prices.length
    const existing = { ...seed.suppliers[0]!, active: false }
    admin(deps, 'saveSupplier', { supplier: existing })

    expect(master(deps).suppliers).toContainEqual(existing)
    expect(master(deps).prices).toHaveLength(prices)
  })

  it.each([
    ['no id', { ...supplier, id: '' }, 'A supplier needs an id.'],
    ['no name', { ...supplier, name: '' }, 'A supplier needs a name.'],
    ['an unknown type', { ...supplier, type: 'shop' }, 'Unknown supplier type.'],
    ['a text flag', { ...supplier, active: 'no' }, 'Invalid supplier details.'],
  ])('refuses %s', (_name, value, message) => {
    const { deps } = seededDeps()

    expect(admin(deps, 'saveSupplier', { supplier: value })).toMatchObject({
      code: 'invalid',
      message,
    })
  })
})

describe('saveDesign', () => {
  it('adds a design', () => {
    const { deps } = seededDeps()
    admin(deps, 'saveDesign', { design })

    expect(master(deps).designs).toContainEqual(design)
  })

  it('retires a design', () => {
    const { deps } = seededDeps()
    admin(deps, 'saveDesign', { design: { ...design, active: false } })

    expect(master(deps).designs.find(({ id }) => id === design.id)?.active).toBe(false)
  })

  it('saves a variant and its recipes in one go', () => {
    const { sheets, deps } = seededDeps()
    const small = recipe({ designId: design.id, size: 'Small' })
    const large = recipe({ designId: design.id, size: 'Large', excludedFlowerIds: ['scabious'] })
    admin(deps, 'saveDesign', { design, recipes: [small, large] })

    const saved = master(deps).recipes.filter(({ designId }) => designId === design.id)
    expect(saved).toEqual([
      { ...small, version: 1 },
      { ...large, version: 1 },
    ])
    expect(sheets.readMeta('dataVersion')).toBe('2')
  })

  it('saves nothing when one of the recipes is bad', () => {
    const { deps } = seededDeps()
    const reply = admin(deps, 'saveDesign', {
      design,
      recipes: [recipe({ designId: design.id, lines: [] })],
    })

    expect(reply.code).toBe('invalid')
    expect(master(deps).designs).not.toContainEqual(design)
  })

  it('refuses recipes for another design', () => {
    const { deps } = seededDeps()

    expect(admin(deps, 'saveDesign', { design, recipes: [recipe()] }).code).toBe('invalid')
  })

  it('keeps a leftover pool as a pool, and never makes a new one', () => {
    const { deps } = seededDeps()
    const { isLeftoverPool: _pool, ...vases } = seed.designs.find(({ id }) => id === 'table-vases')!
    admin(deps, 'saveDesign', { design: { ...vases, name: 'Vases' } })
    admin(deps, 'saveDesign', { design: { ...design, isLeftoverPool: true } })

    const designs = master(deps).designs
    expect(designs.find(({ id }) => id === 'table-vases')).toMatchObject({
      name: 'Vases',
      isLeftoverPool: true,
    })
    expect(designs.find(({ id }) => id === design.id)).toEqual(design)
  })

  it.each([
    ['no id', { ...design, id: '' }, 'A design needs an id.'],
    ['no name', { ...design, name: '' }, 'A design needs a name.'],
    ['no group', { ...design, group: '' }, 'A design needs a group.'],
    ['a text flag', { ...design, optional: 'yes' }, 'Invalid design details.'],
  ])('refuses %s', (_name, value, message) => {
    const { deps } = seededDeps()

    expect(admin(deps, 'saveDesign', { design: value })).toMatchObject({ code: 'invalid', message })
  })
})

describe('saveRecipe', () => {
  it('sets the next version itself', () => {
    const { deps } = seededDeps()
    admin(deps, 'saveRecipe', { recipe: { ...recipe(), version: 99 } })

    expect(master(deps).recipes.find(({ designId }) => designId === 'buttonhole')).toEqual({
      ...recipe(),
      version: 2,
    })
  })

  it('keeps the older version in the Sheet', () => {
    const { sheets, deps } = seededDeps()
    const rows = sheets.readRows('RecipeLines').length
    admin(deps, 'saveRecipe', { recipe: recipe() })

    expect(sheets.readRows('RecipeLines')).toHaveLength(rows + 1)
  })

  it('keeps flowers to leave out', () => {
    const { deps } = seededDeps()
    const excludedFlowerIds = ['dahlia-dark', 'dahlia-orange']
    admin(deps, 'saveRecipe', {
      recipe: recipe({
        lines: [{ kind: 'role', role: 'focal', stemsPerUnit: 3 }],
        excludedFlowerIds,
      }),
    })

    expect(
      master(deps).recipes.find(({ designId }) => designId === 'buttonhole')?.excludedFlowerIds,
    ).toEqual(excludedFlowerIds)
  })

  it('retires a size', () => {
    const { deps } = seededDeps()
    admin(deps, 'saveRecipe', { recipe: recipe({ active: false }) })

    expect(master(deps).recipes.find(({ designId }) => designId === 'buttonhole')?.active).toBe(
      false,
    )
  })

  it('writes a readable log line', () => {
    const { sheets, deps } = seededDeps()
    admin(deps, 'saveRecipe', { recipe: recipe() })

    expect(changelog(sheets).at(-1)?.slice(2)).toEqual([
      'save-recipe',
      'buttonhole Fixed, version 2',
    ])
  })

  it('lets a retired size be saved beside other sizes', () => {
    const { deps } = seededDeps()
    const reply = admin(deps, 'saveRecipe', {
      recipe: recipe({ designId: 'pedestal', size: 'Fixed', active: false }),
    })

    expect(reply.status).toBe('ok')
  })

  it.each([
    ['an unknown design', { designId: 'nope' }, 'Unknown design.'],
    ['a leftover pool', { designId: 'table-vases' }, 'A leftover pool has no recipe.'],
    ['an unknown size', { size: 'Huge' as Size }, 'Unknown size.'],
    ['no lines', { lines: [] }, 'A recipe needs at least one line.'],
    [
      'an unknown flower',
      { lines: [{ kind: 'named', flowerId: 'nope', stemsPerUnit: 1 }] },
      'Unknown flower.',
    ],
    [
      'an unknown role',
      { lines: [{ kind: 'role', role: 'star' as Role, stemsPerUnit: 1 }] },
      'Unknown role.',
    ],
    [
      'zero stems',
      { lines: [{ kind: 'named', flowerId: 'focus-rose', stemsPerUnit: 0 }] },
      'Every line needs at least one stem.',
    ],
    [
      'part of a stem',
      { lines: [{ kind: 'named', flowerId: 'focus-rose', stemsPerUnit: 1.5 }] },
      'Every line needs at least one stem.',
    ],
    ['an unknown flower to leave out', { excludedFlowerIds: ['nope'] }, 'Unknown flower.'],
    ['Fixed beside other sizes', { designId: 'pedestal' }, 'Fixed can’t sit beside other sizes.'],
    ['a size beside Fixed', { size: 'Small' as Size }, 'Fixed can’t sit beside other sizes.'],
  ] as [string, Partial<RecipeDraft>, string][])('refuses %s', (_name, overrides, message) => {
    const { deps } = seededDeps()

    expect(admin(deps, 'saveRecipe', { recipe: recipe(overrides) })).toMatchObject({
      code: 'invalid',
      message,
    })
  })
})

describe('sharePlan', () => {
  function share(deps: ReturnType<typeof fakeDeps>, payload: unknown, key = 'app-key') {
    return post(deps, { action: 'sharePlan', key, payload })
  }

  it('stores the plan and returns its id', () => {
    const { sheets, deps } = seededDeps({ newId: () => 'long-random-id' })

    expect(share(deps, 'H4sIAAAA_-1')).toEqual({ status: 'ok', id: 'long-random-id' })
    expect(sheets.readRows('SharedPlans')).toEqual([
      ['long-random-id', 'H4sIAAAA_-1', '2026-06-30T12:00:00.000Z'],
    ])
  })

  it('gives each share its own id', () => {
    let next = 0
    const { deps } = seededDeps({ newId: () => `id-${(next += 1)}` })

    expect(share(deps, 'abc').id).not.toBe(share(deps, 'abc').id)
  })

  it('needs the app key', () => {
    const { sheets, deps } = seededDeps()

    expect(share(deps, 'abc', 'wrong').code).toBe('bad-key')
    expect(sheets.readRows('SharedPlans')).toEqual([])
  })

  it('accepts a plan at the size limit', () => {
    const { deps } = seededDeps()

    expect(share(deps, 'a'.repeat(MAX_SHARE_CHARS)).status).toBe('ok')
  })

  it('refuses a plan over the size limit', () => {
    const { sheets, deps } = seededDeps()

    expect(share(deps, 'a'.repeat(MAX_SHARE_CHARS + 1)).code).toBe('too-large')
    expect(sheets.readRows('SharedPlans')).toEqual([])
  })

  it.each([
    ['nothing', undefined],
    ['an empty plan', ''],
    ['a number', 7],
    ['text a cell could treat as a formula', '=IMPORTXML("x")'],
  ])('refuses %s', (_label, payload) => {
    const { sheets, deps } = seededDeps()

    expect(share(deps, payload).code).toBe('invalid')
    expect(sheets.readRows('SharedPlans')).toEqual([])
  })

  it('leaves the data version and Changelog alone', () => {
    const { sheets, deps } = seededDeps()
    const version = readMaster(sheets).version
    const logged = sheets.readRows('Changelog').length
    share(deps, 'abc')

    expect(readMaster(sheets).version).toBe(version)
    expect(sheets.readRows('Changelog')).toHaveLength(logged)
  })

  it('keeps shares out of the master data', () => {
    const { deps } = seededDeps()
    share(deps, 'secret-payload')

    expect(respondRead(undefined, deps)).not.toContain('secret-payload')
  })
})

describe('respondShared', () => {
  it('hands back a plan by its id', () => {
    const { deps } = seededDeps({ newId: () => 'share-1' })
    post(deps, { action: 'sharePlan', key: 'app-key', payload: 'abc' })

    expect(JSON.parse(respondShared('share-1', deps))).toEqual({ status: 'ok', payload: 'abc' })
  })

  it('says when there is no such plan', () => {
    const { deps } = seededDeps()

    expect(JSON.parse(respondShared('made-up', deps))).toMatchObject({ code: 'not-found' })
  })
})
