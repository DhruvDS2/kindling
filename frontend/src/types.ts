export interface PqlScore {
  school_id: string;
  name: string;
  pql_score: number;
  status: string;
  reasons: string[];
  active_teachers: number;
  student_sessions: number;
  admin_signed_up: boolean;
  city: string;
  state: string;
  district: string | null;
  contact_name: string;
  contact_title: string;
  contact_email: string;
}

export interface HealthScore {
  school_id: string;
  name: string;
  health_score: number;
  status: string;
  reasons: string[];
  days_to_renewal: number;
  arr: number;
  active_teachers: number;
  seats: number;
  city: string;
  state: string;
  district: string | null;
  contact_name: string;
  contact_title: string;
  contact_email: string;
}

export interface BacktestWeek {
  date: string;
  naive: number;
  kindling: number;
  is_break: boolean;
}

export interface BacktestResult {
  metric: string;
  naive: number | string;
  kindling: number | string;
  kindling_better: boolean;
}

export interface BacktestData {
  weeks: BacktestWeek[];
  results: BacktestResult[];
  takeaway: string;
}

export interface AutomationRun {
  id?: string;
  run_at: string;
  trigger?: string;
  pql_alerts: number;
  cs_alerts?: number;
  health_alerts?: number;
  email_drafts: number;
  status: 'succeeded' | 'failed';
}
