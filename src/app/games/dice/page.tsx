import type { Metadata } from 'next'
import { DiceGame } from '@/components/games/DiceGame'

export const metadata: Metadata = { title: 'Dice' }

export default function DicePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-white mb-2">
          🎲 <span className="neon-text">Dice</span>
        </h1>
        <p className="text-white/40">Roll over or under your target — adjust the slider to change win chance & payout</p>
      </div>
      <DiceGame />
    </div>
  )
}
