/**
 * ReadinessCard Component
 * Visual gauge showing daily readiness based on recent performance
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GarageTheme } from '@/src/constants/garageTheme';

interface ReadinessCardProps {
  predicted: number;
  trend: 'up' | 'same' | 'down';
  confidence: 'high' | 'medium' | 'low';
}

export function ReadinessCard({
  predicted,
  trend,
  confidence,
}: ReadinessCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↗️';
      case 'down':
        return '↘️';
      default:
        return '→';
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return '#4CAF50';
      case 'down':
        return '#F44336';
      default:
        return '#FFC107';
    }
  };

  const getConfidenceLabel = () => {
    switch (confidence) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>本日の調子</Text>
        <View style={[styles.trendBadge, { backgroundColor: getTrendColor() }]}>
          <Text style={styles.trendIcon}>{getTrendIcon()}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.predictedContainer}>
          <Text style={styles.predictedLabel}>予想1RM</Text>
          <Text style={styles.predictedValue}>{predicted.toFixed(1)} kg</Text>
        </View>

        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceLabel}>信頼度</Text>
          <Text style={styles.confidenceValue}>{getConfidenceLabel()}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {trend === 'up' && '最近のパフォーマンスが上昇傾向です'}
          {trend === 'down' && '最近のパフォーマンスが低下傾向です'}
          {trend === 'same' && '最近のパフォーマンスは安定しています'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GarageTheme.colors.card,
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: GarageTheme.colors.text,
  },
  trendBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendIcon: {
    fontSize: 24,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  predictedContainer: {
    alignItems: 'center',
  },
  predictedLabel: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    marginBottom: 8,
  },
  predictedValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: GarageTheme.colors.primary,
  },
  confidenceContainer: {
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    marginBottom: 8,
  },
  confidenceValue: {
    fontSize: 24,
    fontWeight: '600',
    color: GarageTheme.colors.text,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: GarageTheme.colors.border,
    paddingTop: 12,
  },
  footerText: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    textAlign: 'center',
  },
});
