import { type ReportStatus, SEVERITIES, type Severity } from '../api/types'

const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Pending',
  DONE: 'Done',
  FAILED: 'Failed',
}

const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

/** A report's status as a tag: gold while pending, teal when done, red when the AI failed. */
export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className="badge" data-status={status}>
      {STATUS_LABELS[status]}
    </span>
  )
}

/** The AI's severity as a tag with a four-bar level meter, from teal (low) to red (critical). */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const level = SEVERITIES.indexOf(severity) + 1
  return (
    <span className="badge severity" data-severity={severity}>
      <span className="severity-level" aria-hidden="true">
        {SEVERITIES.map((step, index) => (
          <i key={step} className={index < level ? 'on' : undefined} />
        ))}
      </span>
      {SEVERITY_LABELS[severity]}
    </span>
  )
}
