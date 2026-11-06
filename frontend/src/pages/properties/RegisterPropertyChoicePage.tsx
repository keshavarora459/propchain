import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Coins, ArrowRight, ShieldCheck, Users, Layers, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export const RegisterPropertyChoicePage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-4 px-2 sm:px-4">
      <PageHeader
        title="Select Property Sale Method"
        description="Choose how you would like to list and monetize your real estate asset on the PropChain platform."
        breadcrumbs={[
          { label: 'Properties', href: '/properties' },
          { label: 'Register', href: '/properties/register' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Option 1: Sell Entire Property */}
        <Card className="relative overflow-hidden border-2 border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600" />
          <CardContent className="p-6 space-y-5 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building2 className="h-6 w-6" />
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-medium text-xs px-2.5 py-0.5">
                  Single Buyer
                </Badge>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  Sell Entire Property
                </h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Sell the complete property to one buyer. Transfer 100% of the physical asset and registered legal title through unified escrow settlement.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>100% title conveyance to an individual or corporate buyer</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Standard smart contract escrow with multi-party registrar signoff</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>Full valuation purchase price in single atomic settlement</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button
                className="w-full justify-center group-hover:bg-blue-600 text-sm font-medium"
                onClick={() => navigate('/properties/register/entire')}
                rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              >
                Proceed with Entire Property
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Option 2: Sell Through Tokens */}
        <Card className="relative overflow-hidden border-2 border-slate-200 hover:border-purple-500 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />
          <CardContent className="p-6 space-y-5 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Coins className="h-6 w-6" />
                </div>
                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 font-medium text-xs px-2.5 py-0.5">
                  Fractional Ownership
                </Badge>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                  Sell Through Tokens
                </h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Divide the property into tokens and allow multiple buyers to purchase them. Unlock fractional liquidity, broader investor access, and flexible raise targets.
                </p>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-purple-500 shrink-0" />
                  <span>Configurable token supply, ticker symbol, and price per token</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500 shrink-0" />
                  <span>Multiple investors purchase fractional shares of ownership</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Anchored by authentic legal deeds & title registrar verification</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full justify-center border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-400 text-sm font-medium"
                onClick={() => navigate('/properties/register/tokenized')}
                rightIcon={<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              >
                Proceed with Tokenization
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-slate-400 shrink-0" />
        <p>
          Regardless of the chosen sale method, all properties undergo standard title deed auditing, AI fraud anomaly checks, and mandatory verification by the certified Land Registrar before being opened to buyers.
        </p>
      </div>
    </div>
  )
}

export default RegisterPropertyChoicePage

