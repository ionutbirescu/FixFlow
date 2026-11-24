import axios, { type AxiosError } from 'axios'
import type { ErrorResponse } from './types'

/** True for an error response from S1 or S2, optionally with the given HTTP status. */
export function isApiError(error: unknown, status?: number): error is AxiosError<ErrorResponse> {
  return axios.isAxiosError(error) && error.response !== undefined && (status === undefined || error.response.status === status)
}

/** A message to show the user: the server's `ErrorResponse.message`, or a generic one. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (axios.isAxiosError(error) && !error.response) {
    return "Can't reach the server. Check your connection and try again."
  }
  if (isApiError(error)) {
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.trim() !== '') return message
  }
  return fallback
}
