import type { EventPlan } from '@engine'

import { apiClient } from '../api/client'
import { migrateEvent } from '../storage/migrations'
import { MAX_SHARE_CHARS, decodePlan, encodePlan } from './codec'

export type ShareResult =
  { status: 'shared'; link: string } | { status: 'problem'; message: string }

export type OpenResult =
  { status: 'ok'; plan: EventPlan } | { status: 'not-found' | 'problem' | 'retry'; message: string }

const ID_PATTERN = /^[\w-]{20,100}$/

export function shareLink(id: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/shared/${id}`
}

/** Takes a whole link or a bare id, because a pasted link can arrive either way. */
export function shareIdFrom(text: string): string | null {
  const trimmed = text.trim()
  const id = trimmed.split('#/shared/')[1] ?? trimmed
  return ID_PATTERN.test(id) ? id : null
}

async function encodedWithinLimit(event: EventPlan): Promise<string | null> {
  try {
    const payload = await encodePlan(event)
    return payload.length > MAX_SHARE_CHARS ? null : payload
  } catch {
    return null
  }
}

export async function sharePlan(event: EventPlan): Promise<ShareResult> {
  const payload = await encodedWithinLimit(event)
  if (!payload) return { status: 'problem', message: 'This plan is too big to share.' }

  const reply = await apiClient().sharePlan(payload)
  if (reply.status === 'shared') return { status: 'shared', link: shareLink(reply.id) }
  if (reply.status === 'refused') return { status: 'problem', message: reply.message }
  return {
    status: 'problem',
    message: "This plan couldn't be shared. Check your connection and try again.",
  }
}

export async function openShared(id: string): Promise<OpenResult> {
  const reply = await apiClient().fetchShared(id)
  if (reply.status === 'not-found') {
    return { status: 'not-found', message: 'This plan could not be found.' }
  }
  if (reply.status === 'failed') {
    return {
      status: 'retry',
      message: "This plan couldn't be loaded. Check your connection and try again.",
    }
  }

  try {
    return { status: 'ok', plan: migrateEvent(await decodePlan(reply.payload)) }
  } catch (error) {
    const message = error instanceof Error ? error.message : "This link doesn't hold a plan."
    return { status: 'problem', message }
  }
}
