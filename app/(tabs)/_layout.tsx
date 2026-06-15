import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { GarageTheme } from "@/src/constants/garageTheme";
import CrashReportService from "@/src/services/CrashReportService";

const markSessionOpenAttempt = async (entryPoint: "bottom_tab" | "home_card") => {
  await CrashReportService.saveVBTSessionOpenAttempt({
    entry_point: entryPoint,
  });
};

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: GarageTheme.accent,
        tabBarInactiveTintColor: GarageTheme.textMuted,
        headerShown: false,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: GarageTheme.surface,
          borderTopColor: GarageTheme.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          letterSpacing: 0,
        },
        tabBarItemStyle: {
          borderRadius: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ホーム",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="session"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            void markSessionOpenAttempt("bottom_tab")
              .catch((error) => {
                console.warn("[TabLayout] Failed to save session open crash marker:", error);
              })
              .finally(() => {
                router.navigate("/(tabs)/session");
              });
          },
        }}
        options={{
          title: "セッション",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="bolt.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          title: "グラフ",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.xyaxis.line" color={color} />,
        }}
      />
      <Tabs.Screen
        name="manual"
        options={{
          title: "手動入力",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="pencil" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "履歴",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="clock.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "設定",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: "データ",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="tray.and.arrow.down.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
