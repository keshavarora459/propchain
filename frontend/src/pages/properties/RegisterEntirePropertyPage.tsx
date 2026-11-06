import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Building2, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { propertyRegistrationSchema, type PropertyRegistrationFormData } from '@/schemas/propertySchema'
import { PROPERTY_TYPES } from '@/constants/options'
import { propertyService } from '@/services/propertyService'
import { useAuth } from '@/hooks/useAuth'

function formatErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return 'An unexpected error occurred while registering the property. Please try again.'
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
  return 'Unable to register property in database. Please check your network and fields.'
}

export const RegisterEntirePropertyPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const ownerDisplayName = user?.full_name || 'Seller'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PropertyRegistrationFormData>({
    resolver: zodResolver(propertyRegistrationSchema),
    defaultValues: {
      areaUnit: 'sq ft',
      propertyType: 'Residential',
      ownerName: ownerDisplayName,
    },
  })

  const onSubmit = async (data: PropertyRegistrationFormData) => {
    setServerError(null)
    try {
      const areaUnitMap: Record<string, string> = {
        'sq ft': 'SQ_FT',
        'acres': 'ACRE',
        'sq m': 'SQ_M',
      }
      const typeUpper = (data.propertyType || 'Residential').toUpperCase()
      const category =
        typeUpper === 'LAND'
          ? 'LAND'
          : typeUpper === 'COMMERCIAL'
          ? 'OFFICE'
          : typeUpper === 'INDUSTRIAL'
          ? 'WAREHOUSE'
          : 'APARTMENT'

      const entireSaleDescription = data.description
        ? `[ENTIRE PROPERTY SALE] ${data.description}`
        : `[ENTIRE PROPERTY SALE] Full 100% parcel ownership conveyance for ${data.title} located at ${data.address}, ${data.city}.`

      const payload = {
        title: data.title,
        description: entireSaleDescription,
        property_type: typeUpper,
        property_category: category,
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
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-medium px-3 py-1">
          Single Buyer Conveyance (100% Ownership)
        </Badge>
      </div>

      <PageHeader
        title="Sell Entire Property"
        description="Register your complete property for whole title conveyance to one buyer."
        breadcrumbs={[
          { label: 'Properties', href: '/properties' },
          { label: 'Register', href: '/properties/register' },
          { label: 'Entire Property', href: '/properties/register/entire' },
        ]}
      />

      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900">
        <Building2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-blue-950">Entire Property Listing Model:</span> You are registering this parcel to be purchased completely by a single buyer. All cadastral deed rights and total valuation are settled in a single atomic escrow transaction.
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              Property Identity & Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <Input
                  label="Property Title"
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
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-600" />
              Physical Location & Cadastral Address
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
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
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Full Asset Valuation & Ownership
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <Input
                  type="number"
                  label="Total Selling Price / Assessed Valuation ($ USD)"
                  placeholder="12500000"
                  required
                  error={errors.valuation?.message}
                  {...register('valuation', { valueAsNumber: true })}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  This is the complete purchase price required from a single buyer.
                </span>
              </div>
              <div className="col-span-1">
                <span className="block text-xs font-medium text-slate-700 mb-1.5">Registered Seller</span>
                <div className="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 font-medium truncate">
                  Owner: {ownerDisplayName}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Property Description (Optional)
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                placeholder="Describe parcel physical condition, encumbrance history, or zoning details..."
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
            className="px-6"
          >
            Submit Entire Property
          </Button>
        </div>
      </form>
    </div>
  )
}

export default RegisterEntirePropertyPage

