/**
 * Help Button Component
 * 各画面からヘルプにアクセスするためのボタン
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GarageTheme } from '@/src/constants/garageTheme';

interface HelpButtonProps {
  screen?: 'home' | 'session' | 'graph' | 'manual' | 'history' | 'settings' | 'general';
}

export function HelpButton({ screen = 'general' }: HelpButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    // 用語集画面に遷移
    router.push('/glossary');
  };

  return (
    <TouchableOpacity
      style={styles.helpButton}
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={styles.helpIcon}>?</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpIcon: {
    fontSize: 18,
    fontWeight: '500',
    color: GarageTheme.textMuted,
  },
});
