import type { Metadata } from 'next'
import { RouletteGame } from '@/components/games/RouletteGame'

export const metadata: Metadata = { title: 'Roulette' }

export default function RoulettePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-white mb-2">
          🎡 <span className="neon-text">Roulette</span>
        </h1>
        <p className="text-white/40">Red (48%) · Black (48%) · Green (4% · 24×)</p>
      </div>
      <RouletteGame />
    </div>
  )
}
