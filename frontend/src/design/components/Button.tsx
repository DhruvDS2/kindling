import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the one "act on this" button (AA-safe ember). secondary: outlined. quiet: text only. */
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  /** Shows a small busy mark and blocks clicks; the label stays so the width doesn't jump. */
  loading?: boolean;
  /** Leading/trailing icon (from ./icons). */
  icon?: ReactNode;
  iconAfter?: ReactNode;
  /** A keyboard hint shown after the label, e.g. "C". */
  shortcut?: string;
  /** Styleguide only: render a hover/focus/active state without a pointer. */
  force?: 'hover' | 'focus' | 'active';
}

/** DESIGN.md §6 Button. Press darkens one step; focus is the 2px ember ring. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, iconAfter, shortcut, force, className, children, disabled, onClick, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={['k-btn', `k-btn--${variant}`, `k-btn--${size}`, 'k-focus', loading ? 'is-loading' : '', className ?? ''].join(' ').trim()}
      data-force={force}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? e => e.preventDefault() : onClick}
      {...rest}
    >
      {loading ? <span className="k-btn__busy" aria-hidden="true" /> : icon}
      {children != null && <span className="k-btn__label">{children}</span>}
      {iconAfter}
      {shortcut && <kbd className="k-btn__kbd">{shortcut}</kbd>}
    </button>
  );
});

/** A keyboard key hint: <Kbd>j</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="k-kbd">{children}</kbd>;
}
