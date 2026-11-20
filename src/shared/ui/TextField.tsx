import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-footnote font-medium text-text-muted">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? hintId : undefined}
        className={cn(
          'min-h-tap rounded-md border border-border bg-surface-2 px-4 text-body text-text placeholder:text-text-subtle',
          'focus:border-accent focus:outline-none',
          error && 'border-danger',
          className,
        )}
        {...rest}
      />
      {message && (
        <p id={hintId} className={cn('text-footnote', error ? 'text-danger' : 'text-text-subtle')}>
          {message}
        </p>
      )}
    </div>
  );
});
