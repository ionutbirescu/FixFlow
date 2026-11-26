import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES } from '../api/types'
import { S1_URL, S2_URL } from '../config'
import { getDb, MACHINE_IDS, USER_IDS } from '../mocks/db'
import { cors } from '../mocks/handlers'
import { server } from '../mocks/server'
import { renderApp, signInAs } from '../test/utils'

const photo = (name = 'leak.png', type = 'image/png', size = 2048) => new File([new Uint8Array(size)], name, { type })

async function openForm() {
  signInAs('tech1')
  const app = renderApp('/reports/new')
  expect(await screen.findByRole('heading', { name: 'New report' })).toBeInTheDocument()
  // The machines have loaded once the dropdown is enabled
  expect(await screen.findByRole('option', { name: 'Hydraulic Press 02 · Hall A' })).toBeInTheDocument()
  return app
}

describe('new report page', () => {
  it('lists every machine in the dropdown, by name', async () => {
    await openForm()

    const machine = screen.getByRole('combobox', { name: 'Machine' })
    expect(machine).toBeEnabled()
    const names = within(machine)
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(names).toEqual([
      'Choose a machine',
      'Air Compressor 04 · Compressor room',
      'CNC Lathe 01 · Hall A',
      'Conveyor Belt 03 · Hall B',
      'Hydraulic Press 02 · Hall A',
      'Welding Robot 05 · Hall B',
    ])
  })

  it('previews the picked photo and can remove it', async () => {
    const { user } = await openForm()

    await user.upload(screen.getByLabelText('Photo'), photo('leak.png', 'image/png', 3 * 1024 * 1024))

    const preview = screen.getByRole('img', { name: 'Preview of leak.png' })
    expect(preview.getAttribute('src')).toMatch(/^blob:/)
    expect(screen.getByText('leak.png · 3 MB')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect((screen.getByLabelText('Photo') as HTMLInputElement).files).toHaveLength(0)
  })

  it('refuses a file that is not a JPG or PNG before uploading it', async () => {
    await openForm()
    // The file dialog only offers JPG and PNG, but anyone can switch it to "All files"
    const user = userEvent.setup({ applyAccept: false })

    await user.upload(screen.getByLabelText('Photo'), photo('scan.gif', 'image/gif'))

    expect(screen.getByRole('alert')).toHaveTextContent("scan.gif isn't a JPG or PNG")
    expect(screen.getByLabelText('Photo')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Photo')).toHaveAccessibleDescription(/isn't a JPG or PNG/)
    expect((screen.getByLabelText('Photo') as HTMLInputElement).files).toHaveLength(0)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('refuses a photo over 10 MB before uploading it', async () => {
    const { user } = await openForm()

    await user.upload(screen.getByLabelText('Photo'), photo('huge.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1))

    expect(screen.getByRole('alert')).toHaveTextContent('huge.jpg is 10.1 MB. Choose a photo of 10 MB or less.')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    // A photo of exactly 10 MB is fine
    await user.upload(screen.getByLabelText('Photo'), photo('ok.jpg', 'image/jpeg', MAX_IMAGE_BYTES))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Preview of ok.jpg' })).toBeInTheDocument()
  })

  it('asks for a photo when sent without one', async () => {
    const { router, user } = await openForm()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Machine' }), 'CNC Lathe 01 · Hall A')
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Coolant pump does not start')
    await user.click(screen.getByRole('button', { name: 'Send report' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a photo of the fault.')
    expect(getDb().reports).toHaveLength(5)
    expect(router.state.location.pathname).toBe('/reports/new')
  })

  it('uploads the report and opens its page', async () => {
    const { router, user } = await openForm()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Machine' }), 'Hydraulic Press 02 · Hall A')
    await user.upload(screen.getByLabelText('Photo'), photo())
    await user.type(screen.getByRole('textbox', { name: 'Description' }), '  Oil leak under the main cylinder  ')
    await user.click(screen.getByRole('button', { name: 'Send report' }))

    expect(await screen.findByRole('heading', { name: 'Report' })).toBeInTheDocument()
    const report = getDb().reports.at(-1)!
    expect(report).toMatchObject({
      machineId: MACHINE_IDS.hydraulicPress,
      userId: USER_IDS.tech1,
      description: 'Oil leak under the main cylinder',
    })
    expect(router.state.location.pathname).toBe(`/reports/${report.id}`)
  })

  it('shows the server’s answer when the upload fails, and lets the user send again', async () => {
    server.use(
      http.post(
        `${S1_URL}/reports`,
        cors(() => HttpResponse.json({ message: 'Maximum upload size exceeded' }, { status: 413 })),
      ),
    )
    const { router, user } = await openForm()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Machine' }), 'CNC Lathe 01 · Hall A')
    await user.upload(screen.getByLabelText('Photo'), photo())
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Coolant leak')
    await user.click(screen.getByRole('button', { name: 'Send report' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The photo is larger than 10 MB. Choose a smaller one.')
    expect(screen.getByRole('button', { name: 'Send report' })).toBeEnabled()
    expect(router.state.location.pathname).toBe('/reports/new')
  })

  it('offers to try again when the machines don’t load', async () => {
    let calls = 0
    server.use(
      http.get(
        `${S2_URL}/machines`,
        cors(() => (++calls === 1 ? HttpResponse.json({ message: 'Database unavailable' }, { status: 503 }) : undefined)),
      ),
    )
    signInAs('tech1')
    const { user } = renderApp('/reports/new')

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable')
    expect(screen.getByRole('combobox', { name: 'Machine' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('option', { name: 'CNC Lathe 01 · Hall A' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Machine' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
