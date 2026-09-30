'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Password input with a show/hide toggle. The toggle is a real button that
 * switches the input type; paste and password managers are never blocked.
 */
export const PasswordField = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ className, disabled, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    // The toggle needs JS; render it only after hydration so it is never a dead control.
    const [hydrated, setHydrated] = React.useState(false);
    React.useEffect(() => setHydrated(true), []);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="none"
          className={cn(hydrated && 'pr-12', className)}
          {...props}
        />
        {hydrated && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setVisible(v => !v)}
            aria-label="Show password"
            aria-pressed={visible}
            aria-controls={props.id}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors duration-micro ease-standard hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45"
          >
            {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
    );
  },
);
PasswordField.displayName = 'PasswordField';
