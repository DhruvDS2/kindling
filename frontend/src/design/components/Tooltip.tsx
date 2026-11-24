import {
  cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactElement, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { durMs } from '../motion';
import './Tooltip.css';

interface TooltipProps {
  content: ReactNode;
  /** One focusable or hoverable element. */
  children: ReactElement<Record<string, unknown>>;
  side?: 'top' | 'bottom';
  /** Disable without unmounting (e.g. text that isn't truncated). */
  disabled?: boolean;
  /** Styleguide only: render open. */
  forceOpen?: boolean;
}

/**
 * A quiet label on hover (after --motion-slow) and immediately on keyboard focus.
 * Raised surface, popover elevation, label size. Never holds anything you can click.
 */
export function Tooltip({ content, children, side = 'top', disabled, forceOpen }: TooltipProps) {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; side: 'top' | 'bottom' } | null>(null);
  const shown = !disabled && (open || !!forceOpen);

  const place = useCallback(() => {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const flip = side === 'top' && r.top < r.height * 2 ? 'bottom' : side;
    setPos({ x: r.left + r.width / 2, y: flip === 'top' ? r.top : r.bottom, side: flip });
  }, [side]);

  useLayoutEffect(() => { if (shown) place(); }, [shown, place]);
  useEffect(() => {
    if (!shown) return;
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    const ro = new ResizeObserver(place);
    ro.observe(document.body);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); ro.disconnect(); };
  }, [shown, place]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!isValidElement(children)) return children;
  const child = children as ReactElement<Record<string, unknown>>;
  const props = child.props as Record<string, ((e: unknown) => void) | undefined>;
  const trigger = cloneElement(child, {
    ref: (node: HTMLElement | null) => { anchor.current = node; },
    'aria-describedby': shown ? id : undefined,
    onPointerEnter: (e: unknown) => { props.onPointerEnter?.(e); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(true), durMs('slow')); },
    onPointerLeave: (e: unknown) => { props.onPointerLeave?.(e); window.clearTimeout(timer.current); setOpen(false); },
    onFocus: (e: unknown) => { props.onFocus?.(e); setOpen(true); },
    onBlur: (e: unknown) => { props.onBlur?.(e); setOpen(false); },
  });

  return (
    <>
      {trigger}
      {shown && pos && createPortal(
        <div
          role="tooltip"
          id={id}
          className={`k-tooltip k-tooltip--${pos.side}`}
          style={{ '--k-x': `${pos.x}`, '--k-y': `${pos.y}` } as CSSProperties}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * One line of text that truncates with an ellipsis and shows the full text in a tooltip,
 * only when it is actually cut off. Use for school names and other long values.
 */
export function TruncatedText({ children, className, as: Tag = 'span' }: { children: string; className?: string; as?: 'span' | 'div' }) {
  const ref = useRef<HTMLElement | null>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setCut(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  return (
    <Tooltip content={children} disabled={!cut}>
      <Tag ref={ref as never} className={['k-truncate', className ?? ''].join(' ').trim()} tabIndex={cut ? 0 : undefined}>
        {children}
      </Tag>
    </Tooltip>
  );
}
