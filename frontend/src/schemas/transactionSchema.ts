import { z } from 'zod'

export const initiateTransactionSchema = z.object({
  propertyId: z.string().min(1, 'Please select a registered property'),
  buyerName: z.string().min(1, 'Buyer name is required'),
  buyerWallet: z.string().min(1, 'Buyer wallet is required'),
  sellerName: z.string().min(1, 'Seller name is required'),
  sellerWallet: z.string().min(1, 'Seller wallet is required'),
  amount: z.number().positive('Transaction offer amount must be greater than zero'),
  currency: z.string().min(1),
  type: z.string().min(1),
  escrowReleaseConditions: z.string().min(1),
})

export type InitiateTransactionFormData = z.infer<typeof initiateTransactionSchema>
