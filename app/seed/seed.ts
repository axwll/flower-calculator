import type { Design, Flower, PriceReport, Recipe, RecipeLine, Role, Supplier } from '@engine'

// Starting data until the backend arrives in Phase 5. This ships in the public app, so it holds
// no client details. Prices and suppliers are invented. Flower roles, the reception recipes and
// the Small and Large pedestals are placeholders until confirmed. See docs/phases/phase-1.md.

// Stamped at load, so invented prices never look stale.
const reportedAt = new Date().toISOString()

function flower(id: string, name: string, roles: Role[]): Flower {
  return { id, name, roles, soldAs: 'bunch', trackLeftovers: true, active: true }
}

function price(
  flowerId: string,
  supplierId: string,
  pricePence: number,
  stemsPerBunch: number,
): PriceReport {
  return {
    id: `seed-${flowerId}-${supplierId}`,
    flowerId,
    supplierId,
    pricePence,
    stemsPerBunch,
    reportedAt,
    reportedBy: 'seed',
    status: 'active',
  }
}

function named(flowerId: string, stemsPerUnit: number): RecipeLine {
  return { kind: 'named', flowerId, stemsPerUnit }
}

function role(roleName: Role, stemsPerUnit: number): RecipeLine {
  return { kind: 'role', role: roleName, stemsPerUnit }
}

function recipe(designId: string, lines: RecipeLine[], size: Recipe['size'] = 'Fixed'): Recipe {
  return { designId, size, lines, version: 1 }
}

const suppliers: Supplier[] = [
  { id: 'supermarket-c', name: 'Supermarket C', type: 'supermarket', active: true },
  { id: 'wholesaler-a', name: 'Wholesaler A', type: 'wholesaler', active: true },
  { id: 'wholesaler-b', name: 'Wholesaler B', type: 'wholesaler', active: true },
]

const designs: Design[] = [
  { id: 'bridal-bouquet', name: 'Bridal bouquet', group: 'Bridal', optional: false },
  { id: 'bridesmaid-bouquet', name: "Bridesmaid's bouquets", group: 'Bridal', optional: false },
  { id: 'groom', name: 'Groom', group: 'Bridal', optional: false },
  { id: 'buttonhole', name: 'Buttonholes', group: 'Bridal', optional: false },
  { id: 'corsage', name: "Ladies' corsages", group: 'Bridal', optional: false },
  { id: 'top-table', name: 'Top table', group: 'Reception', optional: false },
  { id: 'pedestal', name: 'Pedestals', group: 'Reception', optional: false },
  { id: 'half-moon-hoop', name: 'Half-moon hoop', group: 'Reception', optional: false },
  { id: 'pumpkin', name: 'Pumpkins', group: 'Reception', optional: true },
  { id: 'pumpkin-posey', name: 'Pumpkin white posey', group: 'Reception', optional: true },
  {
    id: 'table-vases',
    name: 'Table vases',
    group: 'Reception',
    optional: true,
    isLeftoverPool: true,
  },
]

const flowers: Flower[] = [
  flower('alstroemeria', 'Alstroemeria', ['filler']),
  flower('burgundy-carnation', 'Burgundy carnation', ['filler']),
  flower('chrysanthemum-blooms', 'Chrysanthemum blooms (orange)', ['focal']),
  flower('dahlia-dark', 'Dahlia (dark)', ['focal']),
  flower('dahlia-orange', 'Dahlia (orange)', ['focal']),
  flower('dahlia-peachy', 'Dahlia (peachy)', ['focal']),
  flower('focus-rose', 'Focus rose (white)', ['focal']),
  flower('hydrangea', 'Hydrangea heads', ['focal']),
  flower('lisianthus', 'Lisianthus', ['secondary']),
  flower('ms-rose', 'Secondary rose (M&S orange)', ['secondary']),
  flower('orange-rose', 'Secondary rose (orange)', ['secondary']),
  flower('santini', 'Chrysanthemum santini (orange)', ['filler']),
  flower('scabious', 'Scabious / paw paw', ['filler']),
  flower('spray-carnation', 'Spray carnation (white)', ['filler']),
  flower('sunflower', 'Sunflower', ['focal']),
  flower('wax-flower', 'Wax flower', ['filler']),
]

// Dahlias, scabious and sunflower have no bunch size yet, so they have no price and show as
// needs data.
const prices: PriceReport[] = [
  price('alstroemeria', 'wholesaler-a', 1200, 20),
  price('alstroemeria', 'wholesaler-b', 1300, 20),
  price('burgundy-carnation', 'wholesaler-a', 700, 10),
  price('chrysanthemum-blooms', 'wholesaler-a', 1800, 20),
  price('focus-rose', 'wholesaler-a', 4000, 48),
  price('focus-rose', 'wholesaler-b', 4400, 48),
  price('hydrangea', 'wholesaler-b', 7000, 35),
  price('lisianthus', 'wholesaler-b', 2200, 20),
  price('ms-rose', 'supermarket-c', 800, 10),
  price('orange-rose', 'wholesaler-a', 3600, 60),
  price('santini', 'wholesaler-a', 2400, 30),
  price('spray-carnation', 'wholesaler-a', 600, 10),
  price('wax-flower', 'wholesaler-a', 3000, 48),
]

const recipes: Recipe[] = [
  recipe('bridal-bouquet', [
    named('focus-rose', 5),
    named('ms-rose', 3),
    named('spray-carnation', 1),
    named('dahlia-dark', 4),
    named('dahlia-orange', 3),
    named('dahlia-peachy', 3),
    named('wax-flower', 1),
    named('scabious', 5),
  ]),
  recipe('bridesmaid-bouquet', [
    named('focus-rose', 4),
    named('ms-rose', 2),
    named('spray-carnation', 1),
    named('dahlia-dark', 2),
    named('dahlia-orange', 2),
    named('dahlia-peachy', 2),
    named('wax-flower', 1),
    named('scabious', 5),
  ]),
  recipe('groom', [
    named('dahlia-orange', 1),
    named('santini', 2),
    named('wax-flower', 1),
    named('scabious', 1),
  ]),
  recipe('buttonhole', [
    named('focus-rose', 1),
    named('santini', 2),
    named('wax-flower', 1),
    named('scabious', 1),
  ]),
  recipe('corsage', [named('focus-rose', 1), named('dahlia-orange', 1), named('scabious', 1)]),
  recipe('top-table', [
    named('hydrangea', 5),
    role('focal', 7),
    role('secondary', 13),
    role('filler', 10),
  ]),
  recipe(
    'pedestal',
    [named('hydrangea', 3), role('focal', 3), role('secondary', 6), role('filler', 8)],
    'Small',
  ),
  recipe(
    'pedestal',
    [named('hydrangea', 5), role('focal', 5), role('secondary', 10), role('filler', 13)],
    'Medium',
  ),
  recipe(
    'pedestal',
    [
      named('hydrangea', 7),
      role('focal', 8),
      role('secondary', 14),
      role('filler', 18),
      role('accent', 3),
    ],
    'Large',
  ),
  recipe('half-moon-hoop', [
    named('sunflower', 10),
    named('hydrangea', 10),
    role('filler', 20),
    named('chrysanthemum-blooms', 3),
  ]),
  recipe('pumpkin', [role('filler', 20)]),
  recipe('pumpkin-posey', [role('filler', 20)]),
  recipe('table-vases', []),
]

export const seed = { suppliers, designs, flowers, prices, recipes }
