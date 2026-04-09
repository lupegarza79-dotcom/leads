import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield, Clock, AlertTriangle, Activity, Calendar, CheckCircle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { getEscalationInfo, getEscalationState, hasQualifyingActivity, formatEscalationTime } from '@/utils/escalation';
import { ESCALATION_THRESHOLDS, SLA_THRESHOLDS } from '@/constants/config';
import { formatDateTime, formatRelativeTime } from '@/utils/formatters';
import type { Lead, ActivityLogEntry, FollowUpTask } from '@/types/leads';

interface ObservabilityPanelProps {
  lead: Lead;
  activities: ActivityLogEntry[];
  followUps: FollowUpTask[];
  lastActionResult: { type: 'success' | 'error'; message: string; at: string } | null;
}

export const ObservabilityPanel = React.memo(function ObservabilityPanel({
  lead,
  activities,
  followUps,
  lastActionResult,
}: ObservabilityPanelProps) {
  const escalationInfo = useMemo(() => getEscalationInfo(lead, activities), [lead, activities]);
  const escalationState = useMemo(() => getEscalationState(lead, activities), [lead, activities]);

  const leadActivities = useMemo(
    () => activities.filter(a => a.lead_id === lead.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [activities, lead.id],
  );

  const lastQualifyingActivity = useMemo(() => {
    const qualifyingTypes = ['call', 'whatsapp', 'email', 'status_change', 'follow_up', 'reassignment'];
    return leadActivities.find(a => qualifyingTypes.includes(a.type)) ?? null;
  }, [leadActivities]);

  const leadFollowUps = useMemo(
    () => followUps.filter(f => f.lead_id === lead.id),
    [followUps, lead.id],
  );

  const nextPendingFollowUp = useMemo(
    () => leadFollowUps.filter(f => !f.completed).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null,
    [leadFollowUps],
  );

  const escalationReason = useMemo(() => {
    if (lead.status === 'Closed' || lead.status === 'Lost') return 'N/A — lead is closed';
    if (escalationState === 'healthy') return 'On track';

    if (escalationState === 'incomplete') return 'No follow-up date set';

    if (escalationState === 'escalated') {
      if (lead.status === 'New') return `New lead uncontacted > ${SLA_THRESHOLDS.newLeadEscalateMinutes}min`;
      if (lead.next_followup_at) return `Follow-up overdue > ${ESCALATION_THRESHOLDS.escalatedMinutes}min biz time`;
      return 'Escalation threshold exceeded';
    }

    if (escalationState === 'overdue') {
      return `Follow-up overdue > ${ESCALATION_THRESHOLDS.overdueMinutes}min`;
    }

    if (escalationState === 'due_now') return 'Follow-up is due now';
    if (escalationState === 'due_soon') return `Follow-up due within ${ESCALATION_THRESHOLDS.dueSoonMinutes}min`;

    return 'Unknown';
  }, [escalationState, lead]);

  const nextEscalationThreshold = useMemo(() => {
    if (lead.status === 'Closed' || lead.status === 'Lost') return null;
    if (!lead.next_followup_at) return null;

    const followUpAt = new Date(lead.next_followup_at);
    const now = new Date();
    const diffMs = followUpAt.getTime() - now.getTime();
    const diffMin = diffMs / 60000;

    if (diffMin > ESCALATION_THRESHOLDS.dueSoonMinutes) {
      const dueIn = Math.round(diffMin - ESCALATION_THRESHOLDS.dueSoonMinutes);
      return `Due Soon in ~${formatEscalationTime(dueIn)}`;
    }
    if (diffMin > 0) {
      return `Due Now in ~${formatEscalationTime(Math.round(diffMin))}`;
    }
    const overdue = Math.abs(diffMin);
    if (overdue < ESCALATION_THRESHOLDS.overdueMinutes) {
      const untilOverdue = Math.round(ESCALATION_THRESHOLDS.overdueMinutes - overdue);
      return `Overdue in ~${formatEscalationTime(untilOverdue)}`;
    }
    if (overdue < ESCALATION_THRESHOLDS.escalatedMinutes) {
      const untilEscalated = Math.round(ESCALATION_THRESHOLDS.escalatedMinutes - overdue);
      return `Escalation in ~${formatEscalationTime(untilEscalated)}`;
    }
    return 'Already escalated';
  }, [lead]);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Shield size={14} color={Colors.textSecondary} />
        <Text style={styles.panelTitle}>Lead Status & Escalation</Text>
      </View>

      <View style={styles.rows}>
        <Row
          icon={<View style={[styles.stateDot, { backgroundColor: escalationInfo.color }]} />}
          label="Escalation State"
          value={escalationInfo.label}
          valueColor={escalationInfo.color}
        />

        <Row
          icon={<AlertTriangle size={12} color={Colors.textTertiary} />}
          label="Why"
          value={escalationReason}
        />

        <Row
          icon={<Activity size={12} color={Colors.textTertiary} />}
          label="Last Qualifying Activity"
          value={
            lastQualifyingActivity
              ? `${lastQualifyingActivity.type} — ${formatRelativeTime(lastQualifyingActivity.created_at)}`
              : 'None recorded'
          }
        />

        <Row
          icon={<Calendar size={12} color={Colors.textTertiary} />}
          label="Next Follow-up"
          value={
            lead.next_followup_at
              ? formatDateTime(lead.next_followup_at)
              : 'Not set'
          }
          valueColor={lead.next_followup_at ? Colors.warning : Colors.danger}
        />

        {nextEscalationThreshold && (
          <Row
            icon={<Clock size={12} color={Colors.textTertiary} />}
            label="Next Threshold"
            value={nextEscalationThreshold}
          />
        )}

        <Row
          icon={<Clock size={12} color={Colors.textTertiary} />}
          label="Last Touch"
          value={formatRelativeTime(lead.last_touch_at)}
        />

        {lastActionResult && (
          <Row
            icon={
              lastActionResult.type === 'success'
                ? <CheckCircle size={12} color={Colors.success} />
                : <AlertTriangle size={12} color={Colors.danger} />
            }
            label="Last Action"
            value={lastActionResult.message}
            valueColor={lastActionResult.type === 'success' ? Colors.success : Colors.danger}
          />
        )}
      </View>
    </View>
  );
});

function Row({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        {icon}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    margin: 16,
    marginTop: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  panelTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  rows: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  rowLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  rowValue: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600' as const,
    textAlign: 'right' as const,
    flex: 1,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
