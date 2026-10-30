import { describe, expect, it } from 'vitest'

import { formatPence, parsePounds } from './money'

describe('parsePounds', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['12.', 1200],
    ['.50', 50],
    ['0', 0],
    ['0.01', 1],
    ['£12.50', 1250],
    ['  £12.50 ', 1250],
    ['1,250.00', 125000],
    ['1,234,567.89', 123456789],
  ])('parses %j as %i pence', (text, pence) => {
    expect(parsePounds(text)).toBe(pence)
  })

  it.each([
    ['19.99', 1999],
    ['1.15', 115],
    ['4.35', 435],
    ['8.29', 829],
    ['1.10', 110],
  ])('gets %j exactly right where floats would drift', (text, pence) => {
    expect(parsePounds(text)).toBe(pence)
  })

  it.each([
    [''],
    ['   '],
    ['£'],
    ['.'],
    ['abc'],
    ['12a'],
    ['-5'],
    ['1.234'],
    ['12,50'],
    ['1,23'],
    ['1,2345'],
    ['1.2.3'],
    ['£ £5'],
    ['99999999999999999999'],
  ])('rejects %j', (text) => {
    expect(parsePounds(text)).toBeNull()
  })
})

describe('formatPence', () => {
  it.each([
    [0, '£0.00'],
    [5, '£0.05'],
    [750, '£7.50'],
    [125000, '£1,250.00'],
  ])('formats %i as %s', (pence, text) => {
    expect(formatPence(pence)).toBe(text)
  })
})

describe('pence round trip', () => {
  it('returns every pence value from 0 to 9,999 unchanged', () => {
    for (let pence = 0; pence <= 9999; pence++) {
      expect(parsePounds(formatPence(pence))).toBe(pence)
    }
  })
})
