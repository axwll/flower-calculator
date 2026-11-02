import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildPdf, drawText, PAGE_MARGIN, wrapText } from '../print/pdf'
import type { PdfPage } from '../print/pdf'
import { mountEvent, setDesign } from './helpers'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'

function decodeString(raw: string): string {
  return raw
    .replace(/\\([0-7]{3})/g, (_, code: string) => String.fromCharCode(parseInt(code, 8)))
    .replace(/\\([\\()])/g, '$1')
}

/** Every piece of text in the file, in the order it is drawn. */
function textIn(pdf: string): string[] {
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((match) => decodeString(match[1] ?? ''))
}

function pageCount(pdf: string): number {
  return Number(/\/Type \/Pages .*\/Count (\d+)/.exec(pdf)?.[1])
}

function pageSizes(pdf: string): string[] {
  return [...pdf.matchAll(/\/MediaBox \[0 0 (\S+) (\S+)\]/g)].map((m) => `${m[1]}x${m[2]}`)
}

function installPhone(share: (data: ShareData) => Promise<void>) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
  Object.assign(navigator, { share, canShare: () => true })
}

function removePhone() {
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
}

async function press(wrapper: VueWrapper) {
  await wrapper.find('button.save-pdf').trigger('click')
  await flushPromises()
}

async function sharedPdf(wrapper: VueWrapper): Promise<string> {
  const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
  installPhone(share)
  await press(wrapper)
  const file = share.mock.calls[0]?.[0].files?.[0]
  return (await file?.text()) ?? ''
}

async function weddingPlan() {
  const mounted = await mountEvent('work-plan')
  setDesign(mounted.store, 'bridal-bouquet', 1)
  setDesign(mounted.store, 'bridesmaid-bouquet', 7)
  setDesign(mounted.store, 'groom', 1)
  await flushPromises()
  return mounted
}

afterEach(() => {
  vi.restoreAllMocks()
  removePhone()
})

describe('the PDF file', () => {
  function blankPage(): PdfPage {
    return { width: 595, height: 842, ops: [] }
  }

  it('lists every object at the place it says', () => {
    const pdf = buildPdf([blankPage(), blankPage()], 'Work plan')
    const start = Number(/startxref\n(\d+)/.exec(pdf)?.[1])
    const table = pdf.slice(start).split('\n').slice(3)
    const offsets = table.filter((row) => row.endsWith(' n ')).map((row) => parseInt(row, 10))

    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true)
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(offsets.length).toBeGreaterThan(0)
    offsets.forEach((offset, index) => {
      expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true)
    })
  })

  it('counts its pages', () => {
    expect(pageCount(buildPdf([blankPage(), blankPage()], 'Work plan'))).toBe(2)
  })

  it('states each stream length exactly', () => {
    const page = blankPage()
    page.ops.push('0 0 m', '10 10 l S')
    const pdf = buildPdf([page], 'Work plan')
    const [, length, stream] = /\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(pdf) ?? []

    expect(stream).toHaveLength(Number(length))
  })
})

describe('wrapping text', () => {
  it('breaks between words to fit the width', () => {
    const lines = wrapText('Spray carnation and alstroemeria', 12, 'regular', 90)

    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe('Spray carnation and alstroemeria')
  })

  it('breaks a word too long for the width', () => {
    const lines = wrapText('Extraordinarilylongflowername', 12, 'regular', 60)

    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe('Extraordinarilylongflowername')
  })

  it('keeps a word that fits on one line', () => {
    expect(wrapText('Rose', 12, 'bold', 200)).toEqual(['Rose'])
  })
})

describe('saving on an iPhone', () => {
  it('shares a PDF file instead of asking the browser to print', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    installPhone(share)
    const { wrapper } = await weddingPlan()

    await press(wrapper)

    const file = share.mock.calls[0]?.[0].files?.[0]
    expect(print).not.toHaveBeenCalled()
    expect(file?.name).toBe('work-plan.pdf')
    expect(file?.type).toBe('application/pdf')
  })

  it('leaves the button ready again afterwards', async () => {
    const { wrapper } = await weddingPlan()

    await sharedPdf(wrapper)

    expect(wrapper.find('button.save-pdf').text()).toBe('Save as PDF')
    expect(wrapper.find('button.save-pdf').attributes('disabled')).toBeUndefined()
  })

  it('says nothing when the share screen is closed', async () => {
    installPhone(() => Promise.reject(new DOMException('Cancelled', 'AbortError')))
    const { wrapper } = await weddingPlan()

    await press(wrapper)

    expect(wrapper.find('[data-print-help]').exists()).toBe(false)
  })

  it('says so when the file cannot be shared', async () => {
    installPhone(() => Promise.reject(new DOMException('Refused', 'NotAllowedError')))
    const { wrapper } = await weddingPlan()

    await press(wrapper)

    expect(wrapper.find('[data-print-help]').text()).toContain('try again')
    expect(wrapper.find('button.save-pdf').text()).toBe('Save as PDF')
  })

  it('prints as before where a file cannot be shared', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    Object.assign(navigator, { canShare: () => false })
    const { wrapper } = await weddingPlan()

    await press(wrapper)

    expect(print).toHaveBeenCalledOnce()
  })
})

describe('what the PDF says', () => {
  it('opens with the same title as the printout', async () => {
    const { wrapper } = await weddingPlan()

    expect(textIn(await sharedPdf(wrapper))[0]).toBe('Work plan')
  })

  it('names each design and its placements as the screen does', async () => {
    const { wrapper } = await weddingPlan()
    const text = textIn(await sharedPdf(wrapper))

    for (const heading of wrapper.findAll('[data-work-card] .row')) {
      for (const part of heading.findAll('h3, span')) expect(text).toContain(part.text())
    }
  })

  it('gives every flower its stems as the screen does', async () => {
    const { wrapper } = await weddingPlan()
    const text = textIn(await sharedPdf(wrapper))
    const rows = wrapper.findAll('[data-work-flower]')

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(text).toContain(row.find('span').text())
      expect(text).toContain(row.find('strong').text())
    }
  })

  it('tells the helper to number placements', async () => {
    const { wrapper } = await weddingPlan()

    expect(textIn(await sharedPdf(wrapper))).toContain('Number them 1 to 7.')
  })

  it('warns about stems with no flower chosen', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'pedestal', 1)
    await flushPromises()
    const warning = wrapper.find('.unassigned').text()

    expect(textIn(await sharedPdf(wrapper))).toContain(warning)
  })

  it('includes the placement grid when placements differ', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    setDesign(store, 'pumpkin', 3)
    for (const id of ['alstroemeria', 'burgundy-carnation', 'santini']) {
      store.togglePalette('filler', id)
    }
    await flushPromises()
    const cells = wrapper.findAll('.grid tbody td').map((cell) => cell.text())
    expect(cells.length).toBeGreaterThan(0)

    const text = textIn(await sharedPdf(wrapper))

    for (const cell of cells) expect(text).toContain(cell)
    expect(text).toContain('Flower')
  })

  it('leaves the event name out', async () => {
    const { wrapper } = await weddingPlan()

    expect(textIn(await sharedPdf(wrapper))).not.toContain('Test event')
  })

  it('leaves the flower table out unless it is asked for', async () => {
    const { wrapper } = await weddingPlan()

    expect(textIn(await sharedPdf(wrapper))).not.toContain('Flowers by design')
  })

  it('puts the flower table on a landscape page when asked', async () => {
    const { wrapper } = await weddingPlan()
    await wrapper.find('input[name="show-matrix"]').setValue(true)
    const pdf = await sharedPdf(wrapper)
    const text = textIn(pdf)

    expect(text).toContain('Flowers by design')
    expect(text).toContain('Total')
    expect(text).toContain('33')
    const [width, height] = (pageSizes(pdf).at(-1) ?? '').split('x').map(Number)
    expect(width).toBeGreaterThan(height ?? 0)
  })

  it('gives each design its own page when asked', async () => {
    const { wrapper, store } = await weddingPlan()
    const designs = store.workPlan.length
    await wrapper.find('input[name="one-per-page"]').setValue(true)

    expect(pageCount(await sharedPdf(wrapper))).toBe(designs)
  })

  it('spills on to more pages and stays inside the margins', async () => {
    const { wrapper, store } = await mountEvent('work-plan')
    store.current?.designs.forEach((design, index) => {
      store.setEnabled(index, true)
      store.setQuantity(index, 3)
    })
    await flushPromises()

    const pdf = await sharedPdf(wrapper)
    const heights = [...pdf.matchAll(/ (-?[\d.]+) Td/g)].map((match) => Number(match[1]))

    expect(pageCount(pdf)).toBeGreaterThan(1)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(PAGE_MARGIN)
  })
})

describe('characters in the PDF', () => {
  function drawn(text: string): string {
    const page: PdfPage = { width: 595, height: 842, ops: [] }
    drawText(page, text, { x: 40, y: 700, size: 12 })
    return /\(((?:\\.|[^\\)])*)\) Tj/.exec(buildPdf([page], 'Work plan'))?.[1] ?? ''
  }

  it('writes pounds and accents in the PDF font encoding', () => {
    expect(drawn('£5 café')).toBe(String.raw`\2435 caf\351`)
  })

  it('writes dashes and curly quotes in the PDF font encoding', () => {
    expect(drawn('a – b ’')).toBe(String.raw`a \226 b \222`)
  })

  it('escapes the characters PDF strings treat as special', () => {
    expect(drawn(String.raw`(a\b)`)).toBe(String.raw`\(a\\b\)`)
  })

  it('swaps a character the font does not have for a question mark', () => {
    expect(drawn('Rose 🌸 →')).toBe('Rose ? ?')
  })
})
