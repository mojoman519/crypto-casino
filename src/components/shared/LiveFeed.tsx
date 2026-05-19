'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { LiveBetEvent } from '@/types'

const MOCK_USERNAMES = [
  'degenKing', 'moonShot', 'rugPuller', 'solJockey', 'ethMaxi',
  'cryptoBro', 'diamondHands', 'paperhands', 'whaleAlert', 'apeIn',
  'NotAScam', 'legitGambler', 'YOLO420', 'NeverSell', 'BuyTheDip',
]

const MOCK_GAMES = ['COINFLIP', 'CRASH', 'JACKPOT'] as const

function generateMockBet(): LiveBetEvent {
  const won = Math.random() > 0.47
  const betAmount = Math.random() < 0.5 ? Math.random() * 50 + 1 : Math.random() * 500 + 50
  const multiplier = won
    ? MOCK_GAMES[Math.floor(Math.random() * 3)] === 'CRASH'
      ? 1.5 + Math.random() * 10
      : 2
    : 0
  return {
    id: `bet_${Date.now()}_${Math.random()}`,
    username: MOCK_USERNAMES[Math.floor(Math.random() * MOCK_USERNAMES.length)],
    game: MOCK_GAMES[Math.floor(Math.random() * MOCK_GAMES.length)],
    betAmount,
    winAmount: won ? betAmount * multiplier : 0,
    multiplier: won ? multiplier : undefined,
    result: won ? 'win' : 'loss',
    timestamp: Date.now(),
  }
}

const GAME_ICONS: Record<string, string> = {
  COINFLIP: '🪙',
  CRASH: '🚀',
  JACKPOT: '💎',
}

export function LiveFeed() {
  const [bets, setBets] = useState<LiveBetEvent[]>(() =>
    Array.from({ length: 12 }, generateMockBet)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setBets((prev) => [generateMockBet(), ...prev].slice(0, 30))
    }, 1800 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="glass-card overflow-hidden">
      <div className="max-h-[400px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {bets.map((bet) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                'flex items-center justify-between px-4 py-3 border-b border-white/[0.04] last:border-0',
                bet.result === 'win' ? 'hover:bg-emerald-500/5' : 'hover:bg-red-500/5',
                'transition-colors duration-200 group'
              )}
            >
              {/* Left: user + game */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-bold text-white">
                  {bet.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate max-w-[80px]">{bet.username}</span>
                    <span className="text-xs text-white/30 hidden sm:block">
                      {GAME_ICONS[bet.game]} {bet.game.toLowerCase()}
                    </span>
                  </div>
                  <div className="text-xs text-white/30">
                    wagered <span className="text-white/50 font-mono">${formatCurrency(bet.betAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Right: result */}
              <div className="flex-shrink-0 text-right">
                {bet.result === 'win' ? (
                  <div>
                    <div className="text-sm font-bold text-emerald-400">
                      +${formatCurrency(bet.winAmount ?? 0)}
                    </div>
                    {bet.multiplier && (
                      <div className="text-xs text-emerald-600">{bet.multiplier.toFixed(2)}×</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm font-bold text-red-400/70">
                    −${formatCurrency(bet.betAmount)}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
