import { z } from 'zod'

export const propertyRegistrationSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(120, 'Title cannot exceed 120 characters'),
  propertyType: z.enum(['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Land']),
  address: z.string().min(5, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State / Province is required'),
  postalCode: z.string().min(3, 'Postal code is required'),
  area: z.number().positive('Area must be a positive number'),
  areaUnit: z.enum(['sq ft', 'acres', 'sq m']),
  valuation: z.number().positive('Valuation must be a positive number'),
  ownerName: z.string().optional(),
  ownerWallet: z.string().optional(),
  registrationReference: z
    .string()
    .min(4, 'Official registry reference number is required'),
  description: z.string().optional(),
})

export type PropertyRegistrationFormData = z.infer<typeof propertyRegistrationSchema>

export const tokenizedPropertySchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(120, 'Title cannot exceed 120 characters'),
  propertyType: z.enum(['Residential', 'Commercial', 'Industrial', 'Agricultural', 'Land']),
  address: z.string().min(5, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State / Province is required'),
  postalCode: z.string().min(3, 'Postal code is required'),
  area: z.number().positive('Area must be a positive number'),
  areaUnit: z.enum(['sq ft', 'acres', 'sq m']),
  valuation: z.number().positive('Total asset valuation must be a positive number'),
  registrationReference: z
    .string()
    .min(4, 'Official registry reference number is required'),
  // Tokenization specific fields
  totalTokens: z.number().int().min(1, 'Total token supply must be at least 1 token'),
  tokenPrice: z.number().positive('Price per token must be greater than 0'),
  tokenSymbol: z
    .string()
    .min(2, 'Token ticker symbol must be at least 2 characters')
    .max(12, 'Token ticker symbol cannot exceed 12 characters'),
  minTokensPerBuyer: z.number().int().min(1, 'Minimum investment must be at least 1 token'),
  projectedApy: z.number().min(0, 'Projected yield cannot be negative').max(100, 'Projected yield cannot exceed 100%').optional(),
  description: z.string().optional(),
})

export type TokenizedPropertyFormData = z.infer<typeof tokenizedPropertySchema>

