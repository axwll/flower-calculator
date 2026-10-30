import type {
  Design,
  Flower,
  MasterData,
  PriceReport,
  Recipe,
  RecipeDraft,
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
  Designs: ['id', 'name', 'group', 'optional', 'isLeftoverPool', 'updatedAt', 'active'],
  Recipes: ['designId', 'size', 'version', 'updatedAt', 'active', 'excludedFlowerIds'],
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
  readHeaders(tab: TabName): string[]
  writeHeaders(tab: TabName, headers: string[]): void
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
const MAX_NAME_LENGTH = 80
const ROLES: Role[] = ['focal', 'secondary', 'filler', 'foliage', 'accent']
const SIZES: Size[] = ['Small', 'Medium', 'Large', 'Fixed']
const SOLD_AS: SoldAs[] = ['bunch', 'stem', 'foraged']
const SUPPLIER_TYPES: Supplier['type'][] = ['wholesaler', 'supermarket', 'other']

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
    roles: list(roles) as Role[],
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
    bool(design.active !== false),
  ]
}

/** Rows from before a column existed have it blank, which counts as active. */
function isRetired(cell: string | undefined): boolean {
  return cell?.toUpperCase() === 'FALSE'
}

function rowToDesign(row: string[]): Design {
  const [id = '', name = '', group = '', optional, pool, , active] = row
  return {
    id,
    name,
    group,
    optional: isTrue(optional),
    ...(isTrue(pool) ? { isLeftoverPool: true } : {}),
    ...(isRetired(active) ? { active: false } : {}),
  }
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

function recipeToRow(recipe: Recipe, at: string): string[] {
  return [
    recipe.designId,
    recipe.size,
    String(recipe.version),
    at,
    bool(recipe.active !== false),
    (recipe.excludedFlowerIds ?? []).join(', '),
  ]
}

function list(cell: string): string[] {
  return cell.split(',').flatMap((item) => (item.trim() ? [item.trim()] : []))
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
  for (const row of sheets.readRows('Recipes')) {
    const [designId = '', size, version, , active, excluded = ''] = row
    const key = `${designId}/${size}`
    const leftOut = list(excluded)
    const recipe: Recipe = {
      designId,
      size: size as Size,
      version: Number(version),
      lines: [],
      ...(isRetired(active) ? { active: false } : {}),
      ...(leftOut.length > 0 ? { excludedFlowerIds: leftOut } : {}),
    }
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
    else if (sheets.readHeaders(tab).length < TABS[tab].length) {
      sheets.writeHeaders(tab, [...TABS[tab]])
    }
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
    seed.recipes.map((recipe) => recipeToRow(recipe, now)),
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
  const { reportId, nickname } = request
  const master = readMaster(deps.sheets)
  const report = master.prices.find((price) => price.id === reportId)
  if (!report) return refuse('not-found', 'That price report no longer exists.')
  if (report.status === 'voided') return { status: 'ok', version: master.version, duplicate: true }

  if (!isAdmin(request, deps) && report.reportedBy !== nickname) {
    return refuse('not-yours', 'Only the person who reported a price can void it.')
  }

  deps.sheets.appendRows('Prices', [priceToRow({ ...report, status: 'voided' })])
  deps.sheets.appendRows('Changelog', [[deps.now(), String(nickname), 'void-price', report.id]])
  return { status: 'ok', version: bumpVersion(deps.sheets) }
}

function logged(actor: string, action: string, detail: string, deps: Deps): Reply {
  deps.sheets.appendRows('Changelog', [[deps.now(), actor, action, detail]])
  return { status: 'ok', version: bumpVersion(deps.sheets) }
}

function isAdmin(request: Record<string, unknown>, deps: Deps): boolean {
  const configured = deps.adminKey()
  return Boolean(configured) && request.adminKey === configured
}

function nameProblem(value: unknown, missing: string): string | null {
  if (!isText(value)) return missing
  return value.length > MAX_NAME_LENGTH ? 'That name is too long.' : null
}

function isChoice<T>(value: unknown, choices: readonly T[]): boolean {
  return choices.includes(value as T)
}

function flowerProblem(raw: Record<string, unknown>): string | null {
  if (!isText(raw.id)) return 'A flower needs an id.'
  const name = nameProblem(raw.name, 'A flower needs a name.')
  if (name) return name
  if (!Array.isArray(raw.roles) || raw.roles.length === 0) {
    return 'A flower needs at least one role.'
  }
  if (!raw.roles.every((role) => isChoice(role, ROLES))) return 'Unknown role.'
  if (!isChoice(raw.soldAs, SOLD_AS)) return 'Unknown sold-as choice.'
  if (raw.colour !== undefined && typeof raw.colour !== 'string') return 'Invalid flower details.'
  if (typeof raw.trackLeftovers !== 'boolean' || typeof raw.active !== 'boolean') {
    return 'Invalid flower details.'
  }
  return null
}

function saveFlower(raw: Record<string, unknown>, actor: string, deps: Deps): Reply {
  const problem = flowerProblem(raw)
  if (problem) return refuse('invalid', problem)

  const flower = raw as unknown as Flower
  deps.sheets.appendRows('Flowers', [flowerToRow(flower, deps.now())])
  return logged(actor, 'save-flower', `${flower.id}: ${flower.name}`, deps)
}

function supplierProblem(raw: Record<string, unknown>): string | null {
  if (!isText(raw.id)) return 'A supplier needs an id.'
  const name = nameProblem(raw.name, 'A supplier needs a name.')
  if (name) return name
  if (!isChoice(raw.type, SUPPLIER_TYPES)) return 'Unknown supplier type.'
  return typeof raw.active === 'boolean' ? null : 'Invalid supplier details.'
}

function saveSupplier(raw: Record<string, unknown>, actor: string, deps: Deps): Reply {
  const problem = supplierProblem(raw)
  if (problem) return refuse('invalid', problem)

  const supplier = raw as unknown as Supplier
  deps.sheets.appendRows('Suppliers', [supplierToRow(supplier, deps.now())])
  return logged(actor, 'save-supplier', `${supplier.id}: ${supplier.name}`, deps)
}

function designProblem(raw: Record<string, unknown>): string | null {
  if (!isText(raw.id)) return 'A design needs an id.'
  const name = nameProblem(raw.name, 'A design needs a name.')
  if (name) return name
  if (!isText(raw.group)) return 'A design needs a group.'
  if (typeof raw.optional !== 'boolean') return 'Invalid design details.'
  return raw.active === undefined || typeof raw.active === 'boolean'
    ? null
    : 'Invalid design details.'
}

function lineProblem(line: Partial<RecipeLine>, master: MasterData): string | null {
  if (line.kind === 'role' && !isChoice(line.role, ROLES)) return 'Unknown role.'
  if (line.kind === 'named' && !master.flowers.some(({ id }) => id === line.flowerId)) {
    return 'Unknown flower.'
  }
  if (line.kind !== 'role' && line.kind !== 'named') return 'Invalid recipe line.'
  return Number.isInteger(line.stemsPerUnit) && (line.stemsPerUnit as number) > 0
    ? null
    : 'Every line needs at least one stem.'
}

function recipeProblem(raw: Partial<RecipeDraft>, master: MasterData): string | null {
  if (!isChoice(raw.size, SIZES)) return 'Unknown size.'
  if (!Array.isArray(raw.lines) || raw.lines.length === 0) {
    return 'A recipe needs at least one line.'
  }
  for (const line of raw.lines) {
    const problem = lineProblem(line, master)
    if (problem) return problem
  }
  const leftOut = raw.excludedFlowerIds ?? []
  if (!leftOut.every((flowerId) => master.flowers.some(({ id }) => id === flowerId))) {
    return 'Unknown flower.'
  }
  return null
}

function clashesOverFixed(draft: RecipeDraft, master: MasterData): boolean {
  if (draft.active === false) return false
  return master.recipes.some(
    (recipe) =>
      recipe.designId === draft.designId &&
      recipe.size !== draft.size &&
      recipe.active !== false &&
      (recipe.size === 'Fixed' || draft.size === 'Fixed'),
  )
}

function appendRecipe(draft: RecipeDraft, master: MasterData, deps: Deps): Recipe {
  const earlier = master.recipes.find(
    (recipe) => recipe.designId === draft.designId && recipe.size === draft.size,
  )
  const recipe = { ...draft, version: (earlier?.version ?? 0) + 1 }
  deps.sheets.appendRows('Recipes', [recipeToRow(recipe, deps.now())])
  deps.sheets.appendRows(
    'RecipeLines',
    recipe.lines.map((line, index) => lineToRow(recipe, line, index)),
  )
  return recipe
}

function saveDesign(request: Record<string, unknown>, actor: string, deps: Deps): Reply {
  const raw = (request.design ?? {}) as Record<string, unknown>
  const drafts = (request.recipes ?? []) as Partial<RecipeDraft>[]
  const master = readMaster(deps.sheets)

  const problem = designProblem(raw)
  if (problem) return refuse('invalid', problem)
  for (const draft of drafts) {
    const recipeIssue = draft.designId === raw.id ? recipeProblem(draft, master) : 'Unknown design.'
    if (recipeIssue) return refuse('invalid', recipeIssue)
  }

  // Being a leftover pool comes with the design, so an edit can't switch it on or off.
  const { isLeftoverPool: _pool, ...fields } = raw as unknown as Design
  const existing = master.designs.find(({ id }) => id === fields.id)
  const design = { ...fields, ...(existing?.isLeftoverPool ? { isLeftoverPool: true } : {}) }

  deps.sheets.appendRows('Designs', [designToRow(design, deps.now())])
  for (const draft of drafts) appendRecipe(draft as RecipeDraft, master, deps)
  return logged(actor, 'save-design', `${design.id}: ${design.name}`, deps)
}

function saveRecipe(request: Record<string, unknown>, actor: string, deps: Deps): Reply {
  const { version: _version, ...draft } = (request.recipe ?? {}) as Partial<Recipe>
  const master = readMaster(deps.sheets)

  const design = master.designs.find(({ id }) => id === draft.designId)
  if (!design) return refuse('invalid', 'Unknown design.')
  if (design.isLeftoverPool) return refuse('invalid', 'A leftover pool has no recipe.')
  const problem = recipeProblem(draft, master)
  if (problem) return refuse('invalid', problem)
  if (clashesOverFixed(draft as RecipeDraft, master)) {
    return refuse('invalid', 'Fixed can’t sit beside other sizes.')
  }

  const recipe = appendRecipe(draft as RecipeDraft, master, deps)
  const detail = `${recipe.designId} ${recipe.size}, version ${recipe.version}`
  return logged(actor, 'save-recipe', detail, deps)
}

/** Every Library edit passes through here, so none can skip the key or the Changelog. */
function routeAdmin(request: Record<string, unknown>, deps: Deps): Reply {
  if (!isAdmin(request, deps)) return refuse('not-admin', 'That admin key isn’t right.')
  if (request.action === 'checkAdmin') return { status: 'ok' }

  const { nickname } = request
  if (!isText(nickname) || nickname.length > MAX_NICKNAME_LENGTH) {
    return refuse('invalid', 'A nickname is needed.')
  }

  if (request.action === 'saveFlower') {
    return saveFlower((request.flower ?? {}) as Record<string, unknown>, nickname, deps)
  }
  if (request.action === 'saveSupplier') {
    return saveSupplier((request.supplier ?? {}) as Record<string, unknown>, nickname, deps)
  }
  return request.action === 'saveDesign'
    ? saveDesign(request, nickname, deps)
    : saveRecipe(request, nickname, deps)
}

const ADMIN_ACTIONS = ['checkAdmin', 'saveFlower', 'saveSupplier', 'saveDesign', 'saveRecipe']

function route(request: Record<string, unknown>, deps: Deps): Reply {
  if (request.key !== deps.appKey) return refuse('bad-key', 'This app is out of date.')
  if (request.action === 'reportPrice') return reportPrice(request, deps)
  if (request.action === 'voidPrice') return voidPrice(request, deps)
  if (ADMIN_ACTIONS.includes(String(request.action))) return routeAdmin(request, deps)
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
