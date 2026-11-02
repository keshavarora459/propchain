import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Eye } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { initiateTransactionSchema, type InitiateTransactionFormData } from '@/schemas/transactionSchema'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types/transaction'
import type { Property } from '@/types/property'
import { propertyService } from '@/services/propertyService'
import apiClient from '@/lib/axios'

function createTransactionRecord(
  data: InitiateTransactionFormData,
  selectedProp: any
): Transaction {
  const timestamp = Date.now()
  return {
    id: `txn-${timestamp}`,
    transactionId: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
    propertyId: selectedProp ? (selectedProp.propertyId || selectedProp.id) : 'PROP-CUSTOM',
    propertyTitle: selectedProp ? selectedProp.title : 'New Title Transfer',
    buyerName: data.buyerName,
    buyerWallet: data.buyerWallet,
    sellerName: data.sellerName,
    sellerWallet: data.sellerWallet,
    amount: data.amount,
    currency: data.currency,
    status: 'Pending',
    type: data.type,
    escrowStatus: 'Awaiting Deposit',
    initiatedAt: new Date(timestamp).toISOString(),
  }
}

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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
          transactionId: t.transaction_number || `TXN-${t.id.slice(0, 6)}`,
          propertyId: t.property?.property_number || t.property_id || 'PROP-PARCEL',
          propertyTitle: t.property?.title || 'Real Estate Parcel',
          buyerName: t.buyer?.full_name || 'Buyer',
          buyerWallet: t.buyer_wallet_address || '0x0000000000000000000000000000000000000000',
          sellerName: t.seller?.full_name || 'Seller',
          sellerWallet: t.seller_wallet_address || '0x0000000000000000000000000000000000000000',
          amount: Number(t.purchase_price) || 0,
          currency: 'USD',
          status: t.status,
          type: 'Sale',
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
    formState: { errors, isSubmitting },
  } = useForm<InitiateTransactionFormData>({
    resolver: zodResolver(initiateTransactionSchema),
    defaultValues: {
      currency: 'USD',
      type: 'Sale',
    },
  })

  const onSubmitInitiate = async (data: InitiateTransactionFormData) => {
    try {
      await apiClient.post('/transactions', {
        property_id: data.propertyId,
        purchase_price: data.amount,
      })
      await loadData()
      reset()
      setIsModalOpen(false)
    } catch (err: any) {
      const selectedProp = properties.find((p) => p.id === data.propertyId || p.propertyId === data.propertyId)
      const newTxn = createTransactionRecord(data, selectedProp)
      setTransactions((prev) => [newTxn, ...prev])
      reset()
      setIsModalOpen(false)
    }
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
          <Button onClick={() => setIsModalOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Initiate Escrow
          </Button>
        }
      />

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
        <form onSubmit={handleSubmit(onSubmitInitiate)} className="space-y-4">
          <Select
            label="Target Real Estate Parcel"
            options={properties.map((p) => ({ value: p.id || p.propertyId, label: `${p.propertyId} - ${p.title}` }))}
            required
            error={errors.propertyId?.message}
            {...register('propertyId')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Buyer Legal Name"
              placeholder="e.g. Elena Rostova"
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
              placeholder="12500000"
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
              <p className="text-slate-400">Escrow Contract Parties:</p>
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
