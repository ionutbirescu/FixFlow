// In-memory data behind the mock API. It starts as a copy of V2__seed.sql (same logins, machine IDs and
// history) plus a few reports, and lives until the page reloads. Tests call resetDb() between cases.
import type { MachineDto, MaintenanceEventDto, MaintenanceType, ReportDetailDto, UserDto } from '../api/types'
import { mockAi } from './ai'
import { placeholderImage } from './placeholder-image'

export interface MockUser extends UserDto {
  password: string
}

export interface MockImage {
  bytes: ArrayBuffer
  type: string
}

export interface MockDb {
  users: MockUser[]
  machines: MachineDto[]
  history: MaintenanceEventDto[]
  reports: ReportDetailDto[]
  images: Map<string, MockImage>
}

/** How long the fake AI takes before a new report turns DONE or FAILED. Tests set it to 0. */
export const mockSettings = { processingMs: 4000 }

export const USER_IDS = {
  tech1: '00000000-0000-4000-8000-000000000001',
  manager1: '00000000-0000-4000-8000-000000000002',
} as const

export const MACHINE_IDS = {
  cncLathe: '00000000-0000-4000-8000-000000000101',
  hydraulicPress: '00000000-0000-4000-8000-000000000102',
  conveyorBelt: '00000000-0000-4000-8000-000000000103',
  airCompressor: '00000000-0000-4000-8000-000000000104',
  weldingRobot: '00000000-0000-4000-8000-000000000105',
} as const

let db = seed()

export function getDb(): MockDb {
  return db
}

export function resetDb(): void {
  db = seed()
}

/** Finishes a PENDING report once its processing time has passed, like S2 calling S1's webhook. */
export function settle(report: ReportDetailDto, now = Date.now()): ReportDetailDto {
  if (report.status !== 'PENDING') return report
  const doneAt = Date.parse(report.createdAt) + mockSettings.processingMs
  if (now < doneAt) return report
  const finishedAt = new Date(doneAt)
  const outcome = mockAi(report.description, report.imageId, finishedAt)
  report.status = outcome.status
  report.completedAt = finishedAt.toISOString()
  if (outcome.status === 'DONE') report.aiReport = outcome.aiReport
  else report.error = outcome.error
  return report
}

function seed(): MockDb {
  const now = Date.now()
  const { tech1, manager1 } = USER_IDS
  const { cncLathe, hydraulicPress, conveyorBelt, airCompressor, weldingRobot } = MACHINE_IDS

  const users: MockUser[] = [
    { id: tech1, username: 'tech1', role: 'TECHNICIAN', password: 'fixflow' },
    { id: manager1, username: 'manager1', role: 'MANAGER', password: 'fixflow' },
  ]

  const machines: MachineDto[] = [
    { id: cncLathe, name: 'CNC Lathe 01', model: 'Haas ST-10', location: 'Hall A', installedAt: '2021-03-10', serviceIntervalDays: 90 },
    { id: hydraulicPress, name: 'Hydraulic Press 02', model: 'HPX-250', location: 'Hall A', installedAt: '2019-09-02', serviceIntervalDays: 60 },
    { id: conveyorBelt, name: 'Conveyor Belt 03', model: 'Dorner 3200', location: 'Hall B', installedAt: '2022-06-15', serviceIntervalDays: 30 },
    { id: airCompressor, name: 'Air Compressor 04', model: 'Atlas Copco GA 30', location: 'Compressor room', installedAt: '2020-01-20', serviceIntervalDays: 180 },
    { id: weldingRobot, name: 'Welding Robot 05', model: 'KUKA KR 16', location: 'Hall B', installedAt: '2024-05-20', serviceIntervalDays: 365 },
  ]

  // [machine, days ago (at 09:00 UTC), type, description, performed by], as in V2__seed.sql
  const log: [string, number, MaintenanceType, string, string][] = [
    [cncLathe, 425, 'PREVENTIVE', 'Quarterly service: way lube and coolant changed, chip conveyor cleaned', 'tech1'],
    [cncLathe, 335, 'PREVENTIVE', 'Quarterly service: way lube and coolant changed', 'tech1'],
    [cncLathe, 290, 'CORRECTIVE', 'Replaced the spindle belt after it slipped under heavy cuts', 'tech1'],
    [cncLathe, 245, 'PREVENTIVE', 'Quarterly service: way lube and coolant changed', 'tech1'],
    [cncLathe, 155, 'PREVENTIVE', 'Quarterly service; spindle runout 0.004 mm, within tolerance', 'tech1'],
    [cncLathe, 65, 'PREVENTIVE', 'Quarterly service: way lube and coolant changed, chuck jaws greased', 'tech1'],
    [hydraulicPress, 310, 'PREVENTIVE', 'Hydraulic oil and return filter changed', 'tech1'],
    [hydraulicPress, 250, 'PREVENTIVE', 'Accumulator pre-charge checked, oil topped up', 'tech1'],
    [hydraulicPress, 195, 'CORRECTIVE', 'Replaced the main cylinder seal after an oil leak', 'HydroServ Ltd'],
    [hydraulicPress, 130, 'PREVENTIVE', 'Hydraulic oil and return filter changed', 'tech1'],
    [hydraulicPress, 40, 'INSPECTION', 'Slight oil seepage at the main cylinder seal again; keep an eye on it', 'tech1'],
    [conveyorBelt, 118, 'PREVENTIVE', 'Belt tension and tracking adjusted, rollers cleaned', 'tech1'],
    [conveyorBelt, 88, 'PREVENTIVE', 'Belt tension and tracking adjusted', 'tech1'],
    [conveyorBelt, 74, 'CORRECTIVE', 'Replaced a worn drive roller bearing that was making noise', 'tech1'],
    [conveyorBelt, 58, 'PREVENTIVE', 'Belt tension and tracking adjusted', 'tech1'],
    [conveyorBelt, 27, 'PREVENTIVE', 'Belt tension adjusted; slight wear on the belt edge', 'tech1'],
    [airCompressor, 540, 'PREVENTIVE', 'Air and oil filters replaced, oil changed', 'Atlas Copco service'],
    [airCompressor, 360, 'PREVENTIVE', 'Air and oil filters replaced, oil changed', 'Atlas Copco service'],
    [airCompressor, 230, 'INSPECTION', 'Condensate drains and safety valve checked, no leaks', 'tech1'],
    [airCompressor, 172, 'PREVENTIVE', 'Oil separator replaced, air and oil filters replaced, oil changed', 'Atlas Copco service'],
    [weldingRobot, 330, 'PREVENTIVE', 'Annual service: gearbox oil changed, cable harness checked', 'KUKA service'],
    [weldingRobot, 140, 'CORRECTIVE', 'Recalibrated axis 4 after a collision with a fixture', 'tech1'],
    [weldingRobot, 30, 'INSPECTION', 'Monthly check of the torch, cables and cell guards', 'tech1'],
  ]
  const history = log.map(([machineId, daysAgo, type, description, performedBy], index) => ({
    id: seedId(200 + index),
    machineId,
    performedAt: atNineUtc(now, daysAgo),
    type,
    description,
    performedBy,
  }))

  // [reporter, machine, description, minutes ago]. The last one is still PENDING when the page loads.
  const reportSeed: [string, string, string, number][] = [
    [tech1, cncLathe, 'Coolant pump does not start', 9 * 24 * 60],
    [tech1, conveyorBelt, 'Loud noise and vibration from the drive roller', 6 * 24 * 60],
    [tech1, hydraulicPress, 'Oil leak under the main cylinder again', 2 * 24 * 60],
    [manager1, airCompressor, 'Burning smell and smoke from the motor housing', 26 * 60],
    [tech1, weldingRobot, 'Torch cable insulation looks worn near the wrist', 0],
  ]
  const images = new Map<string, MockImage>()
  const reports = reportSeed.map(([userId, machineId, description, minutesAgo], index): ReportDetailDto => {
    const imageId = seedId(400 + index)
    images.set(imageId, placeholderImage())
    return {
      id: seedId(300 + index),
      machineId,
      userId,
      imageId,
      description,
      status: 'PENDING',
      createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
      completedAt: null,
      error: null,
      aiReport: null,
    }
  })
  reports.slice(0, -1).forEach((report) => settle(report, now))
  // A failure from the real pipeline, not the #fail trigger
  Object.assign(reports[0], { status: 'FAILED', aiReport: null, error: 'Gemini request timed out after 30 s' })

  return { users, machines, history, reports, images }
}

function seedId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function atNineUtc(now: number, daysAgo: number): string {
  const day = new Date(now)
  day.setUTCDate(day.getUTCDate() - daysAgo)
  day.setUTCHours(9, 0, 0, 0)
  return day.toISOString()
}
