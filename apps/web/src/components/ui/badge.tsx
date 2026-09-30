import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "vg-label inline-flex h-6 select-none items-center gap-1.5 whitespace-nowrap border px-2 font-medium",
  {
    variants: {
      variant: {
        default: "border-border-strong bg-success text-success-foreground",
        secondary: "border-border bg-muted text-foreground",
        destructive: "border-border-strong bg-danger text-danger-foreground",
        outline: "border-border-strong bg-transparent text-foreground",
        critical: "border-border-strong bg-danger text-danger-foreground",
        high: "border-border-strong bg-warning text-warning-foreground",
        medium: "border-border-strong bg-signal text-signal-foreground",
        low: "border-border-strong bg-track text-track-foreground",
        online: "border-border-strong bg-success text-success-foreground",
        offline: "border-border bg-muted text-muted-foreground",
        black: "border-foreground bg-foreground text-background",
      },
      shape: {
        sharp: "rounded-none",
        pill: "rounded-full px-2.5",
      }
    },
    defaultVariants: {
      variant: "default",
      shape: "sharp",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, shape, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, shape }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
