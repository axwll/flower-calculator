import type {
  EventPlan,
  Flower,
  PlanDesign,
  PlanSettings,
  PriceReport,
  RecipeLine,
  Role,
  SoldAs,
} from '../types'

export const SETTINGS: PlanSettings = {
  thinBunchPercent: 15,
  priceAmberDays: 14,
  priceRedDays: 30,
  bigChangePercent: 50,
}

export const NOW = '2026-06-30T12:00:00.000Z'

export function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * 86_400_000).toISOString()
}

export function role(role: Role, stemsPerUnit: number): RecipeLine {
  return { kind: 'role', role, stemsPerUnit }
}

export function named(flowerId: string, stemsPerUnit: number): RecipeLine {
  return { kind: 'named', flowerId, stemsPerUnit }
}

export function design(
  designId: string,
  quantity: number,
  lines: RecipeLine[],
  overrides: Partial<PlanDesign> = {},
): PlanDesign {
  return {
    designId,
    size: 'Fixed',
    quantity,
    enabled: true,
    recipe: { designId, size: 'Fixed', lines, version: 1 },
    excludedFlowerIds: [],
    ...overrides,
  }
}

export function plan(
  designs: PlanDesign[],
  palette: Partial<Record<Role, string[]>> = {},
  overrides: Partial<EventPlan> = {},
): EventPlan {
  return {
    schemaVersion: 1,
    id: 'plan',
    name: 'Test event',
    designs,
    palette: { focal: [], secondary: [], filler: [], foliage: [], accent: [], ...palette },
    supplierChoice: {},
    settings: SETTINGS,
    ...overrides,
  }
}

export function flower(
  id: string,
  soldAs: SoldAs = 'bunch',
  overrides: Partial<Flower> = {},
): Flower {
  return {
    id,
    name: id,
    roles: ['focal'],
    soldAs,
    trackLeftovers: true,
    active: true,
    ...overrides,
  }
}

let nextReportId = 0

export function report(
  flowerId: string,
  supplierId: string,
  pricePence: number,
  stemsPerBunch: number,
  overrides: Partial<PriceReport> = {},
): PriceReport {
  nextReportId += 1
  return {
    id: `report-${String(nextReportId).padStart(4, '0')}`,
    flowerId,
    supplierId,
    pricePence,
    stemsPerBunch,
    reportedAt: daysAgo(1),
    reportedBy: 'tester',
    status: 'active',
    ...overrides,
  }
}
