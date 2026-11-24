import { isRouteErrorResponse, useRouteError } from 'react-router'

/** The router's error boundary: shown when a page throws while rendering. */
export function ErrorPage() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : null

  return (
    <main className="panel page-message">
      <h1>Something went wrong</h1>
      <p>The page crashed. Reload to try again.</p>
      {detail && <pre className="error-detail">{detail}</pre>}
      <button className="button" type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </main>
  )
}
