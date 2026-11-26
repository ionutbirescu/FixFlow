import { Navigate, type RouteObject } from 'react-router'
import { RequireAuth, RequireRole } from './auth/guards'
import { MANAGER_ONLY } from './auth/roles'
import { AppLayout } from './components/AppLayout'
import { ErrorPage } from './pages/ErrorPage'
import { LoginPage } from './pages/LoginPage'
import { NewReportPage } from './pages/NewReportPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ReportPage } from './pages/ReportPage'

// Every page, and who may open it. App.tsx serves these with a browser router; the tests use a memory router.
export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        // Any signed-in user
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="/reports" replace /> },
              {
                path: 'reports',
                element: (
                  <PlaceholderPage title="Reports">
                    Maintenance reports, newest first. Technicians see their own; managers see everyone's.
                  </PlaceholderPage>
                ),
              },
              { path: 'reports/new', element: <NewReportPage /> },
              { path: 'reports/:id', element: <ReportPage /> },
              {
                path: 'machines',
                element: (
                  <PlaceholderPage title="Machines">All machines and when each one is due for service.</PlaceholderPage>
                ),
              },
              {
                path: 'machines/:id',
                element: <PlaceholderPage title="Machine">The machine's maintenance history.</PlaceholderPage>,
              },
              {
                // Managers only
                element: <RequireRole roles={MANAGER_ONLY} />,
                children: [
                  {
                    path: 'machines/new',
                    element: <PlaceholderPage title="Add machine">Add a machine to the plant.</PlaceholderPage>,
                  },
                  {
                    path: 'machines/:id/edit',
                    element: (
                      <PlaceholderPage title="Edit machine">Change a machine's details or delete it.</PlaceholderPage>
                    ),
                  },
                  {
                    path: 'users/new',
                    element: <PlaceholderPage title="Add user">Create a technician or manager account.</PlaceholderPage>,
                  },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]
