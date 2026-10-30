import type {
  Design,
  Flower,
  MasterData,
  PriceReport,
  Recipe,
  RecipeLine,
  Role,
  Size,
  SoldAs,
  Supplier,
} from '@engine'

export const TABS = {
  Meta: ['key', 'value'],
  Flowers: ['id', 'name', 'colour', 'roles', 'soldAs', 'trackLeftovers', 'active', 'updatedAt'],
  Suppliers: ['id', 'name', 'type', 'active', 'updatedAt'],
  Prices: [
    'id',
    'flowerId',
    'supplierId',
    'pricePence',
    'stemsPerBunch',
    'reportedAt',
    'offerEndsAt',
    'note',
    'reportedBy',
    'status',
  ],
  Designs: ['id', 'name', 'group', 'optional', 'isLeftoverPool', 'updatedAt'],
  Recipes: ['designId', 'size', 'version', 'updatedAt'],
  RecipeLines: [
    'designId',
    'size',
    'version',
    'lineIndex',
    'kind',
    'role',
    'flowerId',
    'stemsPerUnit',
  ],
  SharedPlans: ['id', 'payload', 'createdAt'],
  Changelog: ['at', 'actor', 'action', 'detail'],
} as const

export type TabName = keyof typeof TABS

/** Everything the logic needs from a Sheet. Cells are strings, header rows are left out. */
export interface Sheets {
  hasTab(tab: TabName): boolean
  createTab(tab: TabName): void
  readRows(tab: TabName): string[][]
  appendRows(tab: TabName, rows: string[][]): void
  readMeta(key: string): string | null
  writeMeta(key: string, value: string): void
}

export interface Cache {
  get(key: string): string | null
  put(key: string, value: string): void
}

export interface Deps {
  sheets: Sheets
  cache: Cache
  /**
   * Ships in the public page, so it only slows down casual misuse. It's a speed bump, not
   * security. Nicknames are the same: anyone can type any nickname.
   */
  appKey: string
  adminKey: () => string | null
  now: () => string
  withLock: <T>(work: () => T) => T
}

export type SeedData = Omit<MasterData, 'version'>

const VERSION_KEY = 'dataVersion'
const MAX_NOTE_LENGTH = 500
const MAX_NICKNAME_LENGTH = 40

function bool(value: boolean | undefined): string {
  return value ? 'TRUE' : 'FALSE'
}

function isTrue(cell: string | undefined): boolean {
  return cell?.toUpperCase() === 'TRUE'
}

function flowerToRow(flower: Flower, at: string): string[] {
  return [
    flower.id,
    flower.name,
    flower.colour ?? '',
    flower.roles.join(', '),
    flower.soldAs,
    bool(flower.trackLeftovers),
    bool(flower.active),
    at,
  ]
}

function rowToFlower([id = '', name = '', colour, roles = '', soldAs, track, active]: string[]) {
  const flower: Flower = {
    id,
    name,
    roles: roles.split(',').flatMap((role) => (role.trim() ? [role.trim() as Role] : [])),
    soldAs: soldAs as SoldAs,
    trackLeftovers: isTrue(track),
    active: isTrue(active),
  }
  return colour ? { ...flower, colour } : flower
}

function supplierToRow(supplier: Supplier, at: string): string[] {
  return [supplier.id, supplier.name, supplier.type, bool(supplier.active), at]
}

function rowToSupplier([id = '', name = '', type, active]: string[]): Supplier {
  return { id, name, type: type as Supplier['type'], active: isTrue(active) }
}

function designToRow(design: Design, at: string): string[] {
  return [
    design.id,
    design.name,
    design.group,
    bool(design.optional),
    bool(design.isLeftoverPool),
    at,
  ]
}

function rowToDesign([id = '', name = '', group = '', optional, pool]: string[]): Design {
  const design: Design = { id, name, group, optional: isTrue(optional) }
  return isTrue(pool) ? { ...design, isLeftoverPool: true } : design
}

function priceToRow(price: PriceReport): string[] {
  return [
    price.id,
    price.flowerId,
    price.supplierId,
    String(price.pricePence),
    String(price.stemsPerBunch),
    price.reportedAt,
    price.offerEndsAt ?? '',
    price.note ?? '',
    price.reportedBy,
    price.status,
  ]
}

function rowToPrice(row: string[]): PriceReport {
  const [id = '', flowerId = '', supplierId = '', pence, bunch, reportedAt = ''] = row
  const [, , , , , , offerEndsAt, note, reportedBy = '', status] = row
  return {
    id,
    flowerId,
    supplierId,
    pricePence: Number(pence),
    stemsPerBunch: Number(bunch),
    reportedAt,
    ...(offerEndsAt ? { offerEndsAt } : {}),
    ...(note ? { note } : {}),
    reportedBy,
    status: status === 'voided' ? 'voided' : 'active',
  }
}

function lineToRow(recipe: Recipe, line: RecipeLine, lineIndex: number): string[] {
  return [
    recipe.designId,
    recipe.size,
    String(recipe.version),
    String(lineIndex),
    line.kind,
    line.kind === 'role' ? line.role : '',
    line.kind === 'named' ? line.flowerId : '',
    String(line.stemsPerUnit),
  ]
}

function rowToLine([, , , , kind, role, flowerId = '', stems]: string[]): RecipeLine {
  const stemsPerUnit = Number(stems)
  return kind === 'role'
    ? { kind: 'role', role: role as Role, stemsPerUnit }
    : { kind: 'named', flowerId, stemsPerUnit }
}

/** Tabs are append-only, so the last row for an id is the current one. */
function latestById(rows: string[][]): string[][] {
  const latest = new Map<string, string[]>()
  for (const row of rows) latest.set(row[0] ?? '', row)
  return [...latest.values()]
}

function readRecipes(sheets: Sheets): Recipe[] {
  const newest = new Map<string, Recipe>()
  for (const [designId = '', size, version] of sheets.readRows('Recipes')) {
    const key = `${designId}/${size}`
    const recipe = { designId, size: size as Size, version: Number(version), lines: [] }
    if (recipe.version >= (newest.get(key)?.version ?? 0)) newest.set(key, recipe)
  }

  const lines = sheets.readRows('RecipeLines')
  return [...newest.values()].map((recipe) => ({
    ...recipe,
    lines: lines
      .filter(
        ([designId, size, version]) =>
          designId === recipe.designId &&
          size === recipe.size &&
          Number(version) === recipe.version,
      )
      .sort((a, b) => Number(a[3]) - Number(b[3]))
      .map(rowToLine),
  }))
}

export function readMaster(sheets: Sheets): MasterData {
  return {
    version: currentVersion(sheets),
    flowers: latestById(sheets.readRows('Flowers')).map(rowToFlower),
    suppliers: latestById(sheets.readRows('Suppliers')).map(rowToSupplier),
    designs: latestById(sheets.readRows('Designs')).map(rowToDesign),
    recipes: readRecipes(sheets),
    prices: latestById(sheets.readRows('Prices')).map(rowToPrice),
  }
}

function currentVersion(sheets: Sheets): number {
  return Number(sheets.readMeta(VERSION_KEY) ?? 0)
}

export function bumpVersion(sheets: Sheets): number {
  const version = currentVersion(sheets) + 1
  sheets.writeMeta(VERSION_KEY, String(version))
  return version
}

/** Safe to run twice: tabs are only created, and seeded, when they're missing or empty. */
export function runSetup(sheets: Sheets, seed: SeedData, now: string): void {
  for (const tab of Object.keys(TABS) as TabName[]) {
    if (!sheets.hasTab(tab)) sheets.createTab(tab)
  }
  if (sheets.readRows('Flowers').length > 0) return

  sheets.appendRows(
    'Flowers',
    seed.flowers.map((flower) => flowerToRow(flower, now)),
  )
  sheets.appendRows(
    'Suppliers',
    seed.suppliers.map((supplier) => supplierToRow(supplier, now)),
  )
  sheets.appendRows(
    'Designs',
    seed.designs.map((design) => designToRow(design, now)),
  )
  sheets.appendRows(
    'Prices',
    seed.prices.map((price) => priceToRow({ ...price, reportedAt: now })),
  )
  sheets.appendRows(
    'Recipes',
    seed.recipes.map((recipe) => [recipe.designId, recipe.size, String(recipe.version), now]),
  )
  sheets.appendRows(
    'RecipeLines',
    seed.recipes.flatMap((recipe) =>
      recipe.lines.map((line, index) => lineToRow(recipe, line, index)),
    ),
  )
  sheets.appendRows('Changelog', [[now, 'setup', 'seed', 'Starting data']])
  sheets.writeMeta(VERSION_KEY, '1')
}

/** Reads are keyed by version, so any write or hand edit leaves old entries behind. */
export function respondRead(since: number | undefined, deps: Deps): string {
  const version = currentVersion(deps.sheets)
  if (since === version) return JSON.stringify({ status: 'unchanged', version })

  const cacheKey = `master:${version}`
  const cached = deps.cache.get(cacheKey)
  if (cached) return cached

  const reply = JSON.stringify({ status: 'ok', data: readMaster(deps.sheets) })
  try {
    deps.cache.put(cacheKey, reply)
  } catch {
    // CacheService refuses large values. The reply just comes from the Sheet next time.
  }
  return reply
}

type Reply = Record<string, unknown>

function refuse(code: string, message: string): Reply {
  return { status: 'error', code, message }
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isTime(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function reportProblem(raw: Record<string, unknown>, master: MasterData): string | null {
  const { id, flowerId, supplierId, pricePence, stemsPerBunch } = raw
  const { reportedAt, offerEndsAt, note, reportedBy } = raw

  if (!isText(id)) return 'A report needs an id.'
  if (!master.flowers.some((flower) => flower.id === flowerId)) return 'Unknown flower.'
  if (!master.suppliers.some((supplier) => supplier.id === supplierId)) return 'Unknown supplier.'
  if (!Number.isInteger(pricePence) || (pricePence as number) < 0) return 'Invalid price.'
  if (!Number.isInteger(stemsPerBunch) || (stemsPerBunch as number) < 1) {
    return 'Invalid bunch size.'
  }
  if (!isTime(reportedAt)) return 'Invalid report time.'
  if (offerEndsAt !== undefined && !isTime(offerEndsAt)) return 'Invalid offer end date.'
  if (note !== undefined && (typeof note !== 'string' || note.length > MAX_NOTE_LENGTH)) {
    return 'Note too long.'
  }
  if (!isText(reportedBy) || reportedBy.length > MAX_NICKNAME_LENGTH) return 'A nickname is needed.'
  return null
}

function reportPrice(request: Record<string, unknown>, deps: Deps): Reply {
  const raw = (request.report ?? {}) as Record<string, unknown>
  const master = readMaster(deps.sheets)
  const problem = reportProblem(raw, master)
  if (problem) return refuse('invalid', problem)

  // Retries reuse the id made on the phone, so a lost reply can't create a duplicate.
  if (master.prices.some((price) => price.id === raw.id)) {
    return { status: 'ok', version: master.version, duplicate: true }
  }

  deps.sheets.appendRows('Prices', [
    priceToRow({ ...(raw as object), status: 'active' } as PriceReport),
  ])
  return { status: 'ok', version: bumpVersion(deps.sheets) }
}

function voidPrice(request: Record<string, unknown>, deps: Deps): Reply {
  const { reportId, nickname, adminKey } = request
  const master = readMaster(deps.sheets)
  const report = master.prices.find((price) => price.id === reportId)
  if (!report) return refuse('not-found', 'That price report no longer exists.')
  if (report.status === 'voided') return { status: 'ok', version: master.version, duplicate: true }

  const configured = deps.adminKey()
  const isAdmin = Boolean(configured) && adminKey === configured
  if (!isAdmin && report.reportedBy !== nickname) {
    return refuse('not-yours', 'Only the person who reported a price can void it.')
  }

  deps.sheets.appendRows('Prices', [priceToRow({ ...report, status: 'voided' })])
  deps.sheets.appendRows('Changelog', [[deps.now(), String(nickname), 'void-price', report.id]])
  return { status: 'ok', version: bumpVersion(deps.sheets) }
}

function route(request: Record<string, unknown>, deps: Deps): Reply {
  if (request.key !== deps.appKey) return refuse('bad-key', 'This app is out of date.')
  if (request.action === 'reportPrice') return reportPrice(request, deps)
  if (request.action === 'voidPrice') return voidPrice(request, deps)
  return refuse('invalid', 'Unknown action.')
}

function parseRequest(text: string): Record<string, unknown> | null {
  try {
    const request: unknown = JSON.parse(text)
    return typeof request === 'object' && request !== null
      ? (request as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function handlePost(text: string, deps: Deps): string {
  const request = parseRequest(text)
  if (!request) return JSON.stringify(refuse('invalid', 'That request could not be read.'))

  try {
    return JSON.stringify(deps.withLock(() => route(request, deps)))
  } catch {
    return JSON.stringify(refuse('busy', 'The server is busy. Trying again shortly.'))
  }
}
