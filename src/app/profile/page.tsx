'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Edit2, Copy, Check, TrendingUp, TrendingDown, Gamepad2, Share2, Flame, Trophy, ExternalLink, Twitter } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { AnimatedBalance } from '@/components/shared/AnimatedBalance'
import { AchievementBadge } from '@/components/profile/AchievementBadge'
import { LevelBadge } from '@/components/profile/LevelBadge'
import { ProfileEditModal } from '@/components/profile/ProfileEditModal'
import { getAuthToken } from '@/lib/token'
import { formatBalance } from '@/lib/currency'
import { CURRENCY_ICONS } from '@/types/transactions'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const THEME_COLORS: Record<string, { primary: string; glow: string }> = {
  purple: { primary: '#7c3aed', glow: 'rgba(124,58,237,0.3)' },
  cyan:   { primary: '#06b6d4', glow: 'rgba(6,182,212,0.3)' },
  green:  { primary: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  gold:   { primary: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  red:    { primary: '#ef4444', glow: 'rgba(239,68,68,0.3)' },
}

interface ProfileData {
  user: {
    id: string
    username: string
    role: string
    totalWagered: number
    totalWon: number
    gamesPlayed: number
    createdAt: string
    wallets: { chain: string; address: string }[]
  }
  profile: {
    bio?: string
    website?: string
    twitter?: string
    discord?: string
    themeId: string
    avatarUrl?: string
    bannerUrl?: string
    level: number
    xp: number
    streak: number
    longestStreak: number
    biggestWin: number
    favoriteGame?: string
    progress: number
    rank: string
    xpNeeded: number
  }
  achievements: {
    id: string
    name: string
    description: string
    icon: string
    xpReward: number
    earnedAt: string
  }[]
  unlockedThemeIds: string[]
}

export default function ProfilePage() {
  const { user } = useAuthStore()
  const { openDepositModal, openWithdrawModal, NC, SOL } = useWalletStore()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [referralData, setReferralData] = useState<{ referralLink: string; totalReferrals: number; totalEarnings: number } | null>(null)

  const fetchProfile = () => {
    if (!user) return
    setIsLoading(true)
    fetch('/api/profile', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(r => r.json())
      .then(({ data }) => setProfileData(data))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (!user) return
    fetchProfile()
    // Trigger daily streak
    fetch('/api/profile/streak', { method: 'POST', headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.isNew && data?.xpGained > 0) {
          toast.success(`🔥 Day ${data.streak} streak! +${data.xpGained} XP`, { duration: 4000 })
        }
      }).catch(() => {})

    fetch('/api/referral', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(r => r.json())
      .then(({ data }) => setReferralData(data))
      .catch(() => {})
  }, [user?.id]) // eslint-disable-line

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/40">Connect your wallet to view your profile.</p>
      </div>
    )
  }

  const profile = profileData?.profile
  const achievements = profileData?.achievements ?? []
  const theme = THEME_COLORS[profile?.themeId ?? 'purple']
  const profitLoss = (profileData?.user.totalWon ?? 0) - (profileData?.user.totalWagered ?? 0)

  const copyReferral = () => {
    if (!referralData) return
    navigator.clipboard.writeText(referralData.referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Referral link copied!')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

        {/* Profile card */}
        <div className="glass-card overflow-hidden relative">
          {/* Animated banner */}
          <div
            className="h-32 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${theme.primary}40, ${theme.primary}10, rgba(0,0,0,0))` }}
          >
            <div className="absolute inset-0 bg-hero-pattern opacity-30" />
            <motion.div
              className="absolute inset-0"
              animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
              transition={{ duration: 8, repeat: Infinity, repeatType: 'reverse' }}
              style={{ background: `radial-gradient(circle at 30% 50%, ${theme.glow} 0%, transparent 60%)` }}
            />
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}
              className="absolute top-3 right-3 gap-1.5 text-xs">
              <Edit2 className="w-3.5 h-3.5" /> Edit Profile
            </Button>
          </div>

          <div className="p-6 -mt-12 relative">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-24 h-24 rounded-2xl overflow-hidden border-4 shadow-2xl"
                  style={{ borderColor: theme.primary, boxShadow: `0 0 30px ${theme.glow}` }}
                >
                  {profile?.avatarUrl
                    ? <img src={profile.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-black text-white">
                        {getInitials(user.username)}
                      </div>}
                </div>
                {profile && (
                  <div className="absolute -bottom-2 -right-2">
                    <LevelBadge level={profile.level} xp={profile.xp} showProgress={false} size="sm" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 mt-10 sm:mt-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-black text-white">{user.username}</h1>
                  {user.role === 'ADMIN' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">ADMIN</span>
                  )}
                  {user.role === 'VIP' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">VIP</span>
                  )}
                  {profile && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold border" style={{ color: theme.primary, borderColor: `${theme.primary}40`, background: `${theme.primary}15` }}>
                      {profile.rank}
                    </span>
                  )}
                </div>

                {profile?.bio && (
                  <p className="text-sm text-white/60 mb-2 max-w-lg">{profile.bio}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
                  <span>Joined {formatDate(profileData?.user.createdAt ?? '')}</span>
                  {profile?.streak && profile.streak > 1 && (
                    <span className="flex items-center gap-1 text-orange-400">
                      <Flame className="w-3.5 h-3.5" /> {profile.streak} day streak
                    </span>
                  )}
                  {profile?.twitter && (
                    <a href={`https://twitter.com/${profile.twitter.replace('@','')}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                      <Twitter className="w-3.5 h-3.5" /> {profile.twitter}
                    </a>
                  )}
                  {profile?.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Website
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* XP progress bar */}
            {profile && (
              <div className="mt-4">
                <LevelBadge level={profile.level} xp={profile.xp} showProgress size="md" />
              </div>
            )}
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { currency: 'NC' as const, balance: NC, label: 'Neon Coins', note: 'Demo' },
            { currency: 'SOL' as const, balance: SOL, label: 'Solana', note: 'Real' },
            { currency: 'ETH' as const, balance: 0, label: 'Ethereum', note: 'Soon' },
          ].map(({ currency, balance, label, note }) => (
            <div key={currency} className={cn('glass-card p-4 text-center', currency === 'ETH' && 'opacity-40')}>
              <div className="text-xl mb-1">{CURRENCY_ICONS[currency]}</div>
              <AnimatedBalance currency={currency} balance={balance} size="md" showIcon={false} className="justify-center" />
              <div className="text-xs text-white/30 mt-1">{label}</div>
              {currency === 'ETH' && <div className="text-xs text-white/20 mt-0.5">Coming Soon</div>}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Wagered', value: `$${formatCurrency(profileData?.user.totalWagered ?? 0)}`, icon: Gamepad2, color: 'text-purple-400' },
            { label: 'Total Won', value: `$${formatCurrency(profileData?.user.totalWon ?? 0)}`, icon: TrendingUp, color: 'text-emerald-400' },
            { label: 'P/L', value: `${profitLoss >= 0 ? '+' : ''}$${formatCurrency(profitLoss)}`, icon: profitLoss >= 0 ? TrendingUp : TrendingDown, color: profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Games', value: (profileData?.user.gamesPlayed ?? 0).toLocaleString(), icon: Gamepad2, color: 'text-cyan-400' },
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

        {/* Streak & achievements row */}
        {profile && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-5 h-5 text-orange-400" />
                <h2 className="font-bold text-white">Daily Streak</h2>
              </div>
              <div className="flex items-end gap-3">
                <div className="text-5xl font-black text-orange-400">{profile.streak}</div>
                <div>
                  <div className="text-white/60 text-sm">days in a row</div>
                  <div className="text-white/30 text-xs">Best: {profile.longestStreak} days</div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h2 className="font-bold text-white">Achievements ({achievements.length})</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {achievements.slice(0, 6).map(ach => (
                  <AchievementBadge key={ach.id} achievement={ach} size="sm" />
                ))}
                {achievements.length === 0 && (
                  <p className="text-white/30 text-sm">No achievements yet — start playing!</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transaction history */}
        <div className="glass-card p-5">
          <h2 className="text-lg font-bold text-white mb-4">📋 Transaction History</h2>
          {/* Reuse wallet store transactions */}
          <div className="text-center py-4 text-white/30 text-sm">
            View your transactions on the <a href="/profile#history" className="text-purple-400 underline">History tab</a>
          </div>
        </div>

        {/* Referral */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Share2 className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-white">Referral Program</h2>
            <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400 font-bold">5% lifetime</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Referrals', value: referralData?.totalReferrals ?? 0 },
              { label: 'Earnings', value: `$${formatCurrency(referralData?.totalEarnings ?? 0)}` },
              { label: 'Commission', value: '5%' },
            ].map(s => (
              <div key={s.label} className="glass-card p-3 text-center">
                <div className="text-xl font-black text-white">{s.value}</div>
                <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
            <code className="text-sm text-purple-300 flex-1 truncate font-mono">
              {referralData?.referralLink ?? `https://neonbet.gg/?ref=${user.username}`}
            </code>
            <button onClick={copyReferral} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/40" />}
            </button>
          </div>
        </div>

        {/* Wallet connections */}
        {profileData?.user.wallets && profileData.user.wallets.length > 0 && (
          <div className="glass-card p-5">
            <h2 className="font-bold text-white mb-3">🔗 Connected Wallets</h2>
            <div className="space-y-2">
              {profileData.user.wallets.map(w => (
                <div key={w.address} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{w.chain === 'SOLANA' ? '◎' : 'Ξ'}</span>
                    <span className="text-xs text-white/50 font-mono">{w.address}</span>
                  </div>
                  <span className="text-xs text-white/30">{w.chain}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <ProfileEditModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={fetchProfile} />
    </div>
  )
}
