import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Blocking load failure with the API's own detail and a retry. */
export function LoadErrorPanel({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-4 border border-border-strong bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center bg-danger text-danger-foreground">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-body font-semibold">{title}</p>
          <p className="vg-telemetry mt-1 text-muted-foreground">{detail}</p>
        </div>
      </div>
      {onRetry && <Button variant="outline" onClick={onRetry} className="min-h-11">Try again</Button>}
    </div>
  );
}

/**
 * Always-mounted alert region for failed actions, so an inserted message is
 * announced. Renders nothing visible while `message` is empty.
 */
export function ActionAlert({ message, onDismiss }: { message: string | null; onDismiss?: () => void }) {
  return (
    <div role="alert">
      {message && (
        <p className="flex items-start justify-between gap-3 border border-danger bg-danger/10 px-3 py-2 text-body-sm text-foreground">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
            {message}
          </span>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="vg-label -my-2 min-h-11 shrink-0 px-2 underline decoration-1 underline-offset-4 hover:decoration-2">
              Dismiss
            </button>
          )}
        </p>
      )}
    </div>
  );
}
