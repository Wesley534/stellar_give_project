const TOKEN_KEY = 'token'
export const AUTH_STORAGE_EVENT = 'auth-storage-changed'

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT))
}

export function clearStoredToken() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT))
}
