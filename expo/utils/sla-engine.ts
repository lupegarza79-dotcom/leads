import { SLA_THRESHOLDS } from '@/constants/config';
import { getBusinessMinutesBetween } from './business-hours';
import type { Lead, FollowUpTask } from '@/types/leads';

export type SLAStatus = 'ok' | 'warning' | 'critical' | 'escalated';

export interface SLACheck {
  status: SLAStatus;
  minutesElapsed: number;
  thresholdMinutes: number;
  message: string;
}

export function checkNewLeadSLA(lead: Lead): SLACheck {
  if (lead.status !== 'New') {
    return { status: 'ok', minutesElapsed: 0, thresholdMinutes: 0, message: '' };
  }

  const now = new Date();
  const createdAt = new Date(lead.created_at);
  const elapsed = getBusinessMinutesBetween(createdAt, now);

  if (elapsed >= SLA_THRESHOLDS.newLeadEscalateMinutes) {
    return {
      status: 'escalated',
      minutesElapsed: elapsed,
      thresholdMinutes: SLA_THRESHOLDS.newLeadEscalateMinutes,
      message: `Lead "${lead.full_name}" uncontacted for ${elapsed} min. ESCALATION required.`,
    };
  }

  if (elapsed >= SLA_THRESHOLDS.newLeadAlertMinutes) {
    return {
      status: 'critical',
      minutesElapsed: elapsed,
      thresholdMinutes: SLA_THRESHOLDS.newLeadAlertMinutes,
      message: `Lead "${lead.full_name}" uncontacted for ${elapsed} min. Contact immediately.`,
    };
  }

  return { status: 'ok', minutesElapsed: elapsed, thresholdMinutes: SLA_THRESHOLDS.newLeadAlertMinutes, message: '' };
}

export function checkQuotedLeadSLA(lead: Lead): SLACheck {
  if (lead.status !== 'Quoted' || !lead.quoted_at) {
    return { status: 'ok', minutesElapsed: 0, thresholdMinutes: 0, message: '' };
  }

  const now = new Date();
  const quotedAt = new Date(lead.quoted_at);
  const elapsed = getBusinessMinutesBetween(quotedAt, now);
  const escalateMinutes = SLA_THRESHOLDS.quotedEscalateHours * 60;
  const alertMinutes = SLA_THRESHOLDS.quotedAlertHours * 60;

  if (elapsed >= escalateMinutes) {
    return {
      status: 'escalated',
      minutesElapsed: elapsed,
      thresholdMinutes: escalateMinutes,
      message: `Lead "${lead.full_name}" quoted ${Math.round(elapsed / 60)}h ago. ESCALATION required.`,
    };
  }

  if (elapsed >= alertMinutes) {
    return {
      status: 'critical',
      minutesElapsed: elapsed,
      thresholdMinutes: alertMinutes,
      message: `Lead "${lead.full_name}" quoted ${Math.round(elapsed / 60)}h ago. Follow up needed.`,
    };
  }

  return { status: 'ok', minutesElapsed: elapsed, thresholdMinutes: alertMinutes, message: '' };
}

export function checkFollowUpSLA(
  lead: Lead,
  tasks: FollowUpTask[],
): SLACheck {
  const overdueTasks = tasks.filter(t => t.lead_id === lead.id && t.overdue && !t.completed);
  const consecutiveOverdue = overdueTasks.length;

  if (consecutiveOverdue >= SLA_THRESHOLDS.followUpOverdueConsecutiveEscalate) {
    return {
      status: 'escalated',
      minutesElapsed: 0,
      thresholdMinutes: 0,
      message: `Lead "${lead.full_name}" has ${consecutiveOverdue} consecutive overdue follow-ups. ESCALATION.`,
    };
  }

  if (consecutiveOverdue > 0) {
    return {
      status: 'critical',
      minutesElapsed: 0,
      thresholdMinutes: 0,
      message: `Lead "${lead.full_name}" has overdue follow-up.`,
    };
  }

  return { status: 'ok', minutesElapsed: 0, thresholdMinutes: 0, message: '' };
}

export function getLeadSLAStatus(lead: Lead, tasks: FollowUpTask[]): SLAStatus {
  const checks = [
    checkNewLeadSLA(lead),
    checkQuotedLeadSLA(lead),
    checkFollowUpSLA(lead, tasks),
  ];

  const priorities: SLAStatus[] = ['escalated', 'critical', 'warning', 'ok'];
  for (const priority of priorities) {
    if (checks.some(c => c.status === priority)) {
      return priority;
    }
  }
  return 'ok';
}
