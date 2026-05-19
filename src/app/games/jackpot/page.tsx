import type { Metadata } from 'next'
import { JackpotGame } from '@/components/games/JackpotGame'

export const metadata: Metadata = { title: 'Jackpot' }

export default function JackpotPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-white mb-2">
          💎 <span className="neon-text">Jackpot</span>
        </h1>
        <p className="text-white/40">Buy tickets proportional to your bet — winner takes the pot</p>
      </div>
      <JackpotGame />
    </div>
  )
}
