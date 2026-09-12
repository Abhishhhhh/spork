import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomTabBar } from './BottomTabBar'

describe('BottomTabBar', () => {
  it('has 3 tabs: Home (feed), Log, Profile', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/home/feed']}><BottomTabBar /></MemoryRouter>)
    expect(html).toContain('aria-label="Main navigation"')
    // Three destinations present
    expect(html).toContain('/home/feed')
    expect(html).toContain('/home/log')
    expect(html).toContain('/home/profile')
    // Labels present
    expect(html).toContain('Home')
    expect(html).toContain('Log')
    expect(html).toContain('Profile')
    // Old 5-tab routes gone
    expect(html).not.toContain('/home/friends')
    expect(html).not.toContain('/home/today')
    expect(html).not.toContain('Feed')
  })
})
