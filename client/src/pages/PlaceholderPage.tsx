import type { ReactNode } from 'react'

/** Stands in for a page a later client task builds. The route, guard and nav link are already in place. */
export function PlaceholderPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">{children}</p>
    </section>
  )
}
