'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Wallet, Copy, Check, ArrowRight, Loader2 } from 'lucide-react'
import { useWalletStore } from '@/store/walletStore'
import { useAuthStore } from '@/store/authStore'
import { getAuthToken } from '@/lib/token'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  open: boolean
  onClose: () => void
  /** If true, shows "balance is zero" messaging */
  urgentMode?: boolean
}

const NC_PRESETS = [1_000, 10_000, 100_000, 1_000_000]

type Tab = 'neon' | 'crypto'

export function FundingModal({ open, onClose, urgentMode = false }: Props) {
  const { user } = useAuthStore()
  const { NC, SOL, openDepositModal, setBalance } = useWalletStore()
  const [tab, setTab] = useState<Tab>('neon')
  const [copied, setCopied] = useState(false)
  const [loadingAmount, setLoadingAmount] = useState<number | null>(null)

  const houseWallet = process.env.NEXT_PUBLIC_HOUSE_WALLET_SOL

  const addNC = async (amount: number) => {
    if (!user || loadingAmount) return
    setLoadingAmount(amount)
    try {
      const res = await fetch('/api/balance/add-nc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ amount }),
      })
      const { success, data, error } = await res.json()
      if (!success) throw new Error(error)
      // Instantly sync wallet store — no page reload needed
      setBalance('NC', data.newNeonCoins)
      toast.success(`🎮 +${amount.toLocaleString()} Neon Coins added!`)
      if (urgentMode) onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add NC')
    } finally {
      setLoadingAmount(null)
    }
  }

  const copyWallet = () => {
    if (!houseWallet) return
    navigator.clipboard.writeText(houseWallet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Wallet address copied!')
  }

  const handleCryptoDeposit = () => {
    onClose()
    openDepositModal()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-md glass-card border border-purple-500/30 overflow-hidden"
          >
            {/* Animated background gradient */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{ background: 'radial-gradient(circle at 30% 30%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(circle at 70% 70%, rgba(236,72,153,0.10) 0%, transparent 60%)' }}
            />

            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  {urgentMode ? (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="w-2 h-2 rounded-full bg-red-400"
                        />
                        <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Balance Empty</span>
                      </div>
                      <h2 className="text-xl font-black text-white">Top Up to Keep Playing</h2>
                      <p className="text-white/40 text-sm mt-0.5">Add funds and get back in the game instantly.</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Add Funds</span>
                      </div>
                      <h2 className="text-xl font-black text-white">Fund Your Account</h2>
                    </>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current balances */}
              <div className="flex gap-3 mb-5">
                {[
                  { currency: 'NC' as const, balance: NC, label: 'Neon Coins', color: 'border-purple-500/20' },
                  { currency: 'SOL' as const, balance: SOL, label: 'SOL Balance', color: 'border-emerald-500/20' },
                ].map(b => (
                  <div key={b.currency} className={cn('flex-1 glass-card p-3 text-center border', b.color)}>
                    <AnimatedBalance currency={b.currency} balance={b.balance} size="sm" className="justify-center" />
                    <div className="text-[11px] text-white/30 mt-0.5">{b.label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] mb-4">
                {([
                  { id: 'neon' as Tab, label: '🎮 Neon Coins', sub: 'Free demo funds' },
                  { id: 'crypto' as Tab, label: '◎ Crypto', sub: 'Real SOL deposit' },
                ] as { id: Tab; label: string; sub: string }[]).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all text-center',
                      tab === t.id ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white/70'
                    )}
                  >
                    <div>{t.label}</div>
                    <div className={cn('text-[10px] mt-0.5', tab === t.id ? 'text-purple-200/70' : 'text-white/20')}>{t.sub}</div>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {tab === 'neon' && (
                  <motion.div
                    key="neon"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-3"
                  >
                    <p className="text-xs text-white/40">Neon Coins are demo credits — no real money required.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {NC_PRESETS.map(amount => (
                        <button
                          key={amount}
                          onClick={() => addNC(amount)}
                          disabled={!!loadingAmount}
                          className="py-3 px-4 rounded-xl bg-purple-600/15 border border-purple-500/20 hover:bg-purple-600/25 hover:border-purple-500/40 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                        >
                          {loadingAmount === amount && (
                            <div className="absolute inset-0 flex items-center justify-center bg-purple-900/40">
                              <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
                            </div>
                          )}
                          <div className="text-sm font-black text-white group-hover:text-purple-200 transition-colors">
                            +{amount >= 1_000_000 ? `${amount / 1_000_000}M` : `${amount / 1_000}K`}
                          </div>
                          <div className="text-[11px] text-white/30">Neon Coins</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/20">
                      Up to 1.1M NC can be added per day. NC are demo credits with no real value.
                    </p>
                  </motion.div>
                )}

                {tab === 'crypto' && (
                  <motion.div
                    key="crypto"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-3"
                  >
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-white/60 space-y-1">
                      <div className="text-white font-semibold text-sm mb-1.5">How to deposit SOL:</div>
                      <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold mt-0.5">1.</span> Connect your Phantom wallet</div>
                      <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold mt-0.5">2.</span> Send SOL to the house wallet below</div>
                      <div className="flex items-start gap-2"><span className="text-emerald-400 font-bold mt-0.5">3.</span> Your balance updates automatically</div>
                    </div>

                    {houseWallet && (
                      <div>
                        <div className="text-xs text-white/30 mb-1.5">House Wallet Address</div>
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                          <code className="text-xs text-emerald-300 flex-1 truncate font-mono">{houseWallet}</code>
                          <button onClick={copyWallet} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/30" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <Button
                      variant="neon"
                      className="w-full"
                      onClick={handleCryptoDeposit}
                    >
                      <Wallet className="w-4 h-4" />
                      Open Deposit Flow
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
