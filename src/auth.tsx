/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  authApi,
  authStorage,
  decodeAccessToken,
  setAuthFailureHandler,
  usersApi,
} from './api'
import type { AuthResponse, User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  establish: (tokens: AuthResponse) => Promise<void>
  logout: () => Promise<void>
  clearSession: () => Promise<void>
  refreshProfile: () => Promise<void>
  setProfile: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const CURRENT_USER_KEY = ['current-user'] as const

function currentUserQuery(userId: number) {
  return {
    queryKey: [...CURRENT_USER_KEY, userId] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => usersApi.me(signal),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always' as const,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const clearCurrentUserQuery = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: CURRENT_USER_KEY })
    queryClient.removeQueries({ queryKey: CURRENT_USER_KEY })
  }, [queryClient])

  const clearSession = useCallback(async () => {
    setUser(null)
    await clearCurrentUserQuery()
    authStorage.clear()
  }, [clearCurrentUserQuery])

  const loadProfile = useCallback(async () => {
    const token = authStorage.getAccess()
    const payload = token ? decodeAccessToken(token) : null
    if (!payload) {
      await clearSession()
      return
    }
    const profile = await queryClient.fetchQuery(currentUserQuery(payload.userId))
    setUser(profile)
  }, [clearSession, queryClient])

  const establish = useCallback(
    async (tokens: AuthResponse) => {
      setLoading(true)
      setUser(null)
      await clearCurrentUserQuery()
      authStorage.save(tokens)
      try {
        const payload = decodeAccessToken(tokens.accessToken)
        if (!payload) throw new Error('Сервер вернул некорректный access token')
        const profile = await queryClient.fetchQuery(
          currentUserQuery(payload.userId),
        )
        setUser(profile)
      } catch (error) {
        await clearSession()
        throw error
      } finally {
        setLoading(false)
      }
    },
    [clearCurrentUserQuery, clearSession, queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Локальная сессия очищается даже при сетевой ошибке.
    } finally {
      await clearSession()
    }
  }, [clearSession])

  useEffect(() => {
    setAuthFailureHandler(clearSession)
    const timer = window.setTimeout(() => {
      loadProfile()
        .catch(() => clearSession())
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [clearSession, loadProfile])

  const value = useMemo(
    () => ({
      user,
      loading,
      establish,
      logout,
      clearSession,
      refreshProfile: loadProfile,
      setProfile: setUser,
    }),
    [clearSession, establish, loadProfile, loading, logout, user],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return context
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user?.roles.includes('ROLE_ADMIN')) return <Navigate to="/403" replace />
  return <Outlet />
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (user) return <Navigate to="/books" replace />
  return children
}

export function FullPageLoader() {
  return (
    <div className="full-loader" role="status">
      <span className="spinner" />
      <span>Загружаем библиотеку…</span>
    </div>
  )
}
