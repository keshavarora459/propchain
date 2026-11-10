import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Lock, User, Phone, AlertCircle, ArrowRight } from 'lucide-react'
import { registerSchema, type RegisterFormData } from '@/schemas/authSchema'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { BrandLogo } from '@/components/common/BrandLogo'

export const RegisterPage: React.FC = () => {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone_number: '',
      role: 'BUYER',
      password: '',
      confirm_password: '',
      terms_accepted: false,
    },
  })

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await registerUser(data)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setServerError(axiosErr.response?.data?.message || 'Registration failed. Please check inputs.')
      } else {
        setServerError('Unable to connect to registration server. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex items-center justify-center mb-4">
          <Link to="/login" className="hover:opacity-95 transition-opacity">
            <BrandLogo theme="dark" size="md" />
          </Link>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Create Account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Join the decentralized title deed settlement network as an investor or deed holder.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl backdrop-blur-xl">
          {serverError && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/50 p-4 text-xs text-red-200 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Registration Failed</p>
                <p className="mt-0.5">{serverError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Legal Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  {...register('full_name')}
                  placeholder="Eleanor Vance"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {errors.full_name && (
                <p className="mt-1 text-xs text-red-400">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  {...register('email')}
                  placeholder="eleanor.vance@example.com"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Contact Phone <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  {...register('phone_number')}
                  placeholder="+1 (555) 019-2834"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Network Participant Role
              </label>
              <select
                {...register('role')}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 px-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="BUYER">Property Buyer / Investor (Acquire and transact deeds)</option>
                <option value="PROPERTY_OWNER">Property Owner / Seller (Register and convey deeds)</option>
              </select>
              {errors.role && (
                <p className="mt-1 text-xs text-red-400">{errors.role.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    {...register('password')}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    {...register('confirm_password')}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {errors.confirm_password && (
                  <p className="mt-1 text-xs text-red-400">{errors.confirm_password.message}</p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  {...register('terms_accepted')}
                  className="mt-0.5 h-4 w-4 rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20"
                />
                <span>
                  I accept the{' '}
                  <span className="text-blue-400 underline underline-offset-2">
                    Terms of Service & Cryptographic Escrow Disclosures
                  </span>
                  .
                </span>
              </label>
              {errors.terms_accepted && (
                <p className="mt-1 text-xs text-red-400">{errors.terms_accepted.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full justify-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg shadow-lg shadow-blue-600/20 transition-all mt-4"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating Keys & Registering...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Complete Registration <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-800/80 pt-6 text-center text-xs text-slate-400">
            Already registered?{' '}
            <Link
              to="/login"
              className="font-medium text-blue-400 hover:text-blue-300 underline underline-offset-4"
            >
              Sign in to terminal
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
