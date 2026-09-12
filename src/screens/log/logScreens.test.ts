import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useLogDraftStore } from '../../store/logDraft'
import EstimateEdit from './EstimateEdit'
import Capture from './Capture'
vi.mock('../../hooks/useTodayStats', () => ({ useTodayStats: () => ({ data: undefined }) }))
beforeEach(() => useLogDraftStore.getState().reset())
describe('simplified logging screens', () => {
  it('keeps editable nutrition and privacy visible and has a save action', () => {
    const html = renderToStaticMarkup(createElement(EstimateEdit, { onBack() {}, onPost() {}, posting: false, postError: null }))
    // Core nutrition fields are always visible
    expect(html).toContain('Calories (kcal)')
    // Privacy toggle is always visible
    expect(html).toContain('Visible to friends')
    // Has a save / post button
    expect(html).toMatch(/Save meal|Post/)
    // Does NOT leak a static calorie budget figure (avoids hardcoded 2000)
    expect(html).not.toContain('>2000<')
  })
  it('capture offers a clear optional photo and manual entry without gamified eating copy', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(Capture, { onGetEstimate() {}, onSkipPhoto() {} })))
    expect(html).toContain('Add a meal photo')
    expect(html).toContain('Enter manually')
    expect(html).not.toContain('Fuel check')
  })
})
