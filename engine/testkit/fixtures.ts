import bridalJson from '../../fixtures/bridal.json'
import catalogueJson from '../../fixtures/catalogue.json'
import edgeCasesJson from '../../fixtures/edge-cases.json'
import receptionJson from '../../fixtures/reception.json'
import type { AllocationInput } from '../allocate'
import type { Design, EventPlan, Flower, PriceReport } from '../types'

interface Catalogue {
  flowers: Flower[]
  designs: Design[]
  prices: PriceReport[]
}

export const FIXTURE_NOW = '2026-06-30T12:00:00.000Z'

// JSON imports widen unions such as `soldAs` to string, so the literal types need a cast.
const catalogue = catalogueJson as unknown as Catalogue
const edgeCases = edgeCasesJson as unknown as Catalogue & { plan: EventPlan }

export const bridalInput: AllocationInput = {
  ...catalogue,
  plan: bridalJson.plan as unknown as EventPlan,
  now: FIXTURE_NOW,
}

export const receptionInput: AllocationInput = {
  ...catalogue,
  plan: receptionJson.plan as unknown as EventPlan,
  now: FIXTURE_NOW,
}

export const edgeCasesInput: AllocationInput = {
  flowers: edgeCases.flowers,
  designs: edgeCases.designs,
  prices: edgeCases.prices,
  plan: edgeCases.plan,
  now: FIXTURE_NOW,
}
