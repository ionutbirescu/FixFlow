// The two Axios clients. Every API module goes through these, so the interceptors below apply to all calls:
// - each request carries `Authorization: Bearer <token>` while someone is signed in;
// - a 401 to a request that carried the current token ends the session, and the route guards
//   send the user to /login.
import axios, { type AxiosInstance } from 'axios'
import { sessionStore } from '../auth/session'
import { S1_URL, S2_URL } from '../config'

/** S1, the write server (port 8081): login, report upload, machines and users. */
export const s1 = createClient(S1_URL)

/** S2, the read server (port 8082): every `GET`. */
export const s2 = createClient(S2_URL)

export interface RequestOptions {
  /** Cancels the request, e.g. from an effect's cleanup */
  signal?: AbortSignal
}

function createClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL })

  client.interceptors.request.use((config) => {
    const token = sessionStore.getState().session?.token
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    return config
  })

  client.interceptors.response.use(undefined, (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Only end the session whose token was refused. A failed login sends no token, and a slow request
      // from before a re-login carries an older one; neither should sign out the current user.
      const current = sessionStore.getState().session
      const sent = error.config?.headers.get('Authorization')
      if (current && sent === `Bearer ${current.token}`) sessionStore.end('expired')
    }
    return Promise.reject(error)
  })

  return client
}
