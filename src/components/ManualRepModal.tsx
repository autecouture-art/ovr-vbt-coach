/**
 * ManualRepModal
 * 手動でレップを追加するためのモーダル
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { GarageTheme } from '@/src/constants/garageTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAddRep: (velocity: number, load?: number) => void;
  currentLoad: number;
}

export function ManualRepModal({ visible, onClose, onAddRep, currentLoad }: Props) {
  const [velocity, setVelocity] = useState('');
  const [load, setLoad] = useState(currentLoad.toString());

  const handleAdd = () => {
    const velocityNum = parseFloat(velocity);
    const loadNum = parseFloat(load);

    if (isNaN(velocityNum) || velocityNum <= 0) {
      Alert.alert('入力エラー', '速度を正しく入力してください（0より大きい値）');
      return;
    }

    if (isNaN(loadNum) || loadNum <= 0) {
      Alert.alert('入力エラー', '重量を正しく入力してください（0より大きい値）');
      return;
    }

    onAddRep(velocityNum, loadNum);
    handleClose();
  };

  const handleClose = () => {
    setVelocity('');
    setLoad(currentLoad.toString());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>手動レップ追加</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>重量 (kg)</Text>
              <TextInput
                style={styles.input}
                value={load}
                onChangeText={setLoad}
                placeholder="例: 100"
                placeholderTextColor={GarageTheme.textSubtle}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>平均速度 (m/s)</Text>
              <TextInput
                style={styles.input}
                value={velocity}
                onChangeText={setVelocity}
                placeholder="例: 0.65"
                placeholderTextColor={GarageTheme.textSubtle}
                keyboardType="decimal-pad"
              />
              <Text style={styles.hint}>
                BLEセンサーで測定できない場合に手動入力してください
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.addButton]}
                onPress={handleAdd}
              >
                <Text style={styles.addButtonText}>追加</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: GarageTheme.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: GarageTheme.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GarageTheme.chip,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: GarageTheme.textMuted,
  },
  content: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: GarageTheme.text,
  },
  input: {
    backgroundColor: GarageTheme.chip,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: GarageTheme.textStrong,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  hint: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: GarageTheme.textStrong,
  },
  addButton: {
    backgroundColor: GarageTheme.primary,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});
