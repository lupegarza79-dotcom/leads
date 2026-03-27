import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Phone, MessageCircle, Mail, FileText, ArrowRightLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { formatRelativeTime } from '@/utils/formatters';
import type { ActivityLogEntry } from '@/types/leads';

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  call: { icon: Phone, color: Colors.success },
  whatsapp: { icon: MessageCircle, color: '#25D366' },
  email: { icon: Mail, color: Colors.primary },
  note: { icon: FileText, color: Colors.textSecondary },
  status_change: { icon: ArrowRightLeft, color: Colors.warning },
};

interface ActivityItemProps {
  activity: ActivityLogEntry;
  showLeadName?: string;
  userName?: string | null;
}

export const ActivityItem = React.memo(function ActivityItem({ activity, showLeadName, userName }: ActivityItemProps) {
  const config = ACTIVITY_ICONS[activity.type] ?? ACTIVITY_ICONS.note;
  const IconComp = config.icon;

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: config.color + '1A' }]}>
        <IconComp size={14} color={config.color} />
      </View>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.type}>{activity.type.replace('_', ' ')}</Text>
          <Text style={styles.time}>{formatRelativeTime(activity.created_at)}</Text>
        </View>
        {showLeadName && <Text style={styles.leadName}>{showLeadName}</Text>}
        <Text style={styles.note} numberOfLines={2}>{activity.note}</Text>
        {userName && <Text style={styles.user}>{userName}</Text>}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  type: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  time: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  leadName: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  note: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  user: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 4,
  },
});
