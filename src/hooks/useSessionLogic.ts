/**
 * Session Logic Controller
 * Connects UI, BLE, Store, VBTLogic, and AudioService
 */

import { useEffect, useCallback } from 'react';
import { useTrainingStore } from '../store/trainingStore'; // Adjust path if needed
import BLEService from '../services/BLEService';
import AudioService from '../services/AudioService';
import { VBTLogic } from '../services/VBTLogic';
import DatabaseService from '../services/DatabaseService';
import type { RepVeloData, Exercise, RepData, SetData } from '../types/index';

export const useSessionLogic = () => {
  // Store State & Actions
  const {
    currentSession,
    isSessionActive,
    currentSetIndex,
    currentLift,
    currentLoad,
    currentReps,
    currentExercise,
    isConnected,
    liveData,
    repHistory,
    setHistory,
    settings,
    
    // Actions
    setConnectionStatus,
    setLiveData,
    addRep,
    completeSet,
    resetSetData,
  } = useTrainingStore();

  // --- BLE Event Handlers ---

  const handleDataReceived = useCallback((data: RepVeloData) => {
    // 1. Update Live Data in Store (for UI)
    setLiveData(data);

    // 2. Audio Feedback (Velocity)
    if (settings.enable_audio_feedback) {
      AudioService.announceVelocity(data.mean_velocity);
    }

    // 3. Process Rep Logic
    // TODO: Validate rep (ROM check, etc.)
    const isValidRep = data.rom_cm > 10; // Simple threshold for now

    if (isValidRep) {
       // 4. Calculate Derived Metrics
       // Ensure target velocity is available if doing % loss, else use first rep
       const targetVel = repHistory.length > 0 ? repHistory[0].mean_velocity : data.mean_velocity;
       const vLoss = VBTLogic.calculateVelocityLoss(targetVel, data.mean_velocity);
       
       // Power Calculation
       const power = VBTLogic.calculatePower(currentLoad, data.mean_velocity);

       const newRep: RepData = {
         session_id: currentSession?.session_id || 'offline',
         lift: currentLift || 'Unknown',
         set_index: currentSetIndex,
         rep_index: repHistory.length + 1,
         mean_velocity: data.mean_velocity,
         peak_velocity: data.peak_velocity,
         rom_cm: data.rom_cm,
         rep_duration_ms: data.rep_duration_ms,
         load_kg: currentLoad,
         device_type: 'OVR Velocity',
         timestamp: new Date().toISOString(),
         is_valid_rep: true,
         set_type: 'normal',
       };

       // 5. Add to Store
       addRep(newRep);

       // 6. Check Velocity Loss Threshold
       if (vLoss >= settings.velocity_loss_threshold) {
         if (settings.enable_audio_feedback) {
           AudioService.announceVelocityLoss();
         }
       }
    }
  }, [currentSession, currentLift, currentSetIndex, repHistory, currentLoad, settings, setLiveData, addRep]);

  const handleConnectionChanged = useCallback((connected: boolean) => {
    setConnectionStatus(connected);
    if (connected) {
      AudioService.speak('Sensor Connected');
    } else {
      AudioService.speak('Sensor Disconnected');
    }
  }, [setConnectionStatus]);

  // --- Setup & Teardown ---

  useEffect(() => {
    // Initialize Services
    AudioService.initialize();

    // Set BLE Callbacks
    BLEService.setCallbacks({
      onDataReceived: handleDataReceived,
      onConnectionStatusChanged: handleConnectionChanged,
      onError: (error) => console.error('BLE Error:', error),
    });

    // Check initial connection
    BLEService.isConnected().then(result => setConnectionStatus(result));

    return () => {
      // Cleanup callbacks? (Optional if singleton persists)
    };
  }, [handleDataReceived, handleConnectionChanged, setConnectionStatus]);


  // --- User Actions ---

  const finishSet = async () => {
    if (repHistory.length === 0) {
      // confirm empty set?
      return;
    }

    // Calculate Set Averages
    const avgVel = repHistory.reduce((sum, r) => sum + r.mean_velocity, 0) / repHistory.length;
    const peakVel = Math.max(...repHistory.map(r => r.peak_velocity));
    const vLoss = repHistory.length > 1 
      ? VBTLogic.calculateVelocityLoss(repHistory[0].mean_velocity, repHistory[repHistory.length - 1].mean_velocity)
      : 0;
    
    // e1RM
    const e1rm = VBTLogic.calculateE1RM(currentLoad, repHistory.length);

    const newSet: SetData = {
      session_id: currentSession?.session_id || 'offline',
      lift: currentLift || 'Unknown',
      set_index: currentSetIndex,
      load_kg: currentLoad,
      reps: repHistory.length,
      device_type: 'OVR Velocity',
      set_type: 'normal',
      avg_velocity: avgVel,
      velocity_loss: vLoss,
      e1rm: e1rm,
      timestamp: new Date().toISOString(),
    };

    // Save to Store
    completeSet(newSet);
    
    // Save to DB (Async)
    try {
      if (currentSession?.session_id) {
         await DatabaseService.insertSet(newSet);
         // Also save reps
         for (const rep of repHistory) {
           await DatabaseService.insertRep(rep);
         }
      }
    } catch (e) {
      console.error('Failed to save set to DB', e);
    }
    
    AudioService.speak('Set Complete');
  };

  return {
    finishSet,
    // Expose store state for UI to consume directly if needed, 
    // but preferably UI uses useTrainingStore() directly for reading state.
  };
};
