/**
 * PR Notification Component
 * Displays when a new Personal Record is achieved
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { getLocalizedExerciseName } from '../utils/exerciseLocalization';
import { PRRecord } from '../types/index';

interface PRNotificationProps {
  visible: boolean;
  prRecord: PRRecord | null;
  onClose: () => void;
}

const PRNotification: React.FC<PRNotificationProps> = ({
  visible,
  prRecord,
  onClose,
}) => {
  const [scaleAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  if (!prRecord) return null;

  const formatValue = (type: string, value: number | undefined): string => {
    if (value === undefined) return 'N/A';
    switch (type) {
      case 'e1rm':
        return `${value.toFixed(1)} kg`;
      case 'speed':
        return `${value.toFixed(2)} m/s`;
      case 'volume':
        return `${Math.round(value)} kg`;
      case 'set':
        return `${value} reps`;
      default:
        return value.toString();
    }
  };

  const getPRTypeLabel = (type: string): string => {
    switch (type) {
      case 'e1rm':
        return '推定1RM';
      case 'speed':
        return '最高速度';
      case 'volume':
        return 'トータルボリューム';
      case 'set':
        return 'セット記録';
      default:
        return 'PR';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.trophy}>🏆</Text>
            <Text style={styles.title}>新記録達成！</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.liftName}>{getLocalizedExerciseName(prRecord.lift)}</Text>

            <View style={styles.prTypeContainer}>
              <Text style={styles.prTypeLabel}>{getPRTypeLabel(prRecord.type)}</Text>
            </View>

            <View style={styles.valueContainer}>
              <Text style={styles.newValue}>
                {formatValue(prRecord.type, prRecord.value)}
              </Text>
              {prRecord.previous_value !== null && (
                <View style={styles.comparisonContainer}>
                  <Text style={styles.previousLabel}>前回:</Text>
                  <Text style={styles.previousValue}>
                    {formatValue(prRecord.type, prRecord.previous_value)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.improvementContainer}>
              <Text style={styles.improvementLabel}>向上</Text>
              <Text style={styles.improvementValue}>
                +{formatValue(prRecord.type, prRecord.improvement)}
              </Text>
            </View>

            {prRecord.load_kg && (
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsText}>
                  {prRecord.load_kg} kg × {prRecord.reps || 1} reps
                </Text>
              </View>
            )}

            <Text style={styles.dateText}>{prRecord.date}</Text>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  trophy: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 20,
  },
  liftName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  prTypeContainer: {
    backgroundColor: '#3a3a3a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  prTypeLabel: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  valueContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  newValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previousLabel: {
    fontSize: 14,
    color: '#999',
    marginRight: 8,
  },
  previousValue: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  improvementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a4d1a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  improvementLabel: {
    fontSize: 14,
    color: '#4CAF50',
    marginRight: 8,
  },
  improvementValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  detailsContainer: {
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default PRNotification;
