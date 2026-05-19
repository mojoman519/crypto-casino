'use client'

import { motion } from 'framer-motion'
import { levelProgress, getRank, xpToNextLevel } from '@/lib/xp'
import { cn } from '@/lib/utils'

interface Props {
  level: number
  xp: number
  showProgress?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const LEVEL_COLORS = [
  [1, 'from-slate-500 to-slate-400'],
  [10, 'from-emerald-600 to-emerald-400'],
  [20, 'from-blue-600 to-cyan-400'],
  [35, 'from-purple-600 to-violet-400'],
  [50, 'from-yellow-600 to-amber-400'],
  [75, 'from-orange-600 to-red-400'],
  [100, 'from-pink-600 to-purple-600'],
]

function getLevelGradient(level: number): string {
  const match = [...LEVEL_COLORS].reverse().find(([min]) => level >= (min as number))
  return (match?.[1] as string) ?? 'from-slate-500 to-slate-400'
}

export function LevelBadge({ level, xp, showProgress = true, size = 'md' }: Props) {
  const progress = levelProgress(xp)
  const rank = getRank(level)
  const xpNeeded = xpToNextLevel(xp)
  const gradient = getLevelGradient(level)

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className={cn(
          `bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center font-black text-white shadow-lg`,
          sizes[size]
        )}>
          {level}
        </div>
        {size !== 'sm' && (
          <div>
            <div className="font-bold text-white text-sm">{rank}</div>
            <div className="text-xs text-white/40">Level {level}</div>
          </div>
        )}
      </div>

      {showProgress && (
        <div className="space-y-0.5">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden w-full">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          {size !== 'sm' && (
            <div className="text-xs text-white/30">{xpNeeded.toLocaleString()} XP to next level</div>
          )}
        </div>
      )}
    </div>
  )
}
