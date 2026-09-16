import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-none border border-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000000] select-none",
  {
    variants: {
      variant: {
        default: "bg-neo-green text-black",
        secondary: "bg-neo-muted text-black",
        destructive: "bg-neo-red text-white",
        outline: "bg-white text-black",
        critical: "bg-neo-red text-white",
        high: "bg-[#FF884B] text-black",
        medium: "bg-neo-yellow text-black",
        low: "bg-neo-violet text-black",
        online: "bg-neo-green text-black",
        offline: "bg-white text-black",
        black: "bg-black text-white",
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
