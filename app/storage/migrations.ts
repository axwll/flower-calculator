import type { EventPlan, Role } from '@engine'

type RawEvent = Record<string, unknown>

/** Takes an event at the key's version and returns it at the next version. */
export type MigrationSteps = Record<number, (raw: RawEvent) => RawEvent>

export const CURRENT_SCHEMA_VERSION = 1

const MIGRATIONS: MigrationSteps = {}

const ROLES: Role[] = ['focal', 'secondary', 'filler', 'foliage', 'accent']

function isRecord(value: unknown): value is RawEvent {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDesign(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.designId === 'string' &&
    typeof value.quantity === 'number' &&
    isRecord(value.recipe) &&
    Array.isArray(value.recipe.lines)
  )
}

function isEvent(raw: RawEvent): boolean {
  const { id, name, designs, palette, supplierChoice, settings } = raw
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    Array.isArray(designs) &&
    designs.every(isDesign) &&
    isRecord(palette) &&
    ROLES.every((role) => Array.isArray(palette[role])) &&
    isRecord(supplierChoice) &&
    isRecord(settings)
  )
}

/** Every event passes through here when it is loaded or imported. Throws if it can't be used. */
export function migrateEvent(
  raw: unknown,
  steps: MigrationSteps = MIGRATIONS,
  currentVersion: number = CURRENT_SCHEMA_VERSION,
): EventPlan {
  if (!isRecord(raw) || !Number.isInteger(raw.schemaVersion) || !isEvent(raw)) {
    throw new Error('This is not a valid event.')
  }

  let event = raw
  while ((event.schemaVersion as number) < currentVersion) {
    const version = event.schemaVersion as number
    const step = steps[version]
    if (!step) throw new Error(`No way to update an event from version ${version}.`)
    event = step(event)
  }

  if ((event.schemaVersion as number) > currentVersion) {
    throw new Error('This event was made by a newer version of the app.')
  }
  return event as unknown as EventPlan
}
