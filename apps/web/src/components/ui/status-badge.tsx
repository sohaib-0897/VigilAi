import React from "react"
import { StatusIndicator } from "@/components/primitives/status-indicator"
import { statusTone } from "@/lib/status"

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string
  label?: string
  showPulse?: boolean
}

export function StatusBadge({ status, label, showPulse = true, ...props }: StatusBadgeProps) {
  const norm = status?.toLowerCase() || "offline"
  return <StatusIndicator tone={statusTone(norm)} label={label || norm.toUpperCase()} live={showPulse} {...props} />
}
