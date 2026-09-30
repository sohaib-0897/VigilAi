import React from "react"
import { cn } from "@/lib/utils"
import { TechnicalLabel } from "@/components/primitives/technical-label"

interface SectionHeaderProps {
  tag?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({ tag, title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 border-b border-border-strong pb-5 sm:flex-row sm:items-end", className)}>
      <div className="min-w-0">
        {tag && <TechnicalLabel className="mb-3">{tag}</TechnicalLabel>}
        <h1 className="font-display text-heading uppercase text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-measure text-body text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
