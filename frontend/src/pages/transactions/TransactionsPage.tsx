import React, { useState } from 'react'
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
import { MOCK_TRANSACTIONS } from '@/mock-data/transactions'
import { MOCK_PROPERTIES } from '@/mock-data/properties'
import { initiateTransactionSchema, type InitiateTransactionFormData } from '@/schemas/transactionSchema'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types/transaction'

function createTransactionRecord(
  data: InitiateTransactionFormData,
  selectedProp: any
): Transaction {
  const timestamp = Date.now()
  return {
    id: `txn-${timestamp}`,
    transactionId: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
    propertyId: selectedProp ? selectedProp.propertyId : 'PROP-CUSTOM',
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
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS)
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

  const onSubmitInitiate = (data: InitiateTransactionFormData) => {
    const selectedProp = MOCK_PROPERTIES.find((p) => p.id === data.propertyId)
    const newTxn = createTransactionRecord(data, selectedProp)
    setTransactions([newTxn, ...transactions])
    reset()
    setIsModalOpen(false)
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
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
            options={MOCK_PROPERTIES.map((p) => ({ value: p.id, label: `${p.propertyId} - ${p.title}` }))}
            required
            error={errors.propertyId?.message}
            {...register('propertyId')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Buyer Full Legal Name"
              placeholder="e.g. Sterling Global Asset Management"
              required
              error={errors.buyerName?.message}
              {...register('buyerName')}
            />
            <Input
              label="Buyer Ethereum Wallet"
              placeholder="0x1C4a98D224b178F31E83a9B167DeC39b2F082731"
              required
              error={errors.buyerWallet?.message}
              {...register('buyerWallet')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Seller Full Legal Name"
              placeholder="e.g. Apex Real Estate Holdings LLC"
              required
              error={errors.sellerName?.message}
              {...register('sellerName')}
            />
            <Input
              label="Seller Ethereum Wallet"
              placeholder="0x3A9E8b6e3f4211516eB70b138F9B6eFe715697F3"
              required
              error={errors.sellerWallet?.message}
              {...register('sellerWallet')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="number"
              label="Consideration Amount"
              placeholder="12500000"
              required
              error={errors.amount?.message}
              {...register('amount', { valueAsNumber: true })}
            />
            <Select
              label="Settlement Currency"
              options={['USD', 'ETH', 'USDC']}
              required
              error={errors.currency?.message}
              {...register('currency')}
            />
          </div>

          <Input
            label="Escrow Release Conditions"
            placeholder="e.g. Title deed release upon 100% stablecoin deposit and notarized survey acceptance."
            required
            error={errors.escrowReleaseConditions?.message}
            {...register('escrowReleaseConditions')}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Deploy Settlement Lock
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transaction Detail View Modal */}
      {selectedTxn && (
        <Modal
          isOpen={!!selectedTxn}
          onClose={() => setSelectedTxn(null)}
          title={`Escrow Settlement Record: ${selectedTxn.transactionId}`}
          description={`Initiated on ${formatDate(selectedTxn.initiatedAt)}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Property Title</span>
                <span className="font-bold text-slate-900">{selectedTxn.propertyTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Parcel Token ID</span>
                <span className="font-mono text-slate-800">{selectedTxn.propertyId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Purchase Consideration</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatCurrency(selectedTxn.amount)} {selectedTxn.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Escrow Contract Status</span>
                <StatusBadge status={selectedTxn.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                  Purchaser / Buyer
                </span>
                <p className="font-semibold text-slate-900 mt-1">{selectedTxn.buyerName}</p>
                <p className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                  {selectedTxn.buyerWallet}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">
                  Vendor / Seller
                </span>
                <p className="font-semibold text-slate-900 mt-1">{selectedTxn.sellerName}</p>
                <p className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                  {selectedTxn.sellerWallet}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 text-white font-mono text-[11px] space-y-1">
              <p className="text-slate-400">Consensus Anchor:</p>
              <p>Tx Hash: {selectedTxn.blockchainTxHash || 'Awaiting initial block inclusion'}</p>
              <p>Block Height: {selectedTxn.blockNumber || 'Pending'}</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setSelectedTxn(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
