import type { Metadata } from 'next'
import { ComingSoon } from '@/components/shared/ComingSoon'

export const metadata: Metadata = { title: 'Coin Flip' }

export default function CoinFlipPage() {
  return <ComingSoon game="Coin Flip" icon="🪙" message="Coin Flip is being upgraded with new 3D visuals and enhanced mechanics." />
}
