import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ActivityItem {
  month: string
  volumeUSD: number
  count: number
}

interface TransactionActivityChartProps {
  data?: ActivityItem[]
}

const DEFAULT_ACTIVITY: ActivityItem[] = [
  { month: 'Jun', volumeUSD: 0, count: 0 },
  { month: 'Jul', volumeUSD: 0, count: 0 },
  { month: 'Aug', volumeUSD: 0, count: 0 },
  { month: 'Sep', volumeUSD: 0, count: 0 },
  { month: 'Oct', volumeUSD: 0, count: 0 },
  { month: 'Nov', volumeUSD: 0, count: 0 },
]

export const TransactionActivityChart: React.FC<TransactionActivityChartProps> = ({ data }) => {
  const chartData = data && data.length > 0 ? data : DEFAULT_ACTIVITY

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(val) => `$${val}M`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              color: '#fff',
            }}
            formatter={(value: any) => [`$${value}M USD`, 'Settled Volume']}
          />
          <Bar dataKey="volumeUSD" name="Settled Volume ($M)" fill="#0f172a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TransactionActivityChart
