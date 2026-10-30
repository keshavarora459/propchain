export type UserRole =
  | 'ADMIN'
  | 'PROPERTY_OWNER'
  | 'BUYER'
  | 'VERIFIER'
  | 'LEGAL_AUTHORITY'

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'

export interface User {
  id: string
  full_name: string
  email: string
  phone_number?: string | null
  role: UserRole
  account_status: AccountStatus
  email_verified: boolean
  created_at: string
  updated_at?: string
  last_login_at?: string | null
  permissions: string[]
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginResponse extends AuthTokens {
  user: User
}

export interface RegisterRequest {
  full_name: string
  email: string
  phone_number?: string
  password: string
  confirm_password: string
  role: 'BUYER' | 'PROPERTY_OWNER'
  terms_accepted: boolean
}

export interface LoginRequest {
  email: string
  password: string
  remember?: boolean
}

export interface UserListResponse {
  users: User[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

