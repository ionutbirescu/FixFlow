// Where the browser finds the two servers. Docker bakes these in at build time (client/Dockerfile);
// without them, the dev defaults below match the ports in the README.
export const S1_URL = trimSlash(import.meta.env.VITE_S1_URL ?? 'http://localhost:8081')
export const S2_URL = trimSlash(import.meta.env.VITE_S2_URL ?? 'http://localhost:8082')

/** `npm run dev:mock`: MSW answers every S1 and S2 call in the browser. */
export const API_MOCKING = import.meta.env.MODE === 'mock'

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
