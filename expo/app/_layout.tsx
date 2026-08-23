import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Colors } from "@/constants/colors";
import { FeatureFlagsProvider } from "@/providers/FeatureFlagsProvider";
import { SnapshotProvider } from "@/providers/SnapshotProvider";
import { FeedbackProvider } from "@/providers/FeedbackProvider";
import DevToolsFAB from "@/components/DevToolsFAB";
import FeedbackSheet from "@/components/FeedbackSheet";
import ObservabilityBridge from "@/components/ObservabilityBridge";
import {
  initializeObservability,
  registerObservabilityNavigationContainer,
} from "@/services/observability";

initializeObservability();
void SplashScreen.preventAutoHideAsync();

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
        name="game/[id]"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="playoffs"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="team/[id]"
        options={{
          title: "",
          headerTransparent: true,
        }}
      />
      <Stack.Screen
        name="player/[id]"
        options={{
          title: "",
          headerTransparent: true,
        }}
      />
    </Stack>
  );
}

function RootLayout() {
  const navigationContainerRef = useNavigationContainerRef();

  useEffect(() => {
    registerObservabilityNavigationContainer(navigationContainerRef);
    void SplashScreen.hideAsync();
  }, [navigationContainerRef]);

  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider>
        <ObservabilityBridge />
        <SnapshotProvider>
          <FeedbackProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <StatusBar style="light" />
              <RootLayoutNav />
              <DevToolsFAB />
              <FeedbackSheet />
            </GestureHandlerRootView>
          </FeedbackProvider>
        </SnapshotProvider>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
