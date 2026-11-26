import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { listMachines } from './api/machines'
import { STORAGE_KEY, sessionStore } from './auth/session'
import { S1_URL } from './config'
import { server } from './mocks/server'
import { renderApp, signInAs } from './test/utils'

async function submitLogin(user: ReturnType<typeof renderApp>['user'], username: string, password: string) {
  await user.type(screen.getByLabelText('Username'), username)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('signing in', () => {
  it('sends a signed-out visitor to the login page', async () => {
    renderApp('/reports')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('signs in and continues to the page the visitor asked for', async () => {
    const { router, user } = renderApp('/machines?hall=A')

    await submitLogin(user, 'tech1', 'fixflow')

    expect(await screen.findByRole('heading', { name: 'Machines' })).toBeInTheDocument()
    expect(router.state.location).toMatchObject({ pathname: '/machines', search: '?hall=A' })
    const header = screen.getByRole('banner')
    expect(within(header).getByText('tech1')).toBeInTheDocument()
    expect(within(header).getByText('Technician')).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"role":"TECHNICIAN"')
  })

  it('shows an error for a wrong password and stays on the login page', async () => {
    const { user } = renderApp('/login')

    await submitLogin(user, 'tech1', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    expect(sessionStore.getState().session).toBeNull()
  })

  it('tells a developer how to run without a backend when S1 is down', async () => {
    server.use(http.post(`${S1_URL}/auth/login`, () => HttpResponse.error()))
    const { user } = renderApp('/login')

    await submitLogin(user, 'tech1', 'fixflow')

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server.")
    expect(screen.getByText(/nothing answers at/)).toHaveTextContent('npm run dev:mock')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('sends a signed-in user away from the login page', async () => {
    signInAs('tech1')
    renderApp('/login')
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
  })
})

describe('route guards', () => {
  it('opens the reports list from the root path', async () => {
    signInAs('tech1')
    const { router } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reports')
  })

  it('lets managers open manager-only pages and shows them the links', async () => {
    signInAs('manager1')
    renderApp('/users/new')

    expect(await screen.findByRole('heading', { name: 'Add user' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation')).getByRole('link', { name: 'Add user' })).toBeInTheDocument()
  })

  it('shows technicians a 403 page on manager-only pages and hides the links', async () => {
    signInAs('tech1')
    renderApp('/machines/00000000-0000-4000-8000-000000000101/edit')

    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
    expect(screen.getByText(/only for managers/)).toBeInTheDocument()
    expect(within(screen.getByRole('navigation')).queryByRole('link', { name: 'Add user' })).not.toBeInTheDocument()
  })

  it('shows a not-found page for unknown paths', async () => {
    signInAs('tech1')
    renderApp('/nowhere')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('signing out', () => {
  it('signs out, and the next sign-in starts on the home page', async () => {
    signInAs('tech1')
    const { router, user } = renderApp('/machines')

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    await submitLogin(user, 'manager1', 'fixflow')
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reports')
  })

  it('signs out when the server answers 401, then returns to the same page after signing in', async () => {
    signInAs('tech1', { ttlSeconds: -60 }) // a token the mock API rejects as expired
    const { router, user } = renderApp('/machines')
    expect(await screen.findByRole('heading', { name: 'Machines' })).toBeInTheDocument()

    await expect(listMachines()).rejects.toMatchObject({ response: { status: 401 } })

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Your session has expired')

    await submitLogin(user, 'tech1', 'fixflow')
    expect(await screen.findByRole('heading', { name: 'Machines' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/machines')
  })
})
