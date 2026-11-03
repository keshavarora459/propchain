import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { propertyRegistrationSchema, type PropertyRegistrationFormData } from '@/schemas/propertySchema'
import { PROPERTY_TYPES } from '@/constants/options'
import { propertyService } from '@/services/propertyService'
import type { Property } from '@/types/property'
import { useAuth } from '@/hooks/useAuth'

export interface RegisterPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newProperty: Property) => void
}

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

export const RegisterPropertyModal: React.FC<RegisterPropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const ownerDisplayName = user?.full_name || 'Seller'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
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

      const payload = {
        title: data.title,
        description: data.description || `${data.title} located at ${data.address}, ${data.city}`,
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
      reset()
      onSuccess(created)
      onClose()
      const targetId = created.propertyId || created.id
      if (targetId) {
        navigate(`/documents?propertyId=${targetId}`)
      }
    } catch (err: unknown) {
      setServerError(formatErrorMessage(err))
    }
  }

  const handleModalClose = () => {
    setServerError(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Register Property"
      description="Initialize digital deed record for verification and tokenization."
      maxWidth="2xl"
      bodyClassName="p-4 max-h-[90vh] flex flex-col overflow-hidden"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full max-h-[calc(90vh-5rem)]">
        {/* Scrollable inputs container */}
        <div className="space-y-3 overflow-y-auto pr-1 pb-1 flex-1">
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Registration Error</p>
                <p className="mt-0.5 text-red-700">{serverError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Row 1: Title (2 cols) + Property Type (1 col) */}
            <div className="col-span-1 sm:col-span-2">
              <Input
                label="Property Title"
                placeholder="e.g. Skyline Commercial Center"
                required
                className="h-9 py-1 text-xs"
                error={errors.title?.message}
                {...register('title')}
              />
            </div>
            <div className="col-span-1">
              <Select
                label="Property Type"
                options={PROPERTY_TYPES}
                required
                className="h-9 py-1 text-xs"
                error={errors.propertyType?.message}
                {...register('propertyType')}
              />
            </div>

            {/* Row 2: Reference No. + Area + Area Unit (1 col each) */}
            <div className="col-span-1">
              <Input
                label="Reference No."
                placeholder="e.g. REG-2026-9912"
                required
                className="h-9 py-1 text-xs"
                error={errors.registrationReference?.message}
                {...register('registrationReference')}
              />
            </div>
            <div className="col-span-1">
              <Input
                type="number"
                label="Area"
                placeholder="45000"
                required
                className="h-9 py-1 text-xs"
                error={errors.area?.message}
                {...register('area', { valueAsNumber: true })}
              />
            </div>
            <div className="col-span-1">
              <Select
                label="Area Unit"
                options={['sq ft', 'acres', 'sq m']}
                required
                className="h-9 py-1 text-xs"
                error={errors.areaUnit?.message}
                {...register('areaUnit')}
              />
            </div>

            {/* Row 3: Street Address (full width: 3 cols) */}
            <div className="col-span-1 sm:col-span-3">
              <Input
                label="Street Address"
                placeholder="e.g. 450 Financial Way"
                required
                className="h-9 py-1 text-xs"
                error={errors.address?.message}
                {...register('address')}
              />
            </div>

            {/* Row 4: City + State + Postal code (1 col each) */}
            <div className="col-span-1">
              <Input
                label="City"
                placeholder="New York"
                required
                className="h-9 py-1 text-xs"
                error={errors.city?.message}
                {...register('city')}
              />
            </div>
            <div className="col-span-1">
              <Input
                label="State / Province"
                placeholder="NY"
                required
                className="h-9 py-1 text-xs"
                error={errors.state?.message}
                {...register('state')}
              />
            </div>
            <div className="col-span-1">
              <Input
                label="Postal Code"
                placeholder="10005"
                required
                className="h-9 py-1 text-xs"
                error={errors.postalCode?.message}
                {...register('postalCode')}
              />
            </div>

            {/* Row 5: Assessed Valuation (2 cols) + Owner (read-only 1 col) */}
            <div className="col-span-1 sm:col-span-2">
              <Input
                type="number"
                label="Assessed Valuation ($ USD)"
                placeholder="12500000"
                required
                className="h-9 py-1 text-xs"
                error={errors.valuation?.message}
                {...register('valuation', { valueAsNumber: true })}
              />
            </div>
            <div className="col-span-1 flex flex-col justify-start space-y-1.5">
              <span className="block text-xs font-medium text-slate-700">Owner</span>
              <div
                className="flex h-9 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 font-medium truncate select-none"
                title={`Owner: ${ownerDisplayName}`}
              >
                Owner: {ownerDisplayName}
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Footer Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 mt-2 border-t border-slate-100 shrink-0 bg-white">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleModalClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Submit Property
          </Button>
        </div>
      </form>
    </Modal>
  )
}
