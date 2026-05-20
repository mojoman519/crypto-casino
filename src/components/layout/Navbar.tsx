'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Wallet, ChevronDown, User, Trophy, LogOut,
  LayoutDashboard, ArrowDownToLine, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { formatAddress } from '@/lib/utils'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { user, logout } = useAuthStore()
  const { openWalletModal, openDepositModal, openWithdrawModal, connectedWallet, NC, SOL } = useWalletStore()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full h-16 flex-shrink-0">
      <div className="absolute inset-0 bg-[#0a0a14]/90 backdrop-blur-xl border-b border-white/[0.05]" />

      <nav className="relative h-full max-w-none px-4 sm:px-6 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-neon-purple group-hover:shadow-neon-pink transition-shadow duration-300">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-black text-white hidden sm:block">
            Neon<span className="neon-text">Bet</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {user ? (
            <>
              {/* NC balance */}
              <div className="hidden sm:flex items-center px-3 py-2 rounded-xl glass-card border border-purple-500/20">
                <AnimatedBalance currency="NC" balance={NC} size="sm" />
              </div>

              {/* SOL balance + add */}
              <button
                onClick={openDepositModal}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-200 group"
              >
                <AnimatedBalance currency="SOL" balance={SOL} size="sm" />
              </button>

              {/* Deposit button */}
              <Button size="sm" variant="neon" onClick={openDepositModal} className="hidden sm:flex gap-1.5">
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Deposit
              </Button>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-white/[0.06] hover:border-white/20 transition-all duration-200"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {user.username.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm text-white/80 hidden sm:block max-w-[80px] truncate">
                    {user.username}
                  </span>
                  <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform duration-200', userMenuOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-52 glass-card border border-white/[0.06] overflow-hidden z-50"
                    >
                      <div className="p-2 space-y-1">
                        {/* Balance summary */}
                        <div className="px-3 py-2 space-y-1 border-b border-white/5 mb-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/40">Neon Coins</span>
                            <AnimatedBalance currency="NC" balance={NC} size="sm" showIcon={false} />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/40">SOL</span>
                            <AnimatedBalance currency="SOL" balance={SOL} size="sm" showIcon={false} />
                          </div>
                        </div>

                        {connectedWallet && (
                          <div className="px-3 py-1 text-xs text-white/30 font-mono">
                            {formatAddress(connectedWallet.address)}
                          </div>
                        )}

                        <Link href="/profile"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          onClick={() => setUserMenuOpen(false)}>
                          <User className="w-4 h-4" /> Profile
                        </Link>

                        <Link href="/leaderboard"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          onClick={() => setUserMenuOpen(false)}>
                          <Trophy className="w-4 h-4" /> Leaderboard
                        </Link>

                        {user.role === 'ADMIN' && (
                          <Link href="/admin"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                            onClick={() => setUserMenuOpen(false)}>
                            <LayoutDashboard className="w-4 h-4" /> Admin
                          </Link>
                        )}

                        <button onClick={openWithdrawModal}
                          className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                          <Wallet className="w-4 h-4" /> Withdraw
                        </button>

                        <div className="my-1 border-t border-white/5" />

                        <button onClick={() => { logout(); setUserMenuOpen(false) }}
                          className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <Button variant="neon" onClick={openWalletModal}>
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </Button>
          )}

          {/* Mobile menu toggle (shows deposit/balance) */}
          {user && (
            <button
              className="sm:hidden p-2 rounded-lg glass-card border border-white/[0.06] text-white/60 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile balance drawer */}
      <AnimatePresence>
        {mobileMenuOpen && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative border-t border-white/5 bg-[#0a0a14]/95 px-4 py-3 flex gap-3 items-center sm:hidden"
          >
            <AnimatedBalance currency="NC" balance={NC} size="sm" />
            <AnimatedBalance currency="SOL" balance={SOL} size="sm" />
            <Button size="sm" variant="neon" onClick={() => { openDepositModal(); setMobileMenuOpen(false) }} className="ml-auto">
              <ArrowDownToLine className="w-3.5 h-3.5" /> Deposit
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
