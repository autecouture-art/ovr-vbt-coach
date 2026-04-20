/**
 * PRCard Component
 * Displays personal record velocity at current load
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GarageTheme } from '@/src/constants/garageTheme';

interface PRCardProps {
  currentLoad: number;
  bestVelocity: {
    velocity: number;
    date: string;
    reps: number;
  } | null;
}

export function PRCard({ currentLoad, bestVelocity }: PRCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今日';
    if (diffDays === 1) return '昨日';
    if (diffDays <= 7) return `${diffDays}日前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{currentLoad}kg の最速速度</Text>
        {bestVelocity && (
          <View style={styles.prBadge}>
            <Text style={styles.prBadgeText}>PR</Text>
          </View>
        )}
      </View>

      {bestVelocity ? (
        <View style={styles.content}>
          <View style={styles.velocityContainer}>
            <Text style={styles.velocityValue}>{bestVelocity.velocity.toFixed(2)}</Text>
            <Text style={styles.velocityUnit}>m/s</Text>
          </View>

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>日付</Text>
              <Text style={styles.detailValue}>{formatDate(bestVelocity.date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>レップ数</Text>
              <Text style={styles.detailValue}>{bestVelocity.reps} reps</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            まだこの重量のデータがありません
          </Text>
          <Text style={styles.noDataSubtext}>
            セットを完了して記録を残しましょう
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {bestVelocity
            ? 'この重量での過去最高のパフォーマンスです'
            : '新しいPRを記録するチャンスです！'}
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
  prBadge: {
    backgroundColor: GarageTheme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  prBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    alignItems: 'center',
    marginBottom: 16,
  },
  velocityContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  velocityValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: GarageTheme.colors.primary,
  },
  velocityUnit: {
    fontSize: 20,
    color: GarageTheme.colors.textSecondary,
    marginLeft: 8,
  },
  details: {
    width: '100%',
    paddingHorizontal: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.colors.border,
  },
  detailLabel: {
    fontSize: 16,
    color: GarageTheme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: GarageTheme.colors.text,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noDataText: {
    fontSize: 16,
    color: GarageTheme.colors.textSecondary,
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    opacity: 0.7,
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
