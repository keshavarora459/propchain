import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight, Building2, Eye, EyeOff, Zap } from 'lucide-react'
import { loginSchema, type LoginFormData } from '@/schemas/authSchema'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: true,
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await login(data)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setServerError(axiosErr.response?.data?.message || 'Authentication failed. Please check credentials.')
      } else {
        setServerError('Unable to connect to authentication server. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickLogin = async (demoEmail: string) => {
    setValue('email', demoEmail)
    setValue('password', 'Password123!')
    setServerError(null)
    setSubmitting(true)
    try {
      await login({ email: demoEmail, password: 'Password123!', remember: true })
      navigate(from, { replace: true })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setServerError(axiosErr.response?.data?.message || 'Authentication failed. Please check credentials.')
      } else {
        setServerError('Unable to connect to authentication server. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background aesthetic decorative gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-mono text-xl font-bold tracking-tight text-white">
            Prop<span className="text-blue-400">Chain</span>
          </span>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Network Access Terminal
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Sign in to access your digital real estate deeds and consensus settlement portal.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl backdrop-blur-xl">
          {serverError && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-950/50 p-4 text-xs text-red-200 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Authentication Alert</p>
                <p className="mt-0.5">{serverError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  {...register('email')}
                  placeholder="alex.drake@propchain.network"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Passcode / Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 py-2.5 pl-9 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  {...register('remember')}
                  className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20"
                />
                Remember this session
              </label>
              <span className="text-slate-500 hover:text-slate-400 cursor-not-allowed">
                Forgot credentials?
              </span>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full justify-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg shadow-lg shadow-blue-600/20 transition-all"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying Credentials...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In to Terminal <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>

            {/* Quick Demo Login Option */}
            <div className="pt-3 border-t border-slate-800/80">
              <p className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider text-center">
                ⚡ 1-Click Instant Login
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@propchain.network')}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold transition-all"
                >
                  <Zap className="h-3.5 w-3.5 text-blue-400" />
                  <span>Admin (Full Access)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('verifier@propchain.network')}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all"
                >
                  <span>Title Verifier</span>
                </button>
              </div>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-800/80 pt-6 text-center text-xs text-slate-400">
            Need an authorized account?{' '}
            <Link
              to="/register"
              className="font-medium text-blue-400 hover:text-blue-300 underline underline-offset-4"
            >
              Register titleholder / buyer account
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Argon2id Hashed · 256-Bit Cryptographic Bearer Token Sessions
        </div>
      </div>
    </div>
  )
}

export default LoginPage
