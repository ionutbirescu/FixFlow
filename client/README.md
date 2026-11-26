# FixFlow client

React 19 + TypeScript + Vite, with React Router 8 and Axios. Runs on http://localhost:3000.

```bash
npm install
npm run dev        # dev server against S1 (8081) and S2 (8082)
npm run dev:mock   # dev server with the mock API: no backend needed
npm test           # Vitest, once (npm run test:watch to keep it running)
npm run lint       # oxlint
npm run build      # type-check + production build into dist/
npm run gen:api    # regenerate src/api/schema.gen.ts after contracts/openapi.yaml changes
```

## Layout

| Path | What it holds |
| --- | --- |
| `src/api/` | The typed API clients: one function per endpoint, the two Axios instances and their interceptors |
| `src/auth/` | The session store, `AuthProvider` / `useAuth()`, and the route guards |
| `src/routes.tsx` | Every page and the role that may open it |
| `src/pages/`, `src/components/` | Pages and shared components |
| `src/hooks/` | Shared data hooks, e.g. `useMachines()` |
| `src/format.ts` | How dates and file sizes are shown |
| `src/index.css`, `src/assets/` | The theme, and the skyline behind every page |
| `src/mocks/` | The MSW mock API, used by `npm run dev:mock` and by the tests |
| `src/test/` | Test setup and helpers |

## Calling the API

Import the function for the endpoint from `src/api/` (`auth.ts`, `reports.ts`, `machines.ts`, `images.ts`). Each one returns the typed response body. The types come from `src/api/types.ts`.

```ts
import { listReports } from '../api/reports'

const page = await listReports({ status: 'DONE', size: 10 }, { signal })
```

- `schema.gen.ts` is generated from `contracts/openapi.yaml`; never edit it by hand. After the spec changes, run `npm run gen:api` and commit the result. CI fails if the file is out of date.
  - The generator runs on its own TypeScript 5 through `npx`, because TypeScript 7 no longer has the compiler API it needs.
- Failed calls reject with an `AxiosError`. `isApiError(error, 404)` checks the status, and `errorMessage(error)` gives text to show: the server's `ErrorResponse.message`, or a generic message.
- `GET /images/{id}` needs the Bearer token, which an `<img src>` can't send. Use `getImage(id)` and show the blob with `URL.createObjectURL` (`ReportPhoto` in `src/pages/ReportPage.tsx` does this).
- What `POST /reports` accepts is in `src/api/types.ts`: `IMAGE_TYPES` (JPG, PNG) and `MAX_IMAGE_BYTES` (10 MB). The new report page checks a photo against them before uploading it, and the mock API uses them too.
- S1 handles every write, S2 every read. Their URLs come from `VITE_S1_URL` and `VITE_S2_URL` (baked in by the Docker build), defaulting to `localhost:8081` and `localhost:8082`.

## Auth

- `useAuth()` gives `session` (`token`, `role`, `username`, `expiresAt`), `login(credentials)` and `logout()`.
- The session is kept in `localStorage` (`fixflow.session`), so it survives reloads and is shared by the open tabs. Signing in or out in one tab does the same in the others.
- Every request to S1 or S2 carries `Authorization: Bearer <token>` while someone is signed in (`src/api/http.ts`).
- A `401` to a request that carried the current token signs the user out. The guard then sends them to `/login`, which says the session expired, and back to the same page after they sign in again. After an explicit sign-out, the next sign-in starts on `/reports`.
- A `403` doesn't sign anyone out; show it like any other error.

## Routes and roles

`src/routes.tsx` lists every page:

- `RequireAuth` wraps everything except `/login`: signed-out visitors go to the login page.
- `RequireRole roles={MANAGER_ONLY}` wraps the manager pages (`/machines/new`, `/machines/:id/edit`, `/users/new`). A technician who opens one gets a "No access" page, and the nav hides "Add user" from them.
- The guards only decide what the browser shows. S1 and S2 check the role on every request.

The pages that aren't built yet are `PlaceholderPage`s. To build one, replace its `element` in `routes.tsx`.

## Reports

- `/reports/new` uploads a photo with a machine and a description. The photo must be a JPG or PNG of at most 10 MB; any other file is refused before the upload, with a message under the field. A valid one is previewed. After the upload, the page opens the new report.
- `/reports/:id` reads `GET /reports/{id}` from S2, then again every 3 seconds (`POLL_INTERVAL_MS`) while the report is `PENDING`, and stops once it is `DONE` or `FAILED`. The next read is timed from the last answer, so a slow S2 never has two reads in flight.
  - A network error or a 5xx keeps the last copy on screen, shows the error and tries again. A `404` (someone else's report, for a technician) shows "Report not found" and stops.
  - The status tag is a live region, so screen readers hear it change.
- `StatusBadge` and `SeverityBadge` (`src/components/ReportBadges.tsx`) show a report's status and the AI's severity, for the reports list to reuse.

## Theme

A game pause menu over a city skyline, in the style of the GTA 5 menu over GTA 6's Vice City. It comes in two themes: day (light) and night (dark). All of it is in `src/index.css`:

- The colours are variables on `:root`: `--pink` for primary actions, `--gold` and `--teal`, `--red` for errors. `--panel` is the translucent background behind content.
- Each colour is `light-dark(day, night)`. Use the variables rather than raw colours, and both themes keep working.
- The theme follows the system setting until the user picks one with the Day/Night switch, below the login form and below every page. The choice is kept in this browser (`fixflow.theme` in `localStorage`) and set as `data-theme` on `<html>` (`src/theme.ts`). A small script in `index.html` applies it before the first paint.
- Each role has its own colour in `--role`, teal for technicians and gold for managers, like the playable characters in GTA 5. It colours the menu tab strips and the role tag.
- The fonts are Barlow and Barlow Condensed, bundled from `@fontsource`, so the app makes no font requests to Google.
- Classes to reuse on new pages: `panel`, `button` (`button-primary`, `button-small`), `field` (a `<label>` holding a `<span>` and an input, select or textarea, optionally followed by a `field-hint` and a `field-error`), `form-actions`, `notice` (`notice-error`, and `notice-row` for one with a button), `badge`, `facts` (a `<dl>` of short label/value pairs), `progress` (a loading bar), `muted` and `visually-hidden`.
- The `badge` takes the colour of a report status (`data-status`) or severity (`data-severity`): gold for pending and medium, teal for done and low, orange for high, red for failed and critical. Text on red is `--on-red`, white by day and dark by night, because dark text on the day red is too faint.
- The skyline with palms is generated by `node scripts/skyline.mjs`, which draws the same city as `src/assets/skyline-day.svg` and `skyline-night.svg`.

## Mock API

`npm run dev:mock` runs the app against MSW handlers in a service worker. The handlers follow `openapi.yaml`: the same status codes, `ErrorResponse` bodies, and role and ownership rules.

- Logins: `tech1` (technician) and `manager1` (manager), both with the password `fixflow`, the same as `V2__seed.sql`. The login page lists them in any dev build (`npm run dev` or `npm run dev:mock`), but not in production builds.
- The machines and maintenance history match `V2__seed.sql`, and five reports are added. Four belong to `tech1`; the newest is still `PENDING` when the page loads.
- A new report stays `PENDING` for 4 seconds, then the fake AI decides it with the same keywords as the backend's `MockAiReportService`: "smoke" gives `CRITICAL`, "leak" `HIGH`, "noise" `MEDIUM`, anything else `LOW`, and `#fail` makes it `FAILED`.
- The data lives in memory: reloading the page resets it.
- The worker script is only served in mock mode. Production builds contain no mock code.

## Tests

Vitest runs in jsdom, with the same MSW handlers answering every request; an unhandled request fails the test.

- `renderApp('/path')` renders the whole app (real routes, guards and auth) in a memory router; `signInAs('tech1')` starts a session first.
- To change a response for one test, use `server.use(...)` and wrap the resolver in `cors()` from `src/mocks/handlers.ts`, because jsdom enforces CORS like a browser:

  ```ts
  server.use(http.get(`${S2_URL}/machines`, cors(() => HttpResponse.json([]))))
  ```

- The mock database and the session are reset after each test.
- jsdom has no `URL.createObjectURL`, so `src/test/setup.ts` hands out fake `blob:` URLs. jsdom never loads images anyway.
- `user.upload()` drops files that don't match the input's `accept`, like the file dialog. To test what the page does with such a file, use `userEvent.setup({ applyAccept: false })`.
- To test polling, fake `setTimeout`, `clearTimeout` and `Date` with `shouldAdvanceTime: true`, then step with `vi.advanceTimersByTimeAsync()`. The mock AI reads the same faked clock (see `ReportPage.test.tsx`).

## Troubleshooting

- **The login page says "Can't reach the server"**: `npm run dev` calls the real S1 and S2, and nothing is answering on ports 8081 and 8082. Start the backend, or use `npm run dev:mock`.
- **Vitest says "failed to find the runner" on Windows**: the shell was started in a path with a lowercase drive letter (`d:\FixFlow`), so Vitest loads itself twice. Run the tests from PowerShell, or `cd` to the folder again with an uppercase drive letter: `cd /d D:\FixFlow\client` in cmd, `cd /D/FixFlow/client` in Git Bash.
