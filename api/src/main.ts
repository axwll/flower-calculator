import { bumpVersion, handlePost, respondRead, runSetup } from './core'
import type { Deps } from './core'
import { APP_KEY, seed } from './seedData'
import { googleSheets } from './sheet'

const CACHE_SECONDS = 6 * 60 * 60
const LOCK_WAIT_MS = 10_000

function withLock<T>(work: () => T): T {
  const lock = LockService.getScriptLock()
  lock.waitLock(LOCK_WAIT_MS)
  try {
    return work()
  } finally {
    lock.releaseLock()
  }
}

function deps(): Deps {
  const cache = CacheService.getScriptCache()
  return {
    sheets: googleSheets(),
    cache: {
      get: (key) => cache.get(key),
      put: (key, value) => cache.put(key, value, CACHE_SECONDS),
    },
    appKey: APP_KEY,
    adminKey: () => PropertiesService.getScriptProperties().getProperty('ADMIN_KEY'),
    now: () => new Date().toISOString(),
    withLock,
  }
}

function json(text: string): GoogleTextOutput {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON)
}

export function doGet(event: { parameter: { since?: string } }): GoogleTextOutput {
  const { since } = event.parameter
  return json(respondRead(since ? Number(since) : undefined, deps()))
}

export function doPost(event: { postData: { contents: string } }): GoogleTextOutput {
  return json(handlePost(event.postData.contents, deps()))
}

/** Runs when someone edits the Sheet by hand, so the fix reaches the app. */
export function onEdit(event: { range: GoogleRange }): void {
  if (event.range.getSheet().getName() !== 'Meta') bumpVersion(googleSheets())
}

export function setup(): void {
  runSetup(googleSheets(), seed, new Date().toISOString())
}
