import React from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export interface TimelineEvent {
  id: string
  title: string
  description?: string
  date: string
  actor?: string
  status?: 'completed' | 'current' | 'upcoming'
  details?: React.ReactNode
}

export interface TimelineProps {
  events: TimelineEvent[]
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, index) => {
          const isLast = index === events.length - 1
          return (
            <li key={event.id} className="relative pb-8">
              {!isLast && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 ring-4 ring-white">
                    {event.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : event.status === 'current' ? (
                      <Circle className="h-5 w-5 text-blue-600 fill-blue-600 animate-pulse" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-400" />
                    )}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                    )}
                    {event.actor && (
                      <p className="text-xs text-slate-600 font-medium mt-1">By: {event.actor}</p>
                    )}
                    {event.details && <div className="mt-2 text-xs">{event.details}</div>}
                  </div>
                  <div className="whitespace-nowrap text-right text-xs text-slate-400">
                    <time dateTime={event.date}>{formatDate(event.date)}</time>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

