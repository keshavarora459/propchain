import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface TrendItem {
  month: string
  registered: number
  verified: number
}

interface RegistrationTrendChartProps {
  data?: TrendItem[]
}

const DEFAULT_MONTHS: TrendItem[] = [
  { month: 'Jun', registered: 0, verified: 0 },
  { month: 'Jul', registered: 0, verified: 0 },
  { month: 'Aug', registered: 0, verified: 0 },
  { month: 'Sep', registered: 0, verified: 0 },
  { month: 'Oct', registered: 0, verified: 0 },
  { month: 'Nov', registered: 0, verified: 0 },
]

export const RegistrationTrendChart: React.FC<RegistrationTrendChartProps> = ({ data }) => {
  const chartData = data && data.length > 0 ? data : DEFAULT_MONTHS

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="registeredGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="verifiedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              color: '#fff',
            }}
          />
          <Area
            type="monotone"
            dataKey="registered"
            name="Submitted"
            stroke="#2563eb"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#registeredGrad)"
          />
          <Area
            type="monotone"
            dataKey="verified"
            name="On-Chain Verified"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#verifiedGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RegistrationTrendChart
