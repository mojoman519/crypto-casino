'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownToLine, Copy, Check, Loader2, ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWalletStore } from '@/store/walletStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const HOUSE_WALLET = '7hkLAPoX5UQ2KjbRXboVLVRjz8jnx8ReAUSKTzBugRYe'

const CURRENCIES = [
  { id: 'SOL', label: 'SOL', chain: 'SOLANA', icon: '◎', network: 'Solana', address: HOUSE_WALLET },
  { id: 'USDC', label: 'USDC', chain: 'SOLANA', icon: '💵', network: 'Solana (SPL)', address: HOUSE_WALLET },
]

const QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500]

export function DepositModal() {
  const { isDepositModalOpen, closeDepositModal } = useWalletStore()
  const { user, updateBalance } = useAuthStore()
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0])
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState('')
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'amount' | 'confirm'>('amount')

  const depositAddress = selectedCurrency.address ?? HOUSE_WALLET

  const handleCopy = () => {
    navigator.clipboard.writeText(depositAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Address copied!')
  }

  const handleConfirmDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('casino_token')}`,
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency: selectedCurrency.id,
          chain: selectedCurrency.chain,
          txHash: txHash || `mock_${Date.now()}`,
        }),
      })

      if (!res.ok) throw new Error('Deposit failed')
      const { data } = await res.json()
      updateBalance(data.newBalance)
      toast.success(`Deposit of $${amount} confirmed!`)
      closeDepositModal()
      setAmount('')
      setTxHash('')
      setStep('amount')
    } catch {
      toast.error('Deposit failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isDepositModalOpen} onOpenChange={closeDepositModal}>
      <DialogContent className="max-w-md border border-emerald-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 to-purple-900/10 rounded-2xl pointer-events-none" />

        <div className="relative">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <ArrowDownToLine className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle>Deposit Funds</DialogTitle>
                <p className="text-xs text-white/40 mt-0.5">Funds credited instantly</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Currency selector */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Currency</label>
              <div className="grid grid-cols-2 gap-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCurrency(c)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all duration-200',
                      selectedCurrency.id === c.id
                        ? 'bg-purple-500/20 border-purple-500/50 text-white'
                        : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:border-white/20'
                    )}
                  >
                    <span className="text-lg">{c.icon}</span>
                    <div className="text-left">
                      <div className="font-bold">{c.label}</div>
                      <div className="text-xs text-white/40">{c.network}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Amount (USD)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-xl font-bold text-center h-14"
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(String(a))}
                    className={cn(
                      'py-1.5 rounded-lg text-xs font-semibold transition-colors border',
                      amount === String(a)
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                    )}
                  >
                    ${a}
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit address */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">
                Send {selectedCurrency.label} to this address
              </label>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <code className="text-xs text-purple-300 font-mono flex-1 truncate">{depositAddress}</code>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/40" />}
                </button>
              </div>
              <p className="text-xs text-white/30 mt-2">
                ⚠️ Only send {selectedCurrency.label} on the {selectedCurrency.network} network
              </p>
            </div>

            {/* TX Hash (optional) */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">
                Transaction Hash (optional)
              </label>
              <Input
                placeholder="Paste your TX hash for faster verification"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
            </div>

            <Button
              variant="success"
              className="w-full h-12 text-base"
              onClick={handleConfirmDeposit}
              disabled={isLoading || !amount}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
              Confirm Deposit {amount ? `($${amount})` : ''}
            </Button>

            <p className="text-center text-xs text-white/20">
              Current balance: <span className="text-white/50 font-mono">${user?.balance.toFixed(2) ?? '0.00'}</span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
