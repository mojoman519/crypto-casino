import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { RightPanel } from '@/components/layout/RightPanel'
import { MobileNav } from '@/components/layout/MobileNav'
import { WalletModal } from '@/components/wallet/WalletModal'
import { DepositModal } from '@/components/wallet/DepositModal'
import { WithdrawModal } from '@/components/wallet/WithdrawModal'
import { AmbientParticles } from '@/components/effects/AmbientParticles'
import { CelebrationOverlay } from '@/components/effects/CelebrationOverlay'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'NeonBet Casino', template: '%s | NeonBet Casino' },
  description: 'The most electrifying provably fair crypto casino on Solana & Ethereum. Play coin flip, crash, jackpot and more.',
  keywords: ['crypto casino', 'solana casino', 'ethereum casino', 'provably fair', 'crash game', 'coinflip'],
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'NeonBet Casino',
    description: 'Provably fair crypto gambling on Solana & Ethereum',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7c3aed',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {/* Ambient particles — z-index 0, sits behind the z-index:10 UI wrapper */}
          <AmbientParticles zIndex={0} />
          {/* Win celebration burst — z-index 9999, above everything */}
          <CelebrationOverlay />
          {/* relative + z-index:10 creates a stacking context above the particle canvas */}
          <div className="relative z-10 min-h-screen flex flex-col">
            <Navbar />
            {/* Fixed-height row: each column scrolls independently, no sticky needed */}
            <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>
              <Sidebar />
              <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
                {children}
              </main>
              <RightPanel />
            </div>
            <MobileNav />
          </div>
          <WalletModal />
          <DepositModal />
          <WithdrawModal />
        </Providers>
      </body>
    </html>
  )
}
