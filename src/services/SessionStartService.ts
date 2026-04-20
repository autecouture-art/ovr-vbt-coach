/**
 * Session Start Service
 * Aggregates all data needed for the session start screen
 */

import DatabaseService from './DatabaseService';
import { VBTCalculations } from '../utils/VBTCalculations';
import type { LVPData, Exercise } from '../types/index';

export interface SessionStartData {
  lift: string;
  currentLoad: number;
  bestVelocityAtLoad: {
    velocity: number;
    date: string;
    reps: number;
  } | null;
  currentE1RM: number | null;
  mvt: number | null;
  dailyReadiness: {
    predicted: number;
    trend: 'up' | 'same' | 'down';
    confidence: 'high' | 'medium' | 'low';
  };
  historicalVelocityAtLoad: Array<{
    load: number;
    velocity: number;
    date: string;
  }>;
}

export interface ReadinessTrendData {
  recent_sessions: Array<{
    date: string;
    avg_velocity: number;
    load_kg: number;
  }>;
  trend: 'improving' | 'stable' | 'declining';
  delta_percent: number;
}

class SessionStartService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Fetch all data needed for session start screen
   */
  async getSessionStartData(
    exercise: Exercise,
    currentLoad: number
  ): Promise<SessionStartData> {
    const lift = exercise.name;

    // 1. Get best velocity at current load (PR)
    const bestVelocity = await this.db.getBestVelocityAtLoad(lift, currentLoad);

    // 2. Get current LVP profile for 1eRM
    const lvp = await this.db.getLVPProfile(lift);
    const currentE1RM = lvp ? this.calculate1RMFromLVP(lvp) : null;
    const mvt = lvp?.mvt || exercise.mvt || null;

    // 3. Calculate daily readiness
    const dailyReadiness = await this.calculateDailyReadiness(lift, currentLoad, lvp);

    // 4. Get historical velocity data at this load
    const historicalVelocity = await this.getHistoricalVelocityAtLoad(lift, currentLoad);

    return {
      lift,
      currentLoad,
      bestVelocityAtLoad: bestVelocity ? {
        velocity: bestVelocity.avg_velocity,
        date: bestVelocity.timestamp,
        reps: bestVelocity.reps,
      } : null,
      currentE1RM,
      mvt,
      dailyReadiness,
      historicalVelocity: historicalVelocity.slice(0, 5), // Last 5 sessions
    };
  }

  /**
   * Calculate 1RM from LVP profile
   */
  private calculate1RMFromLVP(lvp: LVPData): number {
    const velocityAt1RM = VBTCalculations.getVelocityAt1RM(lvp);
    const estimated1RM = (velocityAt1RM - lvp.intercept) / lvp.slope;
    return Math.round(estimated1RM * 10) / 10;
  }

  /**
   * Calculate daily readiness based on recent performance
   */
  private async calculateDailyReadiness(
    lift: string,
    currentLoad: number,
    lvp: LVPData | null
  ): Promise<SessionStartData['dailyReadiness']> {
    // Get recent sessions at this load
    const recentSets = await this.db.getRecentSetsForLift(lift, 10);

    if (recentSets.length < 2) {
      return {
        predicted: lvp ? this.calculate1RMFromLVP(lvp) : 0,
        trend: 'same',
        confidence: 'low',
      };
    }

    // Filter sets at similar load (±5kg)
    const similarLoadSets = recentSets.filter(
      set => Math.abs(set.load_kg - currentLoad) <= 5
    );

    if (similarLoadSets.length < 2) {
      return {
        predicted: lvp ? this.calculate1RMFromLVP(lvp) : 0,
        trend: 'same',
        confidence: 'low',
      };
    }

    // Calculate trend from recent 3 sessions
    const recent3 = similarLoadSets.slice(0, 3);
    const avgVelocityRecent3 = recent3.reduce(
      (sum, set) => sum + (set.avg_velocity || 0),
      0
    ) / recent3.length;

    // Compare with older sessions
    const olderSessions = similarLoadSets.slice(3);
    if (olderSessions.length > 0) {
      const avgVelocityOlder = olderSessions.reduce(
        (sum, set) => sum + (set.avg_velocity || 0),
        0
      ) / olderSessions.length;

      const deltaPercent = ((avgVelocityRecent3 - avgVelocityOlder) / avgVelocityOlder) * 100;

      let trend: 'up' | 'same' | 'down';
      if (deltaPercent > 2) {
        trend = 'up';
      } else if (deltaPercent < -2) {
        trend = 'down';
      } else {
        trend = 'same';
      }

      // Determine confidence based on sample size
      let confidence: 'high' | 'medium' | 'low';
      if (similarLoadSets.length >= 6) {
        confidence = 'high';
      } else if (similarLoadSets.length >= 4) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      // Predict today's 1RM based on trend
      const baseline1RM = lvp ? this.calculate1RMFromLVP(lvp) : 0;
      let predicted = baseline1RM;

      if (trend === 'up') {
        predicted = baseline1RM * 1.02; // +2%
      } else if (trend === 'down') {
        predicted = baseline1RM * 0.98; // -2%
      }

      return {
        predicted: Math.round(predicted * 10) / 10,
        trend,
        confidence,
      };
    }

    return {
      predicted: lvp ? this.calculate1RMFromLVP(lvp) : 0,
      trend: 'same',
      confidence: 'low',
    };
  }

  /**
   * Get historical velocity at specific load
   */
  private async getHistoricalVelocityAtLoad(
    lift: string,
    loadKg: number
  ): Promise<Array<{ load: number; velocity: number; date: string }>> {
    const recentSets = await this.db.getRecentSetsForLift(lift, 20);

    return recentSets
      .filter(set => Math.abs(set.load_kg - loadKg) <= 1 && set.avg_velocity !== null)
      .map(set => ({
        load: set.load_kg,
        velocity: set.avg_velocity!,
        date: set.timestamp,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Get readiness trend over time
   */
  async getReadinessTrend(lift: string): Promise<ReadinessTrendData> {
    const recentSets = await this.db.getRecentSetsForLift(lift, 10);

    if (recentSets.length < 2) {
      return {
        recent_sessions: [],
        trend: 'stable',
        delta_percent: 0,
      };
    }

    const sessions = recentSets.map(set => ({
      date: set.timestamp,
      avg_velocity: set.avg_velocity || 0,
      load_kg: set.load_kg,
    }));

    // Calculate trend
    const firstHalf = sessions.slice(Math.floor(sessions.length / 2));
    const secondHalf = sessions.slice(0, Math.floor(sessions.length / 2));

    const avgFirst = firstHalf.reduce((sum, s) => sum + s.avg_velocity, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, s) => sum + s.avg_velocity, 0) / secondHalf.length;

    const deltaPercent = ((avgSecond - avgFirst) / avgFirst) * 100;

    let trend: 'improving' | 'stable' | 'declining';
    if (deltaPercent > 3) {
      trend = 'improving';
    } else if (deltaPercent < -3) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return {
      recent_sessions: sessions,
      trend,
      delta_percent: Math.round(deltaPercent * 10) / 10,
    };
  }
}

export default new SessionStartService();
