import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { User, Bell, Check, Globe } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { userSettingsSchema, type UserSettingsFormData } from '@/schemas/settingsSchema'
import { useWallet } from '@/context/WalletContext'
import { useAuth } from '@/hooks/useAuth'

export const SettingsPage: React.FC = () => {
  const { account } = useWallet()
  const { user } = useAuth()
  const [saveSuccess, setSaveSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserSettingsFormData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
      fullName: user?.full_name || '',
      email: user?.email || '',
      organization: '',
      preferredWallet: account || '',
      notifyOnTransactions: true,
      notifyOnFraudAlerts: true,
      notifyOnApprovals: true,
      rpcEndpoint: import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
    },
  })

  const onSubmit = (data: UserSettingsFormData) => {
    // In Phase 2: local preference persistence
    localStorage.setItem('propchain_user_settings', JSON.stringify(data))
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Account & System Preferences"
        description="Configure cryptographic authority profiles, blockchain RPC bindings, and alerting rules."
      />

      {saveSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          Settings successfully persisted to local client profile.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Profile Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-700" />
              <CardTitle>Registrar Authority Profile</CardTitle>
            </div>
            <CardDescription>Personal identification and administrative registry credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Legal Name"
                required
                error={errors.fullName?.message}
                {...register('fullName')}
              />
              <Input
                type="email"
                label="Official Email Address"
                required
                error={errors.email?.message}
                {...register('email')}
              />
            </div>
            <Input
              label="Accredited Organization / Agency"
              required
              error={errors.organization?.message}
              {...register('organization')}
            />
          </CardContent>
        </Card>

        {/* Blockchain Node Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              <CardTitle>Decentralized Network RPC</CardTitle>
            </div>
            <CardDescription>Target node endpoint for Hardhat or Ethereum-compatible EVM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="JSON-RPC Client URL"
              placeholder="http://127.0.0.1:8545"
              helperText="EVM JSON-RPC provider (Default: Hardhat 31337)"
              error={errors.rpcEndpoint?.message}
              {...register('rpcEndpoint')}
            />
            <Input
              label="Designated Signing Wallet (0x...)"
              placeholder="0x..."
              helperText="MetaMask or hardware wallet address for signing registrar approvals."
              error={errors.preferredWallet?.message}
              {...register('preferredWallet')}
            />
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-600" />
              <CardTitle>Notification & Alert Subscriptions</CardTitle>
            </div>
            <CardDescription>Real-time telemetry event subscriptions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                {...register('notifyOnTransactions')}
              />
              <span>Notify upon new escrow deposits and settlement executions</span>
            </label>
            <label className="flex items-center gap-3 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                {...register('notifyOnFraudAlerts')}
              />
              <span>Trigger instant high-priority alerts for critical risk anomalies</span>
            </label>
            <label className="flex items-center gap-3 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                {...register('notifyOnApprovals')}
              />
              <span>Notify when deeds require official registrar sign-off</span>
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" isLoading={isSubmitting}>
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  )
}
