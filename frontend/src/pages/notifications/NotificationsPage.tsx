import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  CheckCheck,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import notificationService from '@/services/notificationService'
import type { NotificationItem } from '@/types/notification'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    if (isNaN(diffMs)) return ''
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} min ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours} hr ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  } catch {
    return ''
  }
}

function getNotificationIcon(type: string) {
  switch ((type || '').toUpperCase()) {
    case 'SUCCESS':
      return <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
    case 'WARNING':
    case 'ACTION_REQUIRED':
      return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
    case 'ERROR':
      return <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
    case 'INFO':
    default:
      return <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
  }
}

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'page-list', user?.id, filter],
    queryFn: () => notificationService.getNotifications(filter === 'unread', 100, 0),
    enabled: Boolean(user),
    refetchInterval: 30000,
  })

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    queryFn: () => notificationService.getUnreadCount(),
    enabled: Boolean(user),
    refetchInterval: 30000,
  })

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await notificationService.markAsRead(id)
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead()
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await notificationService.markAsRead(notif.id)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    if (notif.link) {
      navigate(notif.link)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notifications</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time updates, verification outcomes, buyer offers, and guided next steps.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              leftIcon={<CheckCheck className="h-4 w-4 text-blue-600" />}
              className="text-xs"
            >
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2 -mb-px">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2',
              filter === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <span>All Notifications</span>
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={cn(
              'px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2',
              filter === 'unread'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <Card className="overflow-hidden border border-slate-200">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No notifications yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {filter === 'unread'
                ? 'You have caught up with all your notifications!'
                : 'Activity logs, contract events, and system notifications will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={cn(
                  'flex items-start gap-4 p-4 transition-all cursor-pointer hover:bg-slate-50/80 group',
                  !notif.is_read ? 'bg-blue-50/25' : 'bg-white'
                )}
              >
                {getNotificationIcon(notif.type)}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm', !notif.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700')}>
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-4">
                    {notif.link ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 group-hover:text-blue-700 group-hover:underline">
                        <span>Go to page</span>
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    ) : (
                      <span />
                    )}

                    {!notif.is_read && (
                      <button
                        onClick={(e) => handleMarkAsRead(e, notif.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded hover:bg-slate-200/60 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Mark read</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default NotificationsPage

