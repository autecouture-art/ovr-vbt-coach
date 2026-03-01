/**
 * Session Logic Controller
 * Connects UI, BLE, Store, VBTLogic, and AudioService
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTrainingStore } from '../store/trainingStore';
import BLEService from '../services/BLEService';
import AudioService from '../services/AudioService';
import { VBTLogic } from '../services/VBTLogic';
import DatabaseService from '../services/DatabaseService';
import AICoachService from '../services/AICoachService';
import type { RepVeloData, Exercise, RepData, SetData, PRRecord } from '../types/index';

// PR検知コールバック型
type PRCallback = (pr: PRRecord) => void;

export const useSessionLogic = (onPRDetected?: PRCallback) => {
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
    const minRom = currentExercise?.min_rom_threshold ?? 10.0;
    const isValidRep = data.rom_cm > minRom;

    if (isValidRep) {
      // 4. Calculate Derived Metrics
      // Ensure target velocity is available if doing % loss, else use first rep
      const targetVel = (repHistory.length > 0 ? repHistory[0].mean_velocity : data.mean_velocity) as number;
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
        mean_power_w: power,
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
      return;
    }

    // セット平均を計算
    const avgVel = repHistory.reduce((sum, r) => sum + (r.mean_velocity ?? 0), 0) / repHistory.length;
    const peakVel = Math.max(...repHistory.map(r => r.peak_velocity ?? 0));
    const vLoss = repHistory.length > 1
      ? VBTLogic.calculateVelocityLoss((repHistory[0].mean_velocity ?? 0), (repHistory[repHistory.length - 1].mean_velocity ?? 0))
      : 0;

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

    // Storeに保存
    completeSet(newSet);

    // DBに保存 (Async)
    try {
      if (currentSession?.session_id) {
        await DatabaseService.insertSet(newSet);
        for (const rep of repHistory) {
          await DatabaseService.insertRep(rep);
        }

        // === PR検知 ===
        const today = new Date().toISOString().split('T')[0];
        const lift = currentLift || 'Unknown';

        // 1. e1RM PR チェック
        if (e1rm) {
          const bestE1RM = await DatabaseService.getBestPR(lift, 'e1rm');
          if (!bestE1RM || e1rm > bestE1RM.value) {
            const prRecord: PRRecord = {
              id: `pr_e1rm_${Date.now()}`,
              type: 'e1rm',
              lift,
              value: e1rm,
              load_kg: currentLoad,
              reps: repHistory.length,
              date: today,
              previous_value: bestE1RM?.value,
              improvement: bestE1RM ? e1rm - bestE1RM.value : e1rm,
            };
            await DatabaseService.insertPRRecord(prRecord);
            onPRDetected?.(prRecord);
            AudioService.speak('New Personal Record!');
          }
        }

        // 2. 最高速度 PR チェック
        if (peakVel) {
          const bestSpeed = await DatabaseService.getBestPR(lift, 'speed');
          if (!bestSpeed || peakVel > bestSpeed.value) {
            const prRecord: PRRecord = {
              id: `pr_speed_${Date.now()}`,
              type: 'speed',
              lift,
              value: peakVel,
              load_kg: currentLoad,
              date: today,
              previous_value: bestSpeed?.value,
              improvement: bestSpeed ? peakVel - bestSpeed.value : peakVel,
            };
            await DatabaseService.insertPRRecord(prRecord);
            onPRDetected?.(prRecord);
          }
        }

        // === LVP自動更新 ===
        // 十分なデータポイント（3セット以上）がある場合は線形回帰でLVPを更新
        const updatedSets = [...setHistory, newSet].filter(s => s.avg_velocity && s.load_kg);
        if (updatedSets.length >= 3) {
          // 最小二乗法で線形回帰
          const n = updatedSets.length;
          const sumX = updatedSets.reduce((s, d) => s + d.load_kg, 0);
          const sumY = updatedSets.reduce((s, d) => s + (d.avg_velocity ?? 0), 0);
          const sumXY = updatedSets.reduce((s, d) => s + d.load_kg * (d.avg_velocity ?? 0), 0);
          const sumX2 = updatedSets.reduce((s, d) => s + d.load_kg * d.load_kg, 0);

          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;

          // R²を計算
          const meanY = sumY / n;
          const ssTot = updatedSets.reduce((s, d) => s + Math.pow((d.avg_velocity ?? 0) - meanY, 2), 0);
          const ssRes = updatedSets.reduce((s, d) => {
            const predicted = slope * d.load_kg + intercept;
            return s + Math.pow((d.avg_velocity ?? 0) - predicted, 2);
          }, 0);
          const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

          if (rSquared > 0.5) {  // R²が0.5以上なら信頼できるとして更新
            await DatabaseService.saveLVPProfile({
              lift,
              vmax: Math.max(intercept, 0),
              v1rm: Math.max(slope * 100 + intercept, 0.1), // 100kgでの推定速度
              slope,
              intercept,
              r_squared: rSquared,
              last_updated: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.error('セット保存失敗:', e);
    }

    AudioService.speak('Set Complete');
  };

  return {
    finishSet,
    // Expose store state for UI to consume directly if needed, 
    // but preferably UI uses useTrainingStore() directly for reading state.
  };
};
