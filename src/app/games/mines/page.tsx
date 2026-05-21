import type { Metadata } from 'next'
import { MinesPageClient } from './client'

export const metadata: Metadata = {
  title: 'Mines',
  description: 'Reveal tiles and avoid the mines. Cash out before hitting a bomb.',
}

export default function MinesPage() {
  return <MinesPageClient />
}
