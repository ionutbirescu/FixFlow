// The typed API clients against the mock API. These pin down the behavior the pages rely on, and that
// S1 and S2 must match: who sees what, which role may write, and the report lifecycle.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUser, login } from '../api/auth'
import { getImage } from '../api/images'
import { createMachine, deleteMachine, getMachineHistory, listMachines, updateMachine } from '../api/machines'
import { createReport, getReport, listReports } from '../api/reports'
import type { MachineRequest } from '../api/types'
import { signInAs } from '../test/utils'
import { MACHINE_IDS, mockSettings, USER_IDS } from './db'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
const photo = (type = 'image/png', bytes: BlobPart = PNG) => new File([bytes], 'photo', { type })
const newMachine: MachineRequest = {
  name: 'Lathe 06',
  model: 'Haas ST-20',
  location: 'Hall C',
  installedAt: '2025-01-15',
  serviceIntervalDays: 90,
}

afterEach(() => {
  vi.useRealTimers()
})

describe('mock API: auth', () => {
  it('logs in with the seeded accounts', async () => {
    await expect(login({ username: 'manager1', password: 'fixflow' })).resolves.toMatchObject({ role: 'MANAGER' })
  })

  it('answers 401 with an ErrorResponse for a wrong password', async () => {
    await expect(login({ username: 'tech1', password: 'nope' })).rejects.toMatchObject({
      response: { status: 401, data: { status: 401, error: 'Unauthorized', path: '/auth/login' } },
    })
  })

  it('answers 401 to calls without a token', async () => {
    await expect(listMachines()).rejects.toMatchObject({ response: { status: 401 } })
  })

  it('lets only managers create users, with unique usernames', async () => {
    signInAs('tech1')
    await expect(createUser({ username: 'tech2', password: 'x', role: 'TECHNICIAN' })).rejects.toMatchObject({
      response: { status: 403 },
    })

    signInAs('manager1')
    await expect(createUser({ username: 'tech2', password: 'x', role: 'TECHNICIAN' })).resolves.toMatchObject({
      username: 'tech2',
      role: 'TECHNICIAN',
    })
    await expect(createUser({ username: 'tech1', password: 'x', role: 'TECHNICIAN' })).rejects.toMatchObject({
      response: { status: 409 },
    })
  })
})

describe('mock API: reports', () => {
  it('shows technicians only their own reports and managers everyone’s, newest first', async () => {
    signInAs('tech1')
    const mine = await listReports()
    expect(mine.totalElements).toBe(4)
    expect(mine.content.every((report) => report.userId === USER_IDS.tech1)).toBe(true)

    signInAs('manager1')
    const all = await listReports()
    expect(all.totalElements).toBe(5)
    const created = all.content.map((report) => Date.parse(report.createdAt))
    expect(created).toEqual([...created].sort((a, b) => b - a))
  })

  it('filters and pages the list', async () => {
    signInAs('manager1')
    expect((await listReports({ status: 'FAILED' })).content).toHaveLength(1)
    expect((await listReports({ machineId: MACHINE_IDS.airCompressor })).content[0].severity).toBe('CRITICAL')

    const page = await listReports({ page: 1, size: 2 })
    expect(page).toMatchObject({ page: 1, size: 2, totalElements: 5, totalPages: 3 })
    expect(page.content).toHaveLength(2)

    await expect(listReports({ size: 101 })).rejects.toMatchObject({ response: { status: 400 } })
  })

  it('answers 404 when a technician asks for someone else’s report or image', async () => {
    signInAs('manager1')
    const managers = (await listReports()).content.find((report) => report.userId === USER_IDS.manager1)!
    const { imageId } = await getReport(managers.id)

    signInAs('tech1')
    await expect(getReport(managers.id)).rejects.toMatchObject({ response: { status: 404 } })
    await expect(getImage(imageId)).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('takes an upload as PENDING and finishes it like the backend’s mock AI', async () => {
    mockSettings.processingMs = 5_000
    vi.useFakeTimers({ toFake: ['Date'] })
    signInAs('tech1')

    const { reportId } = await createReport({
      image: photo(),
      machineId: MACHINE_IDS.hydraulicPress,
      description: 'Oil leak at the main seal',
    })
    expect(await getReport(reportId)).toMatchObject({ status: 'PENDING', aiReport: null, completedAt: null })

    vi.setSystemTime(Date.now() + 5_000)
    const done = await getReport(reportId)
    expect(done).toMatchObject({ status: 'DONE', error: null, aiReport: { severity: 'HIGH', id_image: done.imageId } })
    expect(done.completedAt).not.toBeNull()
  })

  it('fails a report whose description contains #fail', async () => {
    signInAs('tech1')
    const { reportId } = await createReport({ image: photo(), machineId: MACHINE_IDS.cncLathe, description: 'Test #fail' })
    expect(await getReport(reportId)).toMatchObject({ status: 'FAILED', aiReport: null, error: expect.stringContaining('#fail') })
  })

  it('serves the uploaded image back', async () => {
    signInAs('tech1')
    const { reportId } = await createReport({ image: photo(), machineId: MACHINE_IDS.cncLathe, description: 'Loose cover' })
    const { imageId } = await getReport(reportId)

    const blob = await getImage(imageId)

    expect(blob.type).toBe('image/png')
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(PNG)
  })

  it('rejects uploads that are not JPG or PNG, or over 10 MB', async () => {
    signInAs('tech1')
    const upload = (image: File) => createReport({ image, machineId: MACHINE_IDS.cncLathe, description: 'Noise' })

    await expect(upload(photo('image/gif'))).rejects.toMatchObject({ response: { status: 415 } })
    await expect(upload(photo('image/jpeg', new Uint8Array(10 * 1024 * 1024 + 1)))).rejects.toMatchObject({
      response: { status: 413 },
    })
  })
})

describe('mock API: machines', () => {
  it('lists machines by name and their history newest first', async () => {
    signInAs('tech1')
    const machines = await listMachines()
    expect(machines.map((machine) => machine.name)).toEqual([
      'Air Compressor 04',
      'CNC Lathe 01',
      'Conveyor Belt 03',
      'Hydraulic Press 02',
      'Welding Robot 05',
    ])

    const history = await getMachineHistory(MACHINE_IDS.hydraulicPress)
    expect(history).toHaveLength(5)
    expect(history[0]).toMatchObject({ type: 'INSPECTION', performedBy: 'tech1' })

    await expect(getMachineHistory('00000000-0000-4000-8000-000000000999')).rejects.toMatchObject({
      response: { status: 404 },
    })
  })

  it('lets only managers add, edit and delete machines', async () => {
    signInAs('tech1')
    await expect(createMachine(newMachine)).rejects.toMatchObject({ response: { status: 403 } })

    signInAs('manager1')
    const created = await createMachine(newMachine)
    expect(created).toMatchObject(newMachine)
    expect(await updateMachine(created.id, { ...newMachine, location: 'Hall D' })).toMatchObject({ location: 'Hall D' })
    await expect(createMachine({ ...newMachine, serviceIntervalDays: 0 })).rejects.toMatchObject({
      response: { status: 400 },
    })

    await deleteMachine(created.id)
    expect((await listMachines()).some((machine) => machine.id === created.id)).toBe(false)
  })

  it('refuses to delete a machine that still has reports', async () => {
    signInAs('manager1')
    await expect(deleteMachine(MACHINE_IDS.hydraulicPress)).rejects.toMatchObject({
      response: { status: 409, data: { message: expect.stringContaining('Hydraulic Press 02') } },
    })
  })
})
