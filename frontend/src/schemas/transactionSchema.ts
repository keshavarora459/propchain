import { z } from 'zod'

export const initiateTransactionSchema = z.object({
  propertyId: z.string().min(1, 'Please select a registered property'),
  buyerName: z.string().min(2, 'Buyer full legal name is required'),
  buyerWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum wallet address'),
  sellerName: z.string().min(2, 'Seller name is required'),
  sellerWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum wallet address'),
  amount: z.number().positive('Transaction amount must be greater than zero'),
  currency: z.enum(['USD', 'ETH', 'USDC']),
  type: z.enum(['Sale', 'Transfer', 'Mortgage Lien', 'Title Deed Release']),
  escrowReleaseConditions: z
    .string()
    .min(10, 'Specify escrow conditions (at least 10 characters)'),
})

export type InitiateTransactionFormData = z.infer<typeof initiateTransactionSchema>
