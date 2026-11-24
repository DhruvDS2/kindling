import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { risePx, tr, useReduce } from '../motion';
import './Toast.css';

export interface ToastInput {
  message: string;
  tone?: 'neutral' | 'success' | 'error';
  /** One follow-up action (e.g. "Undo", "Open in Slack"). */
  action?: { label: string; onClick: () => void };
}
interface ToastItem extends ToastInput { id: number }

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/** Shows a toast: useToast()({ message: 'Sent to #sales' }). */
export function useToast() {
  const fn = useContext(ToastContext);
  if (!fn) throw new Error('useToast must be used inside <ToastProvider>');
  return fn;
}

/** Toasts sit bottom-left, one at a time is typical; each stays ~5s (longer on hover/focus). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const push = useCallback((t: ToastInput) => setItems(list => [...list.slice(-2), { ...t, id: next.current++ }]), []);
  const dismiss = useCallback((id: number) => setItems(list => list.filter(t => t.id !== id)), []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="k-toasts" role="region" aria-label="Notifications" aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map(t => <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />)}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

const LIFETIME_FACTOR = 25;  // × --motion-base = 5s on screen

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const reduce = useReduce();
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const t = window.setTimeout(onDismiss, tr('base').duration * 1000 * LIFETIME_FACTOR);
    return () => window.clearTimeout(t);
  }, [held, onDismiss]);
  return (
    <motion.div
      layout={!reduce}
      className={`k-toast k-toast--${item.tone ?? 'neutral'}`}
      role={item.tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: reduce ? 0 : risePx() }}
      animate={{ opacity: 1, y: 0, transition: tr('base', 'enter') }}
      exit={{ opacity: 0, transition: tr('fast', 'exit') }}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className="k-toast__msg">{item.message}</span>
      {item.action && (
        <button type="button" className="k-toast__action k-focus" onClick={() => { item.action!.onClick(); onDismiss(); }}>
          {item.action.label}
        </button>
      )}
      <button type="button" className="k-toast__close k-focus" aria-label="Dismiss" onClick={onDismiss}>Dismiss</button>
    </motion.div>
  );
}
