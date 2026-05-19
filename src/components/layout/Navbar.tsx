'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Wallet, ChevronDown, User, Trophy, LogOut,
  LayoutDashboard, Menu, X, Plus, ArrowDownToLine,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { formatCurrency, formatAddress } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/games/coinflip', label: 'Coin Flip', icon: '🪙' },
  { href: '/games/crash', label: 'Crash', icon: '🚀' },
  { href: '/games/jackpot', label: 'Jackpot', icon: '💎' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
]

export function Navbar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const { openWalletModal, openDepositModal, openWithdrawModal, connectedWallet } = useWalletStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-white/[0.05]" />
      <nav className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-neon-purple group-hover:shadow-neon-pink transition-shadow duration-300">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-black text-white hidden sm:block">
              Neon<span className="neon-text">Bet</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  pathname === link.href
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Neon Coins balance */}
                {user.neonCoins > 0 && (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card border border-purple-500/20">
                    <span className="text-base leading-none">🎮</span>
                    <span className="text-purple-300 font-bold font-mono text-sm">
                      {formatCurrency(user.neonCoins, 0)} NC
                    </span>
                  </div>
                )}

                {/* Real balance */}
                <button
                  onClick={openDepositModal}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-200 group"
                >
                  <span className="text-white/40 text-xs">◎</span>
                  <span className="text-emerald-300 font-bold font-mono text-sm">
                    {user.solBalance?.toFixed(4) ?? '0.0000'}
                  </span>
                  <Plus className="w-3 h-3 text-emerald-400 group-hover:text-emerald-300" />
                </button>

                {/* Deposit */}
                <Button
                  size="sm"
                  variant="neon"
                  onClick={openDepositModal}
                  className="hidden sm:flex"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Deposit
                </Button>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-white/[0.06] hover:border-white/20 transition-all duration-200"
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
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
                        className="absolute right-0 top-full mt-2 w-48 glass-card border border-white/[0.06] overflow-hidden z-50"
                      >
                        <div className="p-2 space-y-1">
                          {connectedWallet && (
                            <div className="px-3 py-2 text-xs text-white/40 font-mono">
                              {formatAddress(connectedWallet.address)}
                            </div>
                          )}
                          <Link
                            href="/profile"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <User className="w-4 h-4" />
                            Profile
                          </Link>
                          <Link
                            href="/leaderboard"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Trophy className="w-4 h-4" />
                            Leaderboard
                          </Link>
                          {user.role === 'ADMIN' && (
                            <Link
                              href="/admin"
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <LayoutDashboard className="w-4 h-4" />
                              Admin
                            </Link>
                          )}
                          <button
                            onClick={openWithdrawModal}
                            className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Wallet className="w-4 h-4" />
                            Withdraw
                          </button>
                          <div className="my-1 border-t border-white/5" />
                          <button
                            onClick={() => { logout(); setUserMenuOpen(false) }}
                            className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
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

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg glass-card border border-white/[0.06] text-white/60 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden border-t border-white/5"
            >
              <div className="py-3 space-y-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                      pathname === link.href
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span>{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
                {user && (
                  <>
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-white/40 text-sm">🎮 Neon Coins</span>
                      <span className="text-purple-300 font-bold">{formatCurrency(user.neonCoins ?? 0, 0)} NC</span>
                    </div>
                    <div className="px-4 py-2 flex items-center justify-between">
                      <span className="text-white/40 text-sm">◎ SOL Balance</span>
                      <span className="text-emerald-300 font-bold">{user.solBalance?.toFixed(4) ?? '0.0000'}</span>
                    </div>
                    <button
                      onClick={() => { openDepositModal(); setMobileOpen(false) }}
                      className="w-full btn-neon px-4 py-3 rounded-xl text-white font-semibold text-sm"
                    >
                      Deposit
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  )
}
