// The small part of Google's services the backend uses. Declared here, because the official
// types would be a new dependency.

interface GoogleRange {
  setValues(values: string[][]): void
  setNumberFormat(format: string): void
  setFontWeight(weight: string): void
  getDisplayValues(): string[][]
  getSheet(): GoogleSheet
}

interface GoogleSheet {
  getName(): string
  getLastRow(): number
  getMaxRows(): number
  insertRowsAfter(row: number, count: number): void
  setFrozenRows(rows: number): void
  getRange(row: number, column: number, rows?: number, columns?: number): GoogleRange
}

declare const SpreadsheetApp: {
  getActive(): {
    getSheetByName(name: string): GoogleSheet | null
    insertSheet(name: string): GoogleSheet
  }
}

declare const CacheService: {
  getScriptCache(): {
    get(key: string): string | null
    put(key: string, value: string, seconds: number): void
  }
}

declare const LockService: {
  getScriptLock(): { waitLock(milliseconds: number): void; releaseLock(): void }
}

declare const PropertiesService: {
  getScriptProperties(): { getProperty(key: string): string | null }
}

declare const ContentService: {
  MimeType: { JSON: unknown }
  createTextOutput(text: string): { setMimeType(type: unknown): GoogleTextOutput }
}

type GoogleTextOutput = object
