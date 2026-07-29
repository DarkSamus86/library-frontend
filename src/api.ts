import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { jwtDecode } from 'jwt-decode'
import type {
  AdminDashboard,
  AdminUser,
  AuthResponse,
  Book,
  BookPayload,
  ChangePasswordRequest,
  JwtPayload,
  LoginRequest,
  PageResponse,
  RegistrationRequest,
  UpdateProfileRequest,
  User,
} from './types'

const API_URL = import.meta.env.VITE_API_URL || '/api-backend'
const ACCESS_KEY = 'library.accessToken'
const REFRESH_KEY = 'library.refreshToken'

export const authStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  save: (tokens: AuthResponse) => {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export function accessPayload(): JwtPayload | null {
  const token = authStorage.getAccess()
  if (!token) return null
  try {
    return jwtDecode<JwtPayload>(token)
  } catch {
    return null
  }
}

let authFailureHandler: (() => void) | null = null
export const setAuthFailureHandler = (handler: () => void) => {
  authFailureHandler = handler
}

const http = axios.create({ baseURL: API_URL })
const refreshClient = axios.create({ baseURL: API_URL })
let refreshPromise: Promise<string> | null = null

function isAuthEndpoint(url = '') {
  return ['/auth/login', '/auth/register', '/auth/refresh'].some((path) =>
    url.includes(path),
  )
}

function shouldSkipRefresh(url = '') {
  return isAuthEndpoint(url) || url.includes('/user/me/password')
}

function isPublicBookRead(config?: { url?: string; method?: string }) {
  return (
    config?.method?.toLowerCase() === 'get' &&
    config.url?.startsWith('/api/v1/books')
  )
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  const refreshToken = authStorage.getRefresh()
  if (!refreshToken) throw new Error('Сессия отсутствует')
  refreshPromise = refreshClient
    .post<AuthResponse>('/auth/refresh', { refreshToken })
    .then(({ data }) => {
      authStorage.save(data)
      return data.accessToken
    })
    .catch((error: unknown) => {
      authStorage.clear()
      authFailureHandler?.()
      throw error
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

http.interceptors.request.use(async (config) => {
  if (isAuthEndpoint(config.url) || isPublicBookRead(config)) return config
  let token = authStorage.getAccess()
  const payload = accessPayload()
  if (token && payload && payload.exp * 1000 < Date.now() + 30_000) {
    token = await refreshAccessToken()
  }
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined
    const expiredOnForbidden =
      error.response?.status === 403 &&
      Boolean(accessPayload() && accessPayload()!.exp * 1000 <= Date.now())
    if (
      config &&
      !config._retry &&
      !shouldSkipRefresh(config.url) &&
      !isPublicBookRead(config) &&
      (error.response?.status === 401 || expiredOnForbidden)
    ) {
      config._retry = true
      const token = await refreshAccessToken()
      config.headers.Authorization = `Bearer ${token}`
      return http(config)
    }
    return Promise.reject(error)
  },
)

export function normalizeApiError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'Произошла неизвестная ошибка'
  }
  const data = error.response?.data
  if (data && typeof data === 'object') {
    if ('message' in data && typeof data.message === 'string') return data.message
    const messages = Object.values(data).filter(
      (value): value is string => typeof value === 'string',
    )
    if (messages.length) return messages.join('. ')
  }
  if (!error.response) return 'Не удалось связаться с сервером'
  if (error.response.status === 400) return 'Проверьте правильность введённых данных'
  if (error.response.status === 401) return 'Неверные данные или сессия завершена'
  if (error.response.status === 403) return 'У вас нет прав для этого действия'
  if (error.response.status === 404) return 'Запрошенные данные не найдены'
  if (error.response.status === 409)
    return 'Пользователь или другой объект с такими данными уже существует'
  if (error.response.status === 410) return 'Срок действия ссылки или ресурса истёк'
  if (error.response.status >= 500)
    return 'Ошибка сервера. Попробуйте выполнить запрос ещё раз'
  return 'Не удалось выполнить запрос. Попробуйте ещё раз'
}

export const authApi = {
  login: (body: LoginRequest) =>
    http.post<AuthResponse>('/auth/login', body).then((r) => r.data),
  register: (body: RegistrationRequest) =>
    http.post<AuthResponse>('/auth/register', body).then((r) => r.data),
  logout: () => http.post('/auth/logout'),
}

export const usersApi = {
  me: () => http.get<User>('/user/me').then((r) => r.data),
  updateMe: (body: UpdateProfileRequest) =>
    http.patch<User>('/user/me', body).then((r) => r.data),
  changePassword: (body: ChangePasswordRequest) =>
    http.put<void>('/user/me/password', body).then((r) => r.data),
}

export const booksApi = {
  list: (params: { page: number; size: number; sort: string }) =>
    http
      .get<PageResponse<Book>>('/api/v1/books', { params })
      .then((r) => r.data),
  search: (title: string) =>
    http
      .get<Book[]>('/api/v1/books/search', { params: { title } })
      .then((r) => r.data),
  get: (id: number) =>
    http.get<Book>(`/api/v1/books/${id}`).then((r) => r.data),
  create: (body: BookPayload) =>
    http.post<Book>('/api/v1/books', body).then((r) => r.data),
  update: (id: number, body: Partial<BookPayload>) =>
    http.patch<Book>(`/api/v1/books/${id}`, body).then((r) => r.data),
  softDelete: (id: number) => http.delete(`/api/v1/books/${id}`),
  hardDelete: (id: number) => http.delete(`/api/v1/books/hard-delete/${id}`),
  import: (body: { query?: string; title?: string; author?: string; limit: number }) =>
    http.post('/api/v1/books/import', body),
}

export const adminApi = {
  dashboard: () =>
    http.get<AdminDashboard>('/admin/dashboard').then((r) => r.data),
  users: (params: { page: number; size: number; sort: string }) =>
    http
      .get<PageResponse<AdminUser>>('/admin/users', { params })
      .then((r) => r.data),
  user: (id: number) =>
    http.get<AdminUser>(`/admin/users/${id}`).then((r) => r.data),
  roles: (id: number, roles: string[]) =>
    http.put(`/admin/users/${id}/roles`, { roles }),
  status: (id: number, isActive: boolean) =>
    http.patch(`/admin/users/${id}/status`, { isActive }),
  deleteUser: (id: number) => http.delete(`/user/${id}`),
}
