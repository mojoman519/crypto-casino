'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Activity, Shield, BarChart3, Users, RefreshCw,
  AlertTriangle, ToggleLeft, ToggleRight, Save, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getAuthToken } from '@/lib/token'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

type Tab = 'overview' | 'games' | 'transactions' | 'audit' | 'players'

interface GameConfig {
  id: string; gameType: string; name: string; isEnabled: boolean
  houseEdge: number; minBetNC: number; maxBetNC: number
  minBetSOL: number; maxBetSOL: number; maxBetsPerMin: number; maxBetsPerHour: number
}
interface StatsData {
  houseWallet: string | null
  overview: {
    totalUsers: number; newUsersToday: number; totalBetsToday: number; totalBets24h: number
    houseProfit: { today: number; last24h: number; last7d: number }
    fraudAlerts24h: number; rateLimitHits24h: number; activeBetsNow: number
  }
  betsPerGame: { gameType: string; betCount: number; totalWagered: number }[]
  recentActivity: { id: string; username: string; gameType: string; betAmount: number; winAmount: number; status: string; currency: string }[]
  topPlayers: { id: string; username: string; totalWagered: number; totalWon: number; gamesPlayed: number; neonCoins: number }[]
}
interface Transaction {
  id: string; userId: string; gameType: string; currency: string; betAmount: number
  winAmount: number; netAmount: number; status: string; createdAt: string
  user: { username: string }
}
interface AuditEntry {
  id: string; userId: string | null; username: string | null; action: string
  severity: string; data: Record<string, unknown> | null; ipAddress: string | null; createdAt: string
}

const SEVERITY_COLOR: Record<string, string> = {
  INFO: 'text-white/50', WARN: 'text-yellow-400', ALERT: 'text-red-400',
}
const STATUS_COLOR: Record<string, string> = {
  WON: 'text-emerald-400', LOST: 'text-red-400', PENDING: 'text-yellow-400', ROLLED_BACK: 'text-white/30',
}

function authHeaders() {
  return { Authorization: `Bearer ${getAuthToken()}` }
}

export default function AdminPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<StatsData | null>(null)
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
  const [txMeta, setTxMeta] = useState({ total: 0, page: 1, pages: 1 })
  const [auditMeta, setAuditMeta] = useState({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(false)
  const [editingGame, setEditingGame] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<GameConfig>>>({})
  const [txFilter, setTxFilter] = useState({ gameType: '', status: '', page: 1 })
  const [auditFilter, setAuditFilter] = useState({ severity: '', action: '', page: 1 })

  const fetchStats = useCallback(async () => {
    const r = await fetch('/api/admin/stats', { headers: authHeaders() })
    const { data } = await r.json()
    setStats(data)
  }, [])

  const fetchConfigs = useCallback(async () => {
    const r = await fetch('/api/admin/game-config', { headers: authHeaders() })
    const { data } = await r.json()
    setGameConfigs(data ?? [])
  }, [])

  const fetchTransactions = useCallback(async (p = txFilter) => {
    const params = new URLSearchParams({
      page: String(p.page), limit: '50',
      ...(p.gameType && { gameType: p.gameType }),
      ...(p.status && { status: p.status }),
    })
    const r = await fetch(`/api/admin/transactions?${params}`, { headers: authHeaders() })
    const { data, meta } = await r.json()
    setTransactions(data ?? [])
    setTxMeta(meta ?? { total: 0, page: 1, pages: 1 })
  }, [txFilter])

  const fetchAuditLogs = useCallback(async (p = auditFilter) => {
    const params = new URLSearchParams({
      page: String(p.page), limit: '50',
      ...(p.severity && { severity: p.severity }),
      ...(p.action && { action: p.action }),
    })
    const r = await fetch(`/api/admin/audit-logs?${params}`, { headers: authHeaders() })
    const { data, meta } = await r.json()
    setAuditLogs(data ?? [])
    setAuditMeta(meta ?? { total: 0, page: 1, pages: 1 })
  }, [auditFilter])

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    setLoading(true)
    Promise.all([fetchStats(), fetchConfigs()]).finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (tab === 'transactions') fetchTransactions()
    if (tab === 'audit') fetchAuditLogs()
  }, [tab]) // eslint-disable-line

  const saveGameConfig = async (gameType: string) => {
    const changes = edits[gameType]
    if (!changes || Object.keys(changes).length === 0) return
    const r = await fetch('/api/admin/game-config', {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType, ...changes }),
    })
    if (r.ok) {
      toast.success(`${gameType} settings saved`)
      setEditingGame(null)
      setEdits(e => { const n = { ...e }; delete n[gameType]; return n })
      fetchConfigs()
    } else {
      const { error } = await r.json()
      toast.error(error)
    }
  }

  const patchEdit = (gameType: string, field: string, value: unknown) => {
    setEdits(e => ({ ...e, [gameType]: { ...e[gameType], [field]: value } }))
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-white/40">Admin access required.</p>
      </div>
    )
  }

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'games', label: 'Game Settings', icon: Settings },
    { id: 'transactions', label: 'Ledger', icon: Activity },
    { id: 'audit', label: 'Audit Log', icon: Shield },
    { id: 'players', label: 'Players', icon: Users },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-white">Admin Dashboard</h1>
        <Button variant="secondary" size="sm" onClick={() => { fetchStats(); fetchConfigs() }} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
              tab === t.id ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'
            )}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && stats && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Users', value: stats.overview.totalUsers.toLocaleString(), sub: `+${stats.overview.newUsersToday} today`, color: 'text-purple-400' },
              { label: 'Bets Today', value: stats.overview.totalBetsToday.toLocaleString(), sub: `${stats.overview.totalBets24h} / 24h`, color: 'text-cyan-400' },
              { label: 'House Profit Today', value: `$${stats.overview.houseProfit.today.toFixed(2)}`, sub: `$${stats.overview.houseProfit.last7d.toFixed(2)} / 7d`, color: 'text-emerald-400' },
              { label: 'Active Bets', value: String(stats.overview.activeBetsNow), sub: 'pending resolution', color: 'text-yellow-400' },
            ].map(k => (
              <div key={k.label} className="glass-card p-4">
                <div className="text-xs text-white/30 uppercase tracking-widest mb-1">{k.label}</div>
                <div className={cn('text-2xl font-black', k.color)}>{k.value}</div>
                <div className="text-xs text-white/30 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {(stats.overview.fraudAlerts24h > 0 || stats.overview.rateLimitHits24h > 0) && (
            <div className="flex gap-3 flex-wrap">
              {stats.overview.fraudAlerts24h > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {stats.overview.fraudAlerts24h} fraud alerts (24h)
                </div>
              )}
              {stats.overview.rateLimitHits24h > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {stats.overview.rateLimitHits24h} rate limit hits (24h)
                </div>
              )}
            </div>
          )}

          {/* House wallet */}
          <div className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">◎</div>
              <div>
                <div className="text-xs text-white/30 uppercase tracking-widest mb-0.5">House Wallet (SOL)</div>
                {stats.houseWallet
                  ? <div className="font-mono text-sm text-emerald-400">{stats.houseWallet}</div>
                  : <div className="text-sm text-red-400">Not configured — add NEXT_PUBLIC_HOUSE_WALLET_SOL to Vercel</div>}
              </div>
            </div>
            {stats.houseWallet && (
              <a href={`https://solscan.io/account/${stats.houseWallet}`} target="_blank" rel="noreferrer"
                className="text-xs text-white/30 hover:text-white/60 transition-colors">
                View on Solscan →
              </a>
            )}
          </div>

          <div className="glass-card p-5">
            <h2 className="font-bold text-white mb-4">Volume per Game (last 24h)</h2>
            <div className="space-y-2">
              {stats.betsPerGame.map(g => (
                <div key={g.gameType} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-white/50">{g.gameType}</div>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min(100, (g.betCount / Math.max(1, stats.overview.totalBets24h)) * 100)}%` }} />
                  </div>
                  <div className="text-xs text-white/50 w-16 text-right">{g.betCount}</div>
                  <div className="text-xs text-white/30 w-24 text-right">${g.totalWagered.toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="font-bold text-white mb-4">Live Activity (last hour)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/5">
                    {['Player','Game','Bet','Win','Status','Currency'].map(h => (
                      <th key={h} className="text-left pb-2 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map(r => (
                    <tr key={r.id} className="border-b border-white/[0.03]">
                      <td className="py-1.5 px-2 text-white/70">{r.username}</td>
                      <td className="py-1.5 px-2 text-white/50">{r.gameType}</td>
                      <td className="py-1.5 px-2 text-white/70">{r.betAmount.toFixed(2)}</td>
                      <td className="py-1.5 px-2">{r.winAmount > 0 ? <span className="text-emerald-400">+{r.winAmount.toFixed(2)}</span> : <span className="text-white/20">—</span>}</td>
                      <td className={cn('py-1.5 px-2', STATUS_COLOR[r.status] ?? '')}>{r.status}</td>
                      <td className="py-1.5 px-2 text-white/30">{r.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── GAME SETTINGS ── */}
      {tab === 'games' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <p className="text-xs text-white/40 mb-2">Changes take effect within 30s. Toggle enables/disables a game for all players.</p>
          {gameConfigs.map(cfg => {
            const e = edits[cfg.gameType] ?? {}
            const isEditing = editingGame === cfg.gameType
            const get = <K extends keyof GameConfig>(field: K): GameConfig[K] =>
              (field in e ? (e as Partial<GameConfig>)[field] : cfg[field]) as GameConfig[K]

            return (
              <div key={cfg.gameType} className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => patchEdit(cfg.gameType, 'isEnabled', !get('isEnabled'))}>
                      {get('isEnabled')
                        ? <ToggleRight className="w-8 h-8 text-emerald-400" />
                        : <ToggleLeft className="w-8 h-8 text-white/20" />}
                    </button>
                    <div>
                      <div className="font-bold text-white">{cfg.name}</div>
                      <div className="text-xs text-white/30">House edge: {(get('houseEdge') * 100).toFixed(1)}% · NC {get('minBetNC')}–{(get('maxBetNC') / 1000).toFixed(0)}K · {get('maxBetsPerMin')}/min</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {Object.keys(edits[cfg.gameType] ?? {}).length > 0 && (
                      <Button variant="neon" size="sm" onClick={() => saveGameConfig(cfg.gameType)}>
                        <Save className="w-3.5 h-3.5" /> Save
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => setEditingGame(isEditing ? null : cfg.gameType)}>
                      {isEditing ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <div className="border-t border-white/5 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {([
                      { label: 'House Edge (%)', field: 'houseEdge', step: 0.1, min: 0, max: 50, pct: true },
                      { label: 'Min Bet NC', field: 'minBetNC', step: 1, min: 1, max: 10000, pct: false },
                      { label: 'Max Bet NC', field: 'maxBetNC', step: 1000, min: 100, max: 10000000, pct: false },
                      { label: 'Min Bet SOL', field: 'minBetSOL', step: 0.001, min: 0.001, max: 1, pct: false },
                      { label: 'Max Bet SOL', field: 'maxBetSOL', step: 0.1, min: 0.01, max: 1000, pct: false },
                      { label: 'Max Bets/Min', field: 'maxBetsPerMin', step: 1, min: 1, max: 120, pct: false },
                      { label: 'Max Bets/Hour', field: 'maxBetsPerHour', step: 10, min: 10, max: 1000, pct: false },
                    ] as { label: string; field: keyof GameConfig; step: number; min: number; max: number; pct: boolean }[]).map(({ label, field, step, min, max, pct }) => (
                      <div key={field as string}>
                        <label className="text-xs text-white/30 uppercase tracking-widest block mb-1">{label}</label>
                        <input
                          type="number" step={step} min={min} max={max}
                          value={pct
                            ? ((get(field) as number) * 100).toFixed(1)
                            : String(get(field))}
                          onChange={ev => patchEdit(cfg.gameType, field as string, pct
                            ? parseFloat(ev.target.value) / 100
                            : parseFloat(ev.target.value))}
                          className="bet-input w-full text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </motion.div>
      )}

      {/* ── TRANSACTION LEDGER ── */}
      {tab === 'transactions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <select value={txFilter.gameType}
              onChange={e => { const f = { ...txFilter, gameType: e.target.value, page: 1 }; setTxFilter(f); fetchTransactions(f) }}
              className="bet-input text-sm">
              <option value="">All Games</option>
              {['COINFLIP','CRASH','DICE','ROULETTE','JACKPOT'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={txFilter.status}
              onChange={e => { const f = { ...txFilter, status: e.target.value, page: 1 }; setTxFilter(f); fetchTransactions(f) }}
              className="bet-input text-sm">
              <option value="">All Statuses</option>
              {['PENDING','WON','LOST','ROLLED_BACK'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs text-white/30">{txMeta.total.toLocaleString()} total records</span>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5">
                  {['Player','Game','CCY','Bet','Win','Net P/L','Status','Time'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-white/70">{t.user.username}</td>
                    <td className="px-3 py-2 text-white/50">{t.gameType}</td>
                    <td className="px-3 py-2 text-white/30">{t.currency}</td>
                    <td className="px-3 py-2 text-white/70">{t.betAmount.toFixed(2)}</td>
                    <td className="px-3 py-2">{t.winAmount > 0 ? <span className="text-emerald-400">+{t.winAmount.toFixed(2)}</span> : <span className="text-white/20">—</span>}</td>
                    <td className="px-3 py-2">
                      <span className={t.netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {t.netAmount >= 0 ? '+' : ''}{t.netAmount.toFixed(2)}
                      </span>
                    </td>
                    <td className={cn('px-3 py-2 font-medium', STATUS_COLOR[t.status] ?? '')}>{t.status}</td>
                    <td className="px-3 py-2 text-white/30">{new Date(t.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-white/20">No transactions match the filter</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-white/30">Page {txMeta.page} of {txMeta.pages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={txFilter.page <= 1}
                onClick={() => { const f = { ...txFilter, page: txFilter.page - 1 }; setTxFilter(f); fetchTransactions(f) }}>Prev</Button>
              <Button variant="secondary" size="sm" disabled={txFilter.page >= txMeta.pages}
                onClick={() => { const f = { ...txFilter, page: txFilter.page + 1 }; setTxFilter(f); fetchTransactions(f) }}>Next</Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === 'audit' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <select value={auditFilter.severity}
              onChange={e => { const f = { ...auditFilter, severity: e.target.value, page: 1 }; setAuditFilter(f); fetchAuditLogs(f) }}
              className="bet-input text-sm">
              <option value="">All Severities</option>
              {['INFO','WARN','ALERT'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={auditFilter.action}
              onChange={e => { const f = { ...auditFilter, action: e.target.value, page: 1 }; setAuditFilter(f); fetchAuditLogs(f) }}
              className="bet-input text-sm">
              <option value="">All Actions</option>
              {['BET_PLACED','BET_WON','BET_LOST','BET_ROLLBACK','RATE_LIMITED','FRAUD_DETECTED','FRAUD_FLAGGED','ADMIN_CONFIG_CHANGE'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <span className="text-xs text-white/30">{auditMeta.total.toLocaleString()} total events</span>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5">
                  {['Sev','User','Action','Data','IP','Time'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className={cn('px-3 py-2 font-bold text-xs', SEVERITY_COLOR[log.severity] ?? '')}>{log.severity}</td>
                    <td className="px-3 py-2 text-white/60">{log.username ?? log.userId?.slice(0, 8) ?? '—'}</td>
                    <td className="px-3 py-2 text-white/70 font-mono">{log.action}</td>
                    <td className="px-3 py-2 text-white/30 max-w-xs truncate">{log.data ? JSON.stringify(log.data).slice(0, 80) : '—'}</td>
                    <td className="px-3 py-2 text-white/20 font-mono">{log.ipAddress ?? '—'}</td>
                    <td className="px-3 py-2 text-white/30">{new Date(log.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-white/20">No audit logs match the filter</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-white/30">Page {auditMeta.page} of {auditMeta.pages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={auditFilter.page <= 1}
                onClick={() => { const f = { ...auditFilter, page: auditFilter.page - 1 }; setAuditFilter(f); fetchAuditLogs(f) }}>Prev</Button>
              <Button variant="secondary" size="sm" disabled={auditFilter.page >= auditMeta.pages}
                onClick={() => { const f = { ...auditFilter, page: auditFilter.page + 1 }; setAuditFilter(f); fetchAuditLogs(f) }}>Next</Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TOP PLAYERS ── */}
      {tab === 'players' && stats && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/30 border-b border-white/5">
                  {['#','Player','Wagered','Won','P/L','Games','NC Balance'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.topPlayers.map((p, i) => {
                  const pl = p.totalWon - p.totalWagered
                  return (
                    <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-white/30">{i + 1}</td>
                      <td className="px-4 py-3 text-white font-semibold">{p.username}</td>
                      <td className="px-4 py-3 text-white/70">${p.totalWagered.toFixed(2)}</td>
                      <td className="px-4 py-3 text-emerald-400">${p.totalWon.toFixed(2)}</td>
                      <td className={cn('px-4 py-3', pl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-white/50">{p.gamesPlayed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-purple-300">{p.neonCoins.toLocaleString()} NC</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
