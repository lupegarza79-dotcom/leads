import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Phone, Clock, AlertTriangle, MessageCircle, CalendarPlus } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { StatusBadge } from './StatusBadge';
import { formatRelativeTime, formatPhone } from '@/utils/formatters';
import { getLeadSLAStatus } from '@/utils/sla-engine';
import type { Lead, FollowUpTask } from '@/types/leads';

interface LeadCardProps {
  lead: Lead;
  followUps: FollowUpTask[];
  onPress: (id: string) => void;
  compact?: boolean;
  ownerName?: string | null;
  onMarkContacted?: (id: string) => void;
  onSetFollowUp?: (id: string) => void;
  showQuickActions?: boolean;
}

export const LeadCard = React.memo(function LeadCard({
  lead,
  followUps,
  onPress,
  compact,
  ownerName,
  onMarkContacted,
  onSetFollowUp,
  showQuickActions,
}: LeadCardProps) {
  const slaStatus = getLeadSLAStatus(lead, followUps);

  const borderColor = slaStatus === 'escalated'
    ? Colors.danger
    : slaStatus === 'critical'
    ? Colors.warning
    : Colors.border;

  const canMarkContacted = lead.status === 'New';
  const showActions = showQuickActions && (canMarkContacted || onSetFollowUp);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: borderColor, borderLeftWidth: 3 }]}
      onPress={() => onPress(lead.id)}
      activeOpacity={0.7}
      testID={`lead-card-${lead.id}`}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{lead.full_name}</Text>
        {(slaStatus === 'critical' || slaStatus === 'escalated') && (
          <AlertTriangle
            size={14}
            color={slaStatus === 'escalated' ? Colors.danger : Colors.warning}
          />
        )}
      </View>

      {!compact && (
        <View style={styles.phoneRow}>
          <Phone size={12} color={Colors.textTertiary} />
          <Text style={styles.phone}>{formatPhone(lead.phone)}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <StatusBadge status={lead.status} size="small" />
        <View style={styles.meta}>
          {ownerName && <Text style={styles.ownerText}>{ownerName}</Text>}
          {!ownerName && !lead.owner_id && <Text style={styles.unassignedText}>Unassigned</Text>}
          <View style={styles.timeRow}>
            <Clock size={10} color={Colors.textTertiary} />
            <Text style={styles.timeText}>{formatRelativeTime(lead.created_at)}</Text>
          </View>
        </View>
      </View>

      {lead.premium_amount != null && !compact && (
        <Text style={styles.premium}>${lead.premium_amount.toLocaleString()}</Text>
      )}

      {showActions && (
        <View style={styles.actionsRow}>
          {canMarkContacted && onMarkContacted && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onMarkContacted(lead.id);
              }}
              activeOpacity={0.7}
              testID={`mark-contacted-${lead.id}`}
            >
              <MessageCircle size={12} color={Colors.cyan} />
              <Text style={styles.actionBtnText}>Mark Contacted</Text>
            </TouchableOpacity>
          )}
          {onSetFollowUp && lead.status !== 'Closed' && lead.status !== 'Lost' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnFollowUp]}
              onPress={(e) => {
                e.stopPropagation?.();
                onSetFollowUp(lead.id);
              }}
              activeOpacity={0.7}
              testID={`set-followup-${lead.id}`}
            >
              <CalendarPlus size={12} color={Colors.warning} />
              <Text style={[styles.actionBtnText, styles.actionBtnTextFollowUp]}>+1 Biz Day</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
    marginRight: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  phone: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerText: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  unassignedText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  premium: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.cyanMuted,
    borderWidth: 1,
    borderColor: Colors.cyan + '33',
  },
  actionBtnFollowUp: {
    backgroundColor: Colors.warningMuted,
    borderColor: Colors.warning + '33',
  },
  actionBtnText: {
    color: Colors.cyan,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  actionBtnTextFollowUp: {
    color: Colors.warning,
  },
});
