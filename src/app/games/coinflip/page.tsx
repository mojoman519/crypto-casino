import type { Metadata } from 'next'
import { CoinFlip } from '@/components/games/CoinFlip'
import { LiveFeed } from '@/components/shared/LiveFeed'

export const metadata: Metadata = { title: 'Coin Flip' }

export default function CoinFlipPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black text-white mb-2">
          🪙 Coin <span className="neon-text">Flip</span>
        </h1>
        <p className="text-white/40">50/50 provably fair — double your money or lose it all</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CoinFlip />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="live-dot" />
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Live Feed</h2>
          </div>
          <LiveFeed />
        </div>
      </div>
    </div>
  )
}
