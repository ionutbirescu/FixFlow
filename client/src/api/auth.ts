import { s1 } from './http'
import type { CreateUserRequest, LoginRequest, LoginResponse, UserDto } from './types'

/** `POST /auth/login` (S1). Use `useAuth().login`, which also starts the session. 401: wrong credentials. */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await s1.post<LoginResponse>('/auth/login', credentials)
  return data
}

/** `POST /auth/users` (S1, MANAGER only). 409: the username is taken. */
export async function createUser(user: CreateUserRequest): Promise<UserDto> {
  const { data } = await s1.post<UserDto>('/auth/users', user)
  return data
}
