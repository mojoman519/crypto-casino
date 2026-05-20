import type { Metadata } from 'next'
import { ComingSoon } from '@/components/shared/ComingSoon'

export const metadata: Metadata = { title: 'Crash' }

export default function CrashPage() {
  return <ComingSoon game="Crash" icon="🚀" message="Crash is getting a full rebuild with real-time multiplayer and live socket sync." />
}
