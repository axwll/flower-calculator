import fc from 'fast-check'

import type { AllocationInput } from '../allocate'
import type { Flower, PlanDesign, PriceReport, RecipeLine, Role } from '../types'
import { NOW, SETTINGS, daysAgo } from './builders'

const FLOWER_IDS = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5']
const SUPPLIER_IDS = ['s0', 's1', 's2']
const ROLES: Role[] = ['focal', 'secondary', 'filler']
const POOL_ID = 'pool'

const flowers: fc.Arbitrary<Flower[]> = fc
  .array(fc.constantFrom('bunch' as const, 'stem' as const, 'foraged' as const), {
    minLength: FLOWER_IDS.length,
    maxLength: FLOWER_IDS.length,
  })
  .map((soldAsList) =>
    FLOWER_IDS.map((id, index) => ({
      id,
      name: id,
      roles: ROLES,
      soldAs: soldAsList[index] ?? 'bunch',
      trackLeftovers: true,
      active: true,
    })),
  )

const reports: fc.Arbitrary<PriceReport[]> = fc
  .array(
    fc.record({
      flowerId: fc.constantFrom(...FLOWER_IDS),
      supplierId: fc.constantFrom(...SUPPLIER_IDS),
      pricePence: fc.integer({ min: 0, max: 8000 }),
      stemsPerBunch: fc.constantFrom(1, 5, 10, 20, 48),
      age: fc.integer({ min: 0, max: 45 }),
    }),
    { maxLength: 14 },
  )
  .map((items) =>
    items.map(({ age, ...item }, index) => ({
      ...item,
      id: `r${index}`,
      reportedAt: daysAgo(age),
      reportedBy: 'property',
      status: 'active',
    })),
  )

const line: fc.Arbitrary<RecipeLine> = fc.oneof(
  fc.record({
    kind: fc.constant('role' as const),
    role: fc.constantFrom(...ROLES),
    stemsPerUnit: fc.integer({ min: 0, max: 12 }),
  }),
  fc.record({
    kind: fc.constant('named' as const),
    flowerId: fc.constantFrom(...FLOWER_IDS),
    stemsPerUnit: fc.integer({ min: 0, max: 12 }),
  }),
)

const planDesign: fc.Arbitrary<PlanDesign> = fc
  .record({
    designId: fc.constantFrom('d0', 'd1', 'd2'),
    quantity: fc.integer({ min: 0, max: 9 }),
    enabled: fc.boolean(),
    lines: fc.array(line, { maxLength: 4 }),
    excludedFlowerIds: fc.uniqueArray(fc.constantFrom(...FLOWER_IDS), { maxLength: 2 }),
  })
  .map(({ designId, lines, ...rest }) => ({
    ...rest,
    designId,
    size: 'Fixed',
    recipe: { designId, size: 'Fixed', lines, version: 1 },
  }))

const palette = fc.record({
  focal: fc.uniqueArray(fc.constantFrom(...FLOWER_IDS), { maxLength: 5 }),
  secondary: fc.uniqueArray(fc.constantFrom(...FLOWER_IDS), { maxLength: 5 }),
  filler: fc.uniqueArray(fc.constantFrom(...FLOWER_IDS), { maxLength: 5 }),
  foliage: fc.constant<string[]>([]),
  accent: fc.constant<string[]>([]),
})

export const allocationInput: fc.Arbitrary<AllocationInput> = fc
  .record({
    flowers,
    prices: reports,
    designs: fc.array(planDesign, { maxLength: 4 }),
    palette,
    pool: fc.integer({ min: 0, max: 12 }),
  })
  .map(({ flowers, prices, designs, palette, pool }) => ({
    flowers,
    prices,
    now: NOW,
    designs: [{ id: POOL_ID, name: 'Pool', group: 'Any', optional: true, isLeftoverPool: true }],
    plan: {
      schemaVersion: 1,
      id: 'property',
      name: 'Property test',
      palette,
      supplierChoice: {},
      settings: SETTINGS,
      designs: [
        ...designs,
        {
          designId: POOL_ID,
          size: 'Fixed',
          quantity: pool,
          enabled: true,
          recipe: { designId: POOL_ID, size: 'Fixed', lines: [], version: 1 },
          excludedFlowerIds: [],
        },
      ],
    },
  }))
