import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Industrial button: square, ink-framed. Interaction is mechanical — hover
// lifts 1px onto a hard shadow, press seats it back down. No scale, no glow.
const lift = "hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-1 active:translate-x-0 active:translate-y-0 active:shadow-none"

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-none border font-sans text-[0.75rem] font-semibold uppercase leading-none tracking-[0.08em] transition-[background-color,color,border-color,box-shadow,transform] duration-micro ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: `border-border-strong bg-foreground text-background hover:bg-foreground/90 ${lift}`,
        secondary: `border-border-strong bg-signal text-signal-foreground hover:bg-signal/85 ${lift}`,
        destructive: `border-border-strong bg-danger text-danger-foreground hover:bg-danger/90 ${lift}`,
        outline: `border-border-strong bg-surface text-foreground hover:bg-muted ${lift}`,
        violet: `border-border-strong bg-track text-track-foreground hover:bg-track/85 ${lift}`,
        green: `border-border-strong bg-success text-success-foreground hover:bg-success/85 ${lift}`,
        ghost: "border-transparent bg-transparent text-foreground hover:border-border hover:bg-muted/70",
        link: "h-auto border-transparent bg-transparent p-0 text-foreground underline decoration-1 underline-offset-4 hover:decoration-2",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[0.6875rem]",
        lg: "h-12 px-6 text-[0.8125rem]",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button, buttonVariants }
