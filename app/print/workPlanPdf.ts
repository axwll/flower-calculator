import type { MatrixContent, PoolContent, WorkCardContent, WorkCardGrid } from './content'
import { A4, buildPdf, drawBox, drawLine, drawText, PAGE_MARGIN, textWidth, wrapText } from './pdf'
import type { PdfFont, PdfPage } from './pdf'

export interface WorkPlanDocument {
  cards: WorkCardContent[]
  pools: PoolContent[]
  matrix?: MatrixContent
  onePerPage: boolean
}

/** Something a card stacks from the top down, measured first so cards can stay whole. */
interface Row {
  height: number
  draw(page: PdfPage, left: number, top: number, width: number): void
}

const TITLE_SIZE = 22
const NAME_SIZE = 15
const BODY_SIZE = 13
const SMALL_SIZE = 11
const GRID_SIZE = 10
const MATRIX_SIZE = 8
const LEADING = 1.3
const CARD_PADDING = 10
const CARD_GAP = 10
const CELL_PADDING = 3
const GRID_NAME_WIDTH = 120
const MATRIX_NAME_SHARE = 0.2

function lineHeight(size: number): number {
  return size * LEADING
}

function baseline(page: PdfPage, top: number, size: number): number {
  return page.height - top - size
}

function drawLines(
  page: PdfPage,
  lines: string[],
  { x, top, size, font }: { x: number; top: number; size: number; font?: PdfFont },
) {
  lines.forEach((line, index) => {
    const y = baseline(page, top + index * lineHeight(size), size)
    drawText(page, line, { x, y, size, font })
  })
}

function textRow(text: string, size: number, width: number, font: PdfFont = 'regular'): Row {
  const lines = wrapText(text, size, font, width)
  return {
    height: lines.length * lineHeight(size) + 4,
    draw: (page, left, top) => drawLines(page, lines, { x: left, top, size, font }),
  }
}

function headingRow(name: string, heading: string, width: number): Row {
  const room = width - textWidth(heading, BODY_SIZE) - CARD_PADDING
  const lines = wrapText(name, NAME_SIZE, 'bold', room)
  return {
    height: lines.length * lineHeight(NAME_SIZE) + 4,
    draw(page, left, top, rowWidth) {
      drawLines(page, lines, { x: left, top, size: NAME_SIZE, font: 'bold' })
      const x = left + rowWidth - textWidth(heading, BODY_SIZE)
      drawText(page, heading, { x, y: baseline(page, top, NAME_SIZE), size: BODY_SIZE })
    },
  }
}

function flowerRow(name: string, stems: string, width: number): Row {
  const stemWidth = width / 2
  const names = wrapText(name, BODY_SIZE, 'regular', width - stemWidth - CARD_PADDING)
  const amounts = wrapText(stems, BODY_SIZE, 'bold', stemWidth)
  const rows = Math.max(names.length, amounts.length)
  return {
    height: rows * lineHeight(BODY_SIZE) + 8,
    draw(page, left, top, rowWidth) {
      const lineY = page.height - top
      drawLine(page, left, lineY, left + rowWidth, lineY)
      drawLines(page, names, { x: left, top: top + 4, size: BODY_SIZE })
      amounts.forEach((line, index) => {
        drawText(page, line, {
          x: left + rowWidth - textWidth(line, BODY_SIZE, 'bold'),
          y: baseline(page, top + 4 + index * lineHeight(BODY_SIZE), BODY_SIZE),
          size: BODY_SIZE,
          font: 'bold',
        })
      })
    },
  }
}

/** Cells are centred, except the first column, which reads as a label. */
function tableRow(
  cells: string[],
  columns: number[],
  size: number,
  font: PdfFont = 'regular',
): Row {
  const wrapped = cells.map((cell, index) =>
    wrapText(cell, size, font, (columns[index] ?? 0) - CELL_PADDING * 2),
  )
  const tallest = Math.max(1, ...wrapped.map((lines) => lines.length))
  const height = tallest * lineHeight(size) + CELL_PADDING * 2
  return {
    height,
    draw(page, left, top) {
      let x = left
      wrapped.forEach((lines, index) => {
        const column = columns[index] ?? 0
        drawBox(page, x, page.height - top - height, column, height)
        lines.forEach((line, lineIndex) => {
          const inset = index === 0 ? CELL_PADDING : (column - textWidth(line, size, font)) / 2
          drawText(page, line, {
            x: x + inset,
            y: baseline(page, top + CELL_PADDING + lineIndex * lineHeight(size), size),
            size,
            font,
          })
        })
        x += column
      })
    },
  }
}

function gridRows(grid: WorkCardGrid, width: number): Row[] {
  const column = (width - GRID_NAME_WIDTH) / grid.placements.length
  const columns = [GRID_NAME_WIDTH, ...grid.placements.map(() => column)]
  const spacer: Row = { height: 6, draw: () => undefined }
  return [
    spacer,
    tableRow(['Flower', ...grid.placements.map(String)], columns, GRID_SIZE, 'bold'),
    ...grid.rows.map(({ name, cells }) =>
      tableRow([name, ...cells.map(String)], columns, GRID_SIZE),
    ),
  ]
}

function cardRows(card: WorkCardContent, width: number): Row[] {
  return [
    headingRow(card.name, card.heading, width),
    ...(card.numbering ? [textRow(card.numbering, SMALL_SIZE, width)] : []),
    ...(card.warning ? [textRow(card.warning, BODY_SIZE, width, 'bold')] : []),
    ...card.flowers.map(({ name, stems }) => flowerRow(name, stems, width)),
    ...(card.grid ? gridRows(card.grid, width) : []),
  ]
}

function poolRows(pool: PoolContent, width: number): Row[] {
  return [
    headingRow(pool.name, pool.heading, width),
    textRow(pool.note, SMALL_SIZE, width),
    ...pool.lines.map((line) => textRow(`• ${line}`, BODY_SIZE, width)),
  ]
}

function newPage(width: number, height: number): PdfPage {
  return { width, height, ops: [] }
}

/** Stacks cards down the pages, keeping each one whole unless it is taller than a page. */
function createFlow() {
  const pages = [newPage(A4.width, A4.height)]
  let top = PAGE_MARGIN

  const page = () => pages[pages.length - 1] as PdfPage
  const bottom = () => page().height - PAGE_MARGIN
  const contentWidth = () => page().width - PAGE_MARGIN * 2

  function breakPage(width = A4.width, height = A4.height) {
    pages.push(newPage(width, height))
    top = PAGE_MARGIN
  }

  function place(rows: Row[]) {
    const total = rows.reduce((sum, row) => sum + row.height, CARD_PADDING * 2)
    const isFresh = top === PAGE_MARGIN
    if (top + total > bottom() && !isFresh) breakPage()
    let remaining = rows
    while (remaining.length > 0) {
      remaining = placeSome(remaining)
      if (remaining.length > 0) breakPage()
    }
  }

  /** Draws as many rows as fit in a box, and hands back the rest. */
  function placeSome(rows: Row[]): Row[] {
    const room = bottom() - top - CARD_PADDING * 2
    let used = 0
    let count = 0
    for (const row of rows) {
      if (used + row.height > room && count > 0) break
      used += row.height
      count += 1
    }
    const height = used + CARD_PADDING * 2
    const width = contentWidth()
    drawBox(page(), PAGE_MARGIN, page().height - top - height, width, height)
    let rowTop = top + CARD_PADDING
    for (const row of rows.slice(0, count)) {
      row.draw(page(), PAGE_MARGIN + CARD_PADDING, rowTop, width - CARD_PADDING * 2)
      rowTop += row.height
    }
    top += height + CARD_GAP
    return rows.slice(count)
  }

  function drawTitle(text: string, size: number) {
    const y = baseline(page(), top, size)
    drawText(page(), text, { x: PAGE_MARGIN, y, size, font: 'bold' })
    top += lineHeight(size) + 6
  }

  /** The matrix has no card round it, and its heading row repeats on each new page. */
  function placeTable(header: Row, rows: Row[], onBreak: () => void) {
    const drawRow = (row: Row) => {
      row.draw(page(), PAGE_MARGIN, top, contentWidth())
      top += row.height
    }
    drawRow(header)
    for (const row of rows) {
      if (top + row.height > bottom()) {
        onBreak()
        drawRow(header)
      }
      drawRow(row)
    }
  }

  return { pages, place, breakPage, drawTitle, placeTable, contentWidth }
}

function placeMatrix(flow: ReturnType<typeof createFlow>, matrix: MatrixContent) {
  const landscape = () => flow.breakPage(A4.height, A4.width)
  landscape()
  flow.drawTitle('Flowers by design', NAME_SIZE)
  const width = flow.contentWidth()
  const nameWidth = width * MATRIX_NAME_SHARE
  const column = (width - nameWidth) / (matrix.headings.length - 1)
  const columns = [nameWidth, ...matrix.headings.slice(1).map(() => column)]
  flow.placeTable(
    tableRow(matrix.headings, columns, MATRIX_SIZE, 'bold'),
    matrix.rows.map(({ name, cells, total }) =>
      tableRow(
        [name, ...cells.map((stems) => (stems ? String(stems) : '')), String(total)],
        columns,
        MATRIX_SIZE,
      ),
    ),
    landscape,
  )
}

export function workPlanPdf({ cards, pools, matrix, onePerPage }: WorkPlanDocument): string {
  const flow = createFlow()
  flow.drawTitle('Work plan', TITLE_SIZE)
  const inner = flow.contentWidth() - CARD_PADDING * 2
  const blocks = [
    ...cards.map((card) => cardRows(card, inner)),
    ...pools.map((pool) => poolRows(pool, inner)),
  ]
  blocks.forEach((rows, index) => {
    if (onePerPage && index > 0) flow.breakPage()
    flow.place(rows)
  })
  if (matrix) placeMatrix(flow, matrix)
  return buildPdf(flow.pages, 'Work plan')
}
