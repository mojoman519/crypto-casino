'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Star, Clock, ChevronDown, Zap, Lock, Heart } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed'
import { cn } from '@/lib/utils'

export const ALL_GAMES = [
  { id: 'coinflip', name: 'Coin Flip', href: '/games/coinflip', icon: '🪙', badge: 'HOT', badgeColor: 'bg-orange-500/20 text-orange-400' },
  { id: 'crash',   name: 'Crash',     href: '/games/crash',    icon: '🚀', badge: 'LIVE', badgeColor: 'bg-emerald-500/20 text-emerald-400' },
  { id: 'jackpot', name: 'Jackpot',   href: '/games/jackpot',  icon: '💎', badge: 'MEGA', badgeColor: 'bg-cyan-500/20 text-cyan-400' },
  { id: 'roulette',name: 'Roulette',  href: '/games/roulette', icon: '🎡', badge: 'NEW',  badgeColor: 'bg-red-500/20 text-red-400' },
  { id: 'dice',    name: 'Dice',      href: '/games/dice',     icon: '🎲', badge: 'NEW',  badgeColor: 'bg-amber-500/20 text-amber-400' },
]

const COMING_SOON = [
  { id: 'slots',     name: 'Slots',     icon: '🎰' },
  { id: 'blackjack', name: 'Blackjack', icon: '🃏' },
  { id: 'plinko',    name: 'Plinko',    icon: '🔮' },
  { id: 'mines',     name: 'Mines',     icon: '💣' },
]

interface GameRowProps {
  game: typeof ALL_GAMES[0]
  isActive: boolean
  isFav: boolean
  onFavToggle: (id: string) => void
  onClick?: () => void
}

function GameRow({ game, isActive, isFav, onFavToggle, onClick }: GameRowProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link href={game.href} onClick={onClick}>
      <motion.div
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        whileHover={{ x: 3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group transition-all duration-200',
          isActive
            ? 'bg-purple-500/20 border border-purple-500/30'
            : 'hover:bg-white/[0.04] border border-transparent'
        )}
      >
        {/* Active glow indicator */}
        {isActive && (
          <motion.div
            layoutId="active-game"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-400 rounded-full"
            style={{ boxShadow: '0 0 8px rgba(167,139,250,0.8)' }}
          />
        )}

        <span className="text-xl leading-none flex-shrink-0">{game.icon}</span>

        <span className={cn(
          'flex-1 text-sm font-medium transition-colors',
          isActive ? 'text-white' : 'text-white/60 group-hover:text-white'
        )}>
          {game.name}
        </span>

        <div className="flex items-center gap-1.5">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded hidden group-hover:hidden', game.badgeColor, !hovered && 'flex')}>
            {game.badge}
          </span>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onFavToggle(game.id) }}
            className={cn(
              'opacity-0 group-hover:opacity-100 transition-all duration-200 p-0.5 rounded',
              isFav && 'opacity-100'
            )}
          >
            <Heart className={cn('w-3.5 h-3.5 transition-colors', isFav ? 'fill-pink-400 text-pink-400' : 'text-white/30 hover:text-pink-400')} />
          </button>
        </div>
      </motion.div>
    </Link>
  )
}

interface SectionProps {
  label: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ label, icon: Icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white/30 uppercase tracking-widest hover:text-white/50 transition-colors"
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">{label}</span>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { favorites, toggle, isFavorite } = useFavorites()
  const { recent, add } = useRecentlyPlayed()
  const [search, setSearch] = useState('')

  // Track recently played on route change
  useEffect(() => {
    const game = ALL_GAMES.find(g => g.href === pathname)
    if (game) add(game.id)
  }, [pathname]) // eslint-disable-line

  const filtered = search.trim()
    ? ALL_GAMES.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    : null

  const recentGames = recent.map(id => ALL_GAMES.find(g => g.id === id)).filter(Boolean) as typeof ALL_GAMES
  const favoriteGames = favorites.map(id => ALL_GAMES.find(g => g.id === id)).filter(Boolean) as typeof ALL_GAMES

  return (
    <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 bg-[#0a0a14] border-r border-white/[0.05] sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
      {/* Ambient glow */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />

      <div className="relative flex flex-col gap-1 p-3">

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
          />
        </div>

        {/* Search results */}
        {filtered && (
          <div className="mb-2">
            {filtered.length === 0
              ? <p className="text-xs text-white/20 text-center py-3">No games found</p>
              : filtered.map(game => (
                <GameRow key={game.id} game={game} isActive={pathname === game.href}
                  isFav={isFavorite(game.id)} onFavToggle={toggle} />
              ))
            }
          </div>
        )}

        {!filtered && (
          <>
            {/* Recently Played */}
            {recentGames.length > 0 && (
              <Section label="Recently Played" icon={Clock}>
                <div className="mb-2">
                  {recentGames.map(game => (
                    <GameRow key={game.id} game={game} isActive={pathname === game.href}
                      isFav={isFavorite(game.id)} onFavToggle={toggle} />
                  ))}
                </div>
              </Section>
            )}

            {/* Favorites */}
            {favoriteGames.length > 0 && (
              <Section label="Favorites" icon={Star}>
                <div className="mb-2">
                  {favoriteGames.map(game => (
                    <GameRow key={game.id} game={game} isActive={pathname === game.href}
                      isFav={isFavorite(game.id)} onFavToggle={toggle} />
                  ))}
                </div>
              </Section>
            )}

            {/* Originals */}
            <Section label="Originals" icon={Zap} defaultOpen>
              <div className="mb-2">
                {ALL_GAMES.map(game => (
                  <GameRow key={game.id} game={game} isActive={pathname === game.href}
                    isFav={isFavorite(game.id)} onFavToggle={toggle} />
                ))}
              </div>
            </Section>

            {/* Coming Soon */}
            <Section label="Coming Soon" icon={Lock} defaultOpen={false}>
              <div className="mb-2">
                {COMING_SOON.map(game => (
                  <div key={game.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl opacity-40 cursor-not-allowed">
                    <span className="text-xl leading-none">{game.icon}</span>
                    <span className="flex-1 text-sm font-medium text-white/60">{game.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/30">SOON</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Bottom promo */}
      <div className="mt-auto p-3">
        <div className="rounded-xl bg-gradient-to-br from-purple-900/40 to-pink-900/30 border border-purple-500/20 p-3 text-center">
          <div className="text-2xl mb-1">💎</div>
          <div className="text-xs font-bold text-white">Refer & Earn</div>
          <div className="text-[11px] text-white/40 mt-0.5">5% lifetime commission</div>
        </div>
      </div>
    </aside>
  )
}
