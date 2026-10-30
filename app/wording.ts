import type { ExpandedLine, NeedsDataReason, Role, Warning } from '@engine'

const ROLE_LABELS: Record<Role, string> = {
  focal: 'Focal',
  secondary: 'Secondary',
  filler: 'Filler',
  foliage: 'Foliage',
  accent: 'Accent',
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role]
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function splitText({
  total,
  equalShare,
  floating,
  eligibleFlowerIds,
}: Pick<ExpandedLine, 'total' | 'equalShare' | 'floating' | 'eligibleFlowerIds'>): string {
  const k = eligibleFlowerIds.length
  if (k === 0) return `${plural(total, 'stem')} with no flowers ticked`

  const shares = eligibleFlowerIds.map(() => equalShare).join(', ')
  const float = floating > 0 ? ` + ${floating} floating` : ''
  return `${plural(total, 'stem')} across ${plural(k, 'flower')}: ${shares}${float}`
}

export interface Names {
  flowerName: (id: string) => string
  supplierName: (id: string) => string
  designName: (id: string) => string
}

const NEEDS_DATA_TEXT: Record<NeedsDataReason, string> = {
  'no-price': 'has no price yet',
  'no-bunch-size': 'has no bunch size yet',
  'override-unavailable': 'has no price from the chosen supplier',
  'unknown-flower': 'is not in the flower list',
}

export function warningText(warning: Warning, names: Names): string {
  switch (warning.code) {
    case 'no-flowers-for-role':
      return `No flowers ticked for ${warning.role} in ${names.designName(warning.designId)}: ${plural(warning.stems, 'stem')} unassigned.`
    case 'needs-data':
      return `${names.flowerName(warning.flowerId)} ${NEEDS_DATA_TEXT[warning.reason]}: ${plural(warning.stems, 'stem')} counted but not costed.`
    case 'stale-price':
      return `${names.flowerName(warning.flowerId)}: the price from ${names.supplierName(warning.supplierId)} is ${Math.floor(warning.ageDays)} days old.`
    case 'thin-bunch':
      return `${names.flowerName(warning.flowerId)}: only ${warning.lastBunchStems} of the ${warning.bunchSize} stems in the last bunch ${warning.lastBunchStems === 1 ? 'is' : 'are'} used.`
    case 'supplier-changed':
      return `${names.flowerName(warning.flowerId)}: moved to ${names.supplierName(warning.toSupplierId)}, which is cheaper once every stem is counted.`
  }
}
