import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '@/constants/colors';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  icon?: React.ReactNode;
  wide?: boolean;
}

export const MetricCard = React.memo(function MetricCard({
  label,
  value,
  subtitle,
  color = Colors.primary,
  icon,
  wide,
}: MetricCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.card, wide && styles.cardWide, { opacity: fadeAnim }]}>
      <View style={[styles.accentBar, { backgroundColor: color }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={[styles.value, { color }]}>{value}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flex: 1,
    minWidth: 140,
  },
  cardWide: {
    minWidth: 280,
  },
  accentBar: {
    height: 3,
  },
  content: {
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  iconWrap: {
    opacity: 0.7,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
    flex: 1,
  },
  value: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -1,
  },
  subtitle: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginTop: 4,
  },
});
