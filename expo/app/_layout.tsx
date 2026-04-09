import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { LeadsProvider } from "@/providers/LeadsProvider";
import { Colors } from "@/constants/colors";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      console.log('[AuthGate] Loading timed out after 8s');
      setLoadingTimedOut(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (isLoading && !loadingTimedOut) return;

    const inLoginScreen = segments[0] === 'login';
    const effectiveAuth = loadingTimedOut ? false : isAuthenticated;

    if (!effectiveAuth && !inLoginScreen) {
      console.log('[AuthGate] Not authenticated, redirecting to login');
      router.replace('/login');
    } else if (isAuthenticated && inLoginScreen) {
      console.log('[AuthGate] Authenticated, redirecting to home');
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, loadingTimedOut, segments, router]);

  if (isLoading && !loadingTimedOut) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (loadingTimedOut && isLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.timeoutText}>Taking too long to load...</Text>
        <TouchableOpacity
          style={styles.timeoutBtn}
          onPress={() => {
            signOut().catch(() => {});
            router.replace('/login');
          }}
        >
          <Text style={styles.timeoutBtnText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isAuthenticated) {
    return <LeadsProvider>{children}</LeadsProvider>;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthGate>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.textPrimary,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="add-lead"
          options={{
            presentation: "modal",
            title: "New Lead",
            headerStyle: { backgroundColor: Colors.surfaceElevated },
          }}
        />
        <Stack.Screen
          name="lead/[id]"
          options={{
            presentation: "modal",
            title: "Lead Details",
            headerStyle: { backgroundColor: Colors.surfaceElevated },
          }}
        />
        <Stack.Screen
          name="follow-up"
          options={{
            presentation: "modal",
            title: "Set Follow-up",
            headerStyle: { backgroundColor: Colors.surfaceElevated },
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Settings",
          }}
        />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  timeoutText: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginBottom: 16,
  },
  timeoutBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  timeoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
