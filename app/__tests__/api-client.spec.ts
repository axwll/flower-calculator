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

describe('sharePlan', () => {
  it('sends the plan as plain text and returns the id', async () => {
    const fetcher = reply({ status: 'ok', id: 'share-1' })
    const result = await client(fetcher).sharePlan('abc')

    expect(result).toEqual({ status: 'shared', id: 'share-1' })
    const [, options] = fetcher.mock.calls[0] ?? []
    expect(options?.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' })
    expect(JSON.parse(String(options?.body))).toMatchObject({
      action: 'sharePlan',
      key: 'app-key',
      payload: 'abc',
    })
  })

  it('passes on a refusal', async () => {
    const result = await client(
      reply({ status: 'error', code: 'too-large', message: 'Too big.' }),
    ).sharePlan('abc')

    expect(result).toEqual({ status: 'refused', message: 'Too big.' })
  })

  it.each([
    ['no connection', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))],
    ['a busy server', reply({ status: 'error', code: 'busy', message: 'Busy' })],
    ['a reply with no id', reply({ status: 'ok' })],
    ['a server error', reply({}, false)],
  ])('reports %s as failed', async (_label, fetcher) => {
    expect(await client(fetcher).sharePlan('abc')).toEqual({ status: 'failed' })
  })
})

describe('fetchShared', () => {
  it('asks for the plan by id', async () => {
    const fetcher = reply({ status: 'ok', payload: 'abc' })
    const result = await client(fetcher).fetchShared('share-1')

    expect(result).toEqual({ status: 'ok', payload: 'abc' })
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('?shared=share-1')
  })

  it('escapes the id', async () => {
    const fetcher = reply({ status: 'ok', payload: 'abc' })
    await client(fetcher).fetchShared('a&since=1')

    expect(String(fetcher.mock.calls[0]?.[0])).toContain('?shared=a%26since%3D1')
  })

  it('says when there is no such plan', async () => {
    const result = await client(
      reply({ status: 'error', code: 'not-found', message: 'Gone' }),
    ).fetchShared('x')

    expect(result).toEqual({ status: 'not-found' })
  })

  it.each([
    ['no connection', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))],
    ['a reply with no plan', reply({ status: 'ok' })],
    ['a server error', reply({}, false)],
  ])('reports %s as failed', async (_label, fetcher) => {
    expect(await client(fetcher).fetchShared('x')).toEqual({ status: 'failed' })
  })
})
