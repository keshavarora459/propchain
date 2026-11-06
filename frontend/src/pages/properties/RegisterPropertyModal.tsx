import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Coins, ArrowRight, ShieldCheck, KeyRound, Users } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Property } from '@/types/property'

export interface RegisterPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (newProperty: Property) => void
}

export const RegisterPropertyModal: React.FC<RegisterPropertyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate()

  const handleSelectOption = (path: string) => {
    onClose()
    navigate(path)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Property Sale Method"
      description="Choose how you would like to list and sell your real estate asset on PropChain."
      maxWidth="2xl"
      bodyClassName="p-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Option 1: Sell Entire Property */}
        <div
          className="relative rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:shadow-md transition-all p-5 flex flex-col justify-between group bg-white cursor-pointer"
          onClick={() => handleSelectOption('/properties/register/entire')}
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Building2 className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-medium text-[11px] px-2 py-0.5">
                Single Buyer
              </Badge>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Sell Entire Property
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Sell the complete property to one buyer. Transfer 100% parcel ownership via single escrow settlement.
              </p>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span>100% complete title deed transfer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Atomic smart contract escrow</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2">
            <Button
              className="w-full justify-center group-hover:bg-blue-600 text-xs font-medium h-9"
              onClick={(e) => {
                e.stopPropagation()
                handleSelectOption('/properties/register/entire')
              }}
              rightIcon={<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />}
            >
              Sell Entire Property
            </Button>
          </div>
        </div>

        {/* Option 2: Sell Through Tokens */}
        <div
          className="relative rounded-xl border-2 border-slate-200 hover:border-purple-500 hover:shadow-md transition-all p-5 flex flex-col justify-between group bg-white cursor-pointer"
          onClick={() => handleSelectOption('/properties/register/tokenized')}
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Coins className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 font-medium text-[11px] px-2 py-0.5">
                Fractional Ownership
              </Badge>
            </div>

            <div>
              <h4 className="text-base font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                Sell Through Tokens
              </h4>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Divide the property into tokens and allow multiple buyers to purchase them with custom supply & pricing.
              </p>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                <span>Custom token supply & price per token</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                <span>Multiple buyers & fractional liquidity</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2">
            <Button
              variant="outline"
              className="w-full justify-center border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-400 text-xs font-medium h-9"
              onClick={(e) => {
                e.stopPropagation()
                handleSelectOption('/properties/register/tokenized')
              }}
              rightIcon={<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />}
            >
              Sell Through Tokens
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default RegisterPropertyModal
