/**
 * Database Service using expo-sqlite
 * Handles all database operations for VBT data
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type {
  SessionData,
  SetData,
  RepData,
  LVPData,
  PRRecord,
  Exercise,
} from '../types/index';

const DB_NAME = 'repvelo.db';

// Try to import expo-sqlite safely
let SQLite: any = null;
try {
  SQLite = require('expo-sqlite');
} catch (e) {
  console.warn('expo-sqlite not found or failed to load:', e);
}

class DatabaseService {
  private db: any = null;
  private isExpoGo = Constants.appOwnership === 'expo';

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    // Allow Development Builds (which technically have appOwnership='expo' but different env)
    const isStandardExpoGo = Constants.appOwnership === 'expo' && Constants.executionEnvironment === 'storeClient';

    if (isStandardExpoGo) {
      console.warn('Standard Expo Go detected: persistence is disabled. Data will not be saved.');
      return;
    }

    if (!SQLite) {
      console.warn('SQLite module not available. skipping initialization.');
      return;
    }

    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      // In Expo Go, we want to fail gracefully rather than crashing the whole app
      if (this.isExpoGo) {
        console.warn('Silencing DB error for Expo Go compatibility');
      } else {
        throw error;
      }
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) return;

    // Sessions table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        total_volume REAL DEFAULT 0,
        total_sets INTEGER DEFAULT 0,
        duration_minutes INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Sets table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        lift TEXT NOT NULL,
        set_index INTEGER NOT NULL,
        load_kg REAL NOT NULL,
        reps INTEGER NOT NULL,
        device_type TEXT NOT NULL,
        set_type TEXT NOT NULL,
        avg_velocity REAL,
        velocity_loss REAL,
        rpe REAL,
        e1rm REAL,
        timestamp TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      );
    `);

    // Reps table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS reps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        lift TEXT NOT NULL,
        set_index INTEGER NOT NULL,
        rep_index INTEGER NOT NULL,
        load_kg REAL NOT NULL,
        device_type TEXT NOT NULL,
        mean_velocity REAL,
        peak_velocity REAL,
        rom_cm REAL,
        rep_duration_ms REAL,
        is_valid_rep INTEGER DEFAULT 1,
        rpe_set REAL,
        set_type TEXT NOT NULL,
        notes TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      );
    `);

    // LVP Profiles table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS lvp_profiles (
        lift TEXT PRIMARY KEY,
        vmax REAL NOT NULL,
        v1rm REAL NOT NULL,
        slope REAL NOT NULL,
        intercept REAL NOT NULL,
        r_squared REAL NOT NULL,
        last_updated TEXT NOT NULL
      );
    `);

    // PR Records table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS pr_records (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        lift TEXT NOT NULL,
        value REAL NOT NULL,
        load_kg REAL,
        reps INTEGER,
        date TEXT NOT NULL,
        previous_value REAL,
        improvement REAL NOT NULL
      );
    `);

    // Exercises table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        has_lvp INTEGER DEFAULT 0,
        machine_weight_steps TEXT
      );
    `);

    console.log('Database tables created successfully');
  }

  /**
   * Insert a new session
   */
  async insertSession(session: SessionData): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `INSERT INTO sessions (session_id, date, total_volume, total_sets, duration_minutes, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.session_id,
        session.date,
        session.total_volume,
        session.total_sets,
        session.duration_minutes || null,
        session.notes || null,
      ]
    );
  }

  /**
   * Insert a new set
   */
  async insertSet(setData: SetData): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `INSERT INTO sets (session_id, lift, set_index, load_kg, reps, device_type, set_type,
        avg_velocity, velocity_loss, rpe, e1rm, timestamp, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        setData.session_id,
        setData.lift,
        setData.set_index,
        setData.load_kg,
        setData.reps,
        setData.device_type,
        setData.set_type,
        setData.avg_velocity,
        setData.velocity_loss,
        setData.rpe || null,
        setData.e1rm || null,
        setData.timestamp,
        setData.notes || null,
      ]
    );
  }

  /**
   * Insert a new rep
   */
  async insertRep(repData: RepData): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `INSERT INTO reps (session_id, lift, set_index, rep_index, load_kg, device_type,
        mean_velocity, peak_velocity, rom_cm, rep_duration_ms, is_valid_rep,
        rpe_set, set_type, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        repData.session_id,
        repData.lift,
        repData.set_index,
        repData.rep_index,
        repData.load_kg,
        repData.device_type,
        repData.mean_velocity,
        repData.peak_velocity,
        repData.rom_cm || null,
        repData.rep_duration_ms || null,
        repData.is_valid_rep ? 1 : 0,
        repData.rpe_set || null,
        repData.set_type,
        repData.notes || null,
        repData.timestamp,
      ]
    );
  }

  /**
   * Save or update LVP profile
   */
  async saveLVPProfile(lvpData: LVPData): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `INSERT OR REPLACE INTO lvp_profiles (lift, vmax, v1rm, slope, intercept, r_squared, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        lvpData.lift,
        lvpData.vmax,
        lvpData.v1rm,
        lvpData.slope,
        lvpData.intercept,
        lvpData.r_squared,
        lvpData.last_updated,
      ]
    );
  }

  /**
   * Get LVP profile for an exercise
   */
  async getLVPProfile(lift: string): Promise<LVPData | null> {
    if (!this.db) return null;

    const result = await this.db.getFirstAsync<LVPData>(
      'SELECT * FROM lvp_profiles WHERE lift = ?',
      [lift]
    );

    return result || null;
  }

  /**
   * Insert a PR record
   */
  async insertPRRecord(prRecord: PRRecord): Promise<void> {
    if (!this.db) return;

    await this.db.runAsync(
      `INSERT INTO pr_records (id, type, lift, value, load_kg, reps, date, previous_value, improvement)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prRecord.id,
        prRecord.type,
        prRecord.lift,
        prRecord.value,
        prRecord.load_kg || null,
        prRecord.reps || null,
        prRecord.date,
        prRecord.previous_value || null,
        prRecord.improvement,
      ]
    );
  }

  /**
   * Get all sessions
   */
  async getSessions(): Promise<SessionData[]> {
    if (!this.db) return [];

    const results = await this.db.getAllAsync<SessionData>(
      'SELECT * FROM sessions ORDER BY date DESC'
    );

    return results;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.db) return null;

    const result = await this.db.getFirstAsync<SessionData>(
      'SELECT * FROM sessions WHERE session_id = ?',
      [sessionId]
    );

    return result || null;
  }

  /**
   * Get sets for a session
   */
  async getSetsForSession(sessionId: string): Promise<SetData[]> {
    if (!this.db) return [];

    const results = await this.db.getAllAsync<SetData>(
      'SELECT * FROM sets WHERE session_id = ? ORDER BY set_index',
      [sessionId]
    );

    return results;
  }

  /**
   * Get reps for a set
   */
  async getRepsForSet(sessionId: string, lift: string, setIndex: number): Promise<RepData[]> {
    if (!this.db) return [];

    const results = await this.db.getAllAsync<RepData>(
      'SELECT * FROM reps WHERE session_id = ? AND lift = ? AND set_index = ? ORDER BY rep_index',
      [sessionId, lift, setIndex]
    );

    return results;
  }

  /**
   * Get best PR for an exercise
   */
  async getBestPR(lift: string, type: string): Promise<PRRecord | null> {
    if (!this.db) return null;

    const result = await this.db.getFirstAsync<PRRecord>(
      'SELECT * FROM pr_records WHERE lift = ? AND type = ? ORDER BY value DESC LIMIT 1',
      [lift, type]
    );

    return result || null;
  }

  /**
   * Insert or update exercise
   */
  async saveExercise(exercise: Exercise): Promise<void> {
    if (!this.db) return;

    const stepsJson = exercise.machine_weight_steps
      ? JSON.stringify(exercise.machine_weight_steps)
      : null;

    await this.db.runAsync(
      `INSERT OR REPLACE INTO exercises (id, name, category, has_lvp, machine_weight_steps)
       VALUES (?, ?, ?, ?, ?)`,
      [
        exercise.id,
        exercise.name,
        exercise.category,
        exercise.has_lvp ? 1 : 0,
        stepsJson,
      ]
    );
  }

  /**
   * Get all exercises
   */
  async getExercises(): Promise<Exercise[]> {
    if (!this.db) return [];

    const results = await this.db.getAllAsync<any>('SELECT * FROM exercises ORDER BY name');

    return results.map((row: any) => ({
      ...row,
      has_lvp: row.has_lvp === 1,
      machine_weight_steps: row.machine_weight_steps
        ? JSON.parse(row.machine_weight_steps)
        : undefined,
    }));
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      console.log('Database closed');
    }
  }
}

// Export singleton instance
export default new DatabaseService();
