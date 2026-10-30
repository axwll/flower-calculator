import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { allocate } from './allocate'
import type { AllocationInput } from './allocate'
import { expandPlan } from './expand'
import { allocationInput } from './testkit/arbitraries'

// Invariant 6, floating placement against brute force, is in floating.test.ts.

const RUNS = { numRuns: 500 }

function property(check: (input: AllocationInput) => void) {
  fc.assert(fc.property(allocationInput, check), RUNS)
}

describe('engine invariants', () => {
  it('1. never loses or invents stems', () => {
    property((input) => {
      const recipeStems = input.plan.designs
        .filter((design) => design.enabled)
        .flatMap((design) => design.recipe.lines.map((line) => line.stemsPerUnit * design.quantity))
        .reduce((sum, stems) => sum + stems, 0)
      const result = allocate(input)
      const warned = result.warnings
        .map((warning) => (warning.code === 'no-flowers-for-role' ? warning.stems : 0))
        .reduce((sum, stems) => sum + stems, 0)

      expect(result.totals.stems + result.totals.unassignedStems).toBe(recipeStems)
      expect(warned).toBe(result.totals.unassignedStems)
    })
  })

  it('2. keeps every role line to a strict split', () => {
    property((input) => {
      const result = allocate(input)
      const { lines } = expandPlan(input.plan)

      for (const line of lines) {
        const k = line.eligibleFlowerIds.length
        if (k === 0) continue
        const dealt = result.designs.find((design) => design.designIndex === line.designIndex)
          ?.lines[line.lineIndex]?.flowers
        if (!dealt) continue

        for (const id of line.eligibleFlowerIds) {
          const stems = dealt.find((item) => item.flowerId === id)?.stems ?? 0
          expect(stems).toBeGreaterThanOrEqual(Math.floor(line.total / k))
          expect(stems).toBeLessThanOrEqual(Math.ceil(line.total / k))
        }
      }
    })
  })

  it('3. buys enough and never has negative spare stems', () => {
    property((input) => {
      const { flowers } = allocate(input)

      for (const flower of flowers) {
        expect(flower.spare).toBeGreaterThanOrEqual(0)
      }
      for (const flower of flowers.filter((item) => item.soldAs === 'bunch' && item.offer)) {
        const bunchSize = flower.offer?.bunchSize ?? 0
        expect(flower.bunches * bunchSize).toBeGreaterThanOrEqual(flower.stems)
      }
    })
  })

  it('4. gives the same output for the same inputs', () => {
    property((input) => {
      const reordered = {
        ...input,
        prices: [...input.prices].reverse(),
        flowers: [...input.flowers].reverse(),
        plan: {
          ...input.plan,
          palette: {
            ...input.plan.palette,
            focal: [...input.plan.palette.focal].reverse(),
            filler: [...input.plan.palette.filler].reverse(),
          },
        },
      }

      expect(allocate(input)).toEqual(allocate(input))
      expect(allocate(reordered)).toEqual(allocate(input))
    })
  })

  it('5. deals placements that sum to the recipe and to the flower totals', () => {
    property((input) => {
      const result = allocate(input)
      const dealtByFlower = new Map<string, number>()

      for (const design of result.designs) {
        for (const line of design.lines) {
          for (let placement = 0; placement < design.quantity; placement++) {
            const stems = line.flowers.reduce(
              (sum, item) => sum + (item.perPlacement[placement] ?? 0),
              0,
            )
            expect(stems).toBe(line.unassignedStems > 0 ? 0 : line.stemsPerUnit)
          }
          for (const item of line.flowers) {
            expect(item.perPlacement.reduce((sum, stems) => sum + stems, 0)).toBe(item.stems)
            expect(
              Math.max(...item.perPlacement) - Math.min(...item.perPlacement),
            ).toBeLessThanOrEqual(1)
            dealtByFlower.set(item.flowerId, (dealtByFlower.get(item.flowerId) ?? 0) + item.stems)
          }
        }
      }

      for (const flower of result.flowers) {
        expect(dealtByFlower.get(flower.flowerId) ?? 0).toBe(flower.stems)
      }
    })
  })

  it('7. keeps money in whole pence, adding up exactly', () => {
    property((input) => {
      const result = allocate(input)
      const amounts = [
        result.totals.costPence,
        result.totals.spareCostPence,
        ...result.flowers.map((flower) => flower.costPence),
        ...result.designs.map((design) => design.costPence),
        ...result.orderList.map((order) => order.subtotalPence),
      ]

      expect(amounts.every(Number.isSafeInteger)).toBe(true)
      expect(result.orderList.reduce((sum, order) => sum + order.subtotalPence, 0)).toBe(
        result.totals.costPence,
      )
      expect(result.designs.reduce((sum, design) => sum + design.costPence, 0)).toBe(
        result.totals.costPence,
      )
    })
  })
})
