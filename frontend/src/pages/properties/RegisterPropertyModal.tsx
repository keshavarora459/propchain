import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { propertyRegistrationSchema, type PropertyRegistrationFormData } from '@/schemas/propertySchema'
import { PROPERTY_TYPES } from '@/constants/options'

export interface RegisterPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (data: PropertyRegistrationFormData) => void
}

export const RegisterPropertyModal: React.FC<RegisterPropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
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

  const onSubmit = (data: PropertyRegistrationFormData) => {
    onSuccess(data)
    reset()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Real Estate Parcel"
      description="Initialize digital deed record for verification and tokenization."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            Owner & Wallet Authentication
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Primary Owner Legal Entity"
              placeholder="e.g. Apex Real Estate Holdings LLC"
              required
              error={errors.ownerName?.message}
              {...register('ownerName')}
            />
            <Input
              label="Owner Ethereum Wallet (0x...)"
              placeholder="0x3A9E8b6e3f4211516eB70b138F9B6eFe715697F3"
              required
              error={errors.ownerWallet?.message}
              {...register('ownerWallet')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
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
