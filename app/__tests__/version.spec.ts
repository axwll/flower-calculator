import { describe, expect, it } from 'vitest'

import { version } from '../../package.json'
import { mountApp } from './helpers'

describe('version stamp', () => {
  it('shows the app version at the bottom of Settings', async () => {
    const { wrapper } = await mountApp('/settings')

    expect(wrapper.find('[data-version]').text()).toContain(`Version ${version}`)
  })
})
