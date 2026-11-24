import { describe, expect, it } from 'vitest'
import { USER_IDS } from '../mocks/db'
import { createMockToken } from '../mocks/jwt'
import { createSessionStore, STORAGE_KEY } from './session'

const tech1 = { id: USER_IDS.tech1, username: 'tech1', role: 'TECHNICIAN' as const }
const manager1 = { id: USER_IDS.manager1, username: 'manager1', role: 'MANAGER' as const }

describe('session store', () => {
  it('stores the token and role and reads the username and expiry from the token', () => {
    const now = Date.UTC(2026, 10, 23, 8, 0)
    const token = createMockToken(tech1, { now })
    const store = createSessionStore(localStorage, () => now)

    const session = store.start({ token, role: 'TECHNICIAN' })

    expect(session).toEqual({ token, role: 'TECHNICIAN', username: 'tech1', expiresAt: now + 8 * 3600 * 1000 })
    expect(store.getState()).toEqual({ session, endReason: null })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ token, role: 'TECHNICIAN' })
  })

  it('restores the session on the next page load', () => {
    const token = createMockToken(manager1)
    createSessionStore(localStorage).start({ token, role: 'MANAGER' })

    const reloaded = createSessionStore(localStorage)

    expect(reloaded.getState().session).toMatchObject({ token, role: 'MANAGER', username: 'manager1' })
  })

  it('drops a stored token that has expired and says so', () => {
    const token = createMockToken(tech1, { ttlSeconds: 60 })
    createSessionStore(localStorage).start({ token, role: 'TECHNICIAN' })

    const later = createSessionStore(localStorage, () => Date.now() + 61_000)

    expect(later.getState()).toEqual({ session: null, endReason: 'expired' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('ignores a stored value it does not recognize', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'abc', role: 'ADMIN' }))
    expect(createSessionStore(localStorage).getState().session).toBeNull()

    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(createSessionStore(localStorage).getState().session).toBeNull()
  })

  it('accepts a token that is not a readable JWT, without username or expiry', () => {
    const store = createSessionStore(localStorage)
    expect(store.start({ token: 'opaque-token', role: 'TECHNICIAN' })).toEqual({
      token: 'opaque-token',
      role: 'TECHNICIAN',
      username: null,
      expiresAt: null,
    })
  })

  it('ends the session, clears storage and remembers why', () => {
    const store = createSessionStore(localStorage)
    store.start({ token: createMockToken(tech1), role: 'TECHNICIAN' })

    store.end('expired')

    expect(store.getState()).toEqual({ session: null, endReason: 'expired' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    store.end('logout') // nothing to end: keeps the first reason
    expect(store.getState().endReason).toBe('expired')
  })

  it('notifies subscribers on every change', () => {
    const store = createSessionStore(localStorage)
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)

    store.start({ token: createMockToken(tech1), role: 'TECHNICIAN' })
    store.end('logout')
    unsubscribe()
    store.start({ token: createMockToken(tech1), role: 'TECHNICIAN' })

    expect(calls).toBe(2)
  })

  it('follows sign-ins and sign-outs made in another tab', () => {
    const thisTab = createSessionStore(localStorage)
    const otherTab = createSessionStore(localStorage)

    otherTab.start({ token: createMockToken(manager1), role: 'MANAGER' })
    thisTab.syncFromStorage()
    expect(thisTab.getState().session?.username).toBe('manager1')

    otherTab.end('logout')
    thisTab.syncFromStorage()
    expect(thisTab.getState()).toEqual({ session: null, endReason: null })
  })

  it('keeps the session in memory when storage is unavailable', () => {
    const store = createSessionStore(null)
    store.start({ token: createMockToken(tech1), role: 'TECHNICIAN' })
    expect(store.getState().session?.username).toBe('tech1')
  })
})
