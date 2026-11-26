// Readable names for the schemas in openapi.yaml. schema.gen.ts is generated from the spec by
// `npm run gen:api`; never edit it by hand. CI fails when it is out of date.
import type { components, operations } from './schema.gen'

type Schemas = components['schemas']

export type Role = Schemas['Role']
export type ReportStatus = Schemas['ReportStatus']
export type Severity = Schemas['Severity']
export type MaintenanceType = Schemas['MaintenanceType']

export type LoginRequest = Schemas['LoginRequest']
export type LoginResponse = Schemas['LoginResponse']
export type CreateUserRequest = Schemas['CreateUserRequest']
export type UserDto = Schemas['UserDto']

export type CreateReportResponse = Schemas['CreateReportResponse']
export type ReportSummaryDto = Schemas['ReportSummaryDto']
export type ReportSummaryPage = Schemas['ReportSummaryPage']
export type ReportDetailDto = Schemas['ReportDetailDto']
export type AiReportResult = Schemas['AiReportResult']

export type MachineRequest = Schemas['MachineRequest']
export type MachineDto = Schemas['MachineDto']
export type MaintenanceEventDto = Schemas['MaintenanceEventDto']

export type ErrorResponse = Schemas['ErrorResponse']

/** Query parameters of `GET /reports`, straight from the spec. */
export type ListReportsQuery = NonNullable<operations['listReports']['parameters']['query']>

/** Form fields of `POST /reports`. The spec types `image` as a string (binary); in the browser it is a File. */
export interface CreateReportInput {
  image: File
  machineId: string
  description: string
}

export const ROLES = ['TECHNICIAN', 'MANAGER'] as const satisfies readonly Role[]
export const REPORT_STATUSES = ['PENDING', 'DONE', 'FAILED'] as const satisfies readonly ReportStatus[]
/** From least to most urgent */
export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const satisfies readonly Severity[]

/** What `POST /reports` accepts as `image`: a JPG or PNG (else 415) of at most 10 MB (else 413). */
export const IMAGE_TYPES = ['image/jpeg', 'image/png'] as const
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
