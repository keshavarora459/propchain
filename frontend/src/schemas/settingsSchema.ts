import { z } from 'zod'

export const userSettingsSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  organization: z.string().min(2, 'Organization / Agency name is required'),
  preferredWallet: z.string().optional(),
  notifyOnTransactions: z.boolean(),
  notifyOnFraudAlerts: z.boolean(),
  notifyOnApprovals: z.boolean(),
  rpcEndpoint: z.string().url('Must be a valid RPC URL').or(z.literal('')),
})

export type UserSettingsFormData = z.infer<typeof userSettingsSchema>
