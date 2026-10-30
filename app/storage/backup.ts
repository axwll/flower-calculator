import type { EventPlan } from '@engine'

import { migrateEvent } from './migrations'

const APP_NAME = 'flower-calculator'
const BACKUP_VERSION = 1

export function buildBackup(events: EventPlan[], now: string): string {
  return JSON.stringify(
    { app: APP_NAME, backupVersion: BACKUP_VERSION, exportedAt: now, events },
    null,
    2,
  )
}

export function backupFileName(now: string): string {
  return `${APP_NAME}-backup-${now.slice(0, 10)}.json`
}

function readJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error("This file isn't a backup from this app.")
  }
}

/** All or nothing: one bad event refuses the whole file, so a restore can't half happen. */
export function parseBackup(text: string): EventPlan[] {
  const backup = readJson(text) as {
    app?: unknown
    backupVersion?: unknown
    events?: unknown
  } | null

  if (backup?.app !== APP_NAME || !Array.isArray(backup.events)) {
    throw new Error("This file isn't a backup from this app.")
  }
  if (typeof backup.backupVersion !== 'number' || backup.backupVersion > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app.')
  }

  return backup.events.map((raw: unknown, index: number) => {
    try {
      return migrateEvent(raw)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'It could not be read.'
      throw new Error(`Backup not restored. Problem with event ${index + 1}: ${reason}`)
    }
  })
}
