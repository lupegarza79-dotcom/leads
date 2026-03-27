import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusColors } from '@/constants/colors';

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium';
}

export const StatusBadge = React.memo(function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const colors = StatusColors[status] ?? { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8', dot: '#94A3B8' };
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, isSmall && styles.badgeSmall]}>
      <View style={[styles.dot, { backgroundColor: colors.dot }, isSmall && styles.dotSmall]} />
      <Text style={[styles.text, { color: colors.text }, isSmall && styles.textSmall]} numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotSmall: {
    width: 5,
    height: 5,
  },
  text: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  textSmall: {
    fontSize: 10,
  },
});
