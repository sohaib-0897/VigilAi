import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-none font-bold uppercase tracking-wider text-xs border-2 sm:border-2 border-black transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default: "bg-black text-white hover:bg-black/85 shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        secondary: "bg-neo-yellow text-black hover:bg-[#ffe265] shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        destructive: "bg-neo-red text-white hover:bg-[#ff7575] shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        outline: "bg-white text-black hover:bg-neo-cream shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        violet: "bg-neo-violet text-black hover:bg-[#d4c9fe] shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        green: "bg-neo-green text-black hover:bg-[#78eb89] shadow-neo-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        ghost: "border-transparent bg-transparent text-black hover:bg-neo-yellow/25 hover:border-black shadow-none",
        link: "border-transparent bg-transparent text-black underline-offset-4 hover:underline shadow-none p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-[11px]",
        lg: "h-12 px-6 text-sm font-black tracking-widest",
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
