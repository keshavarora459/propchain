import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, 'Full legal name must be at least 2 characters')
      .max(128, 'Full name cannot exceed 128 characters'),
    email: z.string().trim().email('Please enter a valid email address'),
    phone_number: z.string().trim().optional(),
    role: z.enum(['BUYER', 'PROPERTY_OWNER']),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/\d/, 'Password must contain at least one digit')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special symbol'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
    terms_accepted: z.boolean().refine((val) => val === true, {
      message: 'You must accept the PropChain Terms of Service',
    }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>
