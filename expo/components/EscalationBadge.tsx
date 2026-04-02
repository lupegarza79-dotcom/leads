import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getEscalationInfo, formatEscalationTime } from '@/utils/escalation';
import type { Lead, ActivityLogEntry } from '@/types/leads';

interface EscalationBadgeProps {
  lead: Lead;
  activities: ActivityLogEntry[];
  size?: 'small' | 'medium';
}

export const EscalationBadge = React.memo(function EscalationBadge({
  lead,
  activities,
  size = 'small',
}: EscalationBadgeProps) {
  const info = getEscalationInfo(lead, activities);

  if (info.state === 'healthy') return null;

  const isSmall = size === 'small';
  let timeLabel = '';
  if (info.minutesOverdue != null && info.minutesOverdue > 0) {
    timeLabel = `+${formatEscalationTime(info.minutesOverdue)}`;
  } else if (info.minutesUntilDue != null && info.minutesUntilDue > 0) {
    timeLabel = formatEscalationTime(info.minutesUntilDue);
  }

  return (
    <View style={[styles.badge, { backgroundColor: info.bgColor }, isSmall && styles.badgeSmall]}>
      <View style={[styles.dot, { backgroundColor: info.color }, isSmall && styles.dotSmall]} />
      <Text
        style={[styles.label, { color: info.color }, isSmall && styles.labelSmall]}
        numberOfLines={1}
      >
        {info.label}
      </Text>
      {timeLabel ? (
        <Text style={[styles.time, { color: info.color }, isSmall && styles.timeSmall]}>
          {timeLabel}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  labelSmall: {
    fontSize: 9,
    fontWeight: '700' as const,
  },
  time: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  timeSmall: {
    fontSize: 8,
  },
});
