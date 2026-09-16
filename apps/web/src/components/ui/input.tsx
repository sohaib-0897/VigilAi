import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-none border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black placeholder:text-black/40 shadow-[2px_2px_0px_#000000] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:bg-neo-yellow/10 disabled:cursor-not-allowed disabled:bg-neo-muted/50 disabled:opacity-60",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
