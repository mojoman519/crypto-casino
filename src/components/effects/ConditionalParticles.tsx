'use client'

import { usePathname } from 'next/navigation'
import { AmbientParticles } from './AmbientParticles'

interface Props {
  zIndex?: number
}

export function ConditionalParticles({ zIndex = 0 }: Props) {
  const pathname = usePathname()
  const isGamePage = pathname?.startsWith('/games/')
  if (isGamePage) return null
  return <AmbientParticles zIndex={zIndex} />
}
