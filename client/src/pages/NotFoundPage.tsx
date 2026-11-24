import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="page-message">
      <h1>Page not found</h1>
      <p>There's nothing at this address.</p>
      <Link className="button" to="/">
        Back to reports
      </Link>
    </section>
  )
}
