'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, TrendingUp, TrendingDown, Gamepad2, Share2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getAuthToken } from '@/lib/token'
import { useWalletStore } from '@/store/walletStore'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { formatBalance } from '@/lib/currency'
import { CURRENCY_ICONS } from '@/types/transactions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const { user } = useAuthStore()
  const { openDepositModal, openWithdrawModal, NC, SOL, ETH, getRecentTransactions } = useWalletStore()
  const transactions = getRecentTransactions(30)
  const [copied, setCopied] = useState(false)
  const [referralData, setReferralData] = useState<{
    referralCode: string
    referralLink: string
    totalReferrals: number
    totalEarnings: number
    referrals: { username: string; wagered: number; yourEarnings: number; joinedAt: string }[]
  } | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/referral', {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    })
      .then((r) => r.json())
      .then(({ data }) => setReferralData(data))
      .catch(console.error)
  }, [user])

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-white/40">Please connect your wallet to view your profile.</p>
        </div>
      </div>
    )
  }

  const copyReferral = () => {
    if (!referralData) return
    navigator.clipboard.writeText(referralData.referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Referral link copied!')
  }

  const profitLoss = user.totalWon - user.totalWagered
  const winRate = user.gamesPlayed > 0 ? ((user.totalWon / user.totalWagered) * 100).toFixed(1) : '0'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Profile header */}
        <div className="glass-card p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-black text-white shadow-neon-purple">
                {getInitials(user.username)}
              </div>
              <div className={cn(
                'absolute -bottom-1 -right-1 px-2 py-0.5 rounded-lg text-xs font-bold',
                user.role === 'ADMIN' ? 'bg-red-500/30 text-red-300 border border-red-500/30' :
                user.role === 'VIP' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/30' :
                'bg-purple-500/30 text-purple-300 border border-purple-500/30'
              )}>
                {user.role}
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-black text-white">{user.username}</h1>
              <p className="text-white/40 text-sm mt-1">Member since {formatDate(user.createdAt)}</p>

              <div className="flex flex-wrap gap-3 mt-4 justify-center sm:justify-start">
                <Button variant="neon" size="sm" onClick={openDepositModal}>Deposit</Button>
                <Button variant="outline" size="sm" onClick={openWithdrawModal}>Withdraw</Button>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Balance</div>
              <div className="text-4xl font-black neon-text">${formatCurrency(user.balance)}</div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Wagered', value: `$${formatCurrency(user.totalWagered)}`, icon: Gamepad2, color: 'text-purple-400' },
            { label: 'Total Won', value: `$${formatCurrency(user.totalWon)}`, icon: TrendingUp, color: 'text-emerald-400' },
            { label: 'P/L', value: `${profitLoss >= 0 ? '+' : ''}$${formatCurrency(profitLoss)}`, icon: profitLoss >= 0 ? TrendingUp : TrendingDown, color: profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Games Played', value: user.gamesPlayed.toLocaleString(), icon: Gamepad2, color: 'text-cyan-400' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/30 uppercase tracking-widest">{stat.label}</span>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div className={cn('text-xl font-black', stat.color)}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Referral program */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Share2 className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Referral Program</h2>
            <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400 font-bold">5% lifetime</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-black text-white">{referralData?.totalReferrals ?? 0}</div>
              <div className="text-xs text-white/40 mt-1">Total Referrals</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-black text-emerald-400">
                ${formatCurrency(referralData?.totalEarnings ?? 0)}
              </div>
              <div className="text-xs text-white/40 mt-1">Total Earned</div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-2xl font-black text-purple-400">5%</div>
              <div className="text-xs text-white/40 mt-1">Commission Rate</div>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest mb-2 block">Your Referral Link</label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
              <code className="text-sm text-purple-300 flex-1 truncate font-mono">
                {referralData?.referralLink ?? `https://neonbet.gg/?ref=${user.referralCode}`}
              </code>
              <button
                onClick={copyReferral}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/40" />}
              </button>
            </div>
          </div>

          {referralData && referralData.referrals.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Your Referrals</div>
              <div className="space-y-2">
                {referralData.referrals.map((r) => (
                  <div key={r.username} className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-white/70">{r.username}</span>
                    <div className="text-right">
                      <div className="text-sm text-white font-mono">${formatCurrency(r.wagered)} wagered</div>
                      <div className="text-xs text-emerald-400">+${formatCurrency(r.yourEarnings)} earned</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Balances */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-white mb-4">💰 Balances</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { currency: 'NC' as const, balance: NC, label: 'Neon Coins', note: 'Demo only' },
              { currency: 'SOL' as const, balance: SOL, label: 'Solana', note: 'Real money' },
              { currency: 'ETH' as const, balance: ETH, label: 'Ethereum', note: 'Coming soon' },
            ]).map(({ currency, balance: bal, label, note }) => (
              <div key={currency} className={cn(
                'glass-card p-4 text-center',
                currency === 'ETH' && 'opacity-50'
              )}>
                <div className="text-2xl mb-1">{CURRENCY_ICONS[currency]}</div>
                <AnimatedBalance currency={currency} balance={bal} size="lg" showIcon={false} className="justify-center" />
                <div className="text-xs text-white/40 mt-1">{label}</div>
                <div className="text-xs text-white/20 mt-0.5">{note}</div>
                {currency === 'ETH' && (
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-white/5 text-white/30 text-xs">Coming Soon</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Transaction history */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-white mb-4">📋 Transaction History</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-sm">No transactions yet — start playing!</div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {transactions.map((tx) => (
                <div key={tx.id} className={cn(
                  'flex items-center justify-between p-3 rounded-xl transition-colors',
                  tx.status === 'rolled_back' ? 'opacity-40' : '',
                  tx.type === 'WIN' ? 'bg-emerald-500/5 hover:bg-emerald-500/10' :
                  tx.type === 'LOSS' || tx.type === 'BET' ? 'bg-red-500/5 hover:bg-red-500/10' :
                  tx.type === 'DEPOSIT' ? 'bg-blue-500/5 hover:bg-blue-500/10' :
                  'bg-white/[0.02] hover:bg-white/[0.04]'
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {tx.type === 'WIN' ? '🎉' :
                       tx.type === 'LOSS' ? '💸' :
                       tx.type === 'BET' ? '🎲' :
                       tx.type === 'DEPOSIT' ? '📥' :
                       tx.type === 'WITHDRAWAL' ? '📤' : '💰'}
                    </span>
                    <div>
                      <div className="text-sm text-white/80">{tx.description}</div>
                      <div className="text-xs text-white/30">{new Date(tx.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      'text-sm font-bold font-mono',
                      tx.type === 'WIN' || tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {tx.type === 'WIN' || tx.type === 'DEPOSIT' ? '+' : '-'}
                      {formatBalance(tx.amount, tx.currency)}
                    </div>
                    <div className="text-xs text-white/30 font-mono">
                      bal: {formatBalance(tx.balanceAfter, tx.currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
