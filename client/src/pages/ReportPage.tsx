import { type ReactNode, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { errorMessage, isApiError } from '../api/errors'
import { getImage } from '../api/images'
import { getReport } from '../api/reports'
import type { AiReportResult, ReportDetailDto } from '../api/types'
import { SeverityBadge, StatusBadge } from '../components/ReportBadges'
import { formatDate, formatDateTime } from '../format'
import { useMachines } from '../hooks/useMachines'

/** How long to wait between two reads of a PENDING report, as openapi.yaml agrees with S2 */
export const POLL_INTERVAL_MS = 3000

/** One report (`GET /reports/{id}` on S2), read again every 3 s until the AI has finished with it. */
export function ReportPage() {
  const { id = '' } = useParams()
  // A new ID starts over with fresh state, instead of showing the last report while the next one loads
  return <ReportView key={id} id={id} />
}

interface PollState {
  /** The latest copy from S2. Kept when a later read fails, so the page doesn't go blank. */
  report: ReportDetailDto | null
  /** Why the last read failed, or `null` */
  error: string | null
  /** Whether the page will read the report again after that failure */
  retrying: boolean
  /** S2 has no such report for this user: stop reading */
  notFound: boolean
}

/**
 * Reads the report, then again 3 s after each answer while it is PENDING. Waiting for the answer before the
 * next timer means a slow S2 never has two reads in flight. A network error or a 5xx may pass, so those are
 * retried too; other errors stop the polling.
 */
function usePolledReport(id: string): PollState {
  const [state, setState] = useState<PollState>({ report: null, error: null, retrying: false, notFound: false })

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      try {
        const report = await getReport(id, { signal: controller.signal })
        setState({ report, error: null, retrying: false, notFound: false })
        if (report.status === 'PENDING') timer = setTimeout(poll, POLL_INTERVAL_MS)
      } catch (error) {
        if (controller.signal.aborted) return
        const status = isApiError(error) ? error.response?.status : undefined
        // 404: not there, or another technician's. 400: not even a UUID.
        if (status === 404 || status === 400) {
          setState({ report: null, error: null, retrying: false, notFound: true })
          return
        }
        const retrying = status === undefined || status >= 500
        setState((previous) => ({ ...previous, error: errorMessage(error, "Couldn't load the report."), retrying }))
        if (retrying) timer = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [id])

  return state
}

function ReportView({ id }: { id: string }) {
  const { report, error, retrying, notFound } = usePolledReport(id)

  if (notFound) {
    return (
      <section className="page-message">
        <h1>Report not found</h1>
        <p>There's no report at this address, or it isn't one of yours.</p>
        <Link className="button" to="/reports">
          Back to reports
        </Link>
      </section>
    )
  }

  const errorNotice = error && (
    <p className="notice notice-error" role="alert">
      {sentence(error)} {retrying && 'Trying again in a few seconds.'}
    </p>
  )

  if (!report) {
    return (
      <section>
        <h1>Report</h1>
        {errorNotice || (
          <p className="muted" role="status">
            Loading the report…
          </p>
        )}
      </section>
    )
  }

  return <ReportDetail report={report} notice={errorNotice} />
}

function ReportDetail({ report, notice }: { report: ReportDetailDto; notice: ReactNode }) {
  const machines = useMachines()
  const machine = machines.status === 'ready' ? machines.machines.find(({ id }) => id === report.machineId) : undefined

  return (
    <article className="report">
      <header className="report-head">
        <h1>Report</h1>
        {/* A live region: screen readers hear it change from Pending to Done or Failed */}
        <span role="status">
          <span className="visually-hidden">Status: </span>
          <StatusBadge status={report.status} />
        </span>
      </header>

      <dl className="facts">
        <div>
          <dt>Machine</dt>
          <dd>
            {machine ? (
              <>
                <Link to={`/machines/${machine.id}`}>{machine.name}</Link> · {machine.location}
              </>
            ) : machines.status === 'loading' ? (
              '…'
            ) : (
              'Unknown machine'
            )}
          </dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>
            <time dateTime={report.createdAt}>{formatDateTime(report.createdAt)}</time>
          </dd>
        </div>
        {report.completedAt && (
          <div>
            <dt>{report.status === 'FAILED' ? 'Failed' : 'Completed'}</dt>
            <dd>
              <time dateTime={report.completedAt}>{formatDateTime(report.completedAt)}</time>
            </dd>
          </div>
        )}
      </dl>

      {notice}

      <div className="report-body">
        <ReportPhoto imageId={report.imageId} />

        <div className="report-text">
          <section>
            <h2>Description</h2>
            <p className="report-description">{report.description}</p>
          </section>

          <section className="report-ai">
            <h2>AI analysis</h2>
            {report.status === 'PENDING' && (
              <>
                <p>
                  The AI is looking at the photo and the machine's maintenance history. This page checks for the
                  result every {POLL_INTERVAL_MS / 1000} seconds.
                </p>
                <div className="progress" aria-hidden="true" />
              </>
            )}
            {report.status === 'FAILED' && (
              <p className="notice notice-error">
                The AI couldn't analyze this report.
                {report.error && (
                  <>
                    {' '}
                    <span className="report-error">{report.error}</span>
                  </>
                )}
              </p>
            )}
            {report.status === 'DONE' && report.aiReport && <AiResult result={report.aiReport} />}
          </section>
        </div>
      </div>

      <p className="report-back">
        <Link to="/reports">All reports</Link>
      </p>
    </article>
  )
}

function AiResult({ result }: { result: AiReportResult }) {
  return (
    <>
      <div className="report-severity">
        <span className="report-label">Severity</span>
        <SeverityBadge severity={result.severity} />
      </div>
      <p>{result.report}</p>

      <h3>Recommendations</h3>
      {result.recommendations.length > 0 ? (
        <ol className="recommendations">
          {result.recommendations.map((recommendation, index) => (
            <li key={index}>{recommendation}</li>
          ))}
        </ol>
      ) : (
        <p className="muted">None.</p>
      )}

      <dl className="facts">
        <div>
          <dt>Next service</dt>
          <dd>
            <time dateTime={result.nextServiceDate}>{formatDate(result.nextServiceDate)}</time>
          </dd>
        </div>
      </dl>
    </>
  )
}

/** `GET /images/{id}` needs the Bearer token, so the photo is downloaded and shown from a `blob:` URL. */
function ReportPhoto({ imageId }: { imageId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    getImage(imageId, { signal: controller.signal }).then(
      (blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      },
      () => {
        if (!controller.signal.aborted) setFailed(true)
      },
    )
    return () => {
      controller.abort()
      // Lets the browser free the photo once the page closes
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageId])

  return (
    <figure className="report-photo">
      {url ? (
        <img src={url} alt="The photo sent with the report" />
      ) : (
        <figcaption className="muted">{failed ? "Couldn't load the photo." : 'Loading the photo…'}</figcaption>
      )}
    </figure>
  )
}

/** Ends `text` with a full stop, so another sentence can follow it. Server messages often have none. */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`
}
