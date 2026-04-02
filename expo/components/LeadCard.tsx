import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Phone, Clock, MessageCircle, CalendarPlus, Calendar } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { StatusBadge } from './StatusBadge';
import { EscalationBadge } from './EscalationBadge';
import { formatRelativeTime, formatPhone, formatDateTime, getWhatsAppUrl, getDialerUrl } from '@/utils/formatters';
import type { Lead, FollowUpTask, ActivityLogEntry } from '@/types/leads';

interface LeadCardProps {
  lead: Lead;
  followUps?: FollowUpTask[];
  activities?: ActivityLogEntry[];
  onPress: (id: string) => void;
  compact?: boolean;
  ownerName?: string | null;
  onMarkContacted?: (id: string) => void;
  onSetFollowUp?: (id: string) => void;
  onOpenComposer?: (id: string) => void;
  showQuickActions?: boolean;
}

export const LeadCard = React.memo(function LeadCard({
  lead,
  followUps: _followUps,
  activities = [],
  onPress,
  compact,
  ownerName,
  onMarkContacted,
  onSetFollowUp,
  onOpenComposer,
  showQuickActions,
}: LeadCardProps) {
  const canMarkContacted = lead.status === 'New';
  const isActive = lead.status !== 'Closed' && lead.status !== 'Lost';
  const showActions = showQuickActions && isActive;

  const handleCall = (e: any) => {
    e.stopPropagation?.();
    const url = getDialerUrl(lead.phone);
    console.log('[LeadCard] Opening dialer:', url);
    Linking.openURL(url).catch(() => {});
  };

  const handleWhatsApp = (e: any) => {
    e.stopPropagation?.();
    const url = getWhatsAppUrl(lead.phone);
    console.log('[LeadCard] Opening WhatsApp:', url);
    Linking.openURL(url).catch(() => {});
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(lead.id)}
      activeOpacity={0.7}
      testID={`lead-card-${lead.id}`}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{lead.full_name}</Text>
        <EscalationBadge lead={lead} activities={activities} size="small" />
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

      {lead.next_followup_at && isActive && (
        <View style={styles.followUpRow}>
          <Calendar size={10} color={Colors.warning} />
          <Text style={styles.followUpText}>
            {formatDateTime(lead.next_followup_at)}
          </Text>
        </View>
      )}

      {lead.premium_amount != null && !compact && (
        <Text style={styles.premium}>${lead.premium_amount.toLocaleString()}</Text>
      )}

      {showActions && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.tapBtn}
            onPress={handleCall}
            activeOpacity={0.7}
            testID={`call-${lead.id}`}
          >
            <Phone size={13} color="#22C55E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tapBtn}
            onPress={handleWhatsApp}
            activeOpacity={0.7}
            testID={`wa-${lead.id}`}
          >
            <MessageCircle size={13} color="#25D366" />
          </TouchableOpacity>

          {canMarkContacted && onMarkContacted && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnContact]}
              onPress={(e) => { e.stopPropagation?.(); onMarkContacted(lead.id); }}
              activeOpacity={0.7}
            >
              <Text style={styles.actionBtnContactText}>Contacted</Text>
            </TouchableOpacity>
          )}

          {onSetFollowUp && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnFU]}
              onPress={(e) => { e.stopPropagation?.(); onSetFollowUp(lead.id); }}
              activeOpacity={0.7}
            >
              <CalendarPlus size={11} color={Colors.warning} />
              <Text style={styles.actionBtnFUText}>+1 Day</Text>
            </TouchableOpacity>
          )}

          {onOpenComposer && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnComposer]}
              onPress={(e) => { e.stopPropagation?.(); onOpenComposer(lead.id); }}
              activeOpacity={0.7}
            >
              <Calendar size={11} color={Colors.primary} />
              <Text style={styles.actionBtnComposerText}>Set</Text>
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
    gap: 6,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
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
  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  followUpText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  premium: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  tapBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnContact: {
    backgroundColor: Colors.cyanMuted,
    borderColor: Colors.cyan + '33',
  },
  actionBtnContactText: {
    color: Colors.cyan,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  actionBtnFU: {
    backgroundColor: Colors.warningMuted,
    borderColor: Colors.warning + '33',
  },
  actionBtnFUText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  actionBtnComposer: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary + '33',
  },
  actionBtnComposerText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
