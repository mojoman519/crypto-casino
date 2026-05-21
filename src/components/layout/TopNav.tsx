'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Gamepad2, User, Gift, Trophy, Shield, Star, Package, Settings, ChevronDown, Lock } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  comingSoon?: boolean
  badge?: string
  children?: { label: string; href: string; comingSoon?: boolean }[]
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home',        label: 'Home',        href: '/',            icon: Home },
  { id: 'games',       label: 'Games',       href: '/games/dice',  icon: Gamepad2,
    children: [
      { label: 'Mines',    href: '/games/mines' },
      { label: 'Plinko',   href: '/games/plinko' },
      { label: 'Dice',     href: '/games/dice' },
      { label: 'Roulette', href: '/games/roulette' },
      { label: 'Jackpot',  href: '/games/jackpot' },
      { label: 'Blackjack',href: '#', comingSoon: true },
      { label: 'Slots',    href: '#', comingSoon: true },
    ],
  },
  { id: 'profile',     label: 'Profile',     href: '/profile',     icon: User },
  { id: 'leaderboard', label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { id: 'rewards',     label: 'Rewards',     href: '#',            icon: Gift,   comingSoon: true, badge: 'SOON' },
  { id: 'battlepass',  label: 'Battle Pass', href: '#',            icon: Shield, comingSoon: true, badge: 'SOON' },
  { id: 'vip',         label: 'VIP',         href: '#',            icon: Star,   comingSoon: true, badge: 'SOON' },
  { id: 'inventory',   label: 'Inventory',   href: '#',            icon: Package,comingSoon: true, badge: 'SOON' },
  { id: 'settings',    label: 'Settings',    href: '#',            icon: Settings,comingSoon: true },
]

export function TopNav() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const isActive = (item: NavItem) => {
    if (item.href === '/') return pathname === '/'
    return pathname.startsWith(item.href.replace('#', '___'))
  }

  return (
    <div className="sticky top-0 z-20 w-full bg-[#0a0a14]/90 backdrop-blur-xl border-b border-white/[0.05] overflow-x-auto">
      <div className="flex items-center gap-1 px-4 py-1 min-w-max">
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          const needsAuth = ['profile', 'inventory'].includes(item.id) && !user

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => item.children && setOpenDropdown(item.id)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <Link
                href={item.comingSoon || needsAuth ? '#' : item.href}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group whitespace-nowrap',
                  active
                    ? 'text-white'
                    : item.comingSoon
                    ? 'text-white/20 cursor-not-allowed'
                    : 'text-white/50 hover:text-white/80'
                )}
                onClick={e => { if (item.comingSoon) e.preventDefault() }}
              >
                {/* Active glow underline */}
                {active && (
                  <motion.div
                    layoutId="topnav-active"
                    className="absolute inset-x-1 bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                    style={{ boxShadow: '0 0 8px rgba(168,85,247,0.8)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}

                {/* Hover background */}
                {!item.comingSoon && (
                  <span className={cn(
                    'absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                    'bg-white/[0.04]'
                  )} />
                )}

                <item.icon className={cn(
                  'w-3.5 h-3.5 relative z-10 transition-colors',
                  active ? 'text-purple-300' : item.comingSoon ? 'text-white/15' : 'text-white/40 group-hover:text-white/70'
                )} />

                <span className="relative z-10">{item.label}</span>

                {item.badge && (
                  <span className="relative z-10 text-[9px] font-black px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/20">
                    {item.badge}
                  </span>
                )}

                {item.comingSoon && (
                  <Lock className="relative z-10 w-2.5 h-2.5 text-white/15" />
                )}

                {item.children && (
                  <ChevronDown className={cn(
                    'relative z-10 w-3 h-3 text-white/30 transition-transform duration-200',
                    openDropdown === item.id && 'rotate-180'
                  )} />
                )}
              </Link>

              {/* Dropdown */}
              <AnimatePresence>
                {item.children && openDropdown === item.id && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1 w-44 glass-card border border-white/[0.08] overflow-hidden z-50 py-1"
                  >
                    {item.children.map(child => (
                      <Link
                        key={child.label}
                        href={child.comingSoon ? '#' : child.href}
                        onClick={e => { if (child.comingSoon) e.preventDefault() }}
                        className={cn(
                          'flex items-center justify-between px-4 py-2.5 text-xs transition-colors',
                          child.comingSoon
                            ? 'text-white/20 cursor-not-allowed'
                            : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                        )}
                      >
                        {child.label}
                        {child.comingSoon && (
                          <span className="text-[9px] bg-white/10 text-white/30 px-1.5 py-0.5 rounded font-bold">SOON</span>
                        )}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
