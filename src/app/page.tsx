'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Zap, Shield, TrendingUp, Users, Coins, Rocket } from 'lucide-react'
import { LiveFeed } from '@/components/shared/LiveFeed'
import { AnimatedCounter } from '@/components/shared/AnimatedCounter'
import { useWalletStore } from '@/store/walletStore'

const GAMES = [
  {
    id: 'coinflip',
    name: 'Coin Flip',
    description: '50/50 shot at doubling your stack',
    href: '/games/coinflip',
    icon: '🪙',
    multiplier: '2x',
    gradient: 'from-violet-600/20 to-purple-600/20',
    border: 'hover:border-violet-500/50',
    glow: 'hover:shadow-[0_0_40px_rgba(139,92,246,0.2)]',
    badge: 'HOT',
    badgeColor: 'bg-orange-500/20 text-orange-400',
  },
  {
    id: 'crash',
    name: 'Crash',
    description: 'Cash out before the rocket explodes',
    href: '/games/crash',
    icon: '🚀',
    multiplier: '∞x',
    gradient: 'from-pink-600/20 to-rose-600/20',
    border: 'hover:border-pink-500/50',
    glow: 'hover:shadow-[0_0_40px_rgba(236,72,153,0.2)]',
    badge: 'LIVE',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
  },
  {
    id: 'jackpot',
    name: 'Jackpot',
    description: 'Win the entire pool in one spin',
    href: '/games/jackpot',
    icon: '💎',
    multiplier: '100x+',
    gradient: 'from-cyan-600/20 to-blue-600/20',
    border: 'hover:border-cyan-500/50',
    glow: 'hover:shadow-[0_0_40px_rgba(6,182,212,0.2)]',
    badge: 'MEGA',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
  },
]

const FEATURES = [
  { icon: Shield, title: 'Provably Fair', desc: 'Every game verifiable on-chain via HMAC-SHA256' },
  { icon: Zap, title: 'Instant Payouts', desc: 'Winnings hit your wallet in milliseconds' },
  { icon: Users, title: 'Multiplayer', desc: 'Compete and chat with players worldwide' },
  { icon: Coins, title: 'Multi-Chain', desc: 'Deposit with SOL, ETH, USDC and more' },
]

const STATS = [
  { label: 'Total Wagered', value: 48_392_100, prefix: '$', suffix: '' },
  { label: 'Players Online', value: 2847, prefix: '', suffix: '' },
  { label: 'Games Played', value: 1_203_944, prefix: '', suffix: '' },
  { label: 'Biggest Win', value: 94200, prefix: '$', suffix: '' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function HomePage() {
  const { openWalletModal } = useWalletStore()

  return (
    <div className="relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-pink-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Hero */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          className="text-center"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-purple-500/20 mb-8">
            <span className="live-dot" />
            <span className="text-sm text-purple-300 font-medium">2,847 players gambling right now</span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-none"
          >
            <span className="block text-white">THE MOST</span>
            <span className="block neon-text animate-gradient-shift bg-[length:200%_200%]">
              ELECTRIFYING
            </span>
            <span className="block text-white">CRYPTO CASINO</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10"
          >
            Provably fair games on Solana & Ethereum. Instant payouts.
            <br className="hidden sm:block" />
            Degeneracy at its finest.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={openWalletModal}
              className="btn-neon px-8 py-4 rounded-xl text-white font-bold text-lg"
            >
              <Rocket className="inline w-5 h-5 mr-2" />
              Connect & Play
            </button>
            <Link
              href="/games/crash"
              className="px-8 py-4 rounded-xl font-bold text-lg glass-card border border-purple-500/30 text-purple-300 hover:border-purple-500/60 transition-all duration-300 hover:bg-purple-500/10"
            >
              View Games
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-20"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {STATS.map((stat) => (
            <motion.div key={stat.label} variants={itemVariants} className="stat-card text-center">
              <div className="text-2xl sm:text-3xl font-black neon-text">
                {stat.prefix}
                <AnimatedCounter value={stat.value} />
                {stat.suffix}
              </div>
              <div className="text-xs text-white/40 uppercase tracking-widest mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Games */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-white">
              CHOOSE YOUR <span className="neon-text">GAME</span>
            </h2>
            <Link href="/games/crash" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
              View all →
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {GAMES.map((game, i) => (
              <motion.div key={game.id} variants={itemVariants} custom={i}>
                <Link href={game.href}>
                  <div
                    className={`game-card bg-gradient-to-br ${game.gradient} border border-white/[0.06] ${game.border} ${game.glow} transition-all duration-300 h-full group`}
                  >
                    {/* Badge */}
                    <div className="flex items-start justify-between">
                      <span className="text-6xl group-hover:animate-bounce">{game.icon}</span>
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${game.badgeColor}`}>
                        {game.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-white mb-2">{game.name}</h3>
                      <p className="text-white/50 text-sm">{game.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-white/40 text-sm">Max win</span>
                      <span className="text-2xl font-black neon-text">{game.multiplier}</span>
                    </div>

                    {/* Hover shimmer */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none shimmer rounded-2xl" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Live feed + features */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live feed */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="live-dot" />
                <h2 className="text-xl font-bold text-white">Live Bets</h2>
              </div>
              <LiveFeed />
            </motion.div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={containerVariants}
            >
              <h2 className="text-xl font-bold text-white mb-4">Why NeonBet?</h2>
              {FEATURES.map((f) => (
                <motion.div key={f.title} variants={itemVariants} className="glass-card p-4 flex gap-4 items-start mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <f.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{f.title}</div>
                    <div className="text-white/40 text-xs mt-0.5">{f.desc}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="neon-border rounded-3xl overflow-hidden"
        >
          <div className="relative p-8 sm:p-16 text-center bg-gradient-to-r from-purple-900/30 via-pink-900/20 to-cyan-900/20">
            <div className="absolute inset-0 bg-hero-pattern opacity-50" />
            <div className="relative">
              <div className="text-5xl mb-4">💎</div>
              <h2 className="text-3xl sm:text-5xl font-black text-white mb-4">
                Refer & <span className="neon-text">Earn 5%</span>
              </h2>
              <p className="text-white/50 mb-8 max-w-md mx-auto">
                Earn 5% of every bet your referrals make. Forever.
              </p>
              <button
                onClick={openWalletModal}
                className="btn-neon px-10 py-4 rounded-xl text-white font-bold text-lg"
              >
                <TrendingUp className="inline w-5 h-5 mr-2" />
                Start Earning
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
