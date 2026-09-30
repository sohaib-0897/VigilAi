'use client';
import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorMessage } from './format';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  /** Resolve to close the dialog; reject to keep it open and show the error. */
  onConfirm: () => Promise<void>;
}

/**
 * Confirmation for destructive, irreversible actions. Cancel is the first
 * focusable control, so Enter on open never deletes.
 */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, pendingLabel, onConfirm }: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (cause) {
      setError(errorMessage(cause, 'The action failed.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <DialogPrimitive.Description asChild>
          <div className="space-y-2 text-body text-muted-foreground">{description}</div>
        </DialogPrimitive.Description>
        <div role="alert">
          {error && (
            <p className="flex items-start gap-2 bg-danger px-3 py-2 text-body-sm text-danger-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" disabled={pending} className="min-h-11 sm:min-h-10">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending} className="min-h-11 sm:min-h-10">
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
