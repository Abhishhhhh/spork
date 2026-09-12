import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  stats: { data: { caloriesLogged: 645, proteinLogged: 32, logCount: 1 }, isPending: false, isError: false, refetch: vi.fn() },
  meals: { data: [{ id: 'meal-1', name: 'Rice and beans', created_at: new Date().toISOString(), meal_type: 'lunch', calories_final: 645, calories_estimate: 700 }], isPending: false, isError: false, refetch: vi.fn() },
}))
vi.mock('../../hooks/useTodayStats', () => ({ useTodayStats: () => state.stats }))
vi.mock('../../hooks/useProfile', () => ({ useLogsForDay: () => state.meals }))
import Today from './Today'

function render() { return renderToStaticMarkup(<MemoryRouter><Today /></MemoryRouter>) }

describe('Today', () => {
  const originalMeals = state.meals.data
  afterEach(() => {
    state.stats.isError = false
    state.stats.isPending = false
    state.meals.isError = false
    state.meals.isPending = false
    state.meals.data = originalMeals
  })
  it('distinguishes empty, pending, and failed meal queries', () => {
    state.meals.data = []
    expect(render()).toContain('No meals logged yet')
    state.meals.isPending = true
    expect(render()).toContain('Loading your meals')
    expect(render()).not.toContain('No meals logged yet')
    state.meals.isPending = false
    state.meals.isError = true
    expect(render()).toContain('Could not load your meals')
    expect(render()).toContain('Retry meals')
    expect(render()).not.toContain('No meals logged yet')
  })
  it('exposes a nutrition error and retry rather than silently showing zero', () => {
    state.stats.isError = true
    expect(render()).toContain('Could not update your nutrition')
    expect(render()).toContain('Retry nutrition')
    state.stats.isError = false
    state.stats.isPending = true
    expect(render()).toContain('Loading your nutrition')
  })
  it('shows actual logged nutrition and meals, not fallback targets', () => {
    const html = render()
    expect(html).toContain('Today')
    expect(html).toContain('645')
    expect(html).toContain('32')
    expect(html).toContain('Rice and beans')
    expect(html).toContain('/home/log/meal-1')
    expect(html).toContain('Log meal')
    expect(html).toContain('/home/log')
    expect(html).not.toContain('2,000')
    expect(html).not.toContain('2000')
  })
})
