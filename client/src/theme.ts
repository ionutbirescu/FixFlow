/**
 * Day or night: the light or the dark theme. Until the user picks one with the switch, the system setting decides.
 * The choice is stored in this browser and set as `data-theme` on <html>, which index.css reads.
 * index.html applies a stored choice before the first paint; this keeps it in sync afterwards.
 */
export type Theme = 'day' | 'night'

export const THEME_KEY = 'fixflow.theme'

function readChoice(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'day' || value === 'night' ? value : null
  } catch {
    return null
  }
}

// jsdom has no matchMedia: there, the system setting counts as day
const systemDark = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const listeners = new Set<() => void>()
let choice = readChoice()

function apply() {
  if (choice) document.documentElement.dataset.theme = choice
  else delete document.documentElement.dataset.theme
  for (const listener of listeners) listener()
}

export const themeStore = {
  get(): Theme {
    return choice ?? (systemDark?.matches ? 'night' : 'day')
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  set(theme: Theme) {
    choice = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Storage blocked: the choice lasts until the page reloads
    }
    apply()
  },
}

// The system setting can change while the page is open, and so can the choice in another tab
systemDark?.addEventListener('change', apply)
window.addEventListener('storage', (event) => {
  if (event.key !== THEME_KEY && event.key !== null) return
  choice = readChoice()
  apply()
})
