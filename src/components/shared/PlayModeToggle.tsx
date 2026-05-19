'use client'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'

interface Props {
  mode: 'neon' | 'real'
  onChange: (mode: 'neon' | 'real') => void
}

export function PlayModeToggle({ mode, onChange }: Props) {
  const { user } = useAuthStore()

  return (
    <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/[0.06]">
      <button
        onClick={() => onChange('neon')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
          mode === 'neon'
            ? 'bg-purple-600/80 text-white shadow-neon-purple'
            : 'text-white/40 hover:text-white'
        )}
      >
        <span>🎮</span>
        <span>Neon Coins</span>
        {user && (
          <span className={cn('font-mono text-xs', mode === 'neon' ? 'text-purple-200' : 'text-white/30')}>
            {formatCurrency(user.neonCoins ?? 0, 0)}
          </span>
        )}
      </button>

      <button
        onClick={() => onChange('real')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
          mode === 'real'
            ? 'bg-emerald-600/80 text-white shadow-neon-green'
            : 'text-white/40 hover:text-white'
        )}
      >
        <span>◎</span>
        <span>Real SOL</span>
        {user && (
          <span className={cn('font-mono text-xs', mode === 'real' ? 'text-emerald-200' : 'text-white/30')}>
            {user.solBalance?.toFixed(4) ?? '0.0000'}
          </span>
        )}
      </button>
    </div>
  )
}
