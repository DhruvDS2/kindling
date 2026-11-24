import { createContext, useContext } from 'react';

/**
 * Phase 2 contract between the list screens (Ready, At risk) and the school drawer.
 *
 * A screen that opens AccountDetail wraps it in <DrawerListContext.Provider> with the
 * list the rep is looking at, in on-screen order. The drawer uses it for the 4C pager
 * ("2 of 4 at risk", j/k) and the "Next school →" footer. AccountDetail's own props
 * stay { type, school, onClose }. No provider means no pager.
 */
export interface DrawerList {
  /** school_ids in the order they appear on screen (after the current filter and sort). */
  ids: string[];
  /** What the list is, for the pager label: "ready to buy", "at risk", "paid schools". */
  label: string;
  /** Open another school in the same drawer (updates ?school=). */
  open: (schoolId: string) => void;
}

export const DrawerListContext = createContext<DrawerList | null>(null);

export function useDrawerList(): DrawerList | null {
  return useContext(DrawerListContext);
}
