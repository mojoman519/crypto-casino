'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  xpReward: number
  earnedAt?: string
}

interface Props {
  achievement: Achievement
  earned?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function AchievementBadge({ achievement, earned = true, size = 'md' }: Props) {
  const sizes = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-3xl',
    lg: 'w-20 h-20 text-4xl',
  }

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={cn(
        'relative group flex flex-col items-center gap-1',
        !earned && 'opacity-30 grayscale'
      )}
    >
      <div className={cn(
        'rounded-2xl flex items-center justify-center border-2 transition-all duration-200',
        sizes[size],
        earned
          ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-500/40 group-hover:border-yellow-400/60 group-hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]'
          : 'bg-white/5 border-white/10'
      )}>
        {achievement.icon}
      </div>

      {size !== 'sm' && (
        <div className="text-center">
          <div className="text-xs font-semibold text-white/70 leading-tight">{achievement.name}</div>
          {earned && <div className="text-xs text-yellow-500/60">+{achievement.xpReward} XP</div>}
        </div>
      )}

      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-44 glass-card p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 text-center">
        <div className="font-semibold text-white">{achievement.name}</div>
        <div className="text-white/50 mt-0.5">{achievement.description}</div>
        {earned && <div className="text-yellow-400 mt-1">+{achievement.xpReward} XP earned</div>}
        {!earned && <div className="text-white/30 mt-1">Not yet earned</div>}
      </div>
    </motion.div>
  )
}
