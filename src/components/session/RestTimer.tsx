/**
 * RestTimer
 * Independent component for rest timer to isolate updates from parent
 */

import { useEffect, useState, memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatRestTime } from "@/src/viewmodels/SessionDashboardViewModel";
import { GarageTheme } from "@/src/constants/garageTheme";

interface RestTimerProps {
  restStartTime: number | null;
}

function RestTimer({ restStartTime }: RestTimerProps) {
  const [restSeconds, setRestSeconds] = useState(0);

  useEffect(() => {
    if (!restStartTime) {
      setRestSeconds(0);
      return;
    }

    // Initial calculation
    const initialSeconds = Math.floor((Date.now() - restStartTime) / 1000);
    setRestSeconds(initialSeconds);

    // Update every second
    const interval = setInterval(() => {
      setRestSeconds(Math.floor((Date.now() - restStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [restStartTime]);

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{formatRestTime(restSeconds)}</Text>
      <Text style={styles.label}>休憩時間</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 88,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  time: {
    fontSize: 32,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  label: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    marginTop: 4,
  },
});

export default memo(RestTimer);
