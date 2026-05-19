'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Loader2, Save, User, Link, Palette, AlertCircle, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import { useWalletStore } from '@/store/walletStore'
import { getAuthToken } from '@/lib/token'
import { uploadAvatar } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type Tab = 'basic' | 'avatar' | 'theme'

const THEME_PRESETS = [
  { id: 'purple', name: 'Purple', color: '#7c3aed', free: true },
  { id: 'cyan',   name: 'Cyan',   color: '#06b6d4', free: true },
  { id: 'green',  name: 'Green',  color: '#10b981', free: true },
  { id: 'gold',   name: 'Gold',   color: '#f59e0b', free: false, priceSOL: 0.01 },
  { id: 'red',    name: 'Red',    color: '#ef4444', free: false, priceSOL: 0.005 },
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

interface NFT {
  mint: string
  name: string
  image: string
  collection: string | null
}

export function ProfileEditModal({ open, onClose, onSaved }: Props) {
  const { user } = useAuthStore()
  const { connectedWallet, SOL } = useWalletStore()
  const [tab, setTab] = useState<Tab>('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [username, setUsername] = useState(user?.username ?? '')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [twitter, setTwitter] = useState('')
  const [discord, setDiscord] = useState('')
  const [selectedTheme, setSelectedTheme] = useState('purple')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [nfts, setNfts] = useState<NFT[]>([])
  const [loadingNfts, setLoadingNfts] = useState(false)
  const [unlockedThemes, setUnlockedThemes] = useState<string[]>(['purple', 'cyan', 'green'])

  // Load current profile on open
  useEffect(() => {
    if (!open || !user) return
    fetch('/api/profile', { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.profile) {
          setBio(data.profile.bio ?? '')
          setWebsite(data.profile.website ?? '')
          setTwitter(data.profile.twitter ?? '')
          setDiscord(data.profile.discord ?? '')
          setSelectedTheme(data.profile.themeId ?? 'purple')
          setAvatarPreview(data.profile.avatarUrl ?? null)
        }
        if (data?.unlockedThemeIds) {
          setUnlockedThemes(['purple', 'cyan', 'green', ...data.unlockedThemeIds])
        }
      })
      .catch(() => {})
  }, [open, user])

  // Load NFTs from Phantom wallet
  const loadNfts = useCallback(async () => {
    const address = connectedWallet?.chain === 'SOLANA' ? connectedWallet.address : null
    if (!address) return
    setLoadingNfts(true)
    try {
      const res = await fetch(`/api/profile/nfts?address=${address}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      const { data } = await res.json()
      setNfts(data ?? [])
    } catch {}
    setLoadingNfts(false)
  }, [connectedWallet])

  useEffect(() => {
    if (tab === 'avatar' && connectedWallet?.chain === 'SOLANA' && nfts.length === 0) {
      loadNfts()
    }
  }, [tab, connectedWallet, nfts.length, loadNfts])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    setError(null)

    try {
      let finalAvatarUrl: string | undefined
      if (avatarFile) {
        const url = await uploadAvatar(avatarFile, user.id)
        if (!url) throw new Error('Avatar upload failed')
        finalAvatarUrl = url
      } else if (avatarUrl) {
        finalAvatarUrl = avatarUrl
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({
          username: username !== user.username ? username : undefined,
          bio, website, twitter, discord,
          themeId: selectedTheme,
          avatarUrl: finalAvatarUrl,
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error)
      }

      toast.success('Profile updated!')
      onSaved?.()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const TABS = [
    { id: 'basic' as Tab, label: 'Basic Info', icon: User },
    { id: 'avatar' as Tab, label: 'Avatar', icon: Camera },
    { id: 'theme' as Tab, label: 'Theme', icon: Palette },
  ]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border border-purple-500/20 max-h-[90vh] overflow-y-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-pink-900/10 rounded-2xl pointer-events-none" />

        <div className="relative">
          <DialogHeader className="mb-4">
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                  tab === t.id ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'
                )}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'basic' && (
              <motion.div key="basic" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest mb-1.5 block">Username</label>
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest mb-1.5 block">Bio</label>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Tell other players about yourself..."
                    maxLength={300}
                    rows={3}
                    className="bet-input w-full resize-none text-sm"
                  />
                  <div className="text-xs text-white/20 text-right mt-1">{bio.length}/300</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest mb-1.5 block flex items-center gap-1">
                      <Link className="w-3 h-3" /> Website
                    </label>
                    <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest mb-1.5 block">Twitter</label>
                    <Input value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="@username" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest mb-1.5 block">Discord</label>
                  <Input value={discord} onChange={e => setDiscord(e.target.value)} placeholder="username#0000" />
                </div>
              </motion.div>
            )}

            {tab === 'avatar' && (
              <motion.div key="avatar" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                {/* Current avatar preview */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    {avatarPreview
                      ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                      : <span className="text-2xl font-black text-white">{user?.username?.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1">
                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="mb-2 w-full">
                      <Camera className="w-4 h-4" /> Upload Image
                    </Button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    <p className="text-xs text-white/30">PNG, JPG, GIF up to 5MB</p>
                  </div>
                </div>

                {/* URL input */}
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest mb-1.5 block">Or paste image URL</label>
                  <Input value={avatarUrl} onChange={e => { setAvatarUrl(e.target.value); setAvatarPreview(e.target.value); setAvatarFile(null) }}
                    placeholder="https://..." />
                </div>

                {/* NFT picker */}
                {connectedWallet?.chain === 'SOLANA' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/40 uppercase tracking-widest">Your NFTs</label>
                      {loadingNfts && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />}
                    </div>
                    {nfts.length === 0 && !loadingNfts && (
                      <div className="text-xs text-white/30 text-center py-3">
                        {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'No NFTs found in wallet' : 'Add HELIUS_API_KEY to enable NFT fetching'}
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                      {nfts.map(nft => (
                        <button key={nft.mint} onClick={() => { setAvatarPreview(nft.image); setAvatarUrl(nft.image); setAvatarFile(null) }}
                          className={cn(
                            'aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200',
                            avatarPreview === nft.image ? 'border-purple-500' : 'border-transparent hover:border-white/30'
                          )}>
                          <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'theme' && (
              <motion.div key="theme" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                <p className="text-xs text-white/40">Choose your profile color theme. Premium themes require SOL.</p>
                <div className="space-y-2">
                  {THEME_PRESETS.map(theme => {
                    const owned = theme.free || unlockedThemes.includes(theme.id)
                    const canAfford = SOL >= (theme.priceSOL ?? 0)
                    return (
                      <button key={theme.id} onClick={() => owned && setSelectedTheme(theme.id)}
                        disabled={!owned}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200',
                          selectedTheme === theme.id
                            ? 'border-white/40 bg-white/10'
                            : owned ? 'border-white/10 hover:border-white/30 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01] opacity-60'
                        )}>
                        <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: theme.color }} />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-semibold text-white">{theme.name}</div>
                          <div className="text-xs text-white/40">{theme.free ? 'Free' : `${theme.priceSOL} SOL`}</div>
                        </div>
                        {selectedTheme === theme.id && (
                          <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">Active</span>
                        )}
                        {!owned && !canAfford && (
                          <span className="text-xs text-red-400/60">Insufficient SOL</span>
                        )}
                        {!owned && canAfford && (
                          <Button variant="neon" size="sm" onClick={e => { e.stopPropagation(); toast('SOL purchase coming soon!') }}>
                            Buy
                          </Button>
                        )}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 mt-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="neon" className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
