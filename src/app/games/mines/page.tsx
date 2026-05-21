import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mines',
  description: 'Reveal tiles and avoid the mines. Cash out before hitting a bomb.',
}

const MinesGame = dynamic(
  () => import('@/components/games/mines/MinesGame').then(m => ({ default: m.MinesGame })),
  { ssr: false, loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  )}
)

export default function MinesPage() {
  return <MinesGame />
}
