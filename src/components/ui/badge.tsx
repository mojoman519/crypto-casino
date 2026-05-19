import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-purple-500/30 bg-purple-500/20 text-purple-300',
        secondary: 'border-white/10 bg-white/5 text-white/60',
        destructive: 'border-red-500/30 bg-red-500/20 text-red-400',
        success: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400',
        warning: 'border-amber-500/30 bg-amber-500/20 text-amber-400',
        cyan: 'border-cyan-500/30 bg-cyan-500/20 text-cyan-400',
        outline: 'border-white/10 text-white/60',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
