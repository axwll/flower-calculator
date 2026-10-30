import { describe, expect, it } from 'vitest'

import { seed } from '../seed/seed'

describe('seed data', () => {
  const flowerIds = new Set(seed.flowers.map((flower) => flower.id))
  const designIds = new Set(seed.designs.map((design) => design.id))
  const supplierIds = new Set(seed.suppliers.map((supplier) => supplier.id))

  it('gives every recipe a real design', () => {
    expect(seed.recipes.every((recipe) => designIds.has(recipe.designId))).toBe(true)
  })

  it('names only real flowers in recipes', () => {
    const named = seed.recipes.flatMap((recipe) =>
      recipe.lines.flatMap((line) => (line.kind === 'named' ? [line.flowerId] : [])),
    )

    expect(named.filter((id) => !flowerIds.has(id))).toEqual([])
  })

  it('gives every design at least one size', () => {
    const withRecipe = new Set(seed.recipes.map((recipe) => recipe.designId))

    expect([...designIds].filter((id) => !withRecipe.has(id))).toEqual([])
  })

  it('has one recipe per design and size', () => {
    const keys = seed.recipes.map((recipe) => `${recipe.designId}/${recipe.size}`)

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives the leftover pool an empty recipe', () => {
    const pool = seed.designs.filter((design) => design.isLeftoverPool)

    expect(pool.map((design) => design.id)).toEqual(['table-vases'])
    expect(seed.recipes.find((recipe) => recipe.designId === 'table-vases')?.lines).toEqual([])
  })

  it('prices only real flowers and suppliers', () => {
    expect(
      seed.prices.filter(
        (price) => !flowerIds.has(price.flowerId) || !supplierIds.has(price.supplierId),
      ),
    ).toEqual([])
  })

  it('has placeholder Small, Medium and Large recipes for one design', () => {
    const sizes = seed.recipes
      .filter((recipe) => recipe.designId === 'pedestal')
      .map((recipe) => recipe.size)

    expect(sizes).toEqual(['Small', 'Medium', 'Large'])
  })

  it('keeps invented prices from looking stale', () => {
    const newest = Math.max(...seed.prices.map((price) => Date.parse(price.reportedAt)))

    expect(Date.now() - newest).toBeLessThan(86_400_000)
  })
})
