'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, Coins, Share2 } from 'lucide-react'
import { formatCurrency, getInitials } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

type Tab = 'wagered' | 'won' | 'referrals'

const MOCK_LEADERS = Array.from({ length: 20 }, (_, i) => ({
  rank: i + 1,
  username: ['degenKing', 'moonShot', 'whaleAlert', 'cryptoBro', 'ethMaxi', 'rugPuller', 'diamondH', 'YOLO420', 'NeverSell', 'BuyDip'][i % 10] + (i >= 10 ? i : ''),
  totalWagered: Math.random() * 500_000 + 10_000,
  totalWon: Math.random() * 400_000 + 5_000,
  gamesPlayed: Math.floor(Math.random() * 5000 + 100),
  referrals: Math.floor(Math.random() * 200),
  referralEarnings: Math.random() * 10_000,
}))

const RANK_STYLES = [
  'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  'text-slate-300 bg-slate-500/20 border-slate-400/30',
  'text-amber-600 bg-amber-700/20 border-amber-700/30',
]

const RANK_ICONS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('wagered')

  const sorted = [...MOCK_LEADERS].sort((a, b) => {
    if (tab === 'wagered') return b.totalWagered - a.totalWagered
    if (tab === 'won') return b.totalWon - a.totalWon
    return b.referralEarnings - a.referralEarnings
  }).map((l, i) => ({ ...l, rank: i + 1 }))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white">
              Leader<span className="neon-text">board</span>
            </h1>
            <p className="text-white/40 text-sm">Top degenerates this month</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 rounded-xl bg-white/5 w-fit">
          {([
            { id: 'wagered', label: 'Most Wagered', icon: Coins },
            { id: 'won', label: 'Most Won', icon: TrendingUp },
            { id: 'referrals', label: 'Referrals', icon: Share2 },
          ] as { id: Tab; label: string; icon: typeof Trophy }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                tab === t.id
                  ? 'bg-purple-600 text-white shadow-neon-purple'
                  : 'text-white/50 hover:text-white'
              )}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Top 3 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[sorted[1], sorted[0], sorted[2]].map((leader, podiumIdx) => {
            const actualRank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3
            return (
              <motion.div
                key={leader.username}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: podiumIdx * 0.1 }}
                className={cn(
                  'glass-card p-4 text-center relative',
                  podiumIdx === 1 && 'mt-0 border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]',
                  podiumIdx !== 1 && 'mt-6'
                )}
              >
                <div className="text-3xl mb-2">{RANK_ICONS[actualRank - 1]}</div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-black text-white mx-auto mb-2">
                  {getInitials(leader.username)}
                </div>
                <div className="font-bold text-white text-sm truncate">{leader.username}</div>
                <div className={cn('font-black text-lg mt-1', actualRank === 1 ? 'text-yellow-400' : 'neon-text')}>
                  ${formatCurrency(tab === 'wagered' ? leader.totalWagered : tab === 'won' ? leader.totalWon : leader.referralEarnings)}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Full table */}
        <div className="glass-card overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 text-xs text-white/30 uppercase tracking-widest border-b border-white/5">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Player</div>
            <div className="col-span-3 text-right">
              {tab === 'wagered' ? 'Wagered' : tab === 'won' ? 'Won' : 'Referral Earnings'}
            </div>
            <div className="col-span-2 text-right hidden sm:block">Games</div>
            <div className="col-span-2 text-right hidden sm:block">P/L</div>
          </div>

          {sorted.map((leader, i) => (
            <motion.div
              key={leader.username}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'grid grid-cols-12 items-center px-4 py-3 border-b border-white/[0.04] last:border-0 transition-colors hover:bg-white/[0.02]',
                user?.username === leader.username && 'bg-purple-500/5 border-purple-500/10'
              )}
            >
              <div className="col-span-1">
                {i < 3 ? (
                  <span className={cn('px-2 py-0.5 rounded border text-xs font-bold', RANK_STYLES[i])}>
                    {RANK_ICONS[i]}
                  </span>
                ) : (
                  <span className="text-white/30 text-sm font-mono">{leader.rank}</span>
                )}
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {getInitials(leader.username)}
                </div>
                <span className={cn('font-semibold text-sm truncate', user?.username === leader.username ? 'text-purple-300' : 'text-white')}>
                  {leader.username}
                  {user?.username === leader.username && ' (you)'}
                </span>
              </div>
              <div className="col-span-3 text-right font-mono font-bold text-white/90">
                ${formatCurrency(tab === 'wagered' ? leader.totalWagered : tab === 'won' ? leader.totalWon : leader.referralEarnings)}
              </div>
              <div className="col-span-2 text-right text-white/40 text-sm hidden sm:block font-mono">
                {leader.gamesPlayed.toLocaleString()}
              </div>
              <div className={cn('col-span-2 text-right text-sm font-bold hidden sm:block', leader.totalWon - leader.totalWagered >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {leader.totalWon - leader.totalWagered >= 0 ? '+' : ''}
                ${formatCurrency(Math.abs(leader.totalWon - leader.totalWagered))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
