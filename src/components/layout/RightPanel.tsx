'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, TrendingUp, Send, Users } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveBet {
  id: string
  username: string
  game: string
  icon: string
  betAmount: number
  winAmount: number
  multiplier?: number
  won: boolean
  ts: number
}

interface ChatMessage {
  id: string
  username: string
  text: string
  ts: number
  isSystem?: boolean
}

// ─── Demo data generators ─────────────────────────────────────────────────────

const DEMO_USERS = ['CryptoWolf', 'NeonRider', 'SolanaKing', 'DiceGod', 'CrashPilot', 'LuckyApe', 'WhaleHunter', 'DegenMaster']
const DEMO_GAMES = [
  { name: 'Coin Flip', icon: '🪙' },
  { name: 'Crash', icon: '🚀' },
  { name: 'Jackpot', icon: '💎' },
  { name: 'Roulette', icon: '🎡' },
  { name: 'Dice', icon: '🎲' },
]
const DEMO_CHAT = [
  'lets gooo 🚀', 'gg wp', 'crashed again smh', 'who tryna go big?',
  'that jackpot was insane', 'neon coins only rn', 'anyone else riding crash?',
  'sick win bro', 'down bad today', 'letss ride 🎰',
]

function randomBet(): LiveBet {
  const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)]
  const game = DEMO_GAMES[Math.floor(Math.random() * DEMO_GAMES.length)]
  const won = Math.random() > 0.45
  const bet = parseFloat((Math.random() * 500 + 10).toFixed(2))
  const mult = parseFloat((Math.random() * 5 + 1.1).toFixed(2))
  return {
    id: Math.random().toString(36).slice(2),
    username: user,
    game: game.name,
    icon: game.icon,
    betAmount: bet,
    winAmount: won ? parseFloat((bet * mult).toFixed(2)) : 0,
    multiplier: mult,
    won,
    ts: Date.now(),
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RightPanel() {
  const { user } = useAuthStore()
  const pathname = usePathname()

  // Hide on game pages — the betting panel is the primary sidebar there
  if (pathname?.startsWith('/games/')) return null
  const [tab, setTab] = useState<'bets' | 'chat'>('bets')
  const [bets, setBets] = useState<LiveBet[]>(() => Array.from({ length: 12 }, randomBet))
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', username: 'System', text: '🎰 Welcome to NeonBet Live Chat!', ts: Date.now() - 120000, isSystem: true },
    ...Array.from({ length: 6 }, (_, i) => ({
      id: String(i + 2),
      username: DEMO_USERS[i % DEMO_USERS.length],
      text: DEMO_CHAT[i],
      ts: Date.now() - (6 - i) * 15000,
    })),
  ])
  const [input, setInput] = useState('')
  const [onlineCount] = useState(Math.floor(Math.random() * 200 + 50))
  const chatEndRef = useRef<HTMLDivElement>(null)
  const betsEndRef = useRef<HTMLDivElement>(null)

  // Simulate incoming bets
  useEffect(() => {
    const interval = setInterval(() => {
      setBets(prev => [randomBet(), ...prev].slice(0, 50))
    }, 2000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [])

  // Simulate incoming chat messages
  useEffect(() => {
    const interval = setInterval(() => {
      const user = DEMO_USERS[Math.floor(Math.random() * DEMO_USERS.length)]
      const text = DEMO_CHAT[Math.floor(Math.random() * DEMO_CHAT.length)]
      setMessages(prev => [
        ...prev,
        { id: Math.random().toString(36).slice(2), username: user, text, ts: Date.now() },
      ].slice(-100))
    }, 4000 + Math.random() * 6000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, tab])

  const sendMessage = () => {
    if (!input.trim() || !user) return
    setMessages(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2), username: user.username, text: input.trim(), ts: Date.now() },
    ].slice(-100))
    setInput('')
  }

  return (
    <aside className="hidden xl:flex flex-col w-72 flex-shrink-0 bg-[#0a0a14] border-l border-white/[0.05] h-full">

      {/* Tab header */}
      <div className="flex items-center border-b border-white/[0.05] px-1 pt-1">
        {[
          { id: 'bets' as const, label: 'Live Bets', icon: TrendingUp },
          { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 flex-1 justify-center py-3 text-xs font-semibold border-b-2 transition-all',
              tab === t.id
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-white/30 hover:text-white/60'
            )}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
        <div className="flex items-center gap-1 px-3 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {onlineCount}
        </div>
      </div>

      {/* Bets tab */}
      {tab === 'bets' && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1" ref={betsEndRef as React.RefObject<HTMLDivElement>}>
          <AnimatePresence initial={false}>
            {bets.map(bet => (
              <motion.div
                key={bet.id}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-xl border transition-all',
                  bet.won
                    ? 'bg-emerald-500/5 border-emerald-500/10'
                    : 'bg-white/[0.02] border-white/[0.04]'
                )}
              >
                <span className="text-base leading-none flex-shrink-0">{bet.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white/70 truncate">{bet.username}</div>
                  <div className="text-[11px] text-white/30">{bet.game}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  {bet.won ? (
                    <div className="text-xs font-bold text-emerald-400">+{bet.winAmount.toFixed(0)}</div>
                  ) : (
                    <div className="text-xs font-bold text-red-400/60">-{bet.betAmount.toFixed(0)}</div>
                  )}
                  {bet.multiplier && bet.won && (
                    <div className="text-[10px] text-white/20">{bet.multiplier}x</div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Chat tab */}
      {tab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map(msg => (
              <div key={msg.id} className={cn('text-xs', msg.isSystem && 'text-center')}>
                {msg.isSystem ? (
                  <span className="text-purple-400/60">{msg.text}</span>
                ) : (
                  <div>
                    <span className={cn(
                      'font-bold mr-1.5',
                      msg.username === user?.username ? 'text-purple-300' : 'text-white/50'
                    )}>
                      {msg.username}
                    </span>
                    <span className="text-white/70">{msg.text}</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-white/[0.05]">
            {user ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Say something..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  maxLength={120}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-purple-500/40"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-white/20 text-center">Sign in to chat</p>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
