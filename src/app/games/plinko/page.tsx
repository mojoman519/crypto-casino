import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Plinko',
  description: 'Drop the ball and watch it bounce through pegs to win big multipliers.',
}

const PlinkoGame = dynamic(
  () => import('@/components/games/plinko/PlinkoGame').then(m => ({ default: m.PlinkoGame })),
  { ssr: false, loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  )}
)

export default function PlinkoPage() {
  return <PlinkoGame />
}
