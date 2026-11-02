import React from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CheckCircle,
  ArrowLeftRight,
  ShieldAlert,
  ArrowRight,
  Cpu,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { RegistrationTrendChart } from '@/components/charts/RegistrationTrendChart'
import { TransactionActivityChart } from '@/components/charts/TransactionActivityChart'
import {
  MOCK_DASHBOARD_METRICS,
  MOCK_TRANSACTIONS,
  MOCK_APPROVALS,
  MOCK_NETWORK_STATUS,
} from '@/mock-data'
import { formatCurrency, truncateHash, formatDate } from '@/lib/utils'

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description="Live summary of your properties, buying and selling deals, and document approvals."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-mono font-medium text-slate-700 border border-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Hardhat EVM (31337)
            </span>
          </div>
        }
      />

      {/* Illustrative Notice Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 flex items-center justify-between">
        <p>
          <strong className="font-semibold">Live System:</strong> Connected to local blockchain and database services. All data is updated in real time.
        </p>
        <span className="hidden sm:inline-block font-mono text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
          System Active
        </span>
      </div>

      {/* Key Metric Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Properties"
          value={MOCK_DASHBOARD_METRICS.totalProperties.toLocaleString()}
          subtitle="All listed properties"
          trend={{ value: '12.4% this month', isPositive: true }}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title="Approved Properties"
          value={MOCK_DASHBOARD_METRICS.verifiedProperties.toLocaleString()}
          subtitle="Verified & ready for sale"
          trend={{ value: '8.1% this month', isPositive: true }}
          icon={<CheckCircle className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Ongoing Deals"
          value={MOCK_DASHBOARD_METRICS.activeTransactions}
          subtitle={`$${(MOCK_DASHBOARD_METRICS.totalValuationUSD / 1000000).toFixed(1)}M in active buying/selling`}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Security Warnings"
          value={MOCK_DASHBOARD_METRICS.fraudAlerts}
          subtitle="Suspicious cases under review"
          trend={{ value: '2 resolved', isPositive: true }}
          icon={<ShieldAlert className="h-5 w-5" />}
          iconBg="bg-rose-50 text-rose-700"
        />
      </div>

      {/* Primary Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Property Registrations & Approvals</CardTitle>
            <CardDescription>Monthly submitted vs approved properties</CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationTrendChart />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Property Sales Value</CardTitle>
            <CardDescription>Total value of completed deals ($ Millions USD)</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionActivityChart />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Recent Transactions & Pending Approvals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Transactions Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Deals & Sales</CardTitle>
                <CardDescription>Latest property purchases and ownership transfers</CardDescription>
              </div>
              <Link
                to="/transactions"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tx ID</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_TRANSACTIONS.slice(0, 4).map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {txn.transactionId}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-800 truncate max-w-[200px]">
                          {txn.propertyTitle}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">{txn.propertyId}</p>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {formatCurrency(txn.amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={txn.status} />
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-slate-500">
                        {txn.blockchainTxHash ? truncateHash(txn.blockchainTxHash, 5, 4) : 'Pending'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals & Network Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Requires title registrar signature</CardDescription>
              </div>
              <Link
                to="/approvals"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Audit <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 p-0">
              {MOCK_APPROVALS.slice(0, 3).map((apr) => (
                <div key={apr.id} className="p-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-800">
                      {apr.approvalId}
                    </span>
                    <StatusBadge status={apr.status} />
                  </div>
                  <p className="text-xs font-medium text-slate-800 mt-1 line-clamp-1">
                    {apr.propertyTitle}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{apr.description}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                    <span>Priority: {apr.priority}</span>
                    <span>{formatDate(apr.submittedAt)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Node Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm">Blockchain Node State</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Chain Protocol</span>
                <span className="font-semibold text-slate-800">EVM Compatible</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Chain ID</span>
                <span className="font-mono font-semibold text-slate-800">{MOCK_NETWORK_STATUS.chainId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Latest Mined Block</span>
                <span className="font-mono font-semibold text-slate-800">#{MOCK_NETWORK_STATUS.latestBlock}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Gas Price</span>
                <span className="font-mono font-semibold text-emerald-600">{MOCK_NETWORK_STATUS.gasPriceGwei} Gwei</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
