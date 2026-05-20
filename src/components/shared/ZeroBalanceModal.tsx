'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingDown } from 'lucide-react'
import { useWalletStore } from '@/store/walletStore'
import { useAuthStore } from '@/store/authStore'
import { FundingModal } from './FundingModal'
import { Button } from '@/components/ui/button'

/**
 * Monitors user balance and shows a funding prompt when both NC and SOL hit zero.
 * Shown only on game pages. Dismissed once any balance > 0.
 */
export function ZeroBalanceModal() {
  const { user } = useAuthStore()
  const { NC, SOL } = useWalletStore()
  const [showFunding, setShowFunding] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isEmpty = user && NC <= 0 && SOL <= 0

  // Auto-show when balance hits zero; auto-hide when refunded
  useEffect(() => {
    if (!isEmpty) {
      setDismissed(false) // reset dismissal when balance is restored
    }
  }, [isEmpty])

  if (!isEmpty || dismissed) return null

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center pointer-events-none"
        >
          {/* Subtle backdrop — doesn't fully block game */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" />

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="relative pointer-events-auto w-full max-w-sm mx-4 mb-4 sm:mb-0 glass-card border border-red-500/25 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-transparent pointer-events-none" />

            <div className="relative p-6 text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="text-5xl mb-3 inline-block"
              >
                💸
              </motion.div>

              <div className="flex items-center justify-center gap-1.5 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Zero Balance</span>
              </div>

              <h3 className="text-lg font-black text-white mb-1">You're out of funds!</h3>
              <p className="text-sm text-white/40 mb-5">
                Top up your balance to keep playing. Neon Coins are free — no crypto needed.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 text-sm"
                  onClick={() => setDismissed(true)}
                >
                  Dismiss
                </Button>
                <Button
                  variant="neon"
                  className="flex-1 text-sm"
                  onClick={() => setShowFunding(true)}
                >
                  Add Funds
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <FundingModal
        open={showFunding}
        onClose={() => setShowFunding(false)}
        urgentMode
      />
    </>
  )
}
