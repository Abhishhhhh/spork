const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

export function isValidUsernameFormat(username: string): boolean {
  return USERNAME_PATTERN.test(username)
}
