import { THEMES, DEFAULT_THEME_ID, type ParticleTheme, type ParticleType } from './particle-themes'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Particle {
  active: boolean
  ambient: boolean     // true = loops forever, false = celebration (fades out)
  x: number
  y: number
  vx: number          // current velocity
  vy: number
  nvx: number         // natural velocity (for drag recovery)
  nvy: number
  size: number
  opacity: number
  maxOpacity: number
  rotation: number
  rotSpeed: number
  color: string
  type: ParticleType
  imageIndex: number  // index into loadedImages
  wobbleOffset: number
  wobbleSpeed: number
  wobbleAmp: number
  life: number        // 1.0 → 0.0 (celebration only)
  lifeDuration: number // seconds
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_AMBIENT = 60
const MAX_CELEBRATION = 120
const POOL_SIZE = MAX_AMBIENT + MAX_CELEBRATION
const REPULSION_RADIUS = 140
const REPULSION_STRENGTH = 180
const DRAG = 0.94
const GRAVITY = 60          // px/s² for celebration particles
const BASE_COUNT = 50       // at density 1.0

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function rand(min: number, max: number) { return min + Math.random() * (max - min) }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)) }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// ─── Engine ───────────────────────────────────────────────────────────────────

export class ParticleEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private pool: Particle[] = []
  private theme: ParticleTheme = THEMES[DEFAULT_THEME_ID]
  private loadedImages: HTMLImageElement[] = []
  private imagesReady = false
  private mouseX = -9999
  private mouseY = -9999
  private running = false
  private rafId = 0
  private lastTime = 0
  private time = 0
  private dpr = 1
  private w = 0
  private h = 0

  constructor() {
    // Pre-allocate pool — zero GC pressure during animation
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push(this.createEmpty())
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  init(canvas: HTMLCanvasElement, theme?: string) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: true })!
    if (theme && THEMES[theme]) this.theme = THEMES[theme]
    this.resize()
    this.preloadImages()
  }

  resize() {
    if (!this.canvas) return
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = this.canvas.getBoundingClientRect()
    this.w = rect.width || window.innerWidth
    this.h = rect.height || window.innerHeight
    this.canvas.width = this.w * this.dpr
    this.canvas.height = this.h * this.dpr
    this.ctx?.scale(this.dpr, this.dpr)
  }

  start(ambientCount?: number) {
    if (this.running) return
    this.running = true
    const count = Math.round((ambientCount ?? BASE_COUNT) * this.theme.density)
    this.spawnAmbientBatch(count)
    this.lastTime = performance.now()
    this.loop(this.lastTime)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  destroy() {
    this.stop()
    this.canvas = null
    this.ctx = null
    this.loadedImages = []
  }

  // ─── Theme & images ────────────────────────────────────────────────────────

  setTheme(themeId: string) {
    if (!THEMES[themeId]) return
    this.theme = THEMES[themeId]
    this.killAmbient()
    this.imagesReady = false
    this.preloadImages()
    this.spawnAmbientBatch(Math.round(BASE_COUNT * this.theme.density))
  }

  /** Load custom image URLs into the engine (PNG/WebP/SVG) */
  loadCustomImages(urls: string[]) {
    this.loadedImages = []
    this.imagesReady = false
    let loaded = 0
    urls.forEach(url => {
      const img = new Image()
      img.onload = () => {
        loaded++
        if (loaded === urls.length) this.imagesReady = true
      }
      img.onerror = () => { loaded++; if (loaded === urls.length) this.imagesReady = true }
      img.src = url
      this.loadedImages.push(img)
    })
    if (urls.length === 0) this.imagesReady = true
  }

  private preloadImages() {
    const urls = this.theme.imageUrls ?? []
    this.loadCustomImages(urls)
    if (urls.length === 0) this.imagesReady = true
  }

  // ─── Mouse ─────────────────────────────────────────────────────────────────

  setMousePos(clientX: number, clientY: number) {
    if (!this.canvas) return
    const rect = this.canvas.getBoundingClientRect()
    this.mouseX = clientX - rect.left
    this.mouseY = clientY - rect.top
  }

  clearMouse() {
    this.mouseX = -9999
    this.mouseY = -9999
  }

  // ─── Celebration ───────────────────────────────────────────────────────────

  /** Fire a win burst at (x, y) in canvas coordinates */
  triggerCelebration(x: number, y: number, count = 80, intensity = 1.0) {
    let spawned = 0
    for (const p of this.pool) {
      if (spawned >= count) break
      if (p.active && !p.ambient) continue // skip active celebration
      if (p.active && p.ambient) continue  // don't steal ambient

      // Find inactive slot
      if (!p.active) {
        this.initCelebration(p, x, y, intensity)
        spawned++
      }
    }
    // If pool full, steal oldest ambient slots
    if (spawned < count) {
      let stolen = 0
      for (const p of this.pool) {
        if (spawned + stolen >= count) break
        if (p.ambient && p.active) {
          this.initCelebration(p, x, y, intensity)
          stolen++
        }
      }
    }
  }

  // ─── Particle init ─────────────────────────────────────────────────────────

  private createEmpty(): Particle {
    return {
      active: false, ambient: true,
      x: 0, y: 0, vx: 0, vy: 0, nvx: 0, nvy: 0,
      size: 5, opacity: 0, maxOpacity: 0.4,
      rotation: 0, rotSpeed: 0,
      color: '#ffffff', type: 'orb', imageIndex: 0,
      wobbleOffset: 0, wobbleSpeed: 0, wobbleAmp: 0,
      life: 1, lifeDuration: 2,
    }
  }

  private initAmbient(p: Particle) {
    const t = this.theme
    const type = pick(t.typeWeights)
    const isImage = type === 'image' && this.loadedImages.length > 0
    const size = rand(t.size.min, t.size.max)
    const speed = rand(15, 35) * t.speed
    const angle = rand(0, Math.PI * 2)

    p.active = true
    p.ambient = true
    p.x = rand(-20, this.w + 20)
    p.y = rand(-20, this.h + 20)
    p.vx = Math.cos(angle) * speed * rand(0.3, 1)
    p.vy = Math.sin(angle) * speed * rand(0.3, 1) - speed * 0.3 // slight upward bias
    p.nvx = p.vx
    p.nvy = p.vy
    p.size = size
    p.maxOpacity = rand(t.opacity.min, t.opacity.max)
    p.opacity = rand(0, p.maxOpacity)
    p.rotation = rand(0, Math.PI * 2)
    p.rotSpeed = rand(-0.8, 0.8)
    p.color = pick(t.colors)
    p.type = isImage ? 'image' : type
    p.imageIndex = isImage ? randInt(0, this.loadedImages.length - 1) : 0
    p.wobbleOffset = rand(0, Math.PI * 2)
    p.wobbleSpeed = rand(0.4, 1.2)
    p.wobbleAmp = rand(0.3, 1.2)
    p.life = 1
  }

  private initCelebration(p: Particle, cx: number, cy: number, intensity: number) {
    const angle = rand(0, Math.PI * 2)
    const speed = rand(150, 400) * intensity
    const t = this.theme
    const typeWeights: ParticleType[] = ['orb', 'orb', 'diamond', 'star', 'diamond']

    p.active = true
    p.ambient = false
    p.x = cx + rand(-20, 20)
    p.y = cy + rand(-20, 20)
    p.vx = Math.cos(angle) * speed
    p.vy = Math.sin(angle) * speed - rand(50, 200) // initial upward kick
    p.nvx = p.vx
    p.nvy = p.vy
    p.size = rand(4, 14)
    p.maxOpacity = rand(0.7, 1.0)
    p.opacity = p.maxOpacity
    p.rotation = rand(0, Math.PI * 2)
    p.rotSpeed = rand(-3, 3)
    p.color = pick(t.celebrationColors)
    p.type = pick(typeWeights)
    p.imageIndex = 0
    p.wobbleOffset = rand(0, Math.PI * 2)
    p.wobbleSpeed = 0
    p.wobbleAmp = 0
    p.life = 1.0
    p.lifeDuration = rand(1.2, 2.5)
  }

  private spawnAmbientBatch(count: number) {
    let spawned = 0
    for (const p of this.pool) {
      if (spawned >= count) break
      if (!p.active) {
        this.initAmbient(p)
        spawned++
      }
    }
  }

  private killAmbient() {
    for (const p of this.pool) {
      if (p.ambient) p.active = false
    }
  }

  // ─── Physics ───────────────────────────────────────────────────────────────

  private update(dt: number) {
    this.time += dt
    const mx = this.mouseX
    const my = this.mouseY

    for (const p of this.pool) {
      if (!p.active) continue

      if (p.ambient) {
        this.updateAmbient(p, dt, mx, my)
      } else {
        this.updateCelebration(p, dt)
      }
    }
  }

  private updateAmbient(p: Particle, dt: number, mx: number, my: number) {
    // Wobble horizontal force
    const wobble = Math.sin(this.time * p.wobbleSpeed + p.wobbleOffset) * p.wobbleAmp * dt
    p.vx += wobble

    // Mouse repulsion
    const dx = p.x - mx
    const dy = p.y - my
    const distSq = dx * dx + dy * dy
    const rSq = REPULSION_RADIUS * REPULSION_RADIUS
    if (distSq < rSq && distSq > 0.1) {
      const dist = Math.sqrt(distSq)
      const force = ((REPULSION_RADIUS - dist) / REPULSION_RADIUS) * REPULSION_STRENGTH * dt
      p.vx += (dx / dist) * force
      p.vy += (dy / dist) * force
    }

    // Drag toward natural velocity
    p.vx = lerp(p.vx, p.nvx, 0.03)
    p.vy = lerp(p.vy, p.nvy, 0.03)

    // Move
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rotation += p.rotSpeed * dt

    // Opacity pulse
    p.opacity = p.maxOpacity * (0.7 + 0.3 * Math.sin(this.time * 0.8 + p.wobbleOffset))

    // Wrap edges
    const pad = p.size * 3
    if (p.x < -pad) p.x = this.w + pad
    if (p.x > this.w + pad) p.x = -pad
    if (p.y < -pad) p.y = this.h + pad
    if (p.y > this.h + pad) p.y = -pad
  }

  private updateCelebration(p: Particle, dt: number) {
    p.vy += GRAVITY * dt       // gravity
    p.vx *= Math.pow(DRAG, dt * 60)
    p.vy *= Math.pow(DRAG, dt * 60)

    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rotation += p.rotSpeed * dt

    p.life -= dt / p.lifeDuration
    p.opacity = Math.max(0, p.life) * p.maxOpacity

    if (p.life <= 0) {
      p.active = false
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  private draw() {
    if (!this.ctx) return
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)

    for (const p of this.pool) {
      if (!p.active || p.opacity <= 0.01) continue

      ctx.save()
      ctx.globalAlpha = Math.min(1, p.opacity)

      if (p.type === 'image' && this.loadedImages[p.imageIndex]?.complete) {
        this.drawImage(ctx, p)
      } else if (p.type === 'orb') {
        this.drawOrb(ctx, p)
      } else if (p.type === 'diamond') {
        this.drawDiamond(ctx, p)
      } else if (p.type === 'star') {
        this.drawStar(ctx, p)
      } else {
        this.drawOrb(ctx, p)
      }

      ctx.restore()
    }
  }

  private drawOrb(ctx: CanvasRenderingContext2D, p: Particle) {
    const r = p.size
    const glowR = r * 3.5
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR)
    grad.addColorStop(0,   p.color + 'cc')
    grad.addColorStop(0.3, p.color + '66')
    grad.addColorStop(0.7, p.color + '22')
    grad.addColorStop(1,   p.color + '00')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2)
    ctx.fill()

    // Bright core
    const coreGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
    coreGrad.addColorStop(0, '#ffffff')
    coreGrad.addColorStop(0.5, p.color)
    coreGrad.addColorStop(1, p.color + '00')
    ctx.fillStyle = coreGrad
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawDiamond(ctx: CanvasRenderingContext2D, p: Particle) {
    const s = p.size
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)

    // Glow halo
    const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.5)
    glowGrad.addColorStop(0, p.color + '44')
    glowGrad.addColorStop(1, p.color + '00')
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(0, 0, s * 2.5, 0, Math.PI * 2)
    ctx.fill()

    // Diamond shape
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.lineTo(s * 0.6, 0)
    ctx.lineTo(0, s)
    ctx.lineTo(-s * 0.6, 0)
    ctx.closePath()
    ctx.fillStyle = p.color + '30'
    ctx.fill()
    ctx.strokeStyle = p.color + 'cc'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Inner highlight
    ctx.beginPath()
    ctx.moveTo(0, -s * 0.5)
    ctx.lineTo(s * 0.3, 0)
    ctx.lineTo(0, s * 0.5)
    ctx.lineTo(-s * 0.3, 0)
    ctx.closePath()
    ctx.fillStyle = '#ffffff22'
    ctx.fill()

    ctx.restore()
  }

  private drawStar(ctx: CanvasRenderingContext2D, p: Particle) {
    const s = p.size
    const inner = s * 0.4
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)

    // Glow
    const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2)
    glowGrad.addColorStop(0, p.color + '55')
    glowGrad.addColorStop(1, p.color + '00')
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.arc(0, 0, s * 2, 0, Math.PI * 2)
    ctx.fill()

    // 4-point star
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4
      const r = i % 2 === 0 ? s : inner
      const x = r * Math.cos(angle)
      const y = r * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = p.color + 'aa'
    ctx.fill()
    ctx.strokeStyle = p.color
    ctx.lineWidth = 0.8
    ctx.stroke()

    ctx.restore()
  }

  private drawImage(ctx: CanvasRenderingContext2D, p: Particle) {
    const img = this.loadedImages[p.imageIndex]
    const s = p.size
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.drawImage(img, -s, -s, s * 2, s * 2)
    ctx.restore()
  }

  // ─── Loop ──────────────────────────────────────────────────────────────────

  private loop = (now: number) => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.loop)

    // Skip if tab hidden (saves battery + GPU)
    if (document.hidden) return

    const raw = (now - this.lastTime) / 1000
    this.lastTime = now
    // Clamp dt to prevent huge jumps after tab switch
    const dt = Math.min(raw, 0.05)

    this.update(dt)
    this.draw()
  }

  // ─── Public query ──────────────────────────────────────────────────────────

  get activeCount(): number {
    return this.pool.filter(p => p.active).length
  }
}
