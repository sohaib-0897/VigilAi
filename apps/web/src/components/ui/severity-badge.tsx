import React from "react"
import { cn } from "@/lib/utils"
import { severityTone, toneFill } from "@/lib/status"

interface SeverityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  severity: string
}

export function SeverityBadge({ severity, className, ...props }: SeverityBadgeProps) {
  const norm = severity?.toLowerCase() || "low"
  return (
    <span
      className={cn(
        "vg-label inline-flex h-6 select-none items-center whitespace-nowrap border px-2 font-medium",
        toneFill[severityTone(norm)],
        className
      )}
      {...props}
    >
      {norm.toUpperCase()}
    </span>
  )
}
