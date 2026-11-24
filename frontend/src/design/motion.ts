// Motion tokens for JavaScript. The values live in tokens.css (DESIGN.md §4) and are read
// from the document at runtime, so CSS and motion.dev animations can never drift apart.
import { useReducedMotion } from 'motion/react';

export type Speed = 'fast' | 'base' | 'slow' | 'reveal';
export type Easing = 'enter' | 'exit';
type Bezier = [number, number, number, number];

const cache = new Map<string, string>();

/** The computed value of a custom property on <html>, e.g. readToken('--motion-base') → "200ms". */
export function readToken(name: string, cached = true): string {
  if (cached && cache.has(name)) return cache.get(name)!;
  if (typeof document === 'undefined') return '';
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (v && cached) cache.set(name, v);
  return v;
}

/** "200ms" or "0.2s" → seconds. */
export function toSeconds(v: string): number {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.trim().endsWith('ms') ? n / 1000 : n;
}

/** A speed token in seconds (what motion.dev expects). */
export function dur(speed: Speed): number {
  return toSeconds(readToken(`--motion-${speed}`));
}

/** A speed token in milliseconds (for timers such as debounces). */
export function durMs(speed: Speed): number {
  return dur(speed) * 1000;
}

/** An easing token as a cubic-bezier tuple. */
export function ease(name: Easing): Bezier {
  const m = readToken(`--ease-${name}`).match(/cubic-bezier\(([^)]+)\)/);
  const parts = m ? m[1].split(',').map(Number) : [];
  return parts.length === 4 && parts.every(Number.isFinite) ? (parts as Bezier) : [0, 0, 1, 1];
}

/** A motion.dev transition built from tokens: tr('slow', 'enter'). */
export function tr(speed: Speed, easing: Easing = 'enter', extra: Record<string, unknown> = {}) {
  return { duration: dur(speed), ease: ease(easing), ...extra };
}

/** A per-item delay token in seconds (e.g. --stagger-row). Not cached: reduced motion sets it to 0. */
export function stagger(name: 'row' | 'cell'): number {
  return toSeconds(readToken(`--stagger-${name}`, false));
}

/** True when the OS asks for reduced motion. Components then fade instead of moving or clipping. */
export function useReduce(): boolean {
  return useReducedMotion() ?? false;
}
