import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  CheckCircle2,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/common/LoadingState'
import authService from '@/services/authService'
import type { User, AccountStatus } from '@/types/auth'
import { formatDate, getRoleLabel } from '@/lib/utils'

export const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState<number>(0)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await authService.listUsers({
        search: searchTerm || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      })
      setUsers(data.users)
      setTotalCount(data.total)
    } catch (err) {
      console.error('Failed to load user list:', err)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, roleFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadUsers])

  const handleStatusChange = async (userId: string, newStatus: AccountStatus) => {
    setActionInProgress(userId)
    try {
      await authService.updateUserStatus(userId, newStatus)
      await loadUsers()
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${email}"? This action cannot be undone.`)) {
      return
    }
    setActionInProgress(userId)
    try {
      await authService.deleteUser(userId)
      await loadUsers()
    } catch (err: any) {
      console.error('Failed to delete user:', err)
      alert(err.response?.data?.message || 'Failed to delete user.')
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity & Access Governance"
        description="Administrative management of network participants, verified credentials, and cryptographic privileges."
        actions={
          <Button variant="outline" size="sm" onClick={loadUsers} className="gap-1.5">
            <RotateCw className="h-4 w-4" />
            Refresh Directory
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Registered Network Participants</CardTitle>
              <CardDescription>
                {totalCount} total credentialed accounts indexed on the backend.
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-none"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="PROPERTY_OWNER">Seller</option>
                <option value="BUYER">Buyer</option>
                <option value="VERIFIER">Verifier</option>
                <option value="LEGAL_AUTHORITY">Legal Authority</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-12">
              <LoadingState message="Querying user identity repository..." />
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No registered users matched the selected query parameters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Identity</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email Verified</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead className="text-right">Access Controls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{u.full_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-sans text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                          {getRoleLabel(u.role)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={u.account_status === 'ACTIVE' ? 'Approved' : 'Rejected'}
                        />
                      </TableCell>
                      <TableCell>
                        {u.email_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Unverified</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(u.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.role !== 'ADMIN' && (
                          <div className="flex items-center justify-end gap-2">
                            {u.account_status === 'ACTIVE' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={actionInProgress === u.id}
                                onClick={() => handleStatusChange(u.id, 'SUSPENDED')}
                                className="text-xs text-amber-600 hover:bg-amber-50 hover:border-amber-200"
                              >
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={actionInProgress === u.id}
                                onClick={() => handleStatusChange(u.id, 'ACTIVE')}
                                className="text-xs text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                              >
                                Activate
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionInProgress === u.id}
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              className="text-xs text-red-700 bg-red-50 hover:bg-red-100 border-red-200 gap-1"
                              title="Delete user permanently"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default UserManagementPage
