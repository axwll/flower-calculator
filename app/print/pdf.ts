export type PdfFont = 'regular' | 'bold'

export interface PdfPage {
  width: number
  height: number
  ops: string[]
}

export interface TextOptions {
  x: number
  y: number
  size: number
  font?: PdfFont
}

export const A4 = { width: 595.28, height: 841.89 }

/** 12mm, matching the print stylesheet. */
export const PAGE_MARGIN = 34

/** Used for the few accented or symbol characters missing from the tables below. */
const AVERAGE_WIDTH = 556

/** Adobe's published widths for characters 32 to 126, in thousandths of the font size. */
const WIDTHS: Record<PdfFont, number[]> = {
  regular: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
    611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
    222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ],
  bold: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
    611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
    667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
    278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ],
}

/** WinAnsi matches Unicode except for these, which sit where Unicode has control characters. */
const WIN_ANSI_EXTRAS: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

function encodeCharacter(character: string): string {
  if (character === '(' || character === ')' || character === '\\') return `\\${character}`
  const code = character.codePointAt(0) ?? 0
  if (code >= 32 && code < 127) return character
  const winAnsi = code >= 0xa0 && code <= 0xff ? code : WIN_ANSI_EXTRAS[character]
  return winAnsi === undefined ? '?' : `\\${winAnsi.toString(8).padStart(3, '0')}`
}

function encodeText(text: string): string {
  return [...text.normalize('NFC')].map(encodeCharacter).join('')
}

export function textWidth(text: string, size: number, font: PdfFont = 'regular'): number {
  const units = [...text].reduce(
    (sum, character) => sum + (WIDTHS[font][(character.codePointAt(0) ?? 0) - 32] ?? AVERAGE_WIDTH),
    0,
  )
  return (units * size) / 1000
}

function breakWord(word: string, size: number, font: PdfFont, maxWidth: number): string[] {
  const pieces = ['']
  for (const character of word) {
    const last = pieces.at(-1) ?? ''
    if (last && textWidth(last + character, size, font) > maxWidth) pieces.push(character)
    else pieces[pieces.length - 1] = last + character
  }
  return pieces
}

export function wrapText(text: string, size: number, font: PdfFont, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const joined = line ? `${line} ${word}` : word
    if (textWidth(joined, size, font) <= maxWidth) {
      line = joined
      continue
    }
    if (line) lines.push(line)
    const pieces = breakWord(word, size, font, maxWidth)
    line = pieces.pop() ?? ''
    lines.push(...pieces)
  }
  return line ? [...lines, line] : lines
}

export function drawText(page: PdfPage, text: string, { x, y, size, font }: TextOptions) {
  const name = font === 'bold' ? 'F2' : 'F1'
  page.ops.push(`BT /${name} ${size} Tf ${round(x)} ${round(y)} Td (${encodeText(text)}) Tj ET`)
}

export function drawLine(page: PdfPage, x1: number, y1: number, x2: number, y2: number) {
  page.ops.push(`0.5 w 0.47 G ${round(x1)} ${round(y1)} m ${round(x2)} ${round(y2)} l S`)
}

export function drawBox(page: PdfPage, x: number, y: number, width: number, height: number) {
  page.ops.push(`0.5 w 0.47 G ${round(x)} ${round(y)} ${round(width)} ${round(height)} re S`)
}

/** Text only, so the file stays plain ASCII and every byte offset is a string index. */
export function buildPdf(pages: PdfPage[], title: string): string {
  const firstPage = 6
  const kids = pages.map((_, index) => `${firstPage + index * 2} 0 R`).join(' ')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${encodeText(title)}) >>`,
    ...pages.flatMap((page, index) => {
      const content = page.ops.join('\n')
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
          `/Contents ${firstPage + index * 2 + 1} 0 R ` +
          '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>',
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      ]
    }),
  ]

  let file = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = file.length
    file += `${index + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const table = file.length
  const rows = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  const size = objects.length + 1
  return (
    `${file}xref\n0 ${size}\n0000000000 65535 f \n${rows}` +
    `trailer\n<< /Size ${size} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${table}\n%%EOF\n`
  )
}
