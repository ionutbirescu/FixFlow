import { type RequestOptions, s1, s2 } from './http'
import type {
  CreateReportInput,
  CreateReportResponse,
  ListReportsQuery,
  ReportDetailDto,
  ReportSummaryPage,
} from './types'

/**
 * `POST /reports` (S1, multipart). Answers 202 with the new report's ID; poll `getReport` until it is
 * `DONE` or `FAILED`. 413: image over 10 MB. 415: not a JPG or PNG.
 */
export async function createReport({ image, machineId, description }: CreateReportInput): Promise<CreateReportResponse> {
  const form = new FormData()
  form.append('image', image)
  form.append('machineId', machineId)
  form.append('description', description)
  const { data } = await s1.post<CreateReportResponse>('/reports', form)
  return data
}

/** `GET /reports` (S2), newest first. Technicians only get their own reports. */
export async function listReports(query: ListReportsQuery = {}, { signal }: RequestOptions = {}): Promise<ReportSummaryPage> {
  const { data } = await s2.get<ReportSummaryPage>('/reports', { params: query, signal })
  return data
}

/** `GET /reports/{id}` (S2). 404 also when a technician asks for someone else's report. */
export async function getReport(id: string, { signal }: RequestOptions = {}): Promise<ReportDetailDto> {
  const { data } = await s2.get<ReportDetailDto>(`/reports/${encodeURIComponent(id)}`, { signal })
  return data
}
