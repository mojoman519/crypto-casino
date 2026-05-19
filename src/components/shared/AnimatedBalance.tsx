'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatBalanceShort } from '@/lib/currency'
import { CURRENCY_ICONS, CURRENCY_COLORS } from '@/types/transactions'
import type { Currency } from '@/types/transactions'
import { cn } from '@/lib/utils'

interface Props {
  currency: Currency
  balance: number
  className?: string
  showIcon?: boolean
  showCurrency?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function AnimatedBalance({
  currency,
  balance,
  className,
  showIcon = true,
  showCurrency = true,
  size = 'md',
}: Props) {
  const prevRef = useRef(balance)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (balance !== prevRef.current) {
      setFlash(balance > prevRef.current ? 'up' : 'down')
      const timer = setTimeout(() => setFlash(null), 800)
      prevRef.current = balance
      return () => clearTimeout(timer)
    }
  }, [balance])

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg font-bold',
  }

  return (
    <motion.span
      className={cn(
        'inline-flex items-center gap-1 font-mono tabular-nums transition-colors duration-300',
        CURRENCY_COLORS[currency],
        flash === 'up' && 'text-emerald-400',
        flash === 'down' && 'text-red-400',
        sizeClasses[size],
        className
      )}
      animate={flash === 'up'
        ? { scale: [1, 1.08, 1] }
        : flash === 'down'
        ? { scale: [1, 0.95, 1] }
        : {}
      }
      transition={{ duration: 0.3 }}
    >
      {showIcon && <span className="not-italic">{CURRENCY_ICONS[currency]}</span>}
      <AnimatePresence mode="wait">
        <motion.span
          key={Math.floor(balance * 1000)}
          initial={{ opacity: 0, y: flash === 'up' ? 8 : flash === 'down' ? -8 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {formatBalanceShort(balance, currency)}
        </motion.span>
      </AnimatePresence>
      {showCurrency && currency !== 'USDC' && (
        <span className="opacity-60 text-xs">{currency}</span>
      )}
    </motion.span>
  )
}
