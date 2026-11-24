import { AnimatePresence, motion } from 'motion/react';
import { tr } from '../motion';
import './UpdatingMark.css';

/**
 * The quiet inline "Updating…" shown next to the date while a new week loads (DESIGN.md §3.2).
 * Fades in over --motion-base after a --motion-base delay (so fast responses never flash it),
 * and out over --motion-fast.
 */
export function UpdatingMark({ active, label = 'Updating…' }: { active: boolean; label?: string }) {
  return (
    <span className="k-updating" aria-live="polite">
      <AnimatePresence>
        {active && (
          <motion.span
            key="on"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: tr('base', 'enter', { delay: tr('base').duration }) }}
            exit={{ opacity: 0, transition: tr('fast', 'exit') }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
