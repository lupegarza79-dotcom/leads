import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export type ToastType = 'success' | 'error' | 'warning';

interface ActionToastProps {
  visible: boolean;
  type: ToastType;
  message: string;
  onDismiss: () => void;
  duration?: number;
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)', icon: '#22C55E' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', icon: '#EF4444' },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', icon: '#F59E0B' },
};

export function ActionToast({ visible, type, message, onDismiss, duration = 3000 }: ActionToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
        ]).start(() => onDismiss());
      }, duration);

      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
      translateY.setValue(-20);
    }
  }, [visible, duration, onDismiss, opacity, translateY]);

  if (!visible) return null;

  const colors = TOAST_COLORS[type];
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? XCircle : AlertTriangle;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Icon size={16} color={colors.icon} />
      <Text style={[styles.text, { color: colors.icon }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 999,
  },
  text: {
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
});
