// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { authStorage, booksApi, normalizeApiError, usersApi } from './api'
import type { User } from './types'

const user: User = {
  id: 7,
  email: 'reader@example.com',
  username: 'reader',
  firstName: 'Анна',
  lastName: null,
  isActive: true,
  isEmailVerified: false,
  roles: ['ROLE_USER'],
}

function token(exp: number) {
  const payload = btoa(JSON.stringify({ sub: 'reader', userId: 7, iat: 1, exp }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
  return `header.${payload}.signature`
}

const server = setupServer()
const storage = new Map<string, string>()

beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  })
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
  authStorage.clear()
})
afterAll(() => {
  server.close()
  vi.unstubAllGlobals()
})

describe('user self-service API', () => {
  it('loads the current profile without an id in the URL', async () => {
    authStorage.save({
      accessToken: token(Math.floor(Date.now() / 1000) + 3600),
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 3_600_000,
    })
    server.use(
      http.get('*/user/me', ({ request }) => {
        expect(new URL(request.url).pathname).toBe('/api-backend/user/me')
        return HttpResponse.json(user)
      }),
    )

    await expect(usersApi.me()).resolves.toEqual(user)
  })

  it('sends only changed profile fields with PATCH', async () => {
    server.use(
      http.patch('*/user/me', async ({ request }) => {
        expect(await request.json()).toEqual({ firstName: '' })
        return HttpResponse.json({ ...user, firstName: '' })
      }),
    )

    await expect(usersApi.updateMe({ firstName: '' })).resolves.toMatchObject({
      firstName: '',
    })
  })

  it('does not refresh or retry a 401 from password change', async () => {
    const passwordRequests = vi.fn()
    const refreshRequests = vi.fn()
    authStorage.save({
      accessToken: token(Math.floor(Date.now() / 1000) + 3600),
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 3_600_000,
    })
    server.use(
      http.put('*/user/me/password', () => {
        passwordRequests()
        return HttpResponse.json(
          { status: 401, message: 'Current password is incorrect' },
          { status: 401 },
        )
      }),
      http.post('*/auth/refresh', () => {
        refreshRequests()
        return HttpResponse.json({}, { status: 500 })
      }),
    )

    await expect(
      usersApi.changePassword({
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
      }),
    ).rejects.toBeTruthy()
    expect(passwordRequests).toHaveBeenCalledTimes(1)
    expect(refreshRequests).not.toHaveBeenCalled()
  })
})

it('keeps public book reads independent from an expired session', async () => {
  const refreshRequests = vi.fn()
  authStorage.save({
    accessToken: token(1),
    refreshToken: 'expired-refresh',
    tokenType: 'Bearer',
    expiresIn: 0,
  })
  server.use(
    http.get('*/api/v1/books', () =>
      HttpResponse.json({
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 10,
        number: 0,
        first: true,
        last: true,
        numberOfElements: 0,
        empty: true,
      }),
    ),
    http.post('*/auth/refresh', () => {
      refreshRequests()
      return HttpResponse.json({}, { status: 401 })
    }),
  )

  await expect(
    booksApi.list({ page: 0, size: 10, sort: 'title,asc' }),
  ).resolves.toMatchObject({ content: [] })
  expect(refreshRequests).not.toHaveBeenCalled()
})

it('normalizes structured and validation errors', () => {
  expect(
    normalizeApiError({
      isAxiosError: true,
      response: { status: 409, data: { message: 'Username already taken' } },
    }),
  ).toBe('Username already taken')
  expect(
    normalizeApiError({
      isAxiosError: true,
      response: {
        status: 400,
        data: { email: 'must be a well-formed email address' },
      },
    }),
  ).toBe('must be a well-formed email address')
})
