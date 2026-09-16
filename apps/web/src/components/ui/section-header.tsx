import React from "react"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  tag?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({ tag, title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b-4 border-black pb-4", className)}>
      <div>
        {tag && (
          <div className="inline-block bg-neo-yellow border-2 border-black px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] shadow-[2px_2px_0px_#000000] mb-2">
            {tag}
          </div>
        )}
        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-black">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm font-medium text-black/75 mt-1 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  )
}
