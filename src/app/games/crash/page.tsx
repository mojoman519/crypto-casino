import type { Metadata } from 'next'
import { CrashGame } from '@/components/games/CrashGame'

export const metadata: Metadata = { title: 'Crash' }

export default function CrashPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-white mb-2">
          🚀 Crash <span className="neon-text">Game</span>
        </h1>
        <p className="text-white/40">Cash out before the rocket crashes — or hold for maximum gains</p>
      </div>
      <CrashGame />
    </div>
  )
}
