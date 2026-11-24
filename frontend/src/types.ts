// The data contract the UI is built on (docs/gates/PRE-UI-READINESS.md §4).
// Every number on screen comes from these payloads at runtime.

export type PqlStatus = 'Ready' | 'Not yet';
export type HealthStatus = 'At risk' | 'Healthy';

export interface ReasonDetail {
  text: string;
  points: number;
  max_points: number;
}

export interface ScoreWindow {
  start: string;
  end: string;
  prev_start: string | null;
  prev_end: string;
}

interface SchoolProfile {
  school_id: string;
  name: string;
  type: 'district' | 'independent';
  calendar_id: string;
  seats: number;
  city: string;
  state: string;
  district: string | null;
  contact_name: string;
  contact_title: string;
  contact_email: string;
}

export interface PqlScore extends SchoolProfile {
  pql_score: number;
  status: PqlStatus;
  ready_rule: 'score' | 'admin' | null;
  reasons: string[];
  reason_details: ReasonDetail[];
  active_teachers: number;
  active_teachers_prev: number;
  aha_teachers: number;
  student_sessions: number;
  student_sessions_prev: number;
  tutors_created: number;
  admin_signed_up: boolean;
  admin_signed_up_on: string | null;
  window: ScoreWindow;
}

export interface HealthScore extends SchoolProfile {
  health_score: number;
  status: HealthStatus;
  reasons: string[];
  reason_details: ReasonDetail[];
  renewal_date: string;
  days_to_renewal: number;
  arr: number;
  active_teachers: number;
  active_teachers_prev: number;
  student_sessions: number;
  student_sessions_prev: number;
  window: ScoreWindow;
}

export interface Stats {
  as_of: string;
  ready_to_buy: number;
  at_risk: number;
  arr_at_risk: number;
  arr_at_risk_school_count: number;
  paid_schools_scored: number;
  total_arr: number;
  arr_churned_to_date: number;
  projected_nrr: number;
  definitions: { at_risk: string; ready: string; projected_nrr: string };
}

export interface Meta {
  demo_as_of: string;
  sim_start: string;
  sim_end: string;
  replay_start: string;
  replay_end: string;
  shared_calendar: string;
  windows: { school_days: number; calendar_days: number };
  thresholds: {
    pql_ready: number;
    pql_admin_ready: number;
    health_at_risk_below: number;
    renewal_buffer_days: number;
    health_min_school_days: number;
  };
}

export type Lifecycle =
  | 'free' | 'converted' | 'no_signup'
  | 'paid' | 'not_started' | 'renewed' | 'churned' | 'expanded';

export interface SchoolDetail extends SchoolProfile {
  as_of: string;
  plan: 'free' | 'paid';
  students: number;
  region: string;
  signup_date: string | null;
  renewal_date: string | null;
  arr: number;
  lifecycle: Lifecycle;
  renewal_outcome: 'renewed' | 'churned' | 'expanded' | null;
  first_signup: string | null;
  converted_on: string | null;
  score_kind: 'pql' | 'health';
  score: PqlScore | HealthScore | null;
  school_days_elapsed: number;
  windows: {
    school_days: ScoreWindow & { length: number; unit: string; calendar_id: string };
    calendar: ScoreWindow & { length: number; unit: string };
  };
}

export interface HistoryPoint {
  as_of: string;
  score: number;
  status: PqlStatus | HealthStatus;
  reasons: string[];
  active_teachers: number;
  student_sessions: number;
}

export interface SchoolHistory {
  school_id: string;
  as_of: string;
  mode: 'school_days' | 'calendar';
  score_kind: 'pql' | 'health';
  points: HistoryPoint[];
}

export type DayKind = 'instructional' | 'weekend' | 'break' | 'summer';

export interface UsageDay {
  day: string;
  kind: DayKind;
  active_teachers: number;
  student_sessions: number;
  tutors_created: number;
}

export interface SchoolUsage {
  school_id: string;
  as_of: string;
  calendar_id: string;
  days: UsageDay[];
}

export interface SchoolCalendar {
  calendar_id: string;
  first_day: string;
  last_day: string;
  school_days: number;
  breaks: { start: string; end: string }[];
}

export interface BacktestWeek {
  date: string;
  naive: number;
  kindling: number;
  is_break: boolean;
  is_summer: boolean;
}

export interface BacktestData {
  replay: { start: string; end: string };
  calendar: SchoolCalendar;
  weeks: BacktestWeek[];
}

export interface ResultsRow {
  label: string;
  values: (number | string | null)[];
  display: string[];
}

export interface ResultsTable {
  title: string | null;
  note: string | null;
  index_name: string | null;
  columns: string[];
  rows: ResultsRow[];
}

export interface ResultsRun {
  id: string;
  title: string;
  source: string;
  note: string;
  generated_at: string;
  commit: string | null;
  replay: { start: string; end: string };
  tables: ResultsTable[];
}

export interface BacktestResults {
  runs: ResultsRun[];
  missing: string[];
}

export interface FunnelSnapshot {
  as_of: string;
  not_yet: number;
  ready: number;
}

export interface StageMove {
  school_id: string;
  name: string;
  as_of: string;
  from_status: string;
  to_status: string;
}

export interface PipelineFunnelData {
  snapshots: FunnelSnapshot[];
  latest: FunnelSnapshot | null;
  prev: FunnelSnapshot | null;
  moves: StageMove[];
}

export interface AutomationRun {
  id?: string;
  trigger?: string;
  cs_alerts?: number;
  run_at: string;
  pql_alerts: number;
  health_alerts?: number;
  email_drafts: number;
  status: 'succeeded' | 'failed';
}
