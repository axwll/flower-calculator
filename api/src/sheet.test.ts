import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeGoogle } from './fakeGoogle'
import { TABS } from './core'
import { googleSheets } from './sheet'

describe('googleSheets', () => {
  let google: ReturnType<typeof fakeGoogle>

  beforeEach(() => {
    google = fakeGoogle()
    vi.stubGlobal('SpreadsheetApp', google.SpreadsheetApp)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a tab with its header row', () => {
    const sheets = googleSheets()
    sheets.createTab('Suppliers')

    expect(sheets.hasTab('Suppliers')).toBe(true)
    expect(google.grids.get('Suppliers')).toEqual([[...TABS.Suppliers]])
  })

  it('keeps cells as text, so Sheets does not rewrite dates and numbers', () => {
    googleSheets().createTab('Prices')

    expect(google.writtenFormats).toContain('@')
  })

  it('knows when a tab is missing', () => {
    expect(googleSheets().hasTab('Flowers')).toBe(false)
  })

  it('reads rows without the header', () => {
    const sheets = googleSheets()
    sheets.createTab('Suppliers')
    sheets.appendRows('Suppliers', [['a', 'A', 'other', 'TRUE', 'now']])

    expect(sheets.readRows('Suppliers')).toEqual([['a', 'A', 'other', 'TRUE', 'now']])
  })

  it('reads an empty tab as no rows', () => {
    const sheets = googleSheets()
    sheets.createTab('Suppliers')

    expect(sheets.readRows('Suppliers')).toEqual([])
  })

  it('adds rows after the ones already there', () => {
    const sheets = googleSheets()
    sheets.createTab('Changelog')
    sheets.appendRows('Changelog', [['1', 'a', 'x', 'y']])
    sheets.appendRows('Changelog', [
      ['2', 'b', 'x', 'y'],
      ['3', 'c', 'x', 'y'],
    ])

    expect(sheets.readRows('Changelog').map((row) => row[0])).toEqual(['1', '2', '3'])
  })

  it('does nothing when given no rows', () => {
    const sheets = googleSheets()
    sheets.createTab('Changelog')
    sheets.appendRows('Changelog', [])

    expect(google.grids.get('Changelog')).toHaveLength(1)
  })

  it('reads a missing meta key as null', () => {
    const sheets = googleSheets()
    sheets.createTab('Meta')

    expect(sheets.readMeta('dataVersion')).toBeNull()
  })

  it('writes and then updates a meta key in place', () => {
    const sheets = googleSheets()
    sheets.createTab('Meta')
    sheets.writeMeta('dataVersion', '1')
    sheets.writeMeta('other', 'x')
    sheets.writeMeta('dataVersion', '2')

    expect(sheets.readMeta('dataVersion')).toBe('2')
    expect(sheets.readMeta('other')).toBe('x')
    expect(google.grids.get('Meta')).toHaveLength(3)
  })
})
