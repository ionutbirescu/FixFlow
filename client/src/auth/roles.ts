import type { Role } from '../api/types'

export const ROLE_LABELS: Record<Role, string> = {
  TECHNICIAN: 'Technician',
  MANAGER: 'Manager',
}

export const MANAGER_ONLY = ['MANAGER'] as const satisfies readonly Role[]
