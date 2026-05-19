'use client'

import { useState } from 'react'
import { ArrowUpFromLine, Loader2, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWalletStore } from '@/store/walletStore'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const QUICK_AMOUNTS = [25, 50, 100, 250]

export function WithdrawModal() {
  const { isWithdrawModalOpen, closeWithdrawModal } = useWalletStore()
  const { user, updateBalance } = useAuthStore()
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const balance = user?.balance ?? 0
  const MIN_WITHDRAW = 10
  const parsedAmount = parseFloat(amount) || 0
  const isValid = parsedAmount >= MIN_WITHDRAW && parsedAmount <= balance && address.length > 20

  const handleWithdraw = async () => {
    if (!isValid) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('casino_token')}`,
        },
        body: JSON.stringify({ amount: parsedAmount, address }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }
      const { data } = await res.json()
      updateBalance(data.newBalance)
      toast.success(`Withdrawal of $${amount} initiated!`)
      closeWithdrawModal()
      setAmount('')
      setAddress('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Withdrawal failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isWithdrawModalOpen} onOpenChange={closeWithdrawModal}>
      <DialogContent className="max-w-md border border-orange-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/10 to-red-900/10 rounded-2xl pointer-events-none" />

        <div className="relative">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <ArrowUpFromLine className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle>Withdraw Funds</DialogTitle>
                <p className="text-xs text-white/40 mt-0.5">
                  Available: <span className="text-white font-mono">${formatCurrency(balance)}</span>
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Amount (USD)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={balance}
                className="text-xl font-bold text-center h-14"
              />
              <div className="grid grid-cols-4 gap-2 mt-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(String(Math.min(a, balance)))}
                    className="py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAmount(String(balance))}
                className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Max: ${formatCurrency(balance)}
              </button>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">
                Withdrawal Address
              </label>
              <Input
                placeholder="Solana or Ethereum address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {parsedAmount > 0 && parsedAmount < MIN_WITHDRAW && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Minimum withdrawal is ${MIN_WITHDRAW}
              </div>
            )}

            {parsedAmount > balance && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Insufficient balance
              </div>
            )}

            <Button
              variant="danger"
              className="w-full h-12 text-base"
              onClick={handleWithdraw}
              disabled={!isValid || isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
              Withdraw {parsedAmount > 0 ? `$${parsedAmount.toFixed(2)}` : ''}
            </Button>

            <p className="text-center text-xs text-white/20">
              Withdrawals processed within 24 hours • 2% fee applies
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
