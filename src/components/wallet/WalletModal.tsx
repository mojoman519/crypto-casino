'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, X, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWalletStore } from '@/store/walletStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type Chain = 'SOLANA' | 'ETHEREUM'
type View = 'choose' | 'connect' | 'register' | 'login'

const SOLANA_WALLETS = [
  { id: 'phantom', name: 'Phantom', icon: '👻', description: 'Most popular Solana wallet' },
  { id: 'solflare', name: 'Solflare', icon: '☀️', description: 'Feature-rich Solana wallet' },
  { id: 'backpack', name: 'Backpack', icon: '🎒', description: 'Multi-chain xNFT wallet' },
]

const ETH_WALLETS = [
  { id: 'metamask', name: 'MetaMask', icon: '🦊', description: 'The OG Ethereum wallet' },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: '🔵', description: 'Easy onboarding wallet' },
  { id: 'walletconnect', name: 'WalletConnect', icon: '🔗', description: 'Connect any wallet' },
]

export function WalletModal() {
  const { isWalletModalOpen, closeWalletModal, selectedChain, setSelectedChain, setConnectedWallet } = useWalletStore()
  const { login } = useAuthStore()
  const [view, setView] = useState<View>('choose')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state for email login
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  const handleClose = () => {
    closeWalletModal()
    setTimeout(() => {
      setView('choose')
      setError(null)
      setIsLoading(false)
    }, 300)
  }

  const handleWalletConnect = async (walletId: string, chain: Chain) => {
    setIsLoading(true)
    setError(null)
    try {
      // Simulate wallet connection — replace with actual wallet adapter logic
      await new Promise((r) => setTimeout(r, 1200))

      const mockAddress = chain === 'SOLANA'
        ? `So1${Math.random().toString(36).slice(2, 12)}...${Math.random().toString(36).slice(2, 6)}`
        : `0x${Math.random().toString(16).slice(2, 12)}...${Math.random().toString(16).slice(2, 6)}`

      const mockSignature = `sig_${Math.random().toString(36).slice(2, 20)}`
      const message = `Sign in to NeonBet Casino\nNonce: ${Date.now()}`

      const res = await fetch('/api/auth/wallet-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain, address: mockAddress, signature: mockSignature, message }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Connection failed')
      }

      const { data } = await res.json()
      login(data.user, data.token)
      setConnectedWallet({ id: 'wlt_1', chain, address: mockAddress, isDefault: true })
      toast.success(`${walletId} connected!`)
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (isRegister: boolean) => {
    if (!username || !password) {
      setError('Please fill in all fields')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const body = isRegister ? { username, password, email } : { username, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Authentication failed')
      }

      const { data } = await res.json()
      login(data.user, data.token)
      toast.success(isRegister ? 'Account created!' : 'Welcome back!')
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  const wallets = selectedChain === 'SOLANA' ? SOLANA_WALLETS : ETH_WALLETS

  return (
    <Dialog open={isWalletModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border border-purple-500/20">
        {/* Purple glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/10 rounded-2xl pointer-events-none" />

        <div className="relative">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <DialogTitle className="text-xl">
                {view === 'choose' && 'Connect to NeonBet'}
                {view === 'connect' && `Connect ${selectedChain === 'SOLANA' ? 'Solana' : 'Ethereum'} Wallet`}
                {view === 'register' && 'Create Account'}
                {view === 'login' && 'Sign In'}
              </DialogTitle>
            </div>
            <p className="text-sm text-white/40">
              {view === 'choose' && 'Choose how you want to connect'}
              {view === 'connect' && 'Select your wallet to continue'}
              {view === 'register' && 'Create your NeonBet account'}
              {view === 'login' && 'Welcome back, degen'}
            </p>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {view === 'choose' && (
              <motion.div key="choose" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="space-y-3">
                  {/* Chain selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/5">
                    {(['SOLANA', 'ETHEREUM'] as Chain[]).map((c) => (
                      <button
                        key={c}
                        onClick={() => setSelectedChain(c)}
                        className={cn(
                          'py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200',
                          selectedChain === c
                            ? 'bg-purple-600 text-white shadow-neon-purple'
                            : 'text-white/50 hover:text-white'
                        )}
                      >
                        {c === 'SOLANA' ? '◎ Solana' : 'Ξ Ethereum'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setView('connect')}
                    className="w-full flex items-center justify-between p-4 rounded-xl glass-card border border-white/[0.08] hover:border-purple-500/40 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedChain === 'SOLANA' ? '👛' : '🦊'}</span>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-white">Connect with Wallet</div>
                        <div className="text-xs text-white/40">Sign in with your crypto wallet</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-purple-400 transition-colors" />
                  </button>

                  <div className="relative flex items-center py-2">
                    <div className="flex-1 border-t border-white/10" />
                    <span className="mx-4 text-xs text-white/30">or</span>
                    <div className="flex-1 border-t border-white/10" />
                  </div>

                  <button
                    onClick={() => setView('login')}
                    className="w-full flex items-center justify-between p-4 rounded-xl glass-card border border-white/[0.08] hover:border-purple-500/40 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📧</span>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-white">Email & Password</div>
                        <div className="text-xs text-white/40">Classic account login</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-purple-400 transition-colors" />
                  </button>

                  <p className="text-center text-xs text-white/30 pt-2">
                    By connecting, you agree to our Terms of Service
                  </p>
                </div>
              </motion.div>
            )}

            {view === 'connect' && (
              <motion.div key="connect" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-3">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => handleWalletConnect(wallet.id, selectedChain)}
                      disabled={isLoading}
                      className="w-full flex items-center justify-between p-4 rounded-xl glass-card border border-white/[0.08] hover:border-purple-500/40 disabled:opacity-50 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{wallet.icon}</span>
                        <div className="text-left">
                          <div className="text-sm font-semibold text-white">{wallet.name}</div>
                          <div className="text-xs text-white/40">{wallet.description}</div>
                        </div>
                      </div>
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-purple-400 transition-colors" />
                      )}
                    </button>
                  ))}
                  <button onClick={() => setView('choose')} className="text-sm text-white/40 hover:text-white transition-colors w-full text-center pt-2">
                    ← Back
                  </button>
                </div>
              </motion.div>
            )}

            {(view === 'login' || view === 'register') && (
              <motion.div key={view} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-3">
                  {view === 'register' && (
                    <Input
                      placeholder="Email (optional)"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  )}
                  <Input
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <Input
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth(view === 'register')}
                  />

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <Button
                    variant="neon"
                    className="w-full"
                    onClick={() => handleEmailAuth(view === 'register')}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {view === 'register' ? 'Create Account' : 'Sign In'}
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <button onClick={() => setView('choose')} className="text-white/40 hover:text-white transition-colors">
                      ← Back
                    </button>
                    <button
                      onClick={() => setView(view === 'login' ? 'register' : 'login')}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {view === 'login' ? 'Create account →' : 'Sign in →'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
