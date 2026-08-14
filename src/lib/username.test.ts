import { describe, expect, it } from 'vitest'
import { isValidUsernameFormat } from './username'

describe('isValidUsernameFormat', () => {
  it('accepts a valid lowercase username', () => {
    expect(isValidUsernameFormat('john_doe123')).toBe(true)
  })

  it('rejects usernames shorter than 3 characters', () => {
    expect(isValidUsernameFormat('ab')).toBe(false)
  })

  it('rejects usernames with spaces or symbols', () => {
    expect(isValidUsernameFormat('john doe!')).toBe(false)
  })

  it('rejects uppercase letters', () => {
    expect(isValidUsernameFormat('JohnDoe')).toBe(false)
  })
})
