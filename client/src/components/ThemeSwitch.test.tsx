import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { THEME_KEY } from '../theme'
import { ThemeSwitch } from './ThemeSwitch'

describe('ThemeSwitch', () => {
  it('shows the system setting until the user picks a theme, then applies and remembers the choice', async () => {
    const user = userEvent.setup()
    render(<ThemeSwitch />)
    const day = screen.getByRole('button', { name: 'Day' })
    const night = screen.getByRole('button', { name: 'Night' })

    // jsdom has no prefers-color-scheme, so the system setting counts as day
    expect(day).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.dataset.theme).toBeUndefined()

    await user.click(night)
    expect(night).toHaveAttribute('aria-pressed', 'true')
    expect(day).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.dataset.theme).toBe('night')
    expect(localStorage.getItem(THEME_KEY)).toBe('night')

    await user.click(day)
    expect(document.documentElement.dataset.theme).toBe('day')
    expect(localStorage.getItem(THEME_KEY)).toBe('day')
  })
})
