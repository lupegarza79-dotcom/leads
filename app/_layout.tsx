import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LeadsProvider } from "@/providers/LeadsProvider";
import { Colors } from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
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
        name="settings"
        options={{
          title: "Settings",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <LeadsProvider>
          <RootLayoutNav />
        </LeadsProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
