import apiClient from '@/lib/axios'
import type { NotificationItem, UnreadCountResponse, MarkAllReadResponse } from '@/types/notification'

export const notificationService = {
  async getNotifications(unreadOnly = false, limit = 50, offset = 0): Promise<NotificationItem[]> {
    try {
      const response = await apiClient.get<NotificationItem[]>('/notifications', {
        params: {
          unread_only: unreadOnly,
          limit,
          offset,
        },
      })
      return response.data || []
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      return []
    }
  },

  async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get<UnreadCountResponse>('/notifications/unread-count')
      return response.data?.count ?? 0
    } catch (error) {
      console.error('Failed to fetch unread notification count:', error)
      return 0
    }
  },

  async markAsRead(id: string): Promise<NotificationItem | null> {
    try {
      const response = await apiClient.post<NotificationItem>(`/notifications/${id}/read`)
      return response.data
    } catch (error) {
      console.error(`Failed to mark notification ${id} as read:`, error)
      return null
    }
  },

  async markAllAsRead(): Promise<MarkAllReadResponse> {
    try {
      const response = await apiClient.post<MarkAllReadResponse>('/notifications/read-all')
      return response.data
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
      return { success: false, count: 0 }
    }
  },
}

export default notificationService

