import React from "react"
import { cn } from "@/lib/utils"

export type OperationalStatus = "online" | "offline" | "connecting" | "degraded" | "error" | "processing" | "analyzing" | "healthy" | "down"

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string
  label?: string
  showPulse?: boolean
}

export function StatusBadge({ status, label, showPulse = true, className, ...props }: StatusBadgeProps) {
  const norm = status?.toLowerCase() || "offline"

  let bg = "bg-white text-black"
  let dotBg = "bg-black"
  let border = "border-black"
  let text = label || norm.toUpperCase()

  switch (norm) {
    case "online":
    case "healthy":
      bg = "bg-neo-green text-black"
      dotBg = "bg-black"
      break
    case "analyzing":
    case "processing":
      bg = "bg-neo-yellow text-black"
      dotBg = "bg-black"
      break
    case "connecting":
    case "degraded":
      bg = "bg-[#FFD93D] text-black"
      dotBg = "bg-black"
      break
    case "error":
    case "down":
    case "critical":
      bg = "bg-neo-red text-white"
      dotBg = "bg-white"
      break
    case "offline":
    default:
      bg = "bg-neo-muted text-black"
      dotBg = "bg-black/50"
      break
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 border-2 border-black px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_#000000] select-none",
        bg,
        border,
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full border border-black",
          dotBg,
          (norm === "online" || norm === "analyzing") && showPulse && "animate-pulse"
        )}
      />
      <span>{text}</span>
    </div>
  )
}
