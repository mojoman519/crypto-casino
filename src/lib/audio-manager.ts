/**
 * Centralized AudioManager using Web Audio API.
 * Three channels: music | ui | effects
 * Each channel has independent volume and mute state.
 * Sounds have cooldown to prevent spam.
 */

export type AudioChannel = 'music' | 'ui' | 'effects'

interface ChannelState {
  gain: GainNode
  muted: boolean
  volume: number
}

interface SoundDef {
  generate: (ctx: AudioContext) => AudioBufferSourceNode | OscillatorNode
  channel: AudioChannel
  defaultCooldownMs: number
}

const SOUNDS = {
  // UI
  click:       { channel: 'ui',      defaultCooldownMs: 80  },
  hover:       { channel: 'ui',      defaultCooldownMs: 60  },
  modalOpen:   { channel: 'ui',      defaultCooldownMs: 200 },
  modalClose:  { channel: 'ui',      defaultCooldownMs: 200 },

  // Game effects
  diceRoll:    { channel: 'effects', defaultCooldownMs: 400 },
  diceResult:  { channel: 'effects', defaultCooldownMs: 200 },
  rouletteSpin:{ channel: 'effects', defaultCooldownMs: 600 },
  nearWin:     { channel: 'effects', defaultCooldownMs: 300 },
  win:         { channel: 'effects', defaultCooldownMs: 500 },
  bigWin:      { channel: 'effects', defaultCooldownMs: 1000 },
  lose:        { channel: 'effects', defaultCooldownMs: 500 },
  coinFlip:    { channel: 'effects', defaultCooldownMs: 400 },
  cashout:     { channel: 'effects', defaultCooldownMs: 500 },
  tick:        { channel: 'effects', defaultCooldownMs: 50  },
  jackpotSpin: { channel: 'effects', defaultCooldownMs: 600 },
  deposit:     { channel: 'effects', defaultCooldownMs: 800 },
  tension:     { channel: 'effects', defaultCooldownMs: 100 },
} as const

export type SoundName = keyof typeof SOUNDS

const STORAGE_KEY = 'neonbet-audio'

interface AudioPrefs {
  volumes: { music: number; ui: number; effects: number }
  muted: { music: boolean; ui: boolean; effects: boolean }
  masterMuted: boolean
}

class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private channels: Record<AudioChannel, ChannelState | null> = { music: null, ui: null, effects: null }
  private cooldowns = new Map<SoundName, number>()
  private initialized = false
  private prefs: AudioPrefs = {
    volumes: { music: 0.3, ui: 0.6, effects: 0.8 },
    muted: { music: false, ui: false, effects: false },
    masterMuted: false,
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  init() {
    if (this.initialized || typeof window === 'undefined') return
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)

      const channelNames: AudioChannel[] = ['music', 'ui', 'effects']
      for (const name of channelNames) {
        const gain = this.ctx.createGain()
        gain.gain.value = this.prefs.volumes[name]
        gain.connect(this.master)
        this.channels[name] = { gain, muted: this.prefs.muted[name], volume: this.prefs.volumes[name] }
      }

      this.loadPrefs()
      this.initialized = true
    } catch {
      // Audio not supported — silent fallback
    }
  }

  /** Must be called from a user gesture to unlock AudioContext on iOS/Safari */
  unlock() {
    if (!this.ctx) this.init()
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  // ─── Playback ──────────────────────────────────────────────────────────────

  play(name: SoundName, overrideCooldown = false): void {
    if (!this.initialized || !this.ctx) return
    if (this.prefs.masterMuted) return

    const def = SOUNDS[name]
    const channel = this.channels[def.channel]
    if (!channel || channel.muted) return

    // Cooldown check
    const now = performance.now()
    if (!overrideCooldown) {
      const lastPlayed = this.cooldowns.get(name) ?? 0
      if (now - lastPlayed < def.defaultCooldownMs) return
    }
    this.cooldowns.set(name, now)

    try {
      this.ctx.resume()
      const source = this.generateSound(name)
      source.connect(channel.gain)
      source.start(0)
    } catch {}
  }

  /** Schedule a sound to play at a specific time offset (seconds from now) */
  playAt(name: SoundName, delaySeconds: number): void {
    if (!this.initialized || !this.ctx) return
    const def = SOUNDS[name]
    const channel = this.channels[def.channel]
    if (!channel || channel.muted || this.prefs.masterMuted) return

    try {
      this.ctx.resume()
      const source = this.generateSound(name)
      source.connect(channel.gain)
      source.start(this.ctx.currentTime + delaySeconds)
    } catch {}
  }

  // ─── Sound generation ──────────────────────────────────────────────────────

  private generateSound(name: SoundName): AudioBufferSourceNode | OscillatorNode {
    const ctx = this.ctx!

    switch (name) {
      case 'click': {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = 800
        g.gain.setValueAtTime(0.3, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
        osc.stop(ctx.currentTime + 0.08)
        return osc
      }
      case 'hover': {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = 600
        g.gain.setValueAtTime(0.08, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
        osc.stop(ctx.currentTime + 0.05)
        return osc
      }
      case 'win': return this.buildWinSound(ctx, false)
      case 'bigWin': return this.buildWinSound(ctx, true)
      case 'lose': return this.buildLoseSound(ctx)
      case 'diceRoll': return this.buildDiceRollSound(ctx)
      case 'diceResult': return this.buildDiceResultSound(ctx)
      case 'rouletteSpin': return this.buildRouletteSpinSound(ctx)
      case 'nearWin': return this.buildNearWinSound(ctx)
      case 'tension': return this.buildTensionSound(ctx)
      case 'tick': return this.buildTickSound(ctx)
      case 'cashout': return this.buildCashoutSound(ctx)
      case 'jackpotSpin': return this.buildJackpotSpinSound(ctx)
      case 'deposit': return this.buildDepositSound(ctx)
      case 'modalOpen': return this.buildModalSound(ctx, true)
      case 'modalClose': return this.buildModalSound(ctx, false)
      default: return this.buildClickSound(ctx)
    }
  }

  private buildClickSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.value = 500; osc.type = 'sine'
    g.gain.setValueAtTime(0.2, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.stop(ctx.currentTime + 0.1)
    return osc
  }

  private buildWinSound(ctx: AudioContext, big: boolean) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    const t = ctx.currentTime
    if (big) {
      osc.frequency.setValueAtTime(400, t)
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.4)
      g.gain.setValueAtTime(0.5, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
      osc.stop(t + 0.8)
    } else {
      osc.frequency.setValueAtTime(500, t)
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.25)
      g.gain.setValueAtTime(0.4, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.stop(t + 0.4)
    }
    return osc
  }

  private buildLoseSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sawtooth'
    const t = ctx.currentTime
    osc.frequency.setValueAtTime(300, t)
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.3)
    g.gain.setValueAtTime(0.3, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.stop(t + 0.3)
    return osc
  }

  private buildDiceRollSound(ctx: AudioContext) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 0.5
    const g = ctx.createGain()
    source.buffer = buffer
    source.connect(filter); filter.connect(g); g.connect(ctx.destination)
    g.gain.setValueAtTime(0.4, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    return source
  }

  private buildDiceResultSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'triangle'; osc.frequency.value = 900
    g.gain.setValueAtTime(0.35, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.stop(ctx.currentTime + 0.15)
    return osc
  }

  private buildRouletteSpinSound(ctx: AudioContext) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = Math.sin(2 * Math.PI * (200 + 300 * t) * t) * (1 - t / 0.5) * 0.3
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    return source
  }

  private buildNearWinSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    const t = ctx.currentTime
    osc.frequency.setValueAtTime(600, t)
    osc.frequency.linearRampToValueAtTime(800, t + 0.15)
    osc.frequency.linearRampToValueAtTime(650, t + 0.3)
    g.gain.setValueAtTime(0.3, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.stop(t + 0.3)
    return osc
  }

  private buildTensionSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = 200
    g.gain.setValueAtTime(0.1, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.stop(ctx.currentTime + 0.1)
    return osc
  }

  private buildTickSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'square'; osc.frequency.value = 1200
    g.gain.setValueAtTime(0.05, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03)
    osc.stop(ctx.currentTime + 0.03)
    return osc
  }

  private buildCashoutSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    const t = ctx.currentTime
    osc.frequency.setValueAtTime(400, t)
    osc.frequency.exponentialRampToValueAtTime(1000, t + 0.2)
    g.gain.setValueAtTime(0.4, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.stop(t + 0.35)
    return osc
  }

  private buildJackpotSpinSound(ctx: AudioContext) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      data[i] = Math.sin(2 * Math.PI * 300 * t) * (Math.random() * 0.1 + 0.9) * (1 - t / 0.6) * 0.3
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    return source
  }

  private buildDepositSound(ctx: AudioContext) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    const t = ctx.currentTime
    osc.frequency.setValueAtTime(300, t)
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.3)
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.5)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.stop(t + 0.6)
    return osc
  }

  private buildModalSound(ctx: AudioContext, open: boolean) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.type = 'sine'
    const t = ctx.currentTime
    if (open) {
      osc.frequency.setValueAtTime(400, t)
      osc.frequency.linearRampToValueAtTime(600, t + 0.12)
    } else {
      osc.frequency.setValueAtTime(600, t)
      osc.frequency.linearRampToValueAtTime(300, t + 0.1)
    }
    g.gain.setValueAtTime(0.15, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.stop(t + 0.12)
    return osc
  }

  // ─── Volume controls ────────────────────────────────────────────────────────

  setVolume(channel: AudioChannel, value: number) {
    const ch = this.channels[channel]
    if (!ch) return
    const v = Math.max(0, Math.min(1, value))
    ch.volume = v
    this.prefs.volumes[channel] = v
    if (!ch.muted) ch.gain.gain.value = v
    this.savePrefs()
  }

  getVolume(channel: AudioChannel): number {
    return this.prefs.volumes[channel]
  }

  mute(channel?: AudioChannel) {
    if (!channel) {
      this.prefs.masterMuted = true
      if (this.master) this.master.gain.value = 0
    } else {
      const ch = this.channels[channel]
      if (!ch) return
      ch.muted = true
      this.prefs.muted[channel] = true
      ch.gain.gain.value = 0
    }
    this.savePrefs()
  }

  unmute(channel?: AudioChannel) {
    if (!channel) {
      this.prefs.masterMuted = false
      if (this.master) this.master.gain.value = 1
    } else {
      const ch = this.channels[channel]
      if (!ch) return
      ch.muted = false
      this.prefs.muted[channel] = false
      ch.gain.gain.value = ch.volume
    }
    this.savePrefs()
  }

  isMuted(channel?: AudioChannel): boolean {
    if (!channel) return this.prefs.masterMuted
    return this.prefs.muted[channel] ?? false
  }

  toggleMute(channel?: AudioChannel) {
    if (this.isMuted(channel)) this.unmute(channel)
    else this.mute(channel)
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  private savePrefs() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs)) } catch {}
  }

  private loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<AudioPrefs>
      if (saved.volumes) Object.assign(this.prefs.volumes, saved.volumes)
      if (saved.muted) Object.assign(this.prefs.muted, saved.muted)
      if (saved.masterMuted !== undefined) this.prefs.masterMuted = saved.masterMuted

      // Apply loaded state
      for (const [name, ch] of Object.entries(this.channels)) {
        if (!ch) continue
        const n = name as AudioChannel
        ch.volume = this.prefs.volumes[n]
        ch.muted = this.prefs.muted[n]
        ch.gain.gain.value = ch.muted ? 0 : ch.volume
      }
      if (this.master) this.master.gain.value = this.prefs.masterMuted ? 0 : 1
    } catch {}
  }
}

// Singleton
export const audioManager = new AudioManager()
