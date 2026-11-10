import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ShieldCheck,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Zap,
  Building,
  KeyRound,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
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
    const demoPassword = import.meta.env.VITE_DEMO_DEFAULT_PASSWORD || 'Password123!'
    setValue('password', demoPassword)
    setServerError(null)
    setSubmitting(true)
    try {
      await login({ email: demoEmail, password: demoPassword, remember: true })
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
    <div className="min-h-screen bg-[#FAF8F3] text-[#252B28] flex flex-col lg:flex-row antialiased selection:bg-[#657565]/20 selection:text-[#252B28]">
      {/* Left Panel: Hero Imagery & Brand Showcase (Desktop / Tablet split screen) */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[52%] flex-col justify-between p-12 overflow-hidden bg-[#252B28] text-white">
        {/* Architectural photography background */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105 hover:scale-100"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=85')`,
          }}
        />

        {/* Sophisticated Luxury Real Estate Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#252B28] via-[#252B28]/75 to-[#252B28]/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(180,154,112,0.18),transparent_55%)]" />
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#EAE4D9_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Top Header in Hero panel */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#657565] text-white shadow-[0_4px_16px_rgba(101,117,101,0.35)] transition-transform duration-200 group-hover:scale-105">
              <span className="font-bold text-lg tracking-wider">P</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-[0.2em] uppercase text-white font-sans">PROPCHAIN</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#B49A70]" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#FAF8F3]/70 font-medium">LUXURY REAL ESTATE</p>
            </div>
          </Link>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-[#FAF8F3]">
            <Sparkles className="h-3.5 w-3.5 text-[#B49A70]" />
            <span className="text-[11px] font-medium tracking-wide">EVM Cryptographic Protocol</span>
          </div>
        </div>

        {/* Center / Bottom Content in Hero panel */}
        <div className="relative z-10 my-auto max-w-xl space-y-8 pt-16">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B49A70]/20 border border-[#B49A70]/40 text-[#FAF8F3] text-xs font-medium">
              <Building className="h-3.5 w-3.5 text-[#B49A70]" />
              <span>Architectural Vault & Smart Escrow</span>
            </div>

            <h1 className="font-serif text-3xl xl:text-4xl 2xl:text-5xl font-normal leading-[1.15] text-[#FAF8F3] tracking-tight">
              Exclusive ownership, <br />
              <span className="italic text-[#EAE4D9]">authenticated on-chain.</span>
            </h1>

            <p className="text-sm xl:text-base text-[#FAF8F3]/80 font-normal leading-relaxed max-w-md">
              Securely authenticate to access curated prime estates, review statutory cadastral title deeds, and oversee atomic smart settlements.
            </p>
          </div>

          {/* Curated Trust Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/15">
            <div className="space-y-1">
              <p className="font-sans text-xl xl:text-2xl font-bold text-white tracking-tight">$420M+</p>
              <p className="text-[11px] text-[#FAF8F3]/70 font-normal">Real Estate Capital</p>
            </div>
            <div className="space-y-1">
              <p className="font-sans text-xl xl:text-2xl font-bold text-white tracking-tight">100%</p>
              <p className="text-[11px] text-[#FAF8F3]/70 font-normal">On-Chain Deeds</p>
            </div>
            <div className="space-y-1">
              <p className="font-sans text-xl xl:text-2xl font-bold text-white tracking-tight">Zero-Trust</p>
              <p className="text-[11px] text-[#FAF8F3]/70 font-normal">Statutory Registry</p>
            </div>
          </div>
        </div>

        {/* Bottom Security Citation */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-[#FAF8F3]/60 pt-6 border-t border-white/10">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#657565]" />
            Argon2id Hashed · 256-Bit Cryptographic Bearer Tokens
          </span>
          <span className="font-mono text-[10px] text-[#B49A70]">EVM MAINNET READY</span>
        </div>
      </div>

      {/* Right Panel: Clean, Elegant Authentication Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 overflow-y-auto">
        {/* Mobile Header (visible only on small screens) */}
        <div className="lg:hidden flex items-center justify-between mb-8 pb-4 border-b border-[#E8E2D5]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#657565] text-white shadow-xs font-bold text-base">
              P
            </div>
            <div>
              <span className="font-bold text-sm tracking-wider uppercase text-[#252B28] font-sans">PROPCHAIN</span>
              <p className="text-[9px] uppercase tracking-widest text-[#6B726B] font-medium">LUXURY REAL ESTATE</p>
            </div>
          </Link>
          <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-[#EAE4D9] text-[#252B28] border border-[#D4CBBC]">
            SECURE PORTAL
          </span>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-4">
          {/* Header Typography */}
          <div className="mb-8">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#657565] mb-2 block font-sans">
              Sign In to Console
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#252B28] tracking-tight">
              Welcome to PropChain
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-[#6B726B] font-normal leading-relaxed">
              Enter your accredited credentials to manage registered estates, bids, and legal deeds.
            </p>
          </div>

          {/* Server Error Message */}
          {serverError && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800 flex items-start gap-3 shadow-xs">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Authentication Alert</p>
                <p className="mt-0.5 font-normal leading-relaxed">{serverError}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B726B] mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B726B]" />
                <input
                  type="email"
                  {...register('email')}
                  placeholder="name@propchain.network"
                  className="w-full rounded-xl border border-[#E8E2D5] bg-white py-2.5 pl-10 pr-4 text-xs sm:text-sm text-[#252B28] placeholder:text-[#A19D94] focus:border-[#657565] focus:outline-none focus:ring-2 focus:ring-[#657565]/20 hover:border-[#D4CBBC] transition-all duration-200 shadow-[0_1px_4px_rgba(37,43,40,0.02)]"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B726B]">
                  Passcode / Password
                </label>
                <span className="text-[11px] text-[#6B726B] hover:text-[#252B28] cursor-not-allowed">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B726B]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-[#E8E2D5] bg-white py-2.5 pl-10 pr-10 text-xs sm:text-sm text-[#252B28] placeholder:text-[#A19D94] focus:border-[#657565] focus:outline-none focus:ring-2 focus:ring-[#657565]/20 hover:border-[#D4CBBC] transition-all duration-200 shadow-[0_1px_4px_rgba(37,43,40,0.02)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B726B] hover:text-[#252B28] transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-[#6B726B] hover:text-[#252B28] select-none">
                <input
                  type="checkbox"
                  {...register('remember')}
                  className="h-4 w-4 rounded border-[#D4CBBC] text-[#657565] focus:ring-[#657565] accent-[#657565]"
                />
                <span className="text-xs">Keep session remembered</span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full justify-center bg-[#657565] hover:bg-[#526152] text-white font-medium py-2.5 rounded-full shadow-xs hover:shadow-[0_4px_16px_rgba(101,117,101,0.25)] transition-all duration-200 mt-2"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying Identity...
                </span>
              ) : (
                <span className="flex items-center gap-2 font-medium tracking-wide">
                  Sign In to Terminal <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>

            {/* Quick 1-Click Role Login for demo / dev verification */}
            <div className="pt-5 mt-6 border-t border-[#E8E2D5]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold text-[#6B726B] uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-[#B49A70]" />
                  1-Click Role Credentials
                </span>
                <span className="text-[10px] text-[#A19D94] font-mono">Dev Fast Access</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('buyer@propchain.network')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white border border-[#E8E2D5] hover:border-[#657565] hover:bg-[#FAF8F3] hover:-translate-y-0.5 text-[#252B28] text-xs font-medium transition-all duration-200 shadow-[0_1px_3px_rgba(37,43,40,0.02)] cursor-pointer"
                >
                  <span className="h-2 w-2 rounded-full bg-[#657565]" />
                  <span>Buyer</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('seller@propchain.network')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white border border-[#E8E2D5] hover:border-[#657565] hover:bg-[#FAF8F3] hover:-translate-y-0.5 text-[#252B28] text-xs font-medium transition-all duration-200 shadow-[0_1px_3px_rgba(37,43,40,0.02)] cursor-pointer"
                >
                  <span className="h-2 w-2 rounded-full bg-[#B49A70]" />
                  <span>Seller</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('verifier@propchain.network')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white border border-[#E8E2D5] hover:border-[#657565] hover:bg-[#FAF8F3] hover:-translate-y-0.5 text-[#252B28] text-xs font-medium transition-all duration-200 shadow-[0_1px_3px_rgba(37,43,40,0.02)] cursor-pointer"
                >
                  <span className="h-2 w-2 rounded-full bg-[#657565]" />
                  <span>Registrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('legal@propchain.network')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white border border-[#E8E2D5] hover:border-[#657565] hover:bg-[#FAF8F3] hover:-translate-y-0.5 text-[#252B28] text-xs font-medium transition-all duration-200 shadow-[0_1px_3px_rgba(37,43,40,0.02)] cursor-pointer"
                >
                  <span className="h-2 w-2 rounded-full bg-[#B49A70]" />
                  <span>Legal Registrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@propchain.network')}
                  className="col-span-2 sm:col-span-2 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-[#252B28] hover:bg-[#1f2421] hover:-translate-y-0.5 text-white text-xs font-medium transition-all duration-200 shadow-xs cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[#B49A70]" />
                  <span>Admin Console (Full Access)</span>
                </button>
              </div>
            </div>
          </form>

          {/* Footer Register Link */}
          <div className="mt-8 pt-6 border-t border-[#E8E2D5] text-center text-xs text-[#6B726B]">
            Need an accredited account?{' '}
            <Link
              to="/register"
              className="font-semibold text-[#657565] hover:text-[#526152] underline underline-offset-4 transition-colors"
            >
              Enroll buyer or titleholder account
            </Link>
          </div>
        </div>

        {/* Form panel footer */}
        <div className="pt-6 border-t border-[#E8E2D5] text-center text-[11px] text-[#A19D94] flex items-center justify-center gap-4">
          <span className="flex items-center gap-1 text-[#6B726B]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#657565]" />
            Official Title Registry
          </span>
          <span>•</span>
          <span>Terms & Privacy</span>
          <span>•</span>
          <span>v2.4 EVM</span>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
