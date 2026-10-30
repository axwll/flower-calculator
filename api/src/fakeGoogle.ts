/** Test-only. A small stand-in for the parts of Google's services the backend touches. */
export function fakeGoogle() {
  const grids = new Map<string, string[][]>()
  const writtenFormats: string[] = []

  function sheet(name: string): GoogleSheet {
    const grid = () => grids.get(name) ?? []
    return {
      getName: () => name,
      getLastRow: () => grid().length,
      getMaxRows: () => Math.max(grid().length, 1000),
      insertRowsAfter: () => undefined,
      setFrozenRows: () => undefined,
      getRange: (row, column, rows = 1, columns = 1) => ({
        setValues: (values) => {
          values.forEach((cells, offset) => {
            const line = (grid()[row - 1 + offset] ??= [])
            cells.forEach((cell, index) => (line[column - 1 + index] = cell))
          })
        },
        setNumberFormat: (format) => void writtenFormats.push(format),
        setFontWeight: () => undefined,
        getDisplayValues: () =>
          grid()
            .slice(row - 1, row - 1 + rows)
            .map((line) => line.slice(column - 1, column - 1 + columns)),
        getSheet: () => sheet(name),
      }),
    }
  }

  return {
    grids,
    writtenFormats,
    SpreadsheetApp: {
      getActive: () => ({
        getSheetByName: (name: string) => (grids.has(name) ? sheet(name) : null),
        insertSheet: (name: string) => {
          grids.set(name, [])
          return sheet(name)
        },
      }),
    },
  }
}
