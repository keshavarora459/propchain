import { z } from 'zod'

export const documentUploadSchema = z.object({
  propertyId: z.string().min(1, 'Target property is required'),
  documentType: z.enum([
    'Title Deed',
    'Cadastral Survey',
    'Tax Clearance',
    'Encumbrance Certificate',
    'Identity Proof (KYC)',
    'Sale Agreement',
  ]),
  notes: z.string().optional(),
})

export type DocumentUploadFormData = z.infer<typeof documentUploadSchema>

