import "@/global.css";
import "@/lib/_core/nativewind-pressable";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { hydrateApiBaseUrlOverride } from "@/constants/oauth";
import { initManusRuntime } from "@/lib/_core/manus-runtime";
import { ThemeProvider } from "@/lib/theme-provider";
import LiveShareService from "@/src/services/LiveShareService";
import ImprovementFeedbackService from "@/src/services/ImprovementFeedbackService";
import CrashReportService from "@/src/services/CrashReportService";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  useEffect(() => {
    initManusRuntime();
    void hydrateApiBaseUrlOverride();
    // Keep the Mac-side read-only MCP snapshot current when sharing is already configured.
    // A failed sync must never block app startup or training.
    void LiveShareService.syncTrainingExport().catch((error) => {
      console.warn("[RepVeloCoach] startup MCP sync skipped:", error);
    });
    // A crash can prevent the normal session-end send. Replaying this local queue
    // never blocks launch, sensor connection, or a training session.
    void ImprovementFeedbackService.flushAtSessionEnd().catch((error) => {
      console.warn("[RepVeloCoach] pending feedback sync skipped:", error);
    });
    void ImprovementFeedbackService.refreshReceipts().catch(() => undefined);
    void CrashReportService.getLastVBTScreenContext()
      .then((snapshot) => {
        if (!snapshot) return false;
        return ImprovementFeedbackService.sendCrashHandoff(snapshot);
      })
      .catch(() => false);
  }, []);

  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="oauth/callback" />
              </Stack>
              <StatusBar style="light" />
            </QueryClientProvider>
          </trpc.Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
