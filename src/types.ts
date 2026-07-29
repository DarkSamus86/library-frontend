export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegistrationRequest {
  email: string
  username: string
  password: string
  firstName?: string
  lastName?: string
}

export interface UpdateProfileRequest {
  email?: string
  username?: string
  firstName?: string
  lastName?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ApiError {
  status: number
  message: string
  timestamp: string
}

export interface UserApiError extends ApiError {
  path: string
}

export type ValidationError = Record<string, string>

export interface User {
  id: number
  email: string
  username: string
  firstName: string | null
  lastName: string | null
  isActive: boolean
  isEmailVerified: boolean
  roles: string[]
}

export interface AdminUser extends User {
  createdAt: string
  updatedAt: string
}

export interface Book {
  id: number
  title: string
  description: string | null
  isbn: string | null
  pricePurchase: number
  priceRental: number | null
  depositAmount: number | null
  hasPhysical: boolean
  hasDigital: boolean
  physicalInventory: number
  digitalLicenses: number
  isAvailableForRent: boolean
  isAvailableForPurchase: boolean
  publishedYear: number | null
  coverImageUrl: string | null
  totalRentalsCount: number
  totalPurchasesCount: number
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  numberOfElements: number
  empty: boolean
}

export interface AdminDashboard {
  totalUsers: number
  activeUsers: number
  totalBooks: number
  activeBooks: number
  usersByRole: Record<string, number>
}

export interface JwtPayload {
  sub: string
  userId: number
  iat: number
  exp: number
}

export interface BookPayload {
  title: string
  description?: string
  isbn?: string
  author?: string
  genre?: string
  category?: string
  pricePurchase: number
  priceRental?: number
  depositAmount?: number
  physicalInventory: number
  digitalLicenses?: number
  hasPhysical: boolean
  hasDigital: boolean
  publishedYear?: number
  coverImageUrl?: string
  isAvailableForRent?: boolean
  isAvailableForPurchase?: boolean
}
