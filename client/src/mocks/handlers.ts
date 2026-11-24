// MSW handlers for every S1 and S2 endpoint the browser calls (all of openapi.yaml except the internal
// webhook). They follow the spec's rules: a valid Bearer token on everything but login, MANAGER-only
// writes, technicians seeing only their own reports and images, and ErrorResponse bodies on every error.
import { type DefaultBodyType, delay, http, HttpResponse, type HttpResponseResolver, type PathParams } from 'msw'
import {
  type CreateReportResponse,
  type CreateUserRequest,
  type ErrorResponse,
  type LoginRequest,
  type LoginResponse,
  type MachineDto,
  type MachineRequest,
  type MaintenanceEventDto,
  REPORT_STATUSES,
  type ReportDetailDto,
  type ReportStatus,
  type ReportSummaryDto,
  type ReportSummaryPage,
  type Role,
  ROLES,
  type UserDto,
} from '../api/types'
import { S1_URL, S2_URL } from '../config'
import { getDb, type MockUser, settle } from './db'
import { createMockToken, readMockToken } from './jwt'
import { readMultipart } from './multipart'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

type IdParams = { id: string }

// The client (port 3000) calls S1 and S2 on other ports, so they must answer with CORS headers, including the
// preflight for the Authorization header. The mocks do the same: jsdom checks CORS in the tests, like a browser.
// (In the browser, the service worker answers before CORS applies.)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

export const handlers = [
  ...[S1_URL, S2_URL].map((base) =>
    http.options(`${base}/*`, () => new HttpResponse(null, { status: 204, headers: CORS_HEADERS })),
  ),

  // ---- S1: auth ----

  http.post<never, LoginRequest, LoginResponse>(`${S1_URL}/auth/login`, cors(async ({ request }) => {
    await delay()
    const body = await readJson(request)
    const username = text(body.username)
    const password = secret(body.password)
    if (!username || !password) fail(request, 400, 'username and password are required')
    const user = getDb().users.find((candidate) => candidate.username === username && candidate.password === password)
    if (!user) fail(request, 401, 'Wrong username or password')
    return HttpResponse.json({ token: createMockToken(user), role: user.role })
  })),

  http.post<never, CreateUserRequest, UserDto>(`${S1_URL}/auth/users`, cors(async ({ request }) => {
    await delay()
    requireManager(request)
    const body = await readJson(request)
    const username = text(body.username)
    const password = secret(body.password)
    const role = body.role
    if (!username || !password || !isRole(role)) {
      fail(request, 400, 'username, password and role (TECHNICIAN or MANAGER) are required')
    }
    const { users } = getDb()
    if (users.some((user) => user.username === username)) fail(request, 409, `Username ${username} is already taken`)
    const user: MockUser = { id: crypto.randomUUID(), username, password, role }
    users.push(user)
    return HttpResponse.json({ id: user.id, username, role }, { status: 201 })
  })),

  // ---- Reports: upload on S1, reads on S2 ----

  http.post<never, never, CreateReportResponse>(`${S1_URL}/reports`, cors(async ({ request }) => {
    await delay()
    const user = authenticate(request)
    const form = await readMultipart(request)
    if (!form) fail(request, 400, 'Expected a multipart/form-data body')
    const image = form.get('image')
    const machineId = form.get('machineId')
    const description = form.get('description')
    const db = getDb()
    if (image === undefined || typeof image === 'string') fail(request, 400, 'image is required')
    if (typeof description !== 'string' || description.trim() === '') fail(request, 400, 'description is required')
    if (typeof machineId !== 'string' || !db.machines.some((machine) => machine.id === machineId)) {
      fail(request, 400, 'machineId must be the ID of an existing machine')
    }
    if (image.type !== 'image/jpeg' && image.type !== 'image/png') fail(request, 415, 'The image must be a JPG or PNG')
    if (image.bytes.byteLength > MAX_IMAGE_BYTES) fail(request, 413, 'The image is larger than 10 MB')

    const imageId = crypto.randomUUID()
    db.images.set(imageId, { bytes: image.bytes, type: image.type })
    const report: ReportDetailDto = {
      id: crypto.randomUUID(),
      machineId,
      userId: user.id,
      imageId,
      description: description.trim(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      aiReport: null,
    }
    db.reports.push(report)
    return HttpResponse.json({ reportId: report.id }, { status: 202 })
  })),

  http.get<never, never, ReportSummaryPage>(`${S2_URL}/reports`, cors(async ({ request }) => {
    await delay()
    const user = authenticate(request)
    const query = new URL(request.url).searchParams
    const status = query.get('status')
    const machineId = query.get('machineId')
    const from = instantParam(request, query, 'from')
    const to = instantParam(request, query, 'to')
    const page = intParam(request, query, 'page', 0)
    const size = intParam(request, query, 'size', 20)
    if (status !== null && !REPORT_STATUSES.includes(status as ReportStatus)) {
      fail(request, 400, `status must be one of ${REPORT_STATUSES.join(', ')}`)
    }
    if (page < 0) fail(request, 400, 'page must be 0 or more')
    if (size < 1 || size > 100) fail(request, 400, 'size must be between 1 and 100')

    const matching = getDb()
      .reports.filter((report) => canSee(user, report))
      .map((report) => settle(report))
      .filter((report) => {
        const created = Date.parse(report.createdAt)
        return (
          (status === null || report.status === status) &&
          (machineId === null || report.machineId === machineId) &&
          (from === null || created >= from) &&
          (to === null || created < to)
        )
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

    return HttpResponse.json({
      content: matching.slice(page * size, (page + 1) * size).map(toSummary),
      page,
      size,
      totalElements: matching.length,
      totalPages: Math.ceil(matching.length / size),
    })
  })),

  http.get<IdParams, never, ReportDetailDto>(`${S2_URL}/reports/:id`, cors(async ({ request, params }) => {
    await delay()
    const user = authenticate(request)
    const report = getDb().reports.find((candidate) => candidate.id === params.id && canSee(user, candidate))
    if (!report) fail(request, 404, `Report ${params.id} not found`)
    return HttpResponse.json(settle(report))
  })),

  http.get<IdParams>(`${S2_URL}/images/:id`, cors(async ({ request, params }) => {
    await delay()
    const user = authenticate(request)
    const { images, reports } = getDb()
    const image = images.get(params.id)
    const report = reports.find((candidate) => candidate.imageId === params.id)
    if (!image || !report || !canSee(user, report)) fail(request, 404, `Image ${params.id} not found`)
    return new HttpResponse(image.bytes.slice(0), { headers: { 'Content-Type': image.type } })
  })),

  // ---- Machines: writes on S1, reads on S2 ----

  http.get<never, never, MachineDto[]>(`${S2_URL}/machines`, cors(async ({ request }) => {
    await delay()
    authenticate(request)
    return HttpResponse.json([...getDb().machines].sort((a, b) => a.name.localeCompare(b.name)))
  })),

  http.get<IdParams, never, MaintenanceEventDto[]>(`${S2_URL}/machines/:id/history`, cors(async ({ request, params }) => {
    await delay()
    authenticate(request)
    const { machines, history } = getDb()
    if (!machines.some((machine) => machine.id === params.id)) fail(request, 404, `Machine ${params.id} not found`)
    return HttpResponse.json(
      history
        .filter((event) => event.machineId === params.id)
        .sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt)),
    )
  })),

  http.post<never, MachineRequest, MachineDto>(`${S1_URL}/machines`, cors(async ({ request }) => {
    await delay()
    requireManager(request)
    const machine: MachineDto = { id: crypto.randomUUID(), ...(await readMachine(request)) }
    getDb().machines.push(machine)
    return HttpResponse.json(machine, { status: 201 })
  })),

  http.put<IdParams, MachineRequest, MachineDto>(`${S1_URL}/machines/:id`, cors(async ({ request, params }) => {
    await delay()
    requireManager(request)
    const fields = await readMachine(request)
    const { machines } = getDb()
    const index = machines.findIndex((machine) => machine.id === params.id)
    if (index === -1) fail(request, 404, `Machine ${params.id} not found`)
    machines[index] = { id: params.id, ...fields }
    return HttpResponse.json(machines[index])
  })),

  http.delete<IdParams>(`${S1_URL}/machines/:id`, cors(async ({ request, params }) => {
    await delay()
    requireManager(request)
    const db = getDb()
    const machine = db.machines.find((candidate) => candidate.id === params.id)
    if (!machine) fail(request, 404, `Machine ${params.id} not found`)
    if (db.reports.some((report) => report.machineId === params.id)) {
      fail(request, 409, `${machine.name} still has reports and can't be deleted`)
    }
    db.machines = db.machines.filter((candidate) => candidate.id !== params.id)
    db.history = db.history.filter((event) => event.machineId !== params.id)
    return new HttpResponse(null, { status: 204 })
  })),
]

// ---- Helpers ----

const REASONS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
}

/**
 * Adds the CORS headers to whatever the resolver answers, including the errors it throws with `fail()`.
 * Wrap test overrides in it too: `server.use(http.get(url, cors(() => ...)))`.
 */
export function cors<Params extends PathParams<keyof Params>, RequestBody extends DefaultBodyType, ResponseBody extends DefaultBodyType>(
  resolver: HttpResponseResolver<Params, RequestBody, ResponseBody>,
): HttpResponseResolver<Params, RequestBody, ResponseBody> {
  const withHeaders = <T,>(result: T): T => {
    if (result instanceof Response) {
      for (const [name, value] of Object.entries(CORS_HEADERS)) result.headers.set(name, value)
    }
    return result
  }
  return async (info) => {
    try {
      return withHeaders(await resolver(info))
    } catch (thrown) {
      throw withHeaders(thrown)
    }
  }
}

/** Ends the handler with an ErrorResponse. MSW sends a thrown Response as the mocked response. */
function fail(request: Request, status: number, message: string): never {
  const body: ErrorResponse = {
    timestamp: new Date().toISOString(),
    status,
    error: REASONS[status] ?? 'Error',
    message,
    path: new URL(request.url).pathname,
  }
  throw HttpResponse.json(body, { status })
}

/** The user behind the request's Bearer token. Fails with 401 when it is missing, malformed or expired. */
function authenticate(request: Request): MockUser {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) fail(request, 401, 'Missing Bearer token')
  const claims = readMockToken(header.slice('Bearer '.length))
  const user = claims && getDb().users.find((candidate) => candidate.id === claims.uid)
  if (!user) fail(request, 401, 'Invalid or expired token')
  return user
}

function requireManager(request: Request): MockUser {
  const user = authenticate(request)
  if (user.role !== 'MANAGER') fail(request, 403, 'Only managers can do this')
  return user
}

function canSee(user: MockUser, report: ReportDetailDto): boolean {
  return user.role === 'MANAGER' || report.userId === user.id
}

function toSummary(report: ReportDetailDto): ReportSummaryDto {
  const { id, machineId, userId, description, status, createdAt, completedAt, aiReport } = report
  return { id, machineId, userId, description, status, severity: aiReport?.severity ?? null, createdAt, completedAt }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

async function readMachine(request: Request): Promise<MachineRequest> {
  const body = await readJson(request)
  const name = text(body.name)
  const model = text(body.model)
  const location = text(body.location)
  const installedAt = body.installedAt
  const serviceIntervalDays = body.serviceIntervalDays
  if (!name || !model || !location) fail(request, 400, 'name, model and location are required')
  if (typeof installedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(installedAt) || Number.isNaN(Date.parse(installedAt))) {
    fail(request, 400, 'installedAt must be a date like 2021-03-10')
  }
  if (typeof serviceIntervalDays !== 'number' || !Number.isInteger(serviceIntervalDays) || serviceIntervalDays < 1) {
    fail(request, 400, 'serviceIntervalDays must be a whole number of at least 1')
  }
  return { name, model, location, installedAt, serviceIntervalDays }
}

/** A trimmed non-empty string, or `null` */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** A non-empty string kept exactly as sent (passwords), or `null` */
function secret(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role)
}

function intParam(request: Request, query: URLSearchParams, name: string, fallback: number): number {
  const raw = query.get(name)
  if (raw === null) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value)) fail(request, 400, `${name} must be a whole number`)
  return value
}

function instantParam(request: Request, query: URLSearchParams, name: string): number | null {
  const raw = query.get(name)
  if (raw === null) return null
  const value = Date.parse(raw)
  if (Number.isNaN(value)) fail(request, 400, `${name} must be an ISO-8601 instant like 2026-11-01T00:00:00Z`)
  return value
}
