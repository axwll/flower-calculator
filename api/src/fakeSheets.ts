import type { Cache, Deps, Sheets, TabName } from './core'

/** Test-only. Holds tabs as rows of strings, the way the real Sheet hands them back. */
export function fakeSheets(): Sheets & {
  tabs: Map<TabName, string[][]>
  meta: Map<string, string>
} {
  const tabs = new Map<TabName, string[][]>()
  const meta = new Map<string, string>()
  return {
    tabs,
    meta,
    hasTab: (tab) => tabs.has(tab),
    createTab: (tab) => void tabs.set(tab, []),
    readRows: (tab) => tabs.get(tab) ?? [],
    appendRows: (tab, rows) => void tabs.set(tab, [...(tabs.get(tab) ?? []), ...rows]),
    readMeta: (key) => meta.get(key) ?? null,
    writeMeta: (key, value) => void meta.set(key, value),
  }
}

export function fakeCache(): Cache & { entries: Map<string, string> } {
  const entries = new Map<string, string>()
  return {
    entries,
    get: (key) => entries.get(key) ?? null,
    put: (key, value) => void entries.set(key, value),
  }
}

export function fakeDeps(sheets = fakeSheets(), overrides: Partial<Deps> = {}): Deps {
  return {
    sheets,
    cache: fakeCache(),
    appKey: 'app-key',
    adminKey: () => 'admin-key',
    now: () => '2026-06-30T12:00:00.000Z',
    withLock: (work) => work(),
    ...overrides,
  }
}
