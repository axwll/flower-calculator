import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useConfirmStore } from '../stores/confirm'
import { answerConfirm, mountApp } from './helpers'

afterEach(() => {
  vi.restoreAllMocks()
})

async function askAfterMounting(yes?: string, no?: string) {
  const mounted = await mountApp('/events')
  const answer = useConfirmStore().ask('Carry on?', { yes, no })
  await flushPromises()
  return { ...mounted, answer }
}

describe('confirmation', () => {
  it('shows the question and both answers', async () => {
    const { wrapper } = await askAfterMounting('Remove', 'Keep it')
    const dialog = wrapper.find('[role="alertdialog"]')

    expect(dialog.text()).toContain('Carry on?')
    expect(dialog.find('.confirm-yes').text()).toBe('Remove')
    expect(dialog.find('.confirm-no').text()).toBe('Keep it')
  })

  it('answers yes and closes', async () => {
    const { wrapper, answer } = await askAfterMounting()

    await answerConfirm(wrapper, true)

    expect(await answer).toBe(true)
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
  })

  it('answers no and closes', async () => {
    const { wrapper, answer } = await askAfterMounting()

    await answerConfirm(wrapper, false)

    expect(await answer).toBe(false)
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
  })

  it('takes a new question by answering no to the old one', async () => {
    const { wrapper, answer } = await askAfterMounting()

    const next = useConfirmStore().ask('Second?')
    await flushPromises()

    expect(await answer).toBe(false)
    expect(wrapper.find('[role="alertdialog"]').text()).toContain('Second?')

    await answerConfirm(wrapper, true)
    expect(await next).toBe(true)
  })

  it('stays off the printout', async () => {
    const { wrapper } = await askAfterMounting()

    expect(wrapper.find('[role="alertdialog"]').classes()).toContain('no-print')
  })

  it('never uses a browser pop-up', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    await askAfterMounting()

    expect(confirm).not.toHaveBeenCalled()
  })
})
