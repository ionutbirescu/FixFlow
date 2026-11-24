import { type RequestOptions, s1, s2 } from './http'
import type { MachineDto, MachineRequest, MaintenanceEventDto } from './types'

/** `GET /machines` (S2), sorted by name. */
export async function listMachines({ signal }: RequestOptions = {}): Promise<MachineDto[]> {
  const { data } = await s2.get<MachineDto[]>('/machines', { signal })
  return data
}

/** `GET /machines/{id}/history` (S2): the maintenance log, newest first. */
export async function getMachineHistory(id: string, { signal }: RequestOptions = {}): Promise<MaintenanceEventDto[]> {
  const { data } = await s2.get<MaintenanceEventDto[]>(`/machines/${encodeURIComponent(id)}/history`, { signal })
  return data
}

/** `POST /machines` (S1, MANAGER only). */
export async function createMachine(machine: MachineRequest): Promise<MachineDto> {
  const { data } = await s1.post<MachineDto>('/machines', machine)
  return data
}

/** `PUT /machines/{id}` (S1, MANAGER only). */
export async function updateMachine(id: string, machine: MachineRequest): Promise<MachineDto> {
  const { data } = await s1.put<MachineDto>(`/machines/${encodeURIComponent(id)}`, machine)
  return data
}

/** `DELETE /machines/{id}` (S1, MANAGER only). 409: the machine still has reports. */
export async function deleteMachine(id: string): Promise<void> {
  await s1.delete(`/machines/${encodeURIComponent(id)}`)
}
