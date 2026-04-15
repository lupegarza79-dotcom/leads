import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function HomeLayout() {
  const router = useRouter();

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
        options={{
          title: 'Pipeline',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              hitSlop={8}
              style={{ padding: 4 }}
              testID="pipeline-settings-btn"
            >
              <Settings size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
