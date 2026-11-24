import { Link } from 'react-router'
import type { Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../auth/roles'

export function ForbiddenPage({ allowed }: { allowed: readonly Role[] }) {
  const { session } = useAuth()
  const who = allowed.map((role) => `${ROLE_LABELS[role].toLowerCase()}s`).join(' and ')

  return (
    <section className="page-message">
      <h1>No access</h1>
      <p>
        This page is only for {who}.
        {session && ` You're signed in as a ${ROLE_LABELS[session.role].toLowerCase()}.`}
      </p>
      <Link className="button" to="/">
        Back to reports
      </Link>
    </section>
  )
}
