import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function ActivityLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Activity Log' }}
      />
    </Stack>
  );
}
