import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '../api/client'

const URL = 'https://example.test/exec'
const MASTER = {
  version: 3,
  flowers: [{ id: 'rose' }],
  suppliers: [],
  designs: [],
  recipes: [],
  prices: [],
}

function reply(body: unknown, ok = true) {
  return vi.fn<typeof fetch>().mockResolvedValue({
    ok,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response)
}

function client(fetcher: typeof fetch) {
  vi.stubGlobal('fetch', fetcher)
  return httpClient(URL, 'app-key')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchMaster', () => {
  it('returns new data', async () => {
    const result = await client(reply({ status: 'ok', data: MASTER })).fetchMaster()

    expect(result).toEqual({ status: 'ok', data: MASTER })
  })

  it('sends the version it already has', async () => {
    const fetcher = reply({ status: 'unchanged', version: 3 })
    const result = await client(fetcher).fetchMaster(3)

    expect(result).toEqual({ status: 'unchanged' })
    expect(fetcher.mock.calls[0]?.[0]).toBe(`${URL}?since=3`)
  })

  it('fails when the network does', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Offline'))

    expect(await client(fetcher).fetchMaster()).toEqual({ status: 'failed' })
  })

  it('fails on an HTML sign-in page', async () => {
    const result = await client(reply('<!doctype html><title>Sign in</title>')).fetchMaster()

    expect(result).toEqual({ status: 'failed' })
  })

  it('fails on an error status', async () => {
    expect(await client(reply({}, false)).fetchMaster()).toEqual({ status: 'failed' })
  })

  it.each([
    ['no data', { status: 'ok' }],
    ['no flowers', { status: 'ok', data: { ...MASTER, flowers: [] } }],
    ['a missing list', { status: 'ok', data: { ...MASTER, prices: undefined } }],
    ['no version', { status: 'ok', data: { ...MASTER, version: undefined } }],
  ])('refuses a reply with %s, so the cache is left alone', async (_label, body) => {
    expect(await client(reply(body)).fetchMaster()).toEqual({ status: 'failed' })
  })
})

describe('send', () => {
  const action = { action: 'reportPrice' as const, report: { id: 'r1' } as never }

  it('posts plain text, to avoid a CORS preflight, with the shared key', async () => {
    const fetcher = reply({ status: 'ok', version: 2 })
    await client(fetcher).send(action)
    const init = fetcher.mock.calls[0]?.[1]

    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      action: 'reportPrice',
      key: 'app-key',
      report: { id: 'r1' },
    })
  })

  it('reports success', async () => {
    expect(await client(reply({ status: 'ok', version: 2 })).send(action)).toEqual({
      status: 'sent',
    })
  })

  it('retries when the network fails', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Offline'))

    expect(await client(fetcher).send(action)).toEqual({ status: 'retry' })
  })

  it('retries when the server is busy', async () => {
    const busy = reply({ status: 'error', code: 'busy', message: 'Busy' })

    expect(await client(busy).send(action)).toEqual({ status: 'retry' })
  })

  it('retries on a reply it cannot read', async () => {
    expect(await client(reply('<html>')).send(action)).toEqual({ status: 'retry' })
  })

  it('stops on a refusal, passing the reason on', async () => {
    const refused = reply({ status: 'error', code: 'invalid', message: 'Unknown flower.' })

    expect(await client(refused).send(action)).toEqual({
      status: 'refused',
      message: 'Unknown flower.',
    })
  })
})
