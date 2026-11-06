export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'ACTION_REQUIRED'

export interface NotificationItem {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType | string
  link?: string | null
  is_read: boolean
  created_at: string
}

export interface UnreadCountResponse {
  count: number
}

export interface MarkAllReadResponse {
  success: boolean
  count: number
}

