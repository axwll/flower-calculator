const POUNDS_PATTERN = /^£?(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{0,2}))?$/

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

/** Parses pounds text to integer pence with no floating-point maths. Returns null if invalid. */
export function parsePounds(text: string): number | null {
  const trimmed = text.trim()
  const match = POUNDS_PATTERN.exec(trimmed)
  if (!match) return null

  const [, whole = '', fraction = ''] = match
  if (whole === '' && fraction === '') return null

  const pence = Number(whole.replaceAll(',', '') + fraction.padEnd(2, '0'))
  return Number.isSafeInteger(pence) ? pence : null
}

export function formatPence(pence: number): string {
  return gbp.format(pence / 100)
}
