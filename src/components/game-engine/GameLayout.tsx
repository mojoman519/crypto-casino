'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface GameLayoutProps {
  panel: React.ReactNode       // left betting panel
  game: React.ReactNode        // main game area
  className?: string
  title?: string
  badge?: string
}

export function GameLayout({ panel, game, className, title, badge }: GameLayoutProps) {
  return (
    <div className={cn('flex h-full min-h-[600px]', className)}>
      {/* Left betting panel */}
      <aside className="hidden lg:flex">{panel}</aside>

      {/* Game area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 via-transparent to-black/40" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        {title && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 flex items-center gap-3 px-6 py-4 border-b border-white/[0.05]"
          >
            <h1 className="text-lg font-black text-white">{title}</h1>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30">
                {badge}
              </span>
            )}
          </motion.div>
        )}

        {/* Game content */}
        <div className="relative z-10 flex-1 flex items-start justify-center p-4 lg:p-6">
          {game}
        </div>

        {/* Mobile betting panel */}
        <div className="lg:hidden border-t border-white/[0.06] bg-[#0d0d18]">
          {panel}
        </div>
      </main>
    </div>
  )
}
