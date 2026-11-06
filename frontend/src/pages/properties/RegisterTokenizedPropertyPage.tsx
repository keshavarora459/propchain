import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Coins,
  ArrowLeft,
  Calculator,
  Layers,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { tokenizedPropertySchema, type TokenizedPropertyFormData } from '@/schemas/propertySchema'
import { PROPERTY_TYPES } from '@/constants/options'
import { propertyService } from '@/services/propertyService'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

function formatErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return 'An unexpected error occurred while registering the tokenized property. Please try again.'
  }
  const axiosErr = err as any
  const responseData = axiosErr.response?.data
  if (responseData) {
    if (typeof responseData.detail === 'string') {
      return responseData.detail
    }
    if (Array.isArray(responseData.detail)) {
      const messages = responseData.detail
        .map((item: any) => {
          const loc = Array.isArray(item.loc) ? item.loc.slice(-1)[0] : ''
          const field = loc ? `${loc}: ` : ''
          return `${field}${item.msg || item.message || 'invalid'}`
        })
        .filter(Boolean)
      if (messages.length > 0) {
        return messages.join('. ')
      }
    }
    if (typeof responseData.message === 'string') {
      return responseData.message
    }
  }
  if (axiosErr.message) {
    return axiosErr.message
  }
  return 'Unable to register tokenized property. Please check your network and fields.'
}

export const RegisterTokenizedPropertyPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const ownerDisplayName = user?.full_name || 'Seller'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TokenizedPropertyFormData>({
    resolver: zodResolver(tokenizedPropertySchema),
    defaultValues: {
      areaUnit: 'sq ft',
      propertyType: 'Commercial',
      totalTokens: 10000,
      tokenPrice: 100,
      tokenSymbol: 'PROP-TKN',
      minTokensPerBuyer: 5,
      projectedApy: 8.5,
    },
  })

  // Watch values for real-time token economics calculation
  const watchedValuation = watch('valuation') || 0
  const watchedTotalTokens = watch('totalTokens') || 10000
  const watchedTokenPrice = watch('tokenPrice') || 0
  const watchedMinTokens = watch('minTokensPerBuyer') || 1
  const watchedSymbol = watch('tokenSymbol') || 'PROP-TKN'
  const watchedApy = watch('projectedApy') || 0

  // Automatically update tokenPrice when valuation changes, if totalTokens is set
  useEffect(() => {
    if (watchedValuation > 0 && watchedTotalTokens > 0) {
      const calculatedPrice = Math.round((watchedValuation / watchedTotalTokens) * 100) / 100
      setValue('tokenPrice', calculatedPrice, { shouldValidate: true })
    }
  }, [watchedValuation, watchedTotalTokens, setValue])

  const minInvestment = (watchedTokenPrice || 0) * (watchedMinTokens || 1)
  const equityPerToken = watchedTotalTokens > 0 ? (1 / watchedTotalTokens) * 100 : 0

  const onSubmit = async (data: TokenizedPropertyFormData) => {
    setServerError(null)
    try {
      const areaUnitMap: Record<string, string> = {
        'sq ft': 'SQ_FT',
        'acres': 'ACRE',
        'sq m': 'SQ_M',
      }
      const typeUpper = (data.propertyType || 'Commercial').toUpperCase()

      // Structured tokenization terms embedded in description for immutability
      const tokenizedDescription = `[TOKENIZED SALE] Symbol: ${data.tokenSymbol} | Total Supply: ${data.totalTokens.toLocaleString()} tokens | Token Price: $${data.tokenPrice} | Min Purchase: ${data.minTokensPerBuyer} tokens | Projected APY: ${data.projectedApy || 0}% | ${data.description || 'Fractionalized real estate asset offering for multiple investors.'}`

      const payload = {
        title: data.title,
        description: tokenizedDescription,
        property_type: typeUpper,
        property_category: 'TOKENIZED',
        country: (data as any).country || import.meta.env.VITE_DEFAULT_COUNTRY || '',
        state: data.state,
        city: data.city,
        street_address: data.address,
        postal_code: data.postalCode,
        land_area: Number(data.area),
        area_unit: areaUnitMap[data.areaUnit] || 'SQ_FT',
        valuation: Number(data.valuation),
        registration_number: data.registrationReference,
        survey_number: data.registrationReference,
        owner_name: ownerDisplayName,
      }

      const created = await propertyService.registerProperty(payload)
      const targetId = created.propertyId || created.id
      if (targetId) {
        navigate(`/documents?propertyId=${targetId}`)
      } else {
        navigate('/properties')
      }
    } catch (err: unknown) {
      setServerError(formatErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4 px-2 sm:px-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/properties/register')}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Change Sale Method
        </Button>
        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 font-medium px-3 py-1">
          Fractional Tokenization (Multi-Buyer)
        </Badge>
      </div>

      <PageHeader
        title="Sell Property Through Tokens"
        description="Divide your real estate asset into digital tokens and allow multiple buyers to purchase fractional ownership shares."
        breadcrumbs={[
          { label: 'Properties', href: '/properties' },
          { label: 'Register', href: '/properties/register' },
          { label: 'Tokenization', href: '/properties/register/tokenized' },
        ]}
      />

      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 flex items-start gap-3 text-xs text-purple-900">
        <Coins className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-purple-950">Fractional Tokenization Model:</span> Your property will be split into a custom number of digital tokens. Each token represents an equal fraction of the underlying legal asset. Multiple accredited or public buyers can acquire tokens up to your total valuation.
        </div>
      </div>

      {serverError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Registration Error</p>
            <p className="mt-1 text-red-700 leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}

      {/* Live Token Economics Summary Preview */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/40 shadow-xs">
        <CardHeader className="pb-2 border-b border-purple-100">
          <CardTitle className="text-sm font-semibold text-purple-950 flex items-center gap-2">
            <Calculator className="h-4 w-4 text-purple-600" />
            Live Token Economics Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-white/80 rounded-lg p-2.5 border border-purple-100">
            <span className="text-slate-500 block text-[11px]">Target Valuation</span>
            <span className="font-bold text-slate-900 text-sm">{formatCurrency(watchedValuation)}</span>
          </div>
          <div className="bg-white/80 rounded-lg p-2.5 border border-purple-100">
            <span className="text-slate-500 block text-[11px]">Token Supply & Ticker</span>
            <span className="font-bold text-purple-700 text-sm">
              {Number(watchedTotalTokens || 0).toLocaleString()} {watchedSymbol.toUpperCase()}
            </span>
          </div>
          <div className="bg-white/80 rounded-lg p-2.5 border border-purple-100">
            <span className="text-slate-500 block text-[11px]">Price Per Token</span>
            <span className="font-bold text-emerald-600 text-sm">{formatCurrency(watchedTokenPrice || 0)}</span>
          </div>
          <div className="bg-white/80 rounded-lg p-2.5 border border-purple-100">
            <span className="text-slate-500 block text-[11px]">Min. Investment</span>
            <span className="font-bold text-indigo-700 text-sm">
              {formatCurrency(minInvestment)} ({watchedMinTokens} tkns)
            </span>
          </div>
          <div className="bg-white/80 rounded-lg p-2.5 border border-purple-100">
            <span className="text-slate-500 block text-[11px]">Equity / Token (APY)</span>
            <span className="font-bold text-blue-700 text-sm">
              {equityPerToken < 0.01 ? equityPerToken.toFixed(4) : equityPerToken.toFixed(2)}% ({watchedApy}% APY)
            </span>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tokenization Offering Parameters */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-purple-50/20 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Coins className="h-4 w-4 text-purple-600" />
              Tokenization & Distribution Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Input
                  type="number"
                  label="Total Property Valuation ($ USD)"
                  placeholder="e.g. 5000000"
                  required
                  error={errors.valuation?.message}
                  {...register('valuation', { valueAsNumber: true })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Total capital value to be divided into tokens.
                </span>
              </div>
              <div>
                <Input
                  type="number"
                  label="Total Token Supply"
                  placeholder="e.g. 10000"
                  required
                  error={errors.totalTokens?.message}
                  {...register('totalTokens', { valueAsNumber: true })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Total discrete tokens created for this property.
                </span>
              </div>
              <div>
                <Input
                  type="number"
                  step="any"
                  label="Price Per Token ($ USD)"
                  placeholder="e.g. 500"
                  required
                  error={errors.tokenPrice?.message}
                  {...register('tokenPrice', { valueAsNumber: true })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Calculated automatically: Valuation / Supply.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Input
                  label="Token Ticker Symbol"
                  placeholder="e.g. PROP-SKY"
                  required
                  error={errors.tokenSymbol?.message}
                  {...register('tokenSymbol', {
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase()
                    },
                  })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Unique 2-10 character uppercase identifier.
                </span>
              </div>
              <div>
                <Input
                  type="number"
                  label="Min. Tokens per Buyer"
                  placeholder="e.g. 5"
                  required
                  error={errors.minTokensPerBuyer?.message}
                  {...register('minTokensPerBuyer', { valueAsNumber: true })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Minimum tokens a buyer must purchase.
                </span>
              </div>
              <div>
                <Input
                  type="number"
                  step="0.1"
                  label="Projected Annual Yield (APY %)"
                  placeholder="e.g. 8.5"
                  error={errors.projectedApy?.message}
                  {...register('projectedApy', { valueAsNumber: true })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Expected annual rental or commercial return.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real Estate Asset Identity */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-600" />
              Underlying Real Estate Asset Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <Input
                  label="Property / Asset Title"
                  placeholder="e.g. Skyline Commercial Center"
                  required
                  error={errors.title?.message}
                  {...register('title')}
                />
              </div>
              <div className="col-span-1">
                <Select
                  label="Property Type"
                  options={PROPERTY_TYPES}
                  required
                  error={errors.propertyType?.message}
                  {...register('propertyType')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="col-span-1">
                <Input
                  label="Reference / Survey No."
                  placeholder="e.g. REG-2026-9912"
                  required
                  error={errors.registrationReference?.message}
                  {...register('registrationReference')}
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  label="Total Land Area"
                  placeholder="45000"
                  required
                  error={errors.area?.message}
                  {...register('area', { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-1">
                <Select
                  label="Area Unit"
                  options={['sq ft', 'acres', 'sq m']}
                  required
                  error={errors.areaUnit?.message}
                  {...register('areaUnit')}
                />
              </div>
            </div>

            <div>
              <Input
                label="Street Address"
                placeholder="e.g. 450 Financial Way, Suite 1200"
                required
                error={errors.address?.message}
                {...register('address')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Input
                  label="City"
                  placeholder="New York"
                  required
                  error={errors.city?.message}
                  {...register('city')}
                />
              </div>
              <div>
                <Input
                  label="State / Province"
                  placeholder="NY"
                  required
                  error={errors.state?.message}
                  {...register('state')}
                />
              </div>
              <div>
                <Input
                  label="Postal Code"
                  placeholder="10005"
                  required
                  error={errors.postalCode?.message}
                  {...register('postalCode')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Token Offering Terms & Overview (Optional)
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                placeholder="Specify rental distributions, governance voting rights, or tenant occupancy rates..."
                {...register('description')}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/properties')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="px-6 bg-purple-600 hover:bg-purple-700"
          >
            Launch Tokenized Property
          </Button>
        </div>
      </form>
    </div>
  )
}

export default RegisterTokenizedPropertyPage
