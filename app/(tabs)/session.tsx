/**
 * VBT Session Screen
 * Refactored to use useSessionLogic and trainingStore
 * UI is now a "Dumb Component" driven by global state
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTrainingStore } from '@/src/store/trainingStore';
import { useSessionLogic } from '@/src/hooks/useSessionLogic';
import { ExerciseSelectModal } from '@/src/components/ExerciseSelectModal';
import type { Exercise } from '@/src/types/index';

export default function SessionScreen() {
  const router = useRouter();
  
  // Custom Hook for Logic
  const { finishSet } = useSessionLogic();

  // Global State
  const {
    currentSetIndex,
    isConnected,
    liveData,
    currentExercise,
    currentLoad,
    currentReps,
    setHistory,
    updateLoad,
    setCurrentExercise,
  } = useTrainingStore();

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [inputLoad, setInputLoad] = useState('');

  // Sync input with store
  useEffect(() => {
    setInputLoad(currentLoad.toString());
  }, [currentLoad]);

  const handleLoadChange = (text: string) => {
    setInputLoad(text);
    const val = parseFloat(text);
    if (!isNaN(val)) updateLoad(val);
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    setCurrentExercise(exercise);
  };

  const handleFinishSet = () => {
    if (!isConnected) {
        Alert.alert('Device Not Connected', 'Please connect a VBT sensor first.');
        return;
    }
    finishSet();
  };

  const handleFinishSession = () => {
    if (setHistory.length === 0) {
      Alert.alert('End Session?', 'No sets recorded. End anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
        Alert.alert('Session Complete', `Saved ${setHistory.length} sets.`, [
            { text: 'OK', onPress: () => router.back() }
        ]);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>VBT Session</Text>
        <Text style={styles.setNumber}>Set {currentSetIndex}</Text>
      </View>

      {/* Connection Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#4CAF50' : '#F44336' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'Sensor Connected' : 'Sensor Disconnected'}
          </Text>
        </View>
      </View>

      {/* Exercise Selection */}
      <View style={styles.exerciseCard}>
        <Text style={styles.exerciseLabel}>Exercise</Text>
        {currentExercise ? (
          <TouchableOpacity
            style={styles.exerciseSelector}
            onPress={() => setShowExerciseModal(true)}
          >
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{currentExercise.name}</Text>
              <Text style={styles.exerciseCategory}>
                {currentExercise.category}
              </Text>
            </View>
            <Text style={styles.exerciseChange}>Change</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.exerciseSelectButton}
            onPress={() => setShowExerciseModal(true)}
          >
            <Text style={styles.exerciseSelectButtonText}>Select Exercise</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Set Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Set Configuration</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Load (kg)</Text>
          <TextInput
            style={styles.input}
            value={inputLoad}
            onChangeText={handleLoadChange}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Live Data Display */}
      <View style={styles.dataCard}>
        <Text style={styles.dataTitle}>Live Data</Text>
        {liveData ? (
            <>
                <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Mean Velocity</Text>
                    <Text style={styles.dataValue}>
                    {liveData.mean_velocity.toFixed(2)} m/s
                    </Text>
                </View>
                <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Peak Velocity</Text>
                    <Text style={styles.dataValue}>
                    {liveData.peak_velocity.toFixed(2)} m/s
                    </Text>
                </View>
                <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>ROM</Text>
                    <Text style={styles.dataValue}>{liveData.rom_cm.toFixed(0)} cm</Text>
                </View>
            </>
        ) : (
            <Text style={styles.noDataText}>Waiting for rep...</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
         <TouchableOpacity
            style={[styles.button, styles.recordButton]}
            onPress={handleFinishSet}
         >
            <Text style={styles.buttonText}>Finish Set</Text>
         </TouchableOpacity>
      </View>

      {/* Detailed Set History */}
      {setHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session History</Text>
          {setHistory.map((set, idx) => (
            <View key={idx} style={styles.setCard}>
              <View style={styles.setHeader}>
                <Text style={styles.setNumberText}>Set {set.set_index}</Text>
                <Text style={styles.setLoad}>{set.load_kg} kg × {set.reps}</Text>
              </View>
              <Text style={styles.setVelocity}>
                Avg Vel: {set.avg_velocity.toFixed(2)} m/s
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* End Session */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.finishButton]}
          onPress={handleFinishSession}
        >
          <Text style={styles.buttonText}>End Session</Text>
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <ExerciseSelectModal
        visible={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        onSelect={handleExerciseSelect}
        currentExerciseId={currentExercise?.id}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  setNumber: {
    fontSize: 16,
    color: '#999',
  },
  statusCard: {
    margin: 16,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
  },
  exerciseCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  exerciseLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  exerciseSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  exerciseCategory: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  exerciseChange: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseSelectButton: {
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  exerciseSelectButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: '#fff',
  },
  input: {
    fontSize: 16,
    color: '#fff',
    backgroundColor: '#3a3a3a',
    padding: 8,
    borderRadius: 4,
    minWidth: 80,
    textAlign: 'center',
  },
  dataCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    minHeight: 120,
    justifyContent: 'center',
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dataLabel: {
    fontSize: 16,
    color: '#999',
  },
  dataValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  noDataText: {
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#4CAF50',
  },
  finishButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  setCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  setNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  setLoad: {
    fontSize: 14,
    color: '#2196F3',
  },
  setVelocity: {
    fontSize: 14,
    color: '#4CAF50',
  },
});
