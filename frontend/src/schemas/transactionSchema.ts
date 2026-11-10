import { z } from 'zod'

export function normalizeWalletAddress(addr?: string): string {
  if (!addr) return '0x0000000000000000000000000000000000000000'
  let clean = addr.trim()
  if (clean.toLowerCase().startsWith('0x')) {
    clean = clean.slice(2)
  }
  clean = clean.replace(/[^a-fA-F0-9]/g, '')
  if (clean.length === 0) return '0x0000000000000000000000000000000000000000'
  if (clean.length >= 40) return `0x${clean.slice(0, 40)}`
  return `0x${clean.padEnd(40, '0')}`
}

export const initiateTransactionSchema = z.object({
  propertyId: z.string().min(1, 'Please select a registered property'),
  purchaseMode: z.enum(['TOKEN_PURCHASE', 'ENTIRE_PROPERTY']),
  tokenQuantity: z.number().optional().nullable(),
  buyerName: z.string().min(1, 'Buyer legal name is required'),
  buyerWallet: z.string().min(1, 'Buyer Ethereum wallet address is required'),
  sellerName: z.string().min(1, 'Seller legal entity is required'),
  sellerWallet: z.string().min(1, 'Seller Ethereum wallet address is required'),
  amount: z.number().positive('Transaction amount must be greater than zero'),
  currency: z.string().min(1, 'Currency is required'),
  type: z.string().min(1, 'Transaction type is required'),
  escrowReleaseConditions: z.string().optional(),
})

export type InitiateTransactionFormData = z.infer<typeof initiateTransactionSchema>
