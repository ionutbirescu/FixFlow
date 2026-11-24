import { useSyncExternalStore } from 'react'
import { type Theme, themeStore } from '../theme'

const OPTIONS: { theme: Theme; label: string }[] = [
  { theme: 'day', label: 'Day' },
  { theme: 'night', label: 'Night' },
]

/** Picks the light (day) or dark (night) theme. Shows the system setting until the user picks one. */
export function ThemeSwitch() {
  const current = useSyncExternalStore(themeStore.subscribe, themeStore.get)

  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {OPTIONS.map(({ theme, label }) => (
        <button key={theme} type="button" aria-pressed={current === theme} onClick={() => themeStore.set(theme)}>
          {label}
        </button>
      ))}
    </div>
  )
}
