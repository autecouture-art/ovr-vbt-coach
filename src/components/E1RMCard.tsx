/**
 * E1RMCard Component
 * Displays estimated 1RM and minimum velocity threshold (MVT)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GarageTheme } from '@/src/constants/garageTheme';

interface E1RMCardProps {
  currentE1RM: number | null;
  mvt: number | null;
}

export function E1RMCard({ currentE1RM, mvt }: E1RMCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>推定1RM & MVT</Text>
        {currentE1RM && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>更新済み</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.e1rmContainer}>
          <Text style={styles.e1rmLabel}>推定1RM</Text>
          <Text style={styles.e1rmValue}>
            {currentE1RM ? `${currentE1RM.toFixed(1)} kg` : '-'}
          </Text>
        </View>

        <View style={styles.mvtContainer}>
          <Text style={styles.mvtLabel}>限界速度 (MVT)</Text>
          <Text style={styles.mvtValue}>
            {mvt ? `${mvt.toFixed(2)} m/s` : '-'}
          </Text>
          <Text style={styles.mvtDescription}>
            {mvt && mvt <= 0.2
              ? '非常に強いです'
              : mvt && mvt <= 0.3
              ? '標準的です'
              : mvt
              ? '技術改善の余地があります'
              : ''}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {currentE1RM && mvt
            ? `1RM時の速度が${mvt.toFixed(2)}m/sを下回ると限界に近いです`
            : 'データを蓄積して精度を上げましょう'}
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
  badge: {
    backgroundColor: GarageTheme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    marginBottom: 16,
  },
  e1rmContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: GarageTheme.colors.background,
    borderRadius: 12,
  },
  e1rmLabel: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    marginBottom: 8,
  },
  e1rmValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: GarageTheme.colors.primary,
  },
  mvtContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: GarageTheme.colors.background,
    borderRadius: 12,
  },
  mvtLabel: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    marginBottom: 8,
  },
  mvtValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: GarageTheme.colors.accent,
    marginBottom: 8,
  },
  mvtDescription: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    textAlign: 'center',
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
