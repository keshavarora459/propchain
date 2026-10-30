import apiClient from '@/lib/axios'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  UserListResponse,
} from '@/types/auth'

export const authService = {
  async register(data: RegisterRequest): Promise<User> {
    const response = await apiClient.post<{ success: boolean; data: User }>('/auth/register', data)
    return response.data.data
  },

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials)
    return response.data
  },

  async refresh(refreshToken?: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      '/auth/refresh',
      refreshToken ? { refresh_token: refreshToken } : {}
    )
    return response.data
  },

  async logout(refreshToken?: string): Promise<void> {
    await apiClient.post('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {})
  },

  async getMe(): Promise<User> {
    const response = await apiClient.get<User>('/users/me')
    return response.data
  },

  async updateMe(data: { full_name?: string; phone_number?: string }): Promise<User> {
    const response = await apiClient.patch<{ success: boolean; data: User }>('/users/me', data)
    return response.data.data
  },

  async changePassword(data: {
    current_password: string
    new_password: string
    confirm_password: string
  }): Promise<void> {
    await apiClient.post('/auth/change-password', data)
  },

  async listUsers(params?: {
    page?: number
    page_size?: number
    role?: string
    status?: string
    search?: string
  }): Promise<UserListResponse> {
    const response = await apiClient.get<UserListResponse>('/users', { params })
    return response.data
  },

  async updateUserStatus(userId: string, accountStatus: string): Promise<User> {
    const response = await apiClient.patch<{ success: boolean; data: User }>(
      `/users/${userId}/status`,
      { account_status: accountStatus }
    )
    return response.data.data
  },
}

export default authService

