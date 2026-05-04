// Anonymous identity for the current device/browser.
// Stored in localStorage and mirrored in a cookie so it survives
// both client-side reads and potential future server-side access.
//
// Lifecycle:
//   - First visit: generate a UUID, persist it in both localStorage and cookie
//   - Subsequent visits: read the existing ID
//   - If localStorage is cleared: a new ID is generated (user becomes a new voter)
//     but all previous votes remain in Supabase and still count toward averages

const STORAGE_KEY = 'tango90_anon_id'
const COOKIE_NAME = 'tango90_anon_id'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function setCookie(id: string) {
  // 1-year expiry, SameSite=Strict for basic CSRF protection
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${COOKIE_NAME}=${id}; expires=${expires}; path=/; SameSite=Strict`
}

/**
 * Returns the anon_id for the current device.
 * Creates and persists one if it doesn't exist yet.
 * Safe to call on every render — reads are O(1) from localStorage.
 */
export function getAnonId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing

    const id = generateId()
    localStorage.setItem(STORAGE_KEY, id)
    setCookie(id)
    return id
  } catch {
    // Private browsing or storage quota exceeded — return a session-only ID
    return generateId()
  }
}
