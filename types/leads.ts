import type { Office, LeadSource, PipelineStatus, ActivityType } from '@/constants/config';

export interface Lead {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string | null;
  office: Office;
  source: LeadSource;
  owner_id: string | null;
  status: PipelineStatus;
  notes: string;
  last_touch_at: string;
  next_followup_at: string | null;
  quoted_at: string | null;
  closed_at: string | null;
  renewal_date: string | null;
  premium_amount: number | null;
  commission_estimate: number | null;
}

export interface ActivityLogEntry {
  id: string;
  lead_id: string;
  created_at: string;
  user_id: string;
  type: ActivityType;
  note: string;
}

export interface FollowUpTask {
  id: string;
  lead_id: string;
  scheduled_at: string;
  completed: boolean;
  completed_at: string | null;
  overdue: boolean;
}

export interface SLAAlert {
  id: string;
  lead_id: string;
  type: 'new_alert' | 'new_escalate' | 'quoted_alert' | 'quoted_escalate' | 'followup_overdue' | 'followup_escalate';
  triggered_at: string;
  resolved: boolean;
  channel: 'whatsapp' | 'email';
  message: string;
}

export interface MgUser {
  id: string;
  email: string;
  name: string;
  role: 'orchestrator' | 'producer' | 'manager';
  office: Office;
}

export interface LeadCreateInput {
  full_name: string;
  phone: string;
  email?: string;
  office: Office;
  source: LeadSource;
  owner_id?: string | null;
  notes?: string;
  premium_amount?: number;
}

export interface DashboardMetrics {
  leadsToday: number;
  leadsThisWeek: number;
  leadsUnassigned: number;
  leadsNeedingContact: number;
  followUpDueToday: number;
  contactSpeedPercent: number;
  conversionPercent: number;
  closedPerProducer: Record<string, number>;
  stuckLeads: number;
  commissionProjection: number;
  leadsAtRisk: number;
  leadsClosed: number;
  followUpOverdue: number;
}
