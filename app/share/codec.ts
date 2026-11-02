import type { EventPlan } from '@engine'

/** Matches the backend. Just under what a Sheet cell can hold. */
export const MAX_SHARE_CHARS = 50_000
/** Far beyond any real plan, so a bad share can't exhaust a phone as it unpacks. */
const MAX_PLAN_BYTES = 2_000_000
const NOT_A_PLAN = "This link doesn't hold a plan."

/** Stops reading at the limit, instead of unpacking everything and then checking. */
async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter()
  // A failure here also fails the reader, which is where it gets reported.
  writer.write(bytes).catch(() => undefined)
  writer.close().catch(() => undefined)

  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > limit) {
      await reader.cancel()
      throw new Error(NOT_A_PLAN)
    }
    chunks.push(value)
  }

  const joined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.length
  }
  return joined
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export async function gzipText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  return toBase64Url(await transform(bytes, new CompressionStream('gzip'), MAX_PLAN_BYTES))
}

/** What the sharer has seen means nothing on another phone. */
export function encodePlan(event: EventPlan): Promise<string> {
  const { viewedPrices: _viewed, ...shared } = event
  const text = JSON.stringify(shared)
  // Repetitive text compresses well, so a small share could still be too big to open.
  if (new TextEncoder().encode(text).length > MAX_PLAN_BYTES) {
    return Promise.reject(new Error('This plan is too big to share.'))
  }
  return gzipText(text)
}

/** The result still needs checking, because anyone can write a share. */
export async function decodePlan(text: string): Promise<unknown> {
  try {
    const stream = new DecompressionStream('gzip')
    const bytes = await transform(fromBase64Url(text), stream, MAX_PLAN_BYTES)
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error(NOT_A_PLAN)
  }
}
