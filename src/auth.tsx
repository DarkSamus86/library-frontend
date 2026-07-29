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
  setAuthFailureHandler,
  usersApi,
} from './api'
import type { AuthResponse, User } from './types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  establish: (tokens: AuthResponse) => Promise<void>
  logout: () => Promise<void>
  clearSession: () => void
  refreshProfile: () => Promise<void>
  setProfile: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const clearSession = useCallback(() => {
    authStorage.clear()
    setUser(null)
    queryClient.removeQueries({ queryKey: ['current-user'] })
  }, [queryClient])

  const loadProfile = useCallback(async () => {
    if (!authStorage.getAccess()) {
      clearSession()
      return
    }
    const profile = await queryClient.fetchQuery({
      queryKey: ['current-user'],
      queryFn: usersApi.me,
      staleTime: 0,
    })
    setUser(profile)
  }, [clearSession, queryClient])

  const establish = useCallback(
    async (tokens: AuthResponse) => {
      authStorage.save(tokens)
      try {
        await loadProfile()
      } catch (error) {
        clearSession()
        throw error
      }
    },
    [clearSession, loadProfile],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Локальная сессия очищается даже при сетевой ошибке.
    } finally {
      clearSession()
    }
  }, [clearSession])

  useEffect(() => {
    setAuthFailureHandler(clearSession)
    const timer = window.setTimeout(() => {
      loadProfile()
        .catch(clearSession)
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
