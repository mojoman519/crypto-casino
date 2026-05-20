'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, Clock } from 'lucide-react'

interface Props {
  game: string
  icon: string
  message?: string
}

export function ComingSoon({ game, icon, message }: Props) {
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="text-center max-w-md"
      >
        {/* Icon with glow */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="text-8xl mb-6 inline-block"
          style={{ filter: 'drop-shadow(0 0 24px rgba(124,58,237,0.6))' }}
        >
          {icon}
        </motion.div>

        <div className="glass-card p-8 border border-purple-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/10 pointer-events-none" />

          <div className="relative">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Coming Soon</span>
            </div>

            <h1 className="text-3xl font-black text-white mb-3">{game}</h1>

            {message && (
              <p className="text-white/50 text-sm leading-relaxed mb-6">{message}</p>
            )}

            {/* Animated progress bar */}
            <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-6">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-semibold hover:bg-purple-600/30 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Lobby
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
