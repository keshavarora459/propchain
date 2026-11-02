import React, { useState } from 'react'
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

export interface RegisterPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newProperty: Property) => void
}

export const RegisterPropertyModal: React.FC<RegisterPropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
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
      const typeUpper = data.propertyType.toUpperCase()
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
        country: 'United States',
        state: data.state,
        city: data.city,
        street_address: data.address,
        postal_code: data.postalCode,
        land_area: Number(data.area),
        area_unit: areaUnitMap[data.areaUnit] || 'SQ_FT',
        valuation: Number(data.valuation),
        registration_number: data.registrationReference,
        survey_number: data.registrationReference,
      }

      const created = await propertyService.registerProperty(payload)
      onSuccess(created)
      reset()
      onClose()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } }
        setServerError(
          axiosErr.response?.data?.message || 'Failed to register property in database. Please check fields.'
        )
      } else {
        setServerError('Unable to connect to property registration service. Please verify server status.')
      }
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
      title="Register Real Estate Parcel"
      description="Initialize digital deed record for verification and tokenization."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Registration Error</p>
              <p className="mt-0.5 text-red-700">{serverError}</p>
            </div>
          </div>
        )}

        <Input
          label="Property Title / Commercial Name"
          placeholder="e.g. Skyline Commercial Center - Tower A"
          required
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Property Classification"
            options={PROPERTY_TYPES}
            required
            error={errors.propertyType?.message}
            {...register('propertyType')}
          />
          <Input
            label="Government Registry Reference"
            placeholder="e.g. REG-NY-2024-9912"
            required
            error={errors.registrationReference?.message}
            {...register('registrationReference')}
          />
        </div>

        <Input
          label="Street Address"
          placeholder="e.g. 450 Financial Way"
          required
          error={errors.address?.message}
          {...register('address')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="City"
            placeholder="New York"
            required
            error={errors.city?.message}
            {...register('city')}
          />
          <Input
            label="State / Province"
            placeholder="NY"
            required
            error={errors.state?.message}
            {...register('state')}
          />
          <Input
            label="Postal Code"
            placeholder="10005"
            required
            error={errors.postalCode?.message}
            {...register('postalCode')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            type="number"
            label="Land / Floor Area"
            placeholder="45000"
            required
            error={errors.area?.message}
            {...register('area', { valueAsNumber: true })}
          />
          <Select
            label="Area Unit"
            options={['sq ft', 'acres', 'sq m']}
            required
            error={errors.areaUnit?.message}
            {...register('areaUnit')}
          />
          <Input
            type="number"
            label="Assessed Valuation ($ USD)"
            placeholder="12500000"
            required
            error={errors.valuation?.message}
            {...register('valuation', { valueAsNumber: true })}
          />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
            Owner Information
          </h4>
          <Input
            label="Primary Owner Legal Entity"
            placeholder="e.g. Apex Real Estate Holdings LLC"
            required
            error={errors.ownerName?.message}
            {...register('ownerName')}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={handleModalClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Submit for On-Chain Verification
          </Button>
        </div>
      </form>
    </Modal>
  )
}
