import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomTabBar } from './BottomTabBar'

describe('BottomTabBar', () => {
  it('has 5 tabs with Log dead-centre: Home, Insights, Log, Friends, Profile', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/home/feed']}><BottomTabBar /></MemoryRouter>)
    expect(html).toContain('aria-label="Main navigation"')
    const order = ['/home/feed', '/home/insights', '/home/log', '/home/friends', '/home/profile'].map((p) => html.indexOf(`href="${p}"`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order) // rendered in this order → Log is the 3rd of 5
    for (const label of ['Home', 'Insights', 'Log', 'Friends', 'Profile']) expect(html).toContain(label)
    expect(html).not.toContain('/home/today')
  })
})
