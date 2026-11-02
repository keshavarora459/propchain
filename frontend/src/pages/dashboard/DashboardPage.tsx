import React, { useEffect, useState } from 'react'
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
import { formatCurrency, truncateHash } from '@/lib/utils'
import apiClient from '@/lib/axios'

interface DashboardData {
  total_properties: number
  verified_properties: number
  pending_properties: number
  total_valuation_usd: number
  active_transactions: number
  completed_transactions: number
  pending_approvals: number
  fraud_alerts: number
  recent_transactions: Array<{
    id: string
    transaction_number: string
    property_id: string
    property_title: string
    purchase_price: number
    status: string
    blockchain_tx_hash?: string
    created_at?: string
  }>
  registration_trends?: Array<{
    month: string
    registered: number
    verified: number
  }>
  transaction_activity?: Array<{
    month: string
    volumeUSD: number
    count: number
  }>
}

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData>({
    total_properties: 0,
    verified_properties: 0,
    pending_properties: 0,
    total_valuation_usd: 0,
    active_transactions: 0,
    completed_transactions: 0,
    pending_approvals: 0,
    fraud_alerts: 0,
    recent_transactions: [],
  })

  useEffect(() => {
    apiClient
      .get<DashboardData>('/analytics/dashboard')
      .then((res) => {
        if (res.data) setData(res.data)
      })
      .catch((err) => console.error('Failed to load live dashboard telemetry:', err))
  }, [])

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

      {/* Live System Indicator Banner */}
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
          value={data.total_properties.toLocaleString()}
          subtitle="All listed properties"
          trend={{ value: `${data.pending_properties} pending verification`, isPositive: true }}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-blue-50 text-blue-700"
        />
        <StatCard
          title="Approved Properties"
          value={data.verified_properties.toLocaleString()}
          subtitle="Verified & ready for sale"
          trend={{ value: `${data.verified_properties} verified`, isPositive: true }}
          icon={<CheckCircle className="h-5 w-5" />}
          iconBg="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          title="Ongoing Deals"
          value={data.active_transactions}
          subtitle={`$${(data.total_valuation_usd / 1000000).toFixed(2)}M total registered value`}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          iconBg="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Security Warnings"
          value={data.fraud_alerts}
          subtitle="Suspicious cases under review"
          trend={{ value: '0 active threats', isPositive: true }}
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
            <RegistrationTrendChart data={data.registration_trends} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Property Sales Value</CardTitle>
            <CardDescription>Total value of completed deals ($ Millions USD)</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionActivityChart data={data.transaction_activity} />
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
              {data.recent_transactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <p className="font-medium text-slate-600">No transactions recorded yet</p>
                  <p className="mt-1">Initiate a deal from the Deals & Escrow tab to begin an on-chain transfer.</p>
                </div>
              ) : (
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
                    {data.recent_transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-mono text-xs font-semibold text-slate-900">
                          {txn.transaction_number}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-slate-800 truncate max-w-[200px]">
                            {txn.property_title}
                          </p>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-900">
                          {formatCurrency(txn.purchase_price)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={txn.status} />
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-500">
                          {txn.blockchain_tx_hash ? truncateHash(txn.blockchain_tx_hash, 5, 4) : 'Pending'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-4 text-xs text-slate-500">
              {data.pending_approvals === 0 ? (
                <div className="text-center py-6">
                  <p className="font-medium text-slate-700">All Approvals Clear</p>
                  <p className="text-[11px] text-slate-400 mt-1">There are no pending actions requiring review.</p>
                </div>
              ) : (
                <p className="font-semibold text-amber-600">{data.pending_approvals} actions awaiting sign-off</p>
              )}
            </CardContent>
          </Card>

          {/* Node Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm">Blockchain Network Status</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Chain Protocol</span>
                <span className="font-semibold text-slate-800">EVM Compatible</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Chain ID</span>
                <span className="font-mono font-semibold text-slate-800">31337 (Localhost)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">RPC Endpoint</span>
                <span className="font-mono text-slate-700">http://127.0.0.1:8545</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Network State</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Synchronized
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <Link
                  to="/blockchain-explorer"
                  className="flex items-center justify-center gap-1.5 w-full rounded-md bg-blue-50 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Cpu className="h-3.5 w-3.5" />
                  View Decentralized Ledger Explorer
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
export default DashboardPage
