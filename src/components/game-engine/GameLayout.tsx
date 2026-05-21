'use client'

import { cn } from '@/lib/utils'

interface GameLayoutProps {
  panel: React.ReactNode
  game: React.ReactNode
  className?: string
  title?: string
  badge?: string
}

export function GameLayout({ panel, game, className }: GameLayoutProps) {
  return (
    <div className={cn('flex w-full', className)}>
      {/* Left betting panel — desktop only */}
      <aside className="hidden lg:flex flex-shrink-0">{panel}</aside>

      {/* Game area */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-start justify-center p-2 lg:p-3">
          {game}
        </div>

        {/* Mobile betting panel */}
        <div className="lg:hidden border-t border-white/[0.06] bg-[#0d0d18]">
          {panel}
        </div>
      </div>
    </div>
  )
}
