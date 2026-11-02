import axios, { type InternalAxiosRequestConfig } from 'axios'

let rawBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
if (rawBaseURL && !rawBaseURL.endsWith('/api/v1')) {
  rawBaseURL = rawBaseURL.replace(/\/+$/, '') + '/api/v1'
}
const baseURL = rawBaseURL

export const apiClient = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true, // Required for HttpOnly refresh cookie exchange
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request interceptor for Bearer token injection
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('propchain_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor with automatic token refresh on 401
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const localRefresh = localStorage.getItem('propchain_refresh_token')
        const refreshResponse = await axios.post(
          `${baseURL}/auth/refresh`,
          localRefresh ? { refresh_token: localRefresh } : {},
          { withCredentials: true }
        )

        const { access_token, refresh_token } = refreshResponse.data
        localStorage.setItem('propchain_token', access_token)
        if (refresh_token) {
          localStorage.setItem('propchain_refresh_token', refresh_token)
        }

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`
        }

        processQueue(null, access_token)
        return apiClient(originalRequest)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.removeItem('propchain_token')
        localStorage.removeItem('propchain_refresh_token')
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default apiClient
