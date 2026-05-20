'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/',                icon: Home, label: 'Home',     emoji: null },
  { href: '/games/jackpot',   icon: null, label: 'Jackpot',  emoji: '💎' },
  { href: '/games/roulette',  icon: null, label: 'Roulette', emoji: '🎡' },
  { href: '/games/dice',      icon: null, label: 'Dice',     emoji: '🎲' },
  { href: '/leaderboard',     icon: null, label: 'Top',      emoji: '🏆' },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a14]/95 backdrop-blur-xl border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className="flex flex-col items-center justify-center py-2.5 gap-1 relative">
                {isActive && (
                  <motion.div
                    layoutId="mobile-active"
                    className="absolute inset-x-2 inset-y-1 rounded-xl bg-purple-500/15 border border-purple-500/25"
                  />
                )}
                <span className={cn('relative z-10 transition-all', isActive ? 'scale-110' : 'scale-100')}>
                  {item.emoji
                    ? <span className="text-xl leading-none">{item.emoji}</span>
                    : item.icon && <item.icon className={cn('w-5 h-5', isActive ? 'text-purple-300' : 'text-white/30')} />
                  }
                </span>
                <span className={cn(
                  'relative z-10 text-[10px] font-semibold transition-colors',
                  isActive ? 'text-purple-300' : 'text-white/30'
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
