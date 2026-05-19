'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, DollarSign, TrendingUp, Activity,
  Shield, Ban, Gift, RefreshCw, BarChart3,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getAuthToken } from '@/lib/token'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

interface AdminStats {
  totalUsers: number
  totalDeposited: number
  houseProfit: number
  recentGames: {
    id: string
    betAmount: number
    winAmount: number
    result: string
    createdAt: string
    user: { username: string }
  }[]
}

export default function AdminPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [giveAmount, setGiveAmount] = useState('')
  const [targetUser, setTargetUser] = useState('')

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    fetchStats()
  }, [user])

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!res.ok) throw new Error('Unauthorized')
      const { data } = await res.json()
      setStats(data)
    } catch {
      toast.error('Failed to load admin stats')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white mb-2">Access Denied</h1>
          <p className="text-white/40">You need admin privileges to view this page.</p>
        </div>
      </div>
    )
  }

  const STAT_CARDS = [
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      prefix: '',
    },
    {
      label: 'Total Deposited',
      value: stats?.totalDeposited ?? 0,
      icon: DollarSign,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      prefix: '$',
    },
    {
      label: 'House Profit',
      value: stats?.houseProfit ?? 0,
      icon: TrendingUp,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      prefix: '$',
    },
    {
      label: 'Recent Games',
      value: stats?.recentGames.length ?? 0,
      icon: Activity,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      prefix: '',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">Admin <span className="neon-text">Dashboard</span></h1>
              <p className="text-white/40 text-sm">House controls & analytics</p>
            </div>
          </div>
          <Button variant="secondary" onClick={fetchStats} disabled={isLoading}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {STAT_CARDS.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/40 uppercase tracking-widest">{card.label}</span>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', card.bg)}>
                  <card.icon className={cn('w-5 h-5', card.color)} />
                </div>
              </div>
              <div className="text-3xl font-black text-white">
                {card.prefix}{formatCurrency(card.value)}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent games */}
          <div className="lg:col-span-2 glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <h2 className="font-bold text-white">Recent Games</h2>
            </div>
            <div className="space-y-2">
              {stats?.recentGames.map((game) => (
                <div key={game.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      game.winAmount > 0 ? 'bg-emerald-400' : 'bg-red-400'
                    )} />
                    <span className="text-sm text-white/70">{game.user.username}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white/40">${formatCurrency(game.betAmount)}</span>
                    <span className={game.winAmount > 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {game.winAmount > 0 ? `+$${formatCurrency(game.winAmount)}` : `−$${formatCurrency(game.betAmount)}`}
                    </span>
                    <span className="text-white/20 text-xs">{game.result}</span>
                  </div>
                </div>
              )) ?? (
                <div className="text-white/30 text-sm text-center py-8">No games yet</div>
              )}
            </div>
          </div>

          {/* Admin actions */}
          <div className="space-y-4">
            <div className="glass-card p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4 text-yellow-400" />
                Give Balance
              </h2>
              <div className="space-y-3">
                <Input
                  placeholder="Username"
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">$</span>
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={giveAmount}
                    onChange={(e) => setGiveAmount(e.target.value)}
                    className="pl-7"
                  />
                </div>
                <Button variant="neon" className="w-full" onClick={() => toast.success('Balance granted!')}>
                  <Gift className="w-4 h-4" />
                  Grant Balance
                </Button>
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-400" />
                User Management
              </h2>
              <div className="space-y-3">
                <Input
                  placeholder="Search username..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <Button variant="danger" className="w-full" onClick={() => toast.error('User banned')}>
                  <Ban className="w-4 h-4" />
                  Ban User
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
