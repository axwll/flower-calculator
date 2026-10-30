import { TABS } from './core'
import type { Sheets, TabName } from './core'

const HEADER_ROWS = 1
const TEXT_FORMAT = '@'

function tabSheet(tab: TabName): GoogleSheet {
  const sheet = SpreadsheetApp.getActive().getSheetByName(tab)
  if (!sheet) throw new Error(`The ${tab} tab is missing. Run setup first.`)
  return sheet
}

function dataRows(sheet: GoogleSheet, columns: number): string[][] {
  const rows = sheet.getLastRow() - HEADER_ROWS
  if (rows <= 0) return []
  return sheet.getRange(HEADER_ROWS + 1, 1, rows, columns).getDisplayValues()
}

/** Keeps Sheets from turning report times into dates, and hand-fixed rows stay readable. */
function createTab(tab: TabName): void {
  const headers: string[] = [...TABS[tab]]
  const sheet = SpreadsheetApp.getActive().insertSheet(tab)
  sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setNumberFormat(TEXT_FORMAT)
  const header = sheet.getRange(1, 1, 1, headers.length)
  header.setValues([headers])
  header.setFontWeight('bold')
  sheet.setFrozenRows(HEADER_ROWS)
}

function appendRows(tab: TabName, rows: string[][]): void {
  const [first] = rows
  if (!first) return

  const sheet = tabSheet(tab)
  const start = sheet.getLastRow() + 1
  const missing = start + rows.length - 1 - sheet.getMaxRows()
  if (missing > 0) sheet.insertRowsAfter(sheet.getMaxRows(), missing)

  const range = sheet.getRange(start, 1, rows.length, first.length)
  range.setNumberFormat(TEXT_FORMAT)
  range.setValues(rows)
}

function writeMeta(key: string, value: string): void {
  const sheet = tabSheet('Meta')
  const index = dataRows(sheet, TABS.Meta.length).findIndex(([name]) => name === key)
  if (index === -1) appendRows('Meta', [[key, value]])
  else sheet.getRange(HEADER_ROWS + 1 + index, 2).setValues([[value]])
}

export function googleSheets(): Sheets {
  return {
    hasTab: (tab) => SpreadsheetApp.getActive().getSheetByName(tab) !== null,
    createTab,
    readRows: (tab) => dataRows(tabSheet(tab), TABS[tab].length),
    appendRows,
    readMeta: (key) =>
      dataRows(tabSheet('Meta'), TABS.Meta.length).find(([name]) => name === key)?.[1] ?? null,
    writeMeta,
  }
}
