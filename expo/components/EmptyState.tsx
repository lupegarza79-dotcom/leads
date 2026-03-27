import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
}

export const EmptyState = React.memo(function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  iconWrap: {
    marginBottom: 16,
    opacity: 0.5,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  message: {
    color: Colors.textTertiary,
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
