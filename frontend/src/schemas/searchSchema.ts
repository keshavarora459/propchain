import { z } from 'zod'

export const propertySearchSchema = z.object({
  query: z.string().optional(),
  propertyType: z.string().optional(),
  status: z.string().optional(),
  minValuation: z.coerce.number().optional(),
  maxValuation: z.coerce.number().optional(),
})

export type PropertySearchFormData = z.infer<typeof propertySearchSchema>

