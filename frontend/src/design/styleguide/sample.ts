// SAMPLE DATA for the dev-only /__styleguide route. Fictional schools shaped like /pql rows.
// Nothing here is shown in the product: every number in the app comes from the API at runtime.
import { addWeeks, mondaysBetween } from '../dates';

export interface SampleSchool {
  id: string;
  name: string;
  place: string;
  /** Score by week: [this week, next week] so the styleguide can step a week. */
  scores: [number, number];
  teachers: number;
  reason: string;
  points: string;
  contact: string;
  title: string;
  email: string;
}

export const SAMPLE_READY_LINE = 60;

export const SAMPLE_SCHOOLS: SampleSchool[] = [
  { id: 'S-1042', name: 'Quillon Reach Academy', place: 'Independent · Fresno, CA', scores: [90, 88], teachers: 5, reason: '5 teachers with heavy student use', points: '35/35', contact: 'Ana White', title: 'Principal', email: 'a.white@quillon.example' },
  { id: 'S-1187', name: 'Marrow Landing Academy', place: 'Independent · Tucson, AZ', scores: [84, 91], teachers: 4, reason: 'Admin signed up 6 days ago', points: '15/15', contact: 'Luis Ortega', title: 'Technology Coordinator', email: 'l.ortega@marrow.example' },
  { id: 'S-2210', name: 'The Saint Bartholomew-Okonkwo Preparatory School for the Sciences and Humanities', place: 'District · Harlow Valley Unified · Sacramento, CA', scores: [72, 66], teachers: 3, reason: 'Student sessions up 140% vs the prior 10 school days', points: '28/35', contact: 'Priya Natarajan-Whitfield', title: 'Assistant Principal, Curriculum & Instruction', email: 'p.natarajan@stbart.example' },
  { id: 'S-0931', name: 'Larkspur Hollow Academy', place: 'Independent · Boise, ID', scores: [64, 52], teachers: 4, reason: '4 teachers active in the last 10 school days', points: '30/40', contact: 'Dana Kim', title: 'Principal', email: 'd.kim@larkspur.example' },
  { id: 'S-3305', name: 'Thistle Landing Academy', place: 'Independent · Eugene, OR', scores: [58, 63], teachers: 2, reason: '230 student sessions', points: '22/35', contact: 'Owen Price', title: 'Dean of Students', email: 'o.price@thistle.example' },
  { id: 'S-4410', name: 'Cedar Run Elementary', place: 'District · Fox Creek ISD · Austin, TX', scores: [41, 45], teachers: 1, reason: '1 teacher built 3 tutors', points: '12/20', contact: 'Maya Brooks', title: 'Librarian', email: 'm.brooks@cedarrun.example' },
];

export const SAMPLE_MONDAYS = mondaysBetween('2025-08-01', '2026-07-31');
export const SAMPLE_DEMO_DATE = '2026-02-02';
export const SAMPLE_NEXT_WEEK = addWeeks(SAMPLE_DEMO_DATE, 1);
export const SAMPLE_PREV_WEEK = addWeeks(SAMPLE_DEMO_DATE, -1);
export const SAMPLE_BREAKS = [
  { start: '2025-11-24', end: '2025-11-28', kind: 'break' as const },
  { start: '2025-12-22', end: '2026-01-02', kind: 'break' as const },
  { start: '2026-03-23', end: '2026-03-27', kind: 'break' as const },
  { start: '2026-06-08', end: '2026-07-31', kind: 'summer' as const },
];

/** Brief stats for three consecutive Mondays (Jan 26, Feb 2, Feb 9), plus the 7 Mondays before Feb 2. */
export const SAMPLE_STATS = [
  { label: 'Ready to buy', values: [7, 9, 11], trend: [3, 4, 4, 6, 5, 6, 7] },
  { label: 'At risk', values: [3, 4, 3], trend: [1, 2, 2, 2, 3, 3, 3] },
  { label: 'ARR at risk', values: [18000, 23600, 18000], trend: [5600, 8800, 8800, 12000, 17600, 18000, 18000], money: true },
  { label: 'Projected NRR', values: [90.6, 89.2, 91.4], trend: [94, 93.5, 93, 92.1, 91, 90.2, 90.6], percent: true },
];
