export type ParticleType = 'orb' | 'diamond' | 'star' | 'image'

export interface ParticleTheme {
  id: string
  name: string
  /** Hex colors for particles */
  colors: string[]
  /** Celebration burst colors (wins) */
  celebrationColors: string[]
  /** Weighted list of shape types to spawn */
  typeWeights: ParticleType[]
  /** Optional custom image URLs (PNG/WebP/SVG with transparency) */
  imageUrls?: string[]
  /** Particle count multiplier. 1.0 = 50 particles */
  density: number
  /** Speed multiplier. 1.0 = normal */
  speed: number
  /** Size range in px */
  size: { min: number; max: number }
  /** Base opacity range */
  opacity: { min: number; max: number }
}

// ─── Built-in themes ──────────────────────────────────────────────────────────

export const THEMES: Record<string, ParticleTheme> = {
  neonDiamonds: {
    id: 'neonDiamonds',
    name: 'Neon Orbs & Diamonds',
    colors: [
      '#7c3aed', // purple
      '#06b6d4', // cyan
      '#ec4899', // pink
      '#a855f7', // violet
      '#22d3ee', // light cyan
      '#f0abfc', // light pink
    ],
    celebrationColors: [
      '#f59e0b', // gold
      '#fcd34d', // yellow
      '#ffffff', // white
      '#7c3aed', // purple
      '#06b6d4', // cyan
      '#ec4899', // pink
    ],
    // Weighted: more orbs than diamonds, occasional stars
    typeWeights: ['orb', 'orb', 'orb', 'diamond', 'diamond', 'star'],
    density: 1.0,
    speed: 1.0,
    size: { min: 3, max: 11 },
    opacity: { min: 0.15, max: 0.55 },
  },

  // Ready for custom images — just add imageUrls
  customAssets: {
    id: 'customAssets',
    name: 'Custom Brand Assets',
    colors: ['#7c3aed', '#06b6d4', '#ec4899'],
    celebrationColors: ['#f59e0b', '#fcd34d', '#ffffff'],
    typeWeights: ['image', 'image', 'orb'],
    imageUrls: [], // Drop your PNG/WebP/SVG paths here
    density: 1.0,
    speed: 0.8,
    size: { min: 16, max: 40 },
    opacity: { min: 0.2, max: 0.6 },
  },
}

export const DEFAULT_THEME_ID = 'neonDiamonds'
