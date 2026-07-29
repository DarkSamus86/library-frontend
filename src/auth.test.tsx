// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth'
import type { AuthResponse, User } from './types'

function token(userId: number, username: string) {
  const payload = btoa(
    JSON.stringify({
      sub: username,
      userId,
      iat: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
  return `header.${payload}.signature`
}

function authResponse(userId: number, username: string): AuthResponse {
  return {
    accessToken: token(userId, username),
    refreshToken: `refresh-${userId}`,
    tokenType: 'Bearer',
    expiresIn: 3_600_000,
  }
}

function user(id: number, username: string): User {
  return {
    id,
    email: `${username}@example.com`,
    username,
    firstName: null,
    lastName: null,
    isActive: true,
    isEmailVerified: false,
    roles: ['ROLE_USER'],
  }
}

const firstUser = user(1, 'first')
const secondUser = user(2, 'second')
const firstTokens = authResponse(1, 'first')
const secondTokens = authResponse(2, 'second')
const storage = new Map<string, string>()
const requestedAccessTokens: string[] = []
const server = setupServer(
  http.get('*/user/me', ({ request }) => {
    const authorization = request.headers.get('Authorization')
    if (authorization) requestedAccessTokens.push(authorization)
    if (authorization === `Bearer ${firstTokens.accessToken}`) {
      return HttpResponse.json(firstUser)
    }
    if (authorization === `Bearer ${secondTokens.accessToken}`) {
      return HttpResponse.json(secondUser)
    }
    return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }),
  http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })),
)

beforeAll(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  })
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  storage.clear()
  requestedAccessTokens.length = 0
})
afterAll(() => {
  server.close()
  vi.unstubAllGlobals()
})

it('removes the previous current-user query before establishing another session', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const container = document.createElement('div')
  const root = createRoot(container)
  let auth!: ReturnType<typeof useAuth>
  function Probe() {
    auth = useAuth()
    return null
  }

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    )
  })
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
  expect(auth.loading).toBe(false)
  await act(() => auth.establish(firstTokens))
  expect(auth.user).toEqual(firstUser)

  await act(() => auth.logout())
  expect(auth.user).toBeNull()
  expect(queryClient.getQueryData(['current-user', 1])).toBeUndefined()

  await act(() => auth.establish(secondTokens))
  expect(auth.user).toEqual(secondUser)
  expect(queryClient.getQueryData(['current-user', 1])).toBeUndefined()
  expect(requestedAccessTokens).toEqual([
    `Bearer ${firstTokens.accessToken}`,
    `Bearer ${secondTokens.accessToken}`,
  ])

  await act(() => root.unmount())
})
