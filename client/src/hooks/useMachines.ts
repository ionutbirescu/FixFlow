import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../api/errors'
import { listMachines } from '../api/machines'
import type { MachineDto } from '../api/types'

export type MachinesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; machines: MachineDto[] }

/** Every machine, by name (`GET /machines` on S2), loaded once when the component mounts. */
export function useMachines(): MachinesState & { retry(): void } {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MachinesState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    listMachines({ signal: controller.signal }).then(
      (machines) => setState({ status: 'ready', machines }),
      (error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: errorMessage(error, "Couldn't load the machines. Try again.") })
      },
    )
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((count) => count + 1)
  }, [])

  return { ...state, retry }
}
