'use client'

import dynamic from 'next/dynamic'

const MinesGame = dynamic(
  () => import('@/components/games/mines/MinesGame').then(m => ({ default: m.MinesGame })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    ),
  }
)

export function MinesPageClient() {
  return <MinesGame />
}
