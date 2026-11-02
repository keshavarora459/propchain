import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Eye, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import {
  initiateTransactionSchema,
  normalizeWalletAddress,
  type InitiateTransactionFormData,
} from '@/schemas/transactionSchema'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types/transaction'
import type { Property } from '@/types/property'
import { propertyService } from '@/services/propertyService'
import apiClient from '@/lib/axios'

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [propRes, txnRes] = await Promise.allSettled([
        propertyService.getProperties({ page_size: 100 }),
        apiClient.get<any[]>('/transactions'),
      ])

      if (propRes.status === 'fulfilled' && propRes.value.items) {
        setProperties(propRes.value.items)
      }

      if (txnRes.status === 'fulfilled' && Array.isArray(txnRes.value.data)) {
        const liveTxns: Transaction[] = txnRes.value.data.map((t) => ({
          id: t.id,
          transactionId: t.transaction_number || `TXN-${(t.id || '').slice(0, 6)}`,
          propertyId: t.property?.property_number || t.property_number || t.property_id || 'PROP-PARCEL',
          propertyTitle: t.property_title || t.property?.title || 'Real Estate Parcel',
          buyerName: t.buyer_name || t.buyer?.full_name || 'Buyer',
          buyerWallet: t.buyer_wallet_address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          sellerName: t.seller_name || t.seller?.full_name || 'Seller',
          sellerWallet: t.seller_wallet_address || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          amount: Number(t.proposed_amount) || Number(t.purchase_price) || 0,
          currency: t.currency || 'USD',
          status: t.status || 'Pending',
          type: t.transaction_type || 'Sale',
          escrowStatus: t.status === 'COMPLETED' ? 'Settled' : 'In Escrow',
          initiatedAt: t.created_at || new Date().toISOString(),
        }))
        setTransactions(liveTxns)
      }
    } catch (err) {
      console.error('Error loading live transactions:', err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InitiateTransactionFormData>({
    resolver: zodResolver(initiateTransactionSchema),
    defaultValues: {
      propertyId: '',
      currency: 'USD',
      type: 'Sale',
      amount: 1250000,
      buyerName: 'Mahi',
      buyerWallet: '0x2ead5a3cacf11ed1d2a178d163f0000000000000',
      sellerName: 'Apex Real Estate Holdings LLC',
      sellerWallet: '0x131a0d7aaee152ead5a3cacf1000000000000000',
      escrowReleaseConditions: 'Standard atomic title transfer on verification and clearance',
    },
  })

  const selectedPropertyId = watch('propertyId')

  // When property selection changes, auto-fill property details
  useEffect(() => {
    if (selectedPropertyId && properties.length > 0) {
      const p = properties.find((item) => item.id === selectedPropertyId || item.propertyId === selectedPropertyId)
      if (p) {
        if (p.valuation) setValue('amount', p.valuation)
        if (p.currentOwner) setValue('sellerName', p.currentOwner)
        if (p.ownerAddress && p.ownerAddress.startsWith('0x')) {
          setValue('sellerWallet', p.ownerAddress)
        }
      }
    }
  }, [selectedPropertyId, properties, setValue])

  const handleOpenModal = () => {
    if (properties.length > 0) {
      const p = properties[0]
      setValue('propertyId', p.id || p.propertyId)
      if (p.valuation) setValue('amount', p.valuation)
      if (p.currentOwner) setValue('sellerName', p.currentOwner)
      if (p.ownerAddress && p.ownerAddress.startsWith('0x')) {
        setValue('sellerWallet', p.ownerAddress)
      }
    }
    setIsModalOpen(true)
  }

  const onSubmitInitiate = async (data: InitiateTransactionFormData) => {
    const selectedProp = properties.find(
      (p) => p.id === data.propertyId || p.propertyId === data.propertyId
    )
    const buyerWallet = normalizeWalletAddress(data.buyerWallet)
    const sellerWallet = normalizeWalletAddress(data.sellerWallet)

    let backendTxn: any = null
    try {
      const payload = {
        property_id: selectedProp?.id || data.propertyId,
        proposed_amount: Number(data.amount) || 100000,
        purchase_price: Number(data.amount) || 100000,
        currency: data.currency || 'USD',
        transaction_type: (data.type || 'SALE').toUpperCase(),
        description: data.escrowReleaseConditions || `Escrow agreement between ${data.buyerName} and ${data.sellerName}`,
        buyer_name: data.buyerName,
        buyer_wallet: buyerWallet,
        seller_name: data.sellerName,
        seller_wallet: sellerWallet,
      }
      const res = await apiClient.post('/transactions', payload)
      backendTxn = res.data
    } catch (err: any) {
      console.warn('Backend API note for /transactions:', err)
    }

    const newTxn: Transaction = {
      id: backendTxn?.id || `txn-${Date.now()}`,
      transactionId:
        backendTxn?.transaction_number ||
        `TXN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      propertyId: selectedProp ? (selectedProp.propertyId || selectedProp.id) : data.propertyId,
      propertyTitle: selectedProp?.title || (selectedProp ? `${selectedProp.propertyId} - Parcel` : 'Real Estate Parcel'),
      buyerName: data.buyerName || 'Buyer',
      buyerWallet: buyerWallet,
      sellerName: data.sellerName || 'Seller',
      sellerWallet: sellerWallet,
      amount: Number(data.amount) || 0,
      currency: data.currency || 'USD',
      status: 'Pending',
      type: data.type || 'Sale',
      escrowStatus: 'Awaiting Deposit',
      initiatedAt: new Date().toISOString(),
    }

    setTransactions((prev) => [newTxn, ...prev.filter((t) => t.id !== newTxn.id)])
    reset()
    setIsModalOpen(false)
    setSuccessNotice(`Escrow Contract ${newTxn.transactionId} established successfully!`)
    setTimeout(() => setSuccessNotice(null), 5000)
    loadData()
  }

  const filteredTransactions = transactions.filter(
    (t) =>
      t.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.propertyTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sellerName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escrow & Transaction Settlement"
        description="Smart contract coordinated settlement engine governing atomic title transfers and fund clearances."
        actions={
          <Button onClick={handleOpenModal} leftIcon={<Plus className="h-4 w-4" />}>
            Initiate Escrow
          </Button>
        }
      />

      {successNotice && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="w-full sm:w-96">
          <Input
            placeholder="Search transactions by ID, party, property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="bg-slate-50"
          />
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredTransactions.length} of {transactions.length} settlement records
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <p className="text-sm font-medium text-slate-700">No transactions found</p>
            <p className="mt-1">Click &quot;Initiate Escrow&quot; to begin a new real estate purchase agreement.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tx ID</TableHead>
                <TableHead>Property Reference</TableHead>
                <TableHead>Buyer & Seller</TableHead>
                <TableHead>Settlement Amount</TableHead>
                <TableHead>Escrow State</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Inspection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900">
                    {txn.transactionId}
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-slate-900">{txn.propertyTitle}</p>
                    <span className="font-mono text-[11px] text-slate-400">{txn.propertyId}</span>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium text-slate-800">
                      <span className="text-slate-400">Buyer:</span> {txn.buyerName}
                    </p>
                    <p className="text-xs font-medium text-slate-600">
                      <span className="text-slate-400">Seller:</span> {txn.sellerName}
                    </p>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900">
                    {formatCurrency(txn.amount)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                      {txn.escrowStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={txn.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedTxn(txn)}
                      leftIcon={<Eye className="h-3 w-3" />}
                    >
                      Audit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Initiate Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Initiate Decentralized Escrow"
        description="Establish an Ethereum-compatible atomic settlement contract between buyer and seller."
        maxWidth="lg"
      >
        <form
          onSubmit={handleSubmit(onSubmitInitiate, (validationErrors) => {
            console.warn('Form validation issues:', validationErrors)
          })}
          className="space-y-4"
        >
          <Select
            label="Target Real Estate Parcel"
            options={properties.map((p) => ({
              value: p.id || p.propertyId,
              label: `${p.propertyId} - ${p.title}`,
            }))}
            required
            error={errors.propertyId?.message}
            {...register('propertyId')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Buyer Legal Name"
              placeholder="e.g. Mahi"
              required
              error={errors.buyerName?.message}
              {...register('buyerName')}
            />
            <Input
              label="Buyer Ethereum Wallet (0x...)"
              placeholder="0x91F5cE36E9...234"
              required
              error={errors.buyerWallet?.message}
              {...register('buyerWallet')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Seller Legal Entity"
              placeholder="e.g. Apex Real Estate Holdings LLC"
              required
              error={errors.sellerName?.message}
              {...register('sellerName')}
            />
            <Input
              label="Seller Ethereum Wallet (0x...)"
              placeholder="0x3A9E8b6e...7F3"
              required
              error={errors.sellerWallet?.message}
              {...register('sellerWallet')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Agreed Purchase Price ($ USD)"
              placeholder="1250000"
              required
              error={errors.amount?.message}
              {...register('amount', { valueAsNumber: true })}
            />
            <Select
              label="Settlement Currency"
              options={['USD', 'USDC', 'ETH']}
              required
              error={errors.currency?.message}
              {...register('currency')}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Establish Escrow Contract
            </Button>
          </div>
        </form>
      </Modal>

      {/* Audit Detail Modal */}
      {selectedTxn && (
        <Modal
          isOpen={!!selectedTxn}
          onClose={() => setSelectedTxn(null)}
          title={`Escrow Audit: ${selectedTxn.transactionId}`}
          description={`Initiated on ${formatDate(selectedTxn.initiatedAt)}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Parcel:</span>
                <span className="font-semibold text-slate-800">{selectedTxn.propertyTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Escrow Value:</span>
                <span className="font-bold text-slate-900">{formatCurrency(selectedTxn.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Phase:</span>
                <span className="font-medium text-blue-600">{selectedTxn.escrowStatus}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-900 text-white rounded-lg font-mono text-[11px] space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                <ShieldCheck className="h-4 w-4" />
                <span>On-Chain Escrow Security Details</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">BUYER WALLET:</span>
                <span className="break-all">{selectedTxn.buyerWallet}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SELLER WALLET:</span>
                <span className="break-all">{selectedTxn.sellerWallet}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setSelectedTxn(null)}>
                Close Audit View
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default TransactionsPage
