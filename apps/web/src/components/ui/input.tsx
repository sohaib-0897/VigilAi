import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-none border border-input bg-surface px-3 py-2 text-body text-foreground transition-[border-color,box-shadow] duration-micro ease-standard placeholder:text-muted-foreground/70 hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 file:border-0 file:bg-transparent file:font-medium",
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
