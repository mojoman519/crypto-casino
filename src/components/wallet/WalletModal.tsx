'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, Loader2, AlertCircle, ChevronRight, Gamepad2, Coins } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWalletStore } from '@/store/walletStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type View = 'choose' | 'demo-setup' | 'sol-connect' | 'email'
type AuthMode = 'login' | 'register'

const NEON_PRESETS = [1_000, 10_000, 100_000, 1_000_000]

export function WalletModal() {
  const { isWalletModalOpen, closeWalletModal, setConnectedWallet } = useWalletStore()
  const { login } = useAuthStore()

  const [view, setView] = useState<View>('choose')
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Demo setup state
  const [selectedNeon, setSelectedNeon] = useState(10_000)
  const [customNeon, setCustomNeon] = useState('')
  const [demoUsername, setDemoUsername] = useState('')
  const [demoPassword, setDemoPassword] = useState('')

  // Email state
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

  const callAuth = async (url: string, body: object, timeoutMs = 12000) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`)
      return json
    } catch (err: unknown) {
      clearTimeout(timer)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timed out. Check your connection and try again.')
      }
      throw err
    }
  }

  // ─── Demo / Neon Coins signup ───────────────────────────────────────────────
  const handleDemoStart = async () => {
    if (!demoUsername || demoUsername.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (!demoPassword || demoPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    const coins = customNeon ? parseInt(customNeon) : selectedNeon
    if (!coins || coins < 100) {
      setError('Choose at least 100 Neon Coins')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const { data } = await callAuth('/api/auth/register', {
        username: demoUsername,
        password: demoPassword,
        neonCoins: coins,
      })
      login(data.user, data.token)
      toast.success(`🎮 ${coins.toLocaleString()} Neon Coins added! Let's play!`, { duration: 5000 })
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Real Phantom connect ───────────────────────────────────────────────────
  const handlePhantomConnect = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Check if Phantom is installed
      if (!window.solana?.isPhantom) {
        window.open('https://phantom.app/', '_blank')
        throw new Error('Phantom not found. Install it from phantom.app, then try again.')
      }

      // Open Phantom popup — user approves connection
      const response = await window.solana.connect()
      const address = response.publicKey.toString()

      // Ask user to sign a message to prove wallet ownership
      const nonce = Date.now()
      const message = `Sign in to NeonBet Casino\nNonce: ${nonce}`
      const encodedMessage = new TextEncoder().encode(message)
      const { signature } = await window.solana.signMessage(encodedMessage, 'utf8')
      const signatureBase64 = Buffer.from(signature).toString('base64')

      // Authenticate with backend
      const { data } = await callAuth('/api/auth/wallet-connect', {
        chain: 'SOLANA',
        address,
        signature: signatureBase64,
        message,
      })

      login(data.user, data.token)
      setConnectedWallet({ id: 'wlt_sol', chain: 'SOLANA', address, isDefault: true })
      toast.success('Phantom connected!')
      handleClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect'
      if (msg.includes('User rejected')) {
        setError('Connection cancelled. Click Connect Phantom to try again.')
      } else {
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Email login / register ─────────────────────────────────────────────────
  const handleEmailAuth = async () => {
    if (!username || !password) { setError('Fill in all fields'); return }
    if (authMode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const body = authMode === 'register'
        ? { username, password, email, neonCoins: 10_000 }
        : { username, password }
      const { data } = await callAuth(endpoint, body)
      login(data.user, data.token)
      if (authMode === 'register' && data.emailSent) {
        toast.success('Account created! Check your email to verify.', { duration: 6000 })
      } else {
        toast.success(authMode === 'register' ? '🎉 Account created! 10,000 Neon Coins added.' : 'Welcome back!')
      }
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isWalletModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border border-purple-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/10 rounded-2xl pointer-events-none" />

        <div className="relative">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <DialogTitle className="text-xl">
                {view === 'choose' && 'Join NeonBet'}
                {view === 'demo-setup' && 'Choose Your Neon Coins'}
                {view === 'sol-connect' && 'Connect Phantom Wallet'}
                {view === 'email' && (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </DialogTitle>
            </div>
            <p className="text-xs text-white/40 pl-[52px]">
              {view === 'choose' && 'Pick how you want to play'}
              {view === 'demo-setup' && 'Neon Coins have no real value — just for fun'}
              {view === 'sol-connect' && 'Your Phantom wallet will open to confirm'}
              {view === 'email' && 'Classic username & password'}
            </p>
          </DialogHeader>

          <AnimatePresence mode="wait">

            {/* ── CHOOSE MODE ── */}
            {view === 'choose' && (
              <motion.div key="choose" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">

                {/* Demo / Neon Coins */}
                <button
                  onClick={() => setView('demo-setup')}
                  className="w-full flex items-center justify-between p-4 rounded-xl glass-card border border-purple-500/20 hover:border-purple-500/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-2xl">🎮</div>
                    <div className="text-left">
                      <div className="font-bold text-white">Play with Neon Coins</div>
                      <div className="text-xs text-white/40">Free demo coins — no real money needed</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-purple-400 transition-colors" />
                </button>

                {/* Real SOL */}
                <button
                  onClick={() => setView('sol-connect')}
                  className="w-full flex items-center justify-between p-4 rounded-xl glass-card border border-green-500/20 hover:border-green-500/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-2xl">◎</div>
                    <div className="text-left">
                      <div className="font-bold text-white">Play with Real SOL</div>
                      <div className="text-xs text-white/40">Connect Phantom — real crypto wagering</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-green-400 transition-colors" />
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-1 border-t border-white/10" />
                  <span className="mx-3 text-xs text-white/30">or</span>
                  <div className="flex-1 border-t border-white/10" />
                </div>

                {/* Email */}
                <button
                  onClick={() => { setAuthMode('login'); setView('email') }}
                  className="w-full flex items-center justify-between p-4 rounded-xl glass-card border border-white/[0.06] hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl">📧</div>
                    <div className="text-left">
                      <div className="font-bold text-white">Email & Password</div>
                      <div className="text-xs text-white/40">Sign in to existing account</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                </button>
              </motion.div>
            )}

            {/* ── DEMO SETUP ── */}
            {view === 'demo-setup' && (
              <motion.div key="demo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest mb-3 block">How many Neon Coins do you want?</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {NEON_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => { setSelectedNeon(p); setCustomNeon('') }}
                        className={cn(
                          'py-3 rounded-xl font-bold text-sm border transition-all',
                          selectedNeon === p && !customNeon
                            ? 'bg-purple-500/30 border-purple-500/60 text-purple-200'
                            : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:border-white/20'
                        )}
                      >
                        <Coins className="w-3.5 h-3.5 inline mr-1 opacity-70" />
                        {p.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    placeholder="Or enter a custom amount..."
                    value={customNeon}
                    onChange={(e) => { setCustomNeon(e.target.value); setSelectedNeon(0) }}
                  />
                </div>

                <div className="space-y-2">
                  <Input placeholder="Choose a username" value={demoUsername} onChange={(e) => setDemoUsername(e.target.value)} />
                  <Input placeholder="Create a password (8+ characters)" type="password" value={demoPassword} onChange={(e) => setDemoPassword(e.target.value)} />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <Button variant="neon" className="w-full h-12 text-base" onClick={handleDemoStart} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gamepad2 className="w-4 h-4" />}
                  Start Playing with {customNeon ? parseInt(customNeon).toLocaleString() : selectedNeon.toLocaleString()} Coins
                </Button>

                <button onClick={() => { setView('choose'); setError(null) }} className="text-sm text-white/30 hover:text-white w-full text-center transition-colors">
                  ← Back
                </button>
              </motion.div>
            )}

            {/* ── PHANTOM CONNECT ── */}
            {view === 'sol-connect' && (
              <motion.div key="sol" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-sm text-white/60 space-y-1">
                  <div className="text-white font-semibold text-sm">How it works:</div>
                  <div>1. Click below — Phantom opens in your browser</div>
                  <div>2. Approve the connection request</div>
                  <div>3. Sign a message to verify it's you</div>
                  <div>4. You're in — deposit SOL to start playing</div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                    {error.includes('phantom.app') && (
                      <a href="https://phantom.app" target="_blank" rel="noreferrer" className="underline ml-1">Install →</a>
                    )}
                  </div>
                )}

                <Button
                  className="w-full h-14 text-lg font-black bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                  onClick={handlePhantomConnect}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Waiting for Phantom...</>
                  ) : (
                    <>👻 Connect Phantom</>
                  )}
                </Button>

                <p className="text-xs text-white/30 text-center">
                  Don't have Phantom? <a href="https://phantom.app" target="_blank" rel="noreferrer" className="text-purple-400 underline">Install it here</a>
                </p>

                <button onClick={() => { setView('choose'); setError(null) }} className="text-sm text-white/30 hover:text-white w-full text-center transition-colors">
                  ← Back
                </button>
              </motion.div>
            )}

            {/* ── EMAIL AUTH ── */}
            {view === 'email' && (
              <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                {authMode === 'register' && (
                  <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                )}
                <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <Input
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                />

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <Button variant="neon" className="w-full h-12" onClick={handleEmailAuth} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {authMode === 'register' ? 'Create Account' : 'Sign In'}
                </Button>

                <div className="flex items-center justify-between text-sm pt-1">
                  <button onClick={() => { setView('choose'); setError(null) }} className="text-white/30 hover:text-white transition-colors">← Back</button>
                  <button
                    onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(null) }}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    {authMode === 'login' ? 'Create account →' : 'Sign in instead →'}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
