import type { Metadata } from 'next'
import { PlinkoPageClient } from './client'

export const metadata: Metadata = {
  title: 'Plinko',
  description: 'Drop the ball and watch it bounce through pegs to win big multipliers.',
}

export default function PlinkoPage() {
  return <PlinkoPageClient />
}
