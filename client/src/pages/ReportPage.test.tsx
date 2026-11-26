import { act, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReport } from '../api/reports'
import { S2_URL } from '../config'
import { MACHINE_IDS, mockSettings } from '../mocks/db'
import { cors } from '../mocks/handlers'
import { server } from '../mocks/server'
import { renderApp, signInAs } from '../test/utils'
import { POLL_INTERVAL_MS } from './ReportPage'

// The seeded reports (src/mocks/db.ts): tech1's coolant pump failed, tech1's press leak is HIGH, and the
// smoking compressor is manager1's.
const FAILED_REPORT = '00000000-0000-4000-8000-000000000300'
const LEAK_REPORT = '00000000-0000-4000-8000-000000000302'
const MANAGERS_REPORT = '00000000-0000-4000-8000-000000000303'

const photo = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', { type: 'image/png' })

afterEach(() => {
  vi.useRealTimers()
  server.events.removeAllListeners()
})

/** Waits for the status tag to read `text`. Until the first answer, the status is "Loading the report…". */
async function expectStatus(text: 'Pending' | 'Done' | 'Failed') {
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(`Status: ${text}`))
}

describe('report page', () => {
  it('shows a finished report: photo, machine, severity, report and recommendations', async () => {
    signInAs('tech1')
    renderApp(`/reports/${LEAK_REPORT}`)

    await expectStatus('Done')
    expect(screen.getByRole('heading', { name: 'Report' })).toBeInTheDocument()
    expect(screen.getByText('Oil leak under the main cylinder again')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Hydraulic Press 02' })).toHaveAttribute(
      'href',
      `/machines/${MACHINE_IDS.hydraulicPress}`,
    )
    expect((await screen.findByRole('img', { name: 'The photo sent with the report' })).getAttribute('src')).toMatch(
      /^blob:/,
    )

    expect(screen.getByText('High')).toHaveAttribute('data-severity', 'HIGH')
    expect(screen.getByText(/Component failure likely soon/)).toBeInTheDocument()
    const recommendations = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(recommendations.map((item) => item.textContent)).toEqual([
      'Schedule repair within the week',
      'Check fluid levels and seals',
      'Reduce load until repaired',
    ])
    expect(screen.getByText('Next service')).toBeInTheDocument()
    expect(screen.queryByText(/checks for the result/)).not.toBeInTheDocument()
  })

  it('shows why the AI failed', async () => {
    signInAs('tech1')
    renderApp(`/reports/${FAILED_REPORT}`)

    await expectStatus('Failed')
    expect(screen.getByText(/The AI couldn't analyze this report/)).toHaveTextContent('Gemini request timed out after 30 s')
    expect(screen.queryByText('Recommendations')).not.toBeInTheDocument()
  })

  it('says a technician’s report is not found when it belongs to someone else', async () => {
    signInAs('tech1')
    renderApp(`/reports/${MANAGERS_REPORT}`)

    expect(await screen.findByRole('heading', { name: 'Report not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to reports' })).toHaveAttribute('href', '/reports')
  })

  it('shows managers anyone’s report', async () => {
    signInAs('manager1')
    renderApp(`/reports/${MANAGERS_REPORT}`)

    expect(await screen.findByText('Critical')).toHaveAttribute('data-severity', 'CRITICAL')
  })

  it('reads a pending report every 3 seconds until the AI result arrives, then stops', async () => {
    // Fake clocks drive both the page's timer and the mock AI, which finishes 4 s after the upload.
    // shouldAdvanceTime keeps them moving with real time, so the mock API's short response delay still passes.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true })
    mockSettings.processingMs = 4_000
    signInAs('tech1')
    const { reportId } = await createReport({
      image: photo(),
      machineId: MACHINE_IDS.conveyorBelt,
      description: 'Loud noise from the drive roller',
    })
    const reads: string[] = []
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'GET' && request.url === `${S2_URL}/reports/${reportId}`) reads.push(request.url)
    })

    renderApp(`/reports/${reportId}`)

    await expectStatus('Pending')
    expect(screen.getByText(/checks for the result every 3 seconds/)).toBeInTheDocument()
    expect(reads).toHaveLength(1)

    // 3 s after the upload: still working on it
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await waitFor(() => expect(reads).toHaveLength(2))
    await expectStatus('Pending')

    // 6 s: done, with the mock AI's verdict for "noise"
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    expect(await screen.findByText('Medium')).toHaveAttribute('data-severity', 'MEDIUM')
    await expectStatus('Done')
    expect(reads).toHaveLength(3)

    // Nothing more to wait for
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3))
    expect(reads).toHaveLength(3)
  })

  it('keeps the last copy and tries again when a read fails on the way', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true })
    mockSettings.processingMs = 4_000
    signInAs('tech1')
    const { reportId } = await createReport({ image: photo(), machineId: MACHINE_IDS.cncLathe, description: 'Smoke' })
    renderApp(`/reports/${reportId}`)
    await expectStatus('Pending')

    server.use(
      http.get(
        `${S2_URL}/reports/:id`,
        cors(() => HttpResponse.json({ message: 'S2 is restarting' }, { status: 503 })),
        { once: true },
      ),
    )
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    expect(await screen.findByRole('alert')).toHaveTextContent('S2 is restarting. Trying again in a few seconds.')
    expect(screen.getByText('Smoke')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    expect(await screen.findByText('Critical')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
