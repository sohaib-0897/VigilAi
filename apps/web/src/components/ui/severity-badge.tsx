import React from "react"
import { cn } from "@/lib/utils"

interface SeverityBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  severity: string
}

export function SeverityBadge({ severity, className, ...props }: SeverityBadgeProps) {
  const norm = severity?.toLowerCase() || "low"

  let bg = "bg-white text-black"
  let label = norm.toUpperCase()

  switch (norm) {
    case "critical":
      bg = "bg-neo-red text-white"
      break
    case "high":
      bg = "bg-[#FF884B] text-black"
      break
    case "medium":
      bg = "bg-neo-yellow text-black"
      break
    case "low":
    case "info":
    default:
      bg = "bg-neo-violet text-black"
      break
  }

  return (
    <div
      className={cn(
        "inline-flex items-center border border-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000000] select-none",
        bg,
        className
      )}
      {...props}
    >
      {label}
    </div>
  )
}
