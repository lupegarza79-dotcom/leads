import { ESCALATION_THRESHOLDS } from '@/constants/config';
import { isWithinBusinessHours, getBusinessMinutesBetween } from '@/utils/business-hours';
import type { Lead, ActivityLogEntry } from '@/types/leads';

export type EscalationState = 'healthy' | 'due_soon' | 'due_now' | 'overdue' | 'escalated' | 'incomplete';

export interface EscalationInfo {
  state: EscalationState;
  minutesUntilDue: number | null;
  minutesOverdue: number | null;
  label: string;
  color: string;
  bgColor: string;
}

const STATE_COLORS: Record<EscalationState, { color: string; bgColor: string }> = {
  healthy: { color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.12)' },
  due_soon: { color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.12)' },
  due_now: { color: '#F97316', bgColor: 'rgba(249, 115, 22, 0.12)' },
  overdue: { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.12)' },
  escalated: { color: '#DC2626', bgColor: 'rgba(220, 38, 38, 0.18)' },
  incomplete: { color: '#64748B', bgColor: 'rgba(100, 116, 139, 0.12)' },
};

const STATE_LABELS: Record<EscalationState, string> = {
  healthy: 'Healthy',
  due_soon: 'Due Soon',
  due_now: 'Due Now',
  overdue: 'Overdue',
  escalated: 'Escalated',
  incomplete: 'No Follow-up',
};

export function hasQualifyingActivity(
  lead: Lead,
  activities: ActivityLogEntry[],
  sinceDate: Date,
): boolean {
  const leadActivities = activities.filter(a => a.lead_id === lead.id);
  const qualifyingTypes = ['call', 'whatsapp', 'email', 'status_change', 'follow_up', 'reassignment'];

  return leadActivities.some(a => {
    const activityDate = new Date(a.created_at);
    return activityDate >= sinceDate && qualifyingTypes.includes(a.type);
  });
}

export function getEscalationState(
  lead: Lead,
  activities: ActivityLogEntry[],
): EscalationState {
  if (lead.status === 'Closed' || lead.status === 'Lost') {
    return 'healthy';
  }

  if (!lead.next_followup_at) {
    return 'incomplete';
  }

  const now = new Date();
  const followUpAt = new Date(lead.next_followup_at);
  const diffMs = followUpAt.getTime() - now.getTime();
  const diffMinutes = diffMs / 60000;

  if (diffMinutes > ESCALATION_THRESHOLDS.dueSoonMinutes) {
    return 'healthy';
  }

  if (diffMinutes > 0 && diffMinutes <= ESCALATION_THRESHOLDS.dueSoonMinutes) {
    return 'due_soon';
  }

  if (diffMinutes > -ESCALATION_THRESHOLDS.overdueMinutes && diffMinutes <= 0) {
    return 'due_now';
  }

  const lastTouchAt = new Date(lead.last_touch_at);
  if (lastTouchAt > followUpAt) {
    return 'healthy';
  }

  if (hasQualifyingActivity(lead, activities, followUpAt)) {
    return 'healthy';
  }

  const overdueBizMinutes = isWithinBusinessHours()
    ? getBusinessMinutesBetween(followUpAt, now)
    : Math.abs(diffMinutes);

  if (overdueBizMinutes >= ESCALATION_THRESHOLDS.escalatedMinutes) {
    return 'escalated';
  }

  if (overdueBizMinutes >= ESCALATION_THRESHOLDS.overdueMinutes) {
    return 'overdue';
  }

  return 'due_now';
}

export function getEscalationInfo(
  lead: Lead,
  activities: ActivityLogEntry[],
): EscalationInfo {
  const state = getEscalationState(lead, activities);
  const { color, bgColor } = STATE_COLORS[state];
  const label = STATE_LABELS[state];

  let minutesUntilDue: number | null = null;
  let minutesOverdue: number | null = null;

  if (lead.next_followup_at) {
    const now = new Date();
    const followUpAt = new Date(lead.next_followup_at);
    const diffMs = followUpAt.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes > 0) {
      minutesUntilDue = diffMinutes;
    } else {
      minutesOverdue = Math.abs(diffMinutes);
    }
  }

  return { state, minutesUntilDue, minutesOverdue, label, color, bgColor };
}

export function formatEscalationTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
