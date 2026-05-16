/**
 * ExerciseTrendChart Component
 * Displays 1RM and Volume trend charts for a specific exercise
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { GarageTheme } from '../constants/garageTheme';
import type { ExerciseHistoryEntry, ChartDataPoint } from '../types/index';

interface ExerciseTrendChartProps {
  history: ExerciseHistoryEntry[];
}

const screenWidth = Dimensions.get('window').width - 32;

export const ExerciseTrendChart: React.FC<ExerciseTrendChartProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>データがありません</Text>
      </View>
    );
  }

  // Sort by date ascending for charts
  const sortedHistory = [...history].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Prepare 1RM trend data - filter out null values
  const oneRmData: ChartDataPoint[] = sortedHistory
    .filter((entry) => entry.estimated_1rm !== null)
    .map((entry, index) => ({
      x: index,
      y: entry.estimated_1rm || 0,
      label: formatShortDate(entry.date),
    }));

  // Prepare Volume trend data
  const volumeData: ChartDataPoint[] = sortedHistory.map((entry, index) => ({
    x: index,
    y: entry.total_volume,
    label: formatShortDate(entry.date),
  }));

  // Prepare Max Load trend data
  const loadData: ChartDataPoint[] = sortedHistory.map((entry, index) => ({
    x: index,
    y: entry.max_load,
    label: formatShortDate(entry.date),
  }));

  const chartConfig = {
    backgroundColor: GarageTheme.surface,
    backgroundGradientFrom: GarageTheme.surface,
    backgroundGradientTo: GarageTheme.surface,
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: GarageTheme.accent,
    },
  };

  const volumeChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#22c55e',
    },
  };

  const loadChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#f97316',
    },
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1RM Trend Chart */}
      {sortedHistory.some((h) => h.estimated_1rm !== null) && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>1RM推移</Text>
          <LineChart
            data={{
              labels: oneRmData.map((d) => d.label ?? ''),
              datasets: [
                {
                  data: oneRmData.map((d) => d.y),
                },
              ],
            }}
            width={screenWidth}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withDots={true}
            withInnerLines={false}
            withOuterLines={true}
            withVerticalLines={false}
            withHorizontalLines={true}
            formatYLabel={(y) => `${y}kg`}
          />
        </View>
      )}

      {/* Volume Trend Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>ボリューム推移 (kg)</Text>
        <LineChart
          data={{
            labels: volumeData.map((d) => d.label ?? ''),
            datasets: [
              {
                data: volumeData.map((d) => d.y),
              },
            ],
          }}
          width={screenWidth}
          height={200}
          chartConfig={volumeChartConfig}
          bezier
          style={styles.chart}
          withDots={true}
          withInnerLines={false}
          withOuterLines={true}
          withVerticalLines={false}
          withHorizontalLines={true}
          formatYLabel={(y) => `${Math.round(Number(y))}`}
        />
      </View>

      {/* Max Load Trend Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>MAX重量推移</Text>
        <LineChart
          data={{
            labels: loadData.map((d) => d.label ?? ''),
            datasets: [
              {
                data: loadData.map((d) => d.y),
              },
            ],
          }}
          width={screenWidth}
          height={200}
          chartConfig={loadChartConfig}
          bezier
          style={styles.chart}
          withDots={true}
          withInnerLines={false}
          withOuterLines={true}
          withVerticalLines={false}
          withHorizontalLines={true}
          formatYLabel={(y) => `${y}kg`}
        />
      </View>
    </ScrollView>
  );
};

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chartContainer: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: GarageTheme.textStrong,
    marginBottom: 12,
  },
  chart: {
    borderRadius: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
    color: GarageTheme.textMuted,
  },
});
