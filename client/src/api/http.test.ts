import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { sessionStore } from '../auth/session'
import { S1_URL, S2_URL } from '../config'
import { cors } from '../mocks/handlers'
import { server } from '../mocks/server'
import { signInAs } from '../test/utils'
import { s1, s2 } from './http'

/** Answers GET <base>/probe with `status` and records the Authorization header it received. */
function probe(base: string, status = 200) {
  const seen: (string | null)[] = []
  server.use(
    http.get(
      `${base}/probe`,
      cors(({ request }) => {
        seen.push(request.headers.get('Authorization'))
        return status === 200 ? HttpResponse.json({}) : HttpResponse.json({ message: 'no' }, { status })
      }),
    ),
  )
  return seen
}

describe('Axios clients', () => {
  it('send the token as a Bearer header to S1 and S2', async () => {
    const { token } = signInAs('tech1')
    const toS1 = probe(S1_URL)
    const toS2 = probe(S2_URL)

    await s1.get('/probe')
    await s2.get('/probe')

    expect(toS1).toEqual([`Bearer ${token}`])
    expect(toS2).toEqual([`Bearer ${token}`])
  })

  it('send no Authorization header when nobody is signed in', async () => {
    const seen = probe(S2_URL)
    await s2.get('/probe')
    expect(seen).toEqual([null])
  })

  it('end the session when the server refuses the current token', async () => {
    signInAs('tech1')
    probe(S2_URL, 401)

    await expect(s2.get('/probe')).rejects.toMatchObject({ response: { status: 401 } })

    expect(sessionStore.getState()).toEqual({ session: null, endReason: 'expired' })
  })

  it('keep the session on other errors, such as 403', async () => {
    const session = signInAs('tech1')
    probe(S1_URL, 403)

    await expect(s1.get('/probe')).rejects.toMatchObject({ response: { status: 403 } })

    expect(sessionStore.getState().session).toBe(session)
  })

  it('keep a newer session when a 401 answers a request sent with an older token', async () => {
    signInAs('tech1')
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let arrived!: () => void
    const hasArrived = new Promise<void>((resolve) => (arrived = resolve))
    server.use(
      http.get(
        `${S2_URL}/probe`,
        cors(async () => {
          arrived()
          await released
          return HttpResponse.json({}, { status: 401 })
        }),
      ),
    )

    const slow = s2.get('/probe')
    await hasArrived
    const newer = signInAs('manager1')
    release()

    await expect(slow).rejects.toMatchObject({ response: { status: 401 } })
    expect(sessionStore.getState().session).toBe(newer)
  })
})
