/**
 * Database Service using expo-sqlite
 * Handles all database operations for VBT data
 */

import Constants from "expo-constants";
import { VBTLogic } from "./VBTLogic";
import VBTCalculations from "../utils/VBTCalculations";
import { getSessionDate } from "../utils/session";
import type {
  SessionData,
  SetData,
  RepData,
  LVPData,
  PRRecord,
  Exercise,
  FormVideoRecord,
} from "../types/index";

const DB_NAME = "repvelo.db";

// Lazy-load expo-sqlite to avoid native module initialization at import time.
let SQLite: any = null;
let sqliteLoadAttempted = false;

function getSQLite(): any {
  if (!sqliteLoadAttempted) {
    sqliteLoadAttempted = true;
    try {
      SQLite = require("expo-sqlite");
    } catch (e) {
      console.warn("expo-sqlite not found or failed to load:", e);
    }
  }
  return SQLite;
}

class DatabaseService {
  private db: any = null;
  private isExpoGo = Constants.appOwnership === "expo";
  private initializationPromise: Promise<void> | null = null;

  private resolveRepPower(
    storedPower: number | null | undefined,
    velocity: number | null | undefined,
    loadKg: number | null | undefined,
  ): number | null {
    if (storedPower != null && storedPower > 0) {
      return storedPower;
    }
    if (velocity != null && velocity > 0 && loadKg != null && loadKg > 0) {
      return VBTLogic.calculatePower(loadKg, velocity);
    }
    return null;
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Allow Development Builds (which technically have appOwnership='expo' but different env)
    const isStandardExpoGo =
      Constants.appOwnership === "expo" &&
      Constants.executionEnvironment === "storeClient";

    if (isStandardExpoGo) {
      console.warn(
        "Standard Expo Go detected: persistence is disabled. Data will not be saved.",
      );
      return;
    }

    const sqlite = getSQLite();
    if (!sqlite) {
      console.warn("SQLite module not available. skipping initialization.");
      return;
    }

    this.initializationPromise = (async () => {
      try {
        this.db = await sqlite.openDatabaseAsync(DB_NAME);
        await this.createTables();
        await this.migrate(); // カラム追加などのマイグレーション
        await this.createIndexes();
        console.log("Database initialized successfully");
      } catch (error) {
        this.db = null;
        console.error("Failed to initialize database:", error);
        // In Expo Go, we want to fail gracefully rather than crashing the whole app
        if (this.isExpoGo) {
          console.warn("Silencing DB error for Expo Go compatibility");
          return;
        }
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    await this.initializationPromise;
  }

  private async ensureReady(): Promise<boolean> {
    if (this.db) return true;
    try {
      await this.initialize();
    } catch (error) {
      console.error("Database ensureReady failed:", error);
      return false;
    }
    return !!this.db;
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
        duration_seconds INTEGER,
        start_timestamp TEXT,
        end_timestamp TEXT,
        avg_hr REAL,
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
        avg_rom_cm REAL,
        rpe REAL,
        e1rm REAL,
        timestamp TEXT NOT NULL,
        start_timestamp TEXT,
        end_timestamp TEXT,
        rest_duration_s REAL,
        avg_hr REAL,
        peak_hr REAL,
        hr_recovery_to_120_s REAL,
        avg_power_w REAL,
        is_warmup INTEGER DEFAULT 0,
        notes TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      );
    `);

    // Reps table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS reps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rep_id TEXT, -- UUID from RepData.id for consistent tracking
        session_id TEXT NOT NULL,
        lift TEXT NOT NULL,
        set_index INTEGER NOT NULL,
        rep_index INTEGER NOT NULL,
        load_kg REAL NOT NULL,
        device_type TEXT NOT NULL,
        mean_velocity REAL,
        peak_velocity REAL,
        mean_power_w REAL,
        peak_power_w REAL,
        rom_cm REAL,
        rep_duration_ms REAL,
        is_valid_rep INTEGER DEFAULT 1,
        is_short_rom INTEGER DEFAULT 0,
        rpe_set REAL,
        set_type TEXT NOT NULL,
        notes TEXT,
        hr_bpm REAL,
        timestamp TEXT NOT NULL,
        is_excluded INTEGER DEFAULT 0,
        exclusion_reason TEXT,
        edited_at INTEGER,
        is_failed INTEGER DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      );
    `);

    // LVP Profiles table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS lvp_profiles (
        lift TEXT PRIMARY KEY,
        vmax REAL NOT NULL,
        v1rm REAL NOT NULL,
        mvt REAL,
        slope REAL NOT NULL,
        intercept REAL NOT NULL,
        r_squared REAL NOT NULL,
        sample_count INTEGER DEFAULT 0,
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
        subcategory TEXT,
        has_lvp INTEGER DEFAULT 0,
        machine_weight_steps TEXT,
        min_rom_threshold REAL DEFAULT 10.0,
        rep_detection_mode TEXT DEFAULT 'standard',
        target_pause_ms INTEGER DEFAULT 0,
        rom_range_min_cm REAL,
        rom_range_max_cm REAL,
        rom_data_points INTEGER DEFAULT 0,
        description TEXT,
        mvt REAL,
        ignore_first_rep_as_setup INTEGER DEFAULT 0,
        auto_start_rom_cm REAL
      );
    `);

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS form_video_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        lift TEXT NOT NULL,
        set_index INTEGER,
        load_kg REAL,
        local_uri TEXT NOT NULL,
        thumbnail_uri TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_s REAL NOT NULL,
        created_at TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      );
    `);

    console.log("Database tables created successfully");
  }

  /**
   * カラム追加などのマイグレーション処理
   */
  private async migrate(): Promise<void> {
    if (!this.db) return;

    const migrations = [
      // Sessions
      { table: "sessions", column: "duration_seconds", type: "INTEGER" },
      { table: "sessions", column: "start_timestamp", type: "TEXT" },
      { table: "sessions", column: "end_timestamp", type: "TEXT" },
      { table: "sessions", column: "avg_hr", type: "REAL" },
      // Sets
      { table: "sets", column: "start_timestamp", type: "TEXT" },
      { table: "sets", column: "end_timestamp", type: "TEXT" },
      { table: "sets", column: "rest_duration_s", type: "REAL" },
      { table: "sets", column: "avg_hr", type: "REAL" },
      { table: "sets", column: "peak_hr", type: "REAL" },
      { table: "sets", column: "hr_recovery_to_120_s", type: "REAL" },
      { table: "sets", column: "avg_power_w", type: "REAL" },
      { table: "sets", column: "avg_rom_cm", type: "REAL" },
      { table: "sets", column: "is_warmup", type: "INTEGER DEFAULT 0" },
      // Reps 追加カラム
      { table: "reps", column: "is_excluded", type: "INTEGER DEFAULT 0" },
      { table: "reps", column: "exclusion_reason", type: "TEXT" },
      { table: "reps", column: "edited_at", type: "INTEGER" },
      { table: "reps", column: "is_short_rom", type: "INTEGER DEFAULT 0" },
      { table: "reps", column: "is_failed", type: "INTEGER DEFAULT 0" },
      { table: "reps", column: "rep_id", type: "TEXT" }, // UUID for consistent rep tracking
      { table: "reps", column: "mean_power_w", type: "REAL" },
      { table: "reps", column: "peak_power_w", type: "REAL" },
      // Exercises 追加カラム
      { table: "exercises", column: "description", type: "TEXT" },
      {
        table: "exercises",
        column: "ignore_first_rep_as_setup",
        type: "INTEGER DEFAULT 0",
      },
      { table: "exercises", column: "category", type: "TEXT" },
      { table: "exercises", column: "subcategory", type: "TEXT" },
      { table: "exercises", column: "rom_range_min_cm", type: "REAL" },
      { table: "exercises", column: "rom_range_max_cm", type: "REAL" },
      {
        table: "exercises",
        column: "rom_data_points",
        type: "INTEGER DEFAULT 0",
      },
      { table: "exercises", column: "mvt", type: "REAL" },
      {
        table: "exercises",
        column: "velocity_loss_threshold",
        type: "REAL",
      },
      { table: "exercises", column: "training_cue", type: "TEXT" },
      { table: "exercises", column: "focus_note", type: "TEXT" },
      { table: "exercises", column: "auto_start_rom_cm", type: "REAL" },
      // LVP Profiles 追加カラム
      {
        table: "lvp_profiles",
        column: "sample_count",
        type: "INTEGER DEFAULT 0",
      },
      { table: "lvp_profiles", column: "r_squared", type: "REAL" },
      { table: "lvp_profiles", column: "mvt", type: "REAL" },
    ];

    for (const m of migrations) {
      try {
        await this.db.execAsync(
          `ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type};`,
        );
        console.log(`Added column ${m.column} to ${m.table}`);
      } catch {
        // すでにカラムが存在する場合はエラーになるが、無視して続行
      }
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sets_session_lift_set
        ON sets(session_id, lift, set_index);
      CREATE INDEX IF NOT EXISTS idx_sets_lift_timestamp
        ON sets(lift, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_sets_lift_velocity_timestamp
        ON sets(lift, avg_velocity, is_warmup, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_reps_session_lift_set
        ON reps(session_id, lift, set_index, rep_index);
      CREATE INDEX IF NOT EXISTS idx_reps_lift_rom
        ON reps(lift, is_valid_rep, is_excluded, is_failed, rom_cm);
      CREATE INDEX IF NOT EXISTS idx_pr_records_lift_type_value
        ON pr_records(lift, type, value DESC);
      CREATE INDEX IF NOT EXISTS idx_form_video_records_session_lift_set
        ON form_video_records(session_id, lift, set_index, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_form_video_records_session_started
        ON form_video_records(session_id, started_at DESC);
    `);
  }

  private mapFormVideoRecord(row: any): FormVideoRecord {
    return {
      id: row.id,
      session_id: row.session_id,
      lift: row.lift,
      set_index: row.set_index ?? null,
      load_kg: row.load_kg ?? null,
      local_uri: row.local_uri,
      thumbnail_uri: row.thumbnail_uri ?? null,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration_s: row.duration_s,
      created_at: row.created_at,
      notes: row.notes ?? null,
    };
  }

  async insertFormVideoRecord(record: FormVideoRecord): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync(
      `INSERT OR REPLACE INTO form_video_records (
        id, session_id, lift, set_index, load_kg, local_uri, thumbnail_uri,
        started_at, ended_at, duration_s, created_at, notes
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.session_id,
        record.lift,
        record.set_index ?? null,
        record.load_kg ?? null,
        record.local_uri,
        record.thumbnail_uri ?? null,
        record.started_at,
        record.ended_at,
        record.duration_s,
        record.created_at,
        record.notes ?? null,
      ],
    );
  }

  async getFormVideosForSet(
    sessionId: string,
    lift: string,
    setIndex: number,
  ): Promise<FormVideoRecord[]> {
    if (!(await this.ensureReady())) return [];

    const results = (await this.db.getAllAsync(
      `SELECT * FROM form_video_records
       WHERE session_id = ? AND lift = ? AND set_index = ?
       ORDER BY started_at DESC, created_at DESC`,
      [sessionId, lift, setIndex],
    )) as any[];

    return results.map((row) => this.mapFormVideoRecord(row));
  }

  async getFormVideosForSession(
    sessionId: string,
  ): Promise<FormVideoRecord[]> {
    if (!(await this.ensureReady())) return [];

    const results = (await this.db.getAllAsync(
      `SELECT * FROM form_video_records
       WHERE session_id = ?
       ORDER BY started_at DESC, created_at DESC`,
      [sessionId],
    )) as any[];

    return results.map((row) => this.mapFormVideoRecord(row));
  }

  async deleteFormVideoRecord(id: string): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync("DELETE FROM form_video_records WHERE id = ?", [id]);
  }

  /**
   * Insert a new session
   */
  async insertSession(session: SessionData): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync(
      `INSERT INTO sessions (session_id, date, total_volume, total_sets, duration_minutes, duration_seconds, start_timestamp, end_timestamp, avg_hr, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.session_id,
        session.date,
        session.total_volume,
        session.total_sets,
        session.duration_minutes || null,
        session.duration_seconds || null,
        session.start_timestamp || null,
        session.end_timestamp || null,
        session.avg_hr || null,
        session.notes || null,
      ],
    );
  }

  /**
   * Update an existing session
   */
  async updateSession(session: SessionData): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync(
      `UPDATE sessions SET
        date = ?, total_volume = ?, total_sets = ?, duration_minutes = ?, duration_seconds = ?,
        start_timestamp = ?, end_timestamp = ?, avg_hr = ?, notes = ?
       WHERE session_id = ?`,
      [
        session.date,
        session.total_volume,
        session.total_sets,
        session.duration_minutes || null,
        session.duration_seconds || null,
        session.start_timestamp || null,
        session.end_timestamp || null,
        session.avg_hr || null,
        session.notes || null,
        session.session_id,
      ],
    );
  }

  /**
   * Insert a new set
   */
  async insertSet(setData: SetData): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync(
      `INSERT INTO sets (session_id, lift, set_index, load_kg, reps, device_type, set_type,
        avg_velocity, velocity_loss, avg_rom_cm, rpe, e1rm, timestamp, start_timestamp, end_timestamp, rest_duration_s, avg_hr, peak_hr, hr_recovery_to_120_s, avg_power_w, is_warmup, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        setData.avg_rom_cm ?? null,
        setData.rpe || null,
        setData.e1rm || null,
        setData.timestamp,
        setData.start_timestamp || null,
        setData.end_timestamp || null,
        setData.rest_duration_s || null,
        setData.avg_hr || null,
        setData.peak_hr || null,
        setData.hr_recovery_to_120_s ?? null,
        setData.avg_power_w || null,
        setData.is_warmup ? 1 : 0,
        setData.notes || null,
      ],
    );
  }

  /**
   * Insert a new rep
   */
  async insertRep(repData: RepData): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync(
      `INSERT INTO reps (rep_id, session_id, lift, set_index, rep_index, load_kg, device_type,
        mean_velocity, peak_velocity, mean_power_w, peak_power_w, rom_cm, rep_duration_ms, is_valid_rep, is_short_rom,
        rpe_set, set_type, notes, hr_bpm, timestamp, is_excluded, exclusion_reason, edited_at, is_failed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        repData.id || null, // UUID
        repData.session_id,
        repData.lift,
        repData.set_index,
        repData.rep_index,
        repData.load_kg,
        repData.device_type,
        repData.mean_velocity,
        repData.peak_velocity,
        repData.mean_power_w ?? null,
        repData.peak_power_w ?? null,
        repData.rom_cm || null,
        repData.rep_duration_ms || null,
        repData.is_valid_rep ? 1 : 0,
        repData.is_short_rom ? 1 : 0,
        repData.rpe_set || null,
        repData.set_type,
        repData.notes || null,
        repData.hr_bpm || null,
        repData.timestamp,
        repData.is_excluded ? 1 : 0,
        repData.exclusion_reason || null,
        repData.edited_at || null,
        repData.is_failed ? 1 : 0,
      ],
    );
  }

  /**
   * 除外フラグを立てる (Phase 1)
   */
  async excludeRep(repId: string, reason: string): Promise<void> {
    if (!(await this.ensureReady())) return;
    // rep_id (UUID) で検索、見つからなければフォールバックして id (INTEGER) で検索
    await this.db.runAsync(
      "UPDATE reps SET is_excluded = 1, exclusion_reason = ?, edited_at = ? WHERE rep_id = ?",
      [reason, Date.now(), repId],
    );
    // フォールバック: rep_idで該当しなかった場合、旧データのid(整数)で試行
    const numericId = parseInt(repId, 10);
    if (!isNaN(numericId)) {
      await this.db.runAsync(
        "UPDATE reps SET is_excluded = 1, exclusion_reason = ?, edited_at = ? WHERE id = ? AND rep_id IS NULL",
        [reason, Date.now(), numericId],
      );
    }
  }

  /**
   * 失敗フラグを立てる (Phase 5)
   */
  async markRepAsFailed(repId: string, isFailed: boolean): Promise<void> {
    if (!(await this.ensureReady())) return;
    // rep_id (UUID) で検索、見つからなければフォールバックして id (INTEGER) で検索
    await this.db.runAsync(
      "UPDATE reps SET is_failed = ?, edited_at = ? WHERE rep_id = ?",
      [isFailed ? 1 : 0, Date.now(), repId],
    );
    // フォールバック: rep_idで該当しなかった場合、旧データのid(整数)で試行
    const numericId = parseInt(repId, 10);
    if (!isNaN(numericId)) {
      await this.db.runAsync(
        "UPDATE reps SET is_failed = ?, edited_at = ? WHERE id = ? AND rep_id IS NULL",
        [isFailed ? 1 : 0, Date.now(), numericId],
      );
    }
  }

  /**
   * セット情報の修正 (除外後などの再計算時に使用)
   */
  async updateSetMetrics(
    sessionId: string,
    setIndex: number,
    setData: Partial<SetData>,
    lift?: string,
  ): Promise<void> {
    if (!(await this.ensureReady())) return;

    // Partial updates based on what is provided
    let query = "UPDATE sets SET ";
    const queryParams: any[] = [];
    const updateFields: string[] = [];

    if (setData.reps !== undefined) {
      updateFields.push("reps = ?");
      queryParams.push(setData.reps);
    }
    if (setData.avg_velocity !== undefined) {
      updateFields.push("avg_velocity = ?");
      queryParams.push(setData.avg_velocity);
    }
    if (setData.velocity_loss !== undefined) {
      updateFields.push("velocity_loss = ?");
      queryParams.push(setData.velocity_loss);
    }
    if (setData.rpe !== undefined) {
      updateFields.push("rpe = ?");
      queryParams.push(setData.rpe);
    }
    if (setData.e1rm !== undefined) {
      updateFields.push("e1rm = ?");
      queryParams.push(setData.e1rm);
    }

    if (updateFields.length === 0) return;

    query +=
      updateFields.join(", ") + " WHERE session_id = ? AND set_index = ?";
    queryParams.push(sessionId, setIndex);

    // liftが指定されている場合はWHERE句に追加（種目切り替え時の更新ミス防止）
    if (lift) {
      query += " AND lift = ?";
      queryParams.push(lift);
    }

    await this.db.runAsync(query, queryParams);
  }

  /**
   * 統一再集計関数: レップ除外・失敗後にセットのメトリクスを再計算する
   * @param sessionId セッションID
   * @param lift 種目名
   * @param setIndex セットインデックス
   * @returns 再計算されたセットメトリクス
   */
  async recalculateSetMetrics(
    sessionId: string,
    lift: string,
    setIndex: number,
  ): Promise<{
    reps: number;
    avg_velocity: number;
    velocity_loss: number;
    e1rm?: number | null;
  } | null> {
    if (!(await this.ensureReady())) return null;

    // 1. セットデータを取得
    const sets = await this.getSetsForSession(sessionId);
    const setData = sets.find(
      (s) => s.set_index === setIndex && s.lift === lift,
    );
    if (!setData) return null;

    // 2. このセットの全レップを取得
    const allSetReps = await this.getRepsForSet(sessionId, lift, setIndex);

    // 3. 有効なレップのみを抽出（除外・失敗・無効レップを除外）
    const validReps = allSetReps.filter(
      (r) => !r.is_excluded && !r.is_failed && r.is_valid_rep,
    );

    if (validReps.length === 0) {
      // 有効なレップがない場合、0として扱う
      return {
        reps: 0,
        avg_velocity: 0,
        velocity_loss: 0,
        e1rm: undefined,
      };
    }

    // 4. 平均速度を計算
    const avgVel =
      validReps.reduce((sum, r) => sum + (r.mean_velocity ?? 0), 0) /
      validReps.length;

    // 5. Velocity Lossを計算（セット内最高速度 vs 平均速度）
    const vLoss = VBTCalculations.calculateSetVelocityLoss(validReps) ?? 0;

    // 6. e1RMを計算（reps <= 0の場合はnull）
    const e1rm =
      VBTLogic.calculateE1RM(setData.load_kg, validReps.length) ?? null;

    return {
      reps: validReps.length,
      avg_velocity: avgVel,
      velocity_loss: vLoss,
      e1rm: e1rm,
    };
  }

  /**
   * レップ編集後の完全再集計（DB更新 + セッションボリューム再計算）
   * @param sessionId セッションID
   * @param lift 種目名
   * @param setIndex セットインデックス
   */
  async recalculateAndUpdateSet(
    sessionId: string,
    lift: string,
    setIndex: number,
  ): Promise<void> {
    if (!(await this.ensureReady())) return;

    // 1. メトリクスを再計算
    const metrics = await this.recalculateSetMetrics(sessionId, lift, setIndex);
    if (!metrics) return;

    // 2. セットを更新（liftを含めて種目切り替え時の更新ミスを防止）
    await this.updateSetMetrics(sessionId, setIndex, metrics, lift);

    // 3. セッション全体のボリュームを再集計
    await this.recalcSessionVolume(sessionId);
  }

  /**
   * Insert a PR record
   */
  async insertPRRecord(prRecord: PRRecord): Promise<void> {
    if (!(await this.ensureReady())) return;

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
        prRecord.previous_value ?? null,
        prRecord.improvement,
      ],
    );
  }

  /**
   * 同一種目・同一重量の最高速度PRを取得する。
   * 軽い重量の速度が重い重量のPR通知を上書きしないよう、速度PRは重量別に扱う。
   */
  async getBestSpeedPRForLoad(
    lift: string,
    loadKg: number,
  ): Promise<PRRecord | null> {
    if (!(await this.ensureReady())) return null;

    const result = await (this.db.getFirstAsync(
      `SELECT * FROM pr_records
       WHERE lift = ? AND type = 'speed' AND load_kg IS NOT NULL AND ABS(load_kg - ?) <= 0.001
       ORDER BY value DESC LIMIT 1`,
      [lift, loadKg],
    ) as Promise<PRRecord | null>);

    return result || null;
  }

  /**
   * MVT補正用に、直近のセッションから高負荷設定のレップを抽出する
   * @param lift 種目名
   * @param limit_sessions 参照する直近セッション数 (default: 5)
   */
  async getHighLoadRepsForMVT(
    lift: string,
    limit_sessions: number = 5,
  ): Promise<RepData[]> {
    if (!(await this.ensureReady())) return [];

    // 直近 N 件のセッションIDを取得
    const sessionRows = (await this.db.getAllAsync(
      `SELECT DISTINCT session_id FROM sets WHERE lift = ? ORDER BY timestamp DESC LIMIT ?`,
      [lift, limit_sessions],
    )) as { session_id: string }[];

    if (sessionRows.length === 0) return [];

    // SQL IN句をプレースホルダ化
    const placeholders = sessionRows.map(() => "?").join(",");
    const sessionIds = sessionRows.map((r) => r.session_id);

    // 該当セッションの中から、速度が低く（高負荷を示唆）有効なレップを抽出
    const reps = (await this.db.getAllAsync(
      `
      SELECT * FROM reps
      WHERE lift = ?
        AND session_id IN (${placeholders})
        AND is_valid_rep = 1
        AND is_excluded = 0
        AND is_failed = 0
        AND mean_velocity > 0.05
        AND mean_velocity < 0.35
      ORDER BY mean_velocity ASC
    `,
      [lift, ...sessionIds],
    )) as any[];

    // Map rep_id to id property for consistent tracking
    return reps.map((row: any) => ({
      ...row,
      id: String(row.rep_id || row.id), // Use rep_id (UUID) if available, otherwise fall back to id (INTEGER), ensure string
      is_valid_rep: row.is_valid_rep === 1,
      is_short_rom: row.is_short_rom === 1,
      is_excluded: row.is_excluded === 1,
      is_failed: row.is_failed === 1,
    }));
  }

  /**
   * Get all sessions
   */
  async getSessions(): Promise<SessionData[]> {
    if (!(await this.ensureReady())) return [];

    const results = await (this.db.getAllAsync(
      "SELECT * FROM sessions ORDER BY date DESC",
    ) as Promise<SessionData[]>);

    return results;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!(await this.ensureReady())) return null;

    const result = await (this.db.getFirstAsync(
      "SELECT * FROM sessions WHERE session_id = ?",
      [sessionId],
    ) as Promise<SessionData | null>);

    return result || null;
  }

  /**
   * Get sets for a session
   */

  /**
   * Ensure a session exists before saving sets or reps
   */
  async ensureSession(sessionId: string, notes?: string): Promise<SessionData> {
    if (!(await this.ensureReady())) {
      return {
        session_id: sessionId,
        date: getSessionDate(sessionId),
        total_volume: 0,
        total_sets: 0,
        lifts: [],
        notes,
      };
    }

    const existing = await this.getSession(sessionId);
    if (existing) return existing;

    const session: SessionData = {
      session_id: sessionId,
      date: getSessionDate(sessionId),
      total_volume: 0,
      total_sets: 0,
      lifts: [],
      notes,
    };

    await this.insertSession(session);
    return session;
  }

  /**
   * Recalculate session totals from saved sets
   */
  async syncSessionSummary(sessionId: string): Promise<void> {
    if (!(await this.ensureReady())) return;

    const sets = await this.getSetsForSession(sessionId);
    const totalVolume = sets.reduce(
      (sum, set) => sum + set.load_kg * set.reps,
      0,
    );
    await this.db.runAsync(
      `UPDATE sessions SET total_volume = ?, total_sets = ? WHERE session_id = ?`,
      [totalVolume, sets.length, sessionId],
    );
  }

  /**
   * Get recent sets for a specific lift
   */
  async getRecentSetsForLift(
    lift: string,
    limit: number = 3,
    excludeSessionId?: string,
  ): Promise<SetData[]> {
    if (!(await this.ensureReady())) return [];

    const query = excludeSessionId
      ? `SELECT * FROM sets WHERE lift = ? AND session_id != ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM sets WHERE lift = ? ORDER BY timestamp DESC LIMIT ?`;
    const params = excludeSessionId
      ? [lift, excludeSessionId, limit]
      : [lift, limit];

    return (await this.db.getAllAsync(query, params)) as SetData[];
  }

  /**
   * Get best velocity at a specific load for PR display
   * Returns the fastest average velocity achieved at approximately the given load
   */
  async getBestVelocityAtLoad(
    lift: string,
    loadKg: number,
  ): Promise<{ avg_velocity: number; date: string; reps: number } | null> {
    if (!(await this.ensureReady())) return null;

    // Query sets within ±0.5kg of target load to find best velocity
    const result = (await this.db.getFirstAsync(
      `SELECT avg_velocity, timestamp, reps
       FROM sets
       WHERE lift = ?
       AND load_kg >= ?
       AND load_kg < ?
       AND avg_velocity IS NOT NULL
       AND is_warmup = 0
       ORDER BY avg_velocity DESC
       LIMIT 1`,
      [lift, loadKg - 0.5, loadKg + 0.5],
    )) as { avg_velocity: number; timestamp: string; reps: number } | null;

    return result
      ? {
          avg_velocity: result.avg_velocity,
          date: result.timestamp,
          reps: result.reps,
        }
      : null;
  }

  async getSetsForSession(sessionId: string): Promise<SetData[]> {
    if (!(await this.ensureReady())) return [];

    const results = await (this.db.getAllAsync(
      "SELECT * FROM sets WHERE session_id = ? ORDER BY COALESCE(end_timestamp, timestamp), id",
      [sessionId],
    ) as Promise<SetData[]>);

    return results;
  }

  async getExerciseUsageStats(
    days: number = 120,
  ): Promise<
    {
      lift: string;
      recent_set_count: number;
      session_count: number;
      last_trained: string;
    }[]
  > {
    if (!(await this.ensureReady())) return [];

    const since = new Date(
      Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const results = (await this.db.getAllAsync(
      `SELECT
        lift,
        COUNT(*) as recent_set_count,
        COUNT(DISTINCT session_id) as session_count,
        MAX(timestamp) as last_trained
       FROM sets
       WHERE timestamp >= ?
       GROUP BY lift
       ORDER BY recent_set_count DESC, last_trained DESC`,
      [since],
    )) as {
      lift: string;
      recent_set_count: number;
      session_count: number;
      last_trained: string;
    }[];

    return results;
  }

  async getExerciseRomStats(lift: string): Promise<{
    count: number;
    min: number;
    max: number;
    median: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
    mean: number;
  } | null> {
    if (!(await this.ensureReady())) return null;

    const rows = (await this.db.getAllAsync(
      `SELECT rom_cm FROM reps
       WHERE lift = ?
         AND rom_cm IS NOT NULL
         AND is_valid_rep = 1
         AND is_excluded = 0
         AND is_failed = 0
       ORDER BY rom_cm ASC`,
      [lift],
    )) as { rom_cm: number | null }[];

    const values = rows
      .map((row) => row.rom_cm)
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value) && value > 0,
      );

    if (values.length === 0) {
      return null;
    }

    const percentile = (ratio: number) => {
      const index = Math.min(
        values.length - 1,
        Math.max(0, Math.floor((values.length - 1) * ratio)),
      );
      return values[index];
    };

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      median: percentile(0.5),
      p10: percentile(0.1),
      p25: percentile(0.25),
      p75: percentile(0.75),
      p90: percentile(0.9),
      mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    };
  }

  /**
   * Get reps for a set
   */
  async getRepsForSet(
    sessionId: string,
    lift: string,
    setIndex: number,
  ): Promise<RepData[]> {
    if (!(await this.ensureReady())) return [];

    const results = await (this.db.getAllAsync(
      "SELECT * FROM reps WHERE session_id = ? AND lift = ? AND set_index = ? ORDER BY rep_index",
      [sessionId, lift, setIndex],
    ) as Promise<any[]>);

    // Map rep_id to id property for consistent tracking, ensure string type
    return results.map((row: any) => ({
      ...row,
      id: String(row.rep_id || row.id), // Use rep_id (UUID) if available, otherwise fall back to id (INTEGER), ensure string
      mean_power_w: this.resolveRepPower(
        row.mean_power_w,
        row.mean_velocity,
        row.load_kg,
      ),
      peak_power_w: this.resolveRepPower(
        row.peak_power_w,
        row.peak_velocity,
        row.load_kg,
      ),
      is_valid_rep: row.is_valid_rep === 1,
      is_short_rom: row.is_short_rom === 1,
      is_excluded: row.is_excluded === 1,
      is_failed: row.is_failed === 1,
    }));
  }

  /**
   * Get all reps for a session
   */
  async getRepsForSession(sessionId: string): Promise<RepData[]> {
    if (!(await this.ensureReady())) return [];

    const results = await (this.db.getAllAsync(
      "SELECT * FROM reps WHERE session_id = ? ORDER BY lift, set_index, rep_index",
      [sessionId],
    ) as Promise<any[]>);

    // Map rep_id to id property for consistent tracking
    return results.map((row: any) => ({
      ...row,
      id: String(row.rep_id || row.id), // Use rep_id (UUID) if available, otherwise fall back to id (INTEGER), ensure string
      mean_power_w: this.resolveRepPower(
        row.mean_power_w,
        row.mean_velocity,
        row.load_kg,
      ),
      peak_power_w: this.resolveRepPower(
        row.peak_power_w,
        row.peak_velocity,
        row.load_kg,
      ),
      is_valid_rep: row.is_valid_rep === 1,
      is_short_rom: row.is_short_rom === 1,
      is_excluded: row.is_excluded === 1,
      is_failed: row.is_failed === 1,
    }));
  }

  /**
   * Get exercise history - all sessions containing a specific lift
   */
  async getExerciseHistory(lift: string): Promise<
    {
      session_id: string;
      date: string;
      sets: SetData[];
      total_volume: number;
      max_load: number;
      max_reps_at_max_load: number;
      estimated_1rm: number | null;
      total_sets: number;
    }[]
  > {
    if (!(await this.ensureReady())) return [];

    const sessionsWithLift = (await this.db.getAllAsync(
      `SELECT DISTINCT s.session_id, s.date
       FROM sessions s
       INNER JOIN sets st ON s.session_id = st.session_id
       WHERE st.lift = ?
       ORDER BY s.date DESC`,
      [lift],
    )) as { session_id: string; date: string }[];

    const history = [];
    for (const session of sessionsWithLift) {
      const sets = await this.getSetsForSession(session.session_id);
      const liftSets = sets.filter((s) => s.lift === lift && !s.is_warmup);

      if (liftSets.length === 0) continue;

      const totalVolume = liftSets.reduce(
        (sum, s) => sum + s.load_kg * s.reps,
        0,
      );
      const maxLoadSet = liftSets.reduce((max, s) =>
        s.load_kg > max.load_kg ? s : max,
      );
      const estimated1rm =
        liftSets
          .map((s) => s.e1rm)
          .filter((e): e is number => e !== null)
          .sort((a, b) => b - a)[0] || null;

      history.push({
        session_id: session.session_id,
        date: session.date,
        sets: liftSets,
        total_volume: totalVolume,
        max_load: maxLoadSet.load_kg,
        max_reps_at_max_load: maxLoadSet.reps,
        estimated_1rm: estimated1rm,
        total_sets: liftSets.length,
      });
    }

    return history;
  }

  /**
   * Get exercise statistics - aggregated stats for a specific lift
   */
  async getExerciseStats(lift: string): Promise<{
    lift: string;
    session_count: number;
    avg_max_load: number;
    best_1rm: number;
    avg_volume: number;
    avg_sets: number;
    avg_velocity: number;
    recent_sessions: {
      session_id: string;
      date: string;
      sets: SetData[];
      total_volume: number;
      max_load: number;
      max_reps_at_max_load: number;
      estimated_1rm: number | null;
      total_sets: number;
    }[];
  } | null> {
    if (!(await this.ensureReady())) return null;

    const history = await this.getExerciseHistory(lift);
    if (history.length === 0) return null;

    const allMaxLoads = history.map((h) => h.max_load);
    const avgMaxLoad =
      allMaxLoads.reduce((sum, load) => sum + load, 0) / allMaxLoads.length;

    const all1rms = history
      .map((h) => h.estimated_1rm)
      .filter((e): e is number => e !== null);
    const best1rm = all1rms.length > 0 ? Math.max(...all1rms) : 0;

    const allVolumes = history.map((h) => h.total_volume);
    const avgVolume =
      allVolumes.reduce((sum, vol) => sum + vol, 0) / allVolumes.length;

    const allSetCounts = history.map((h) => h.total_sets);
    const avgSets =
      allSetCounts.reduce((sum, count) => sum + count, 0) / allSetCounts.length;

    // Calculate average velocity across all sets for this lift
    const allVelocities = (
      await this.db.getAllAsync(
        `SELECT avg_velocity FROM sets WHERE lift = ? AND avg_velocity IS NOT NULL AND is_warmup = 0`,
        [lift],
      )
    ).map((row: any) => row.avg_velocity);
    const avgVelocity =
      allVelocities.length > 0
        ? allVelocities.reduce((sum: number, v: number) => sum + v, 0) /
          allVelocities.length
        : 0;

    return {
      lift,
      session_count: history.length,
      avg_max_load: avgMaxLoad,
      best_1rm: best1rm,
      avg_volume: avgVolume,
      avg_sets: avgSets,
      avg_velocity: avgVelocity,
      recent_sessions: history.slice(0, 10),
    };
  }

  /**
   * Get list of all exercises that have been trained (have sets recorded)
   */
  async getTrainedExercises(): Promise<
    { lift: string; session_count: number; last_trained: string }[]
  > {
    if (!(await this.ensureReady())) return [];

    const results = (await this.db.getAllAsync(
      `SELECT
        lift,
        COUNT(DISTINCT session_id) as session_count,
        MAX(timestamp) as last_trained
       FROM sets
       GROUP BY lift
       ORDER BY session_count DESC, last_trained DESC`,
    )) as { lift: string; session_count: number; last_trained: string }[];

    return results;
  }

  /**
   * Get best PR for an exercise
   */
  async getBestPR(lift: string, type: string): Promise<PRRecord | null> {
    if (!(await this.ensureReady())) return null;

    const result = await (this.db.getFirstAsync(
      "SELECT * FROM pr_records WHERE lift = ? AND type = ? ORDER BY value DESC LIMIT 1",
      [lift, type],
    ) as Promise<PRRecord | null>);

    return result || null;
  }

  /**
   * Insert or update exercise
   */
  async saveExercise(exercise: Exercise): Promise<void> {
    if (!(await this.ensureReady())) return;

    const stepsJson = exercise.machine_weight_steps
      ? JSON.stringify(exercise.machine_weight_steps)
      : null;

    await this.db.runAsync(
      `INSERT OR REPLACE INTO exercises (
        id, name, category, subcategory, has_lvp, machine_weight_steps,
        min_rom_threshold, rep_detection_mode, target_pause_ms, rom_range_min_cm, rom_range_max_cm, rom_data_points, description, mvt, ignore_first_rep_as_setup, training_cue, focus_note, auto_start_rom_cm
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exercise.id,
        exercise.name,
        exercise.category,
        exercise.subcategory || null,
        exercise.has_lvp ? 1 : 0,
        stepsJson,
        exercise.min_rom_threshold ?? 10.0,
        exercise.rep_detection_mode ?? "standard",
        exercise.target_pause_ms ?? 0,
        exercise.rom_range_min_cm ?? null,
        exercise.rom_range_max_cm ?? null,
        exercise.rom_data_points ?? 0,
        exercise.description || null,
        exercise.mvt || null,
        exercise.ignore_first_rep_as_setup ? 1 : 0,
        exercise.training_cue || null,
        exercise.focus_note || null,
        exercise.auto_start_rom_cm ?? null,
      ],
    );
  }

  /**
   * Get all exercises
   */
  async getExercises(): Promise<Exercise[]> {
    if (!(await this.ensureReady())) return [];

    const results = await (this.db.getAllAsync(
      "SELECT * FROM exercises ORDER BY name",
    ) as Promise<any[]>);

    return results.map((row: any) => ({
      ...row,
      has_lvp: row.has_lvp === 1,
      machine_weight_steps: row.machine_weight_steps
        ? JSON.parse(row.machine_weight_steps)
        : undefined,
      min_rom_threshold: row.min_rom_threshold,
      rep_detection_mode: row.rep_detection_mode,
      target_pause_ms: row.target_pause_ms,
      rom_range_min_cm: row.rom_range_min_cm ?? undefined,
      rom_range_max_cm: row.rom_range_max_cm ?? undefined,
      rom_data_points: row.rom_data_points ?? undefined,
      description: row.description || undefined,
      mvt: row.mvt || undefined,
      ignore_first_rep_as_setup: row.ignore_first_rep_as_setup === 1,
      training_cue: row.training_cue || undefined,
      focus_note: row.focus_note || undefined,
      auto_start_rom_cm: row.auto_start_rom_cm ?? undefined,
    }));
  }

  /**
   * セッションのお気に入りコメントを更新
   */
  async updateSessionNotes(sessionId: string, notes: string): Promise<void> {
    if (!(await this.ensureReady())) return;
    await this.db.runAsync(
      "UPDATE sessions SET notes = ? WHERE session_id = ?",
      [notes, sessionId],
    );
  }

  /**
   * セッションを削除（関連するset/repも全削除）
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!(await this.ensureReady())) return;
    // 関連データを先に削除
    await this.db.runAsync("DELETE FROM reps WHERE session_id = ?", [
      sessionId,
    ]);
    await this.db.runAsync("DELETE FROM sets WHERE session_id = ?", [
      sessionId,
    ]);
    await this.db.runAsync("DELETE FROM sessions WHERE session_id = ?", [
      sessionId,
    ]);
  }

  /**
   * 種目をマスターから削除
   */
  async deleteExercise(id: string): Promise<void> {
    if (!(await this.ensureReady())) return;
    await this.db.runAsync("DELETE FROM exercises WHERE id = ?", [id]);
  }

  /**
   * セットを削除（関連するrepも全削除）
   */
  async deleteSet(
    sessionId: string,
    setIndex: number,
    lift: string,
  ): Promise<void> {
    if (!(await this.ensureReady())) return;
    await this.db.runAsync(
      "DELETE FROM reps WHERE session_id = ? AND set_index = ? AND lift = ?",
      [sessionId, setIndex, lift],
    );
    await this.db.runAsync(
      "DELETE FROM sets WHERE session_id = ? AND set_index = ? AND lift = ?",
      [sessionId, setIndex, lift],
    );
  }

  /**
   * セットのメモを更新
   */
  async updateSetNotes(
    sessionId: string,
    setIndex: number,
    notes: string,
  ): Promise<void> {
    if (!(await this.ensureReady())) return;
    await this.db.runAsync(
      "UPDATE sets SET notes = ? WHERE session_id = ? AND set_index = ?",
      [notes, sessionId, setIndex],
    );
  }

  /**
   * セットの負荷とRPEを更新
   */
  async updateSet(
    sessionId: string,
    setIndex: number,
    updates: { load_kg?: number; rpe?: number; notes?: string; lift?: string },
  ): Promise<void> {
    if (!(await this.ensureReady())) return;
    const parts: string[] = [];
    const values: any[] = [];
    if (updates.load_kg !== undefined) {
      parts.push("load_kg = ?");
      values.push(updates.load_kg);
    }
    if (updates.rpe !== undefined) {
      parts.push("rpe = ?");
      values.push(updates.rpe);
    }
    if (updates.notes !== undefined) {
      parts.push("notes = ?");
      values.push(updates.notes);
    }
    if (parts.length === 0) return;
    values.push(sessionId, setIndex);

    // liftが指定されている場合はWHERE句に追加（種目切り替え時の更新ミス防止）
    const liftCondition = updates.lift ? " AND lift = ?" : "";
    if (updates.lift) values.push(updates.lift);

    await this.db.runAsync(
      `UPDATE sets SET ${parts.join(", ")} WHERE session_id = ? AND set_index = ?${liftCondition}`,
      values,
    );
  }

  /**
   * セット後の心拍回復時間を追記する。
   */
  async updateSetHeartRateRecovery(
    sessionId: string,
    lift: string,
    setIndex: number,
    recoverySeconds: number,
  ): Promise<void> {
    if (!(await this.ensureReady())) return;
    await this.db.runAsync(
      "UPDATE sets SET hr_recovery_to_120_s = ? WHERE session_id = ? AND lift = ? AND set_index = ?",
      [recoverySeconds, sessionId, lift, setIndex],
    );
  }

  /**
   * セットの編集可能項目をまとめて更新し、必要に応じてrep側と集計も揃える
   */
  async updateSetEditableFields(
    sessionId: string,
    setIndex: number,
    lift: string,
    updates: { load_kg: number; lift?: string; rpe?: number; notes?: string },
  ): Promise<void> {
    if (!(await this.ensureReady())) return;

    const newLift = updates.lift ?? lift;

    // setsテーブルを更新
    await this.updateSet(sessionId, setIndex, {
      load_kg: updates.load_kg,
      rpe: updates.rpe,
      notes: updates.notes,
      lift: newLift,
    });

    // 種目名が変更された場合は、関連するrepsのliftも更新
    if (updates.lift && updates.lift !== lift) {
      await this.db.runAsync(
        "UPDATE reps SET lift = ?, edited_at = ? WHERE session_id = ? AND set_index = ? AND lift = ?",
        [updates.lift, Date.now(), sessionId, setIndex, lift],
      );
    }

    // 重量が変更された場合は、関連するrepsのload_kgも更新
    await this.db.runAsync(
      "UPDATE reps SET load_kg = ?, edited_at = ? WHERE session_id = ? AND set_index = ? AND lift = ?",
      [updates.load_kg, Date.now(), sessionId, setIndex, newLift],
    );

    await this.recalcSessionVolume(sessionId);
  }

  /**
   * 種目名の表記揺れを履歴データ全体で英語 canonical 名へ寄せる。
   * sets/reps/pr_records/lvp_profiles を同時に揃え、履歴・PR・LVPが分断されないようにする。
   */
  async renameLiftEverywhere(fromLift: string, toLift: string): Promise<void> {
    if (!(await this.ensureReady())) return;
    if (!fromLift || !toLift || fromLift === toLift) return;

    const editedAt = Date.now();

    await this.db.runAsync("UPDATE sets SET lift = ? WHERE lift = ?", [
      toLift,
      fromLift,
    ]);
    await this.db.runAsync(
      "UPDATE reps SET lift = ?, edited_at = ? WHERE lift = ?",
      [toLift, editedAt, fromLift],
    );
    await this.db.runAsync("UPDATE pr_records SET lift = ? WHERE lift = ?", [
      toLift,
      fromLift,
    ]);
    await this.db.runAsync(
      `UPDATE lvp_profiles
       SET lift = ?
       WHERE lift = ?
         AND NOT EXISTS (SELECT 1 FROM lvp_profiles WHERE lift = ?)`,
      [toLift, fromLift, toLift],
    );
    await this.db.runAsync("DELETE FROM lvp_profiles WHERE lift = ?", [
      fromLift,
    ]);
  }

  /**
   * セット重量を後から修正し、関連するrepとセッション集計も揃える
   */
  async updateSetLoad(
    sessionId: string,
    setIndex: number,
    lift: string,
    loadKg: number,
  ): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync(
      "UPDATE sets SET load_kg = ? WHERE session_id = ? AND set_index = ? AND lift = ?",
      [loadKg, sessionId, setIndex, lift],
    );

    await this.db.runAsync(
      "UPDATE reps SET load_kg = ?, edited_at = ? WHERE session_id = ? AND set_index = ? AND lift = ?",
      [loadKg, Date.now(), sessionId, setIndex, lift],
    );

    await this.recalcSessionVolume(sessionId);
  }

  /**
   * セッション内の全セットのボリュームを集計して更新
   * また、各セットのe1RMも再計算して更新する
   */
  async recalcSessionVolume(sessionId: string): Promise<void> {
    if (!(await this.ensureReady())) return;
    const sets = await this.getSetsForSession(sessionId);

    // 各セットのe1RMを再計算
    for (const setData of sets) {
      const reps = await this.getRepsForSet(
        sessionId,
        setData.lift,
        setData.set_index,
      );
      const validReps = reps.filter(
        (r) => !r.is_excluded && !r.is_failed && r.is_valid_rep,
      );
      const actualRepsCount = validReps.length;

      // e1RMを再計算 (VBTLogic.calculateE1RM使用 - reps <= 0の場合はnull)
      const recalculatedE1RM =
        VBTLogic.calculateE1RM(setData.load_kg, actualRepsCount) ?? null;

      // セットのe1RMとrepsを更新（liftを含めて種目切り替え時の更新ミスを防止）
      await this.updateSetMetrics(
        sessionId,
        setData.set_index,
        {
          reps: actualRepsCount,
          e1rm: recalculatedE1RM,
        },
        setData.lift,
      );
    }

    // セッション全体のボリュームとセット数を再集計 (更新後のセット情報を再取得)
    const updatedSets = await this.getSetsForSession(sessionId);
    const totalVolume = updatedSets.reduce(
      (sum, s) => sum + s.load_kg * s.reps,
      0,
    );
    const totalSets = updatedSets.length;

    await this.db.runAsync(
      "UPDATE sessions SET total_volume = ?, total_sets = ? WHERE session_id = ?",
      [totalVolume, totalSets, sessionId],
    );
  }

  /**
   * データ検索（キーワード・種目フィルター）
   */
  async searchSessions(query?: string, lift?: string): Promise<SessionData[]> {
    if (!(await this.ensureReady())) return [];
    if (lift) {
      const setRows = (await this.db.getAllAsync(
        "SELECT DISTINCT session_id FROM sets WHERE lift = ? ORDER BY timestamp DESC",
        [lift],
      )) as { session_id: string }[];
      const sessions: SessionData[] = [];
      for (const row of setRows) {
        const s = await this.getSession(row.session_id);
        if (s) sessions.push(s);
      }
      return sessions;
    }
    if (query) {
      return (await this.db.getAllAsync(
        "SELECT * FROM sessions WHERE notes LIKE ? ORDER BY date DESC",
        [`%${query}%`],
      )) as SessionData[];
    }
    return this.getSessions();
  }

  /**
   * 週間集計を返す（過去4週間）
   */
  async getWeeklyStats(): Promise<
    { week: string; volume: number; sets: number }[]
  > {
    if (!(await this.ensureReady())) return [];
    const results = (await this.db.getAllAsync(`
      SELECT
        strftime('%Y-W%W', date) as week,
        SUM(total_volume) as volume,
        SUM(total_sets) as sets
      FROM sessions
      GROUP BY week
      ORDER BY week DESC
      LIMIT 8
    `)) as { week: string; volume: number; sets: number }[];
    return results;
  }

  /**
   * Save or update LVP profile
   */
  async saveLVPProfile(lvp: LVPData): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync(
      `INSERT OR REPLACE INTO lvp_profiles (
        lift, vmax, v1rm, mvt, slope, intercept, r_squared, last_updated, sample_count
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lvp.lift,
        lvp.vmax,
        lvp.v1rm,
        lvp.mvt || 0.15,
        lvp.slope,
        lvp.intercept,
        lvp.r_squared,
        lvp.last_updated,
        lvp.sample_count || 0,
      ],
    );
  }

  /**
   * Get LVP profile for a specific exercise
   */
  async getLVPProfile(lift: string): Promise<LVPData | null> {
    if (!(await this.ensureReady())) return null;

    const result = await (this.db.getFirstAsync(
      "SELECT * FROM lvp_profiles WHERE lift = ?",
      [lift],
    ) as Promise<any>);

    if (!result) return null;

    return {
      lift: result.lift,
      vmax: result.vmax,
      v1rm: result.v1rm,
      mvt: result.mvt,
      slope: result.slope,
      intercept: result.intercept,
      r_squared: result.r_squared,
      last_updated: result.last_updated,
      sample_count: result.sample_count,
    };
  }

  /**
   * Get all LVP profiles
   */
  async getAllLVPProfiles(): Promise<LVPData[]> {
    if (!(await this.ensureReady())) return [];

    const results = await (this.db.getAllAsync(
      "SELECT * FROM lvp_profiles ORDER BY lift",
    ) as Promise<any[]>);

    return results.map((row: any) => ({
      lift: row.lift,
      vmax: row.vmax,
      v1rm: row.v1rm,
      mvt: row.mvt,
      slope: row.slope,
      intercept: row.intercept,
      r_squared: row.r_squared,
      last_updated: row.last_updated,
      sample_count: row.sample_count,
    }));
  }

  /**
   * Get historical load-velocity data for 1RM estimation
   * Returns averaged velocity data grouped by load
   */
  async getHistoricalVelocityData(
    lift: string,
    limit: number = 20,
  ): Promise<{ load: number; velocity: number }[]> {
    if (!(await this.ensureReady())) return [];

    const rows = (await this.db.getAllAsync(
      `SELECT s.load_kg, s.avg_velocity
       FROM sets s
       WHERE s.lift = ?
         AND s.avg_velocity IS NOT NULL
         AND s.is_warmup = 0
       ORDER BY s.timestamp DESC
       LIMIT ?`,
      [lift, limit * 2], // Get more to allow for filtering
    )) as { load_kg: number; avg_velocity: number }[];

    // Group by load and average velocities
    const loadMap = new Map<number, number[]>();
    for (const row of rows) {
      const velocities = loadMap.get(row.load_kg) ?? [];
      velocities.push(row.avg_velocity);
      loadMap.set(row.load_kg, velocities);
    }

    return Array.from(loadMap.entries())
      .map(([load, velocities]) => ({
        load,
        velocity: velocities.reduce((a, b) => a + b, 0) / velocities.length,
      }))
      .sort((a, b) => a.load - b.load)
      .slice(0, limit);
  }

  /**
   * Update exercise MVT value
   */
  async updateExerciseMVT(exerciseId: string, mvt: number): Promise<void> {
    if (!(await this.ensureReady())) return;

    await this.db.runAsync("UPDATE exercises SET mvt = ? WHERE id = ?", [
      mvt,
      exerciseId,
    ]);
  }

  /**
   * Database connectionを閉じる
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      console.log("Database closed");
    }
  }
}

// Export singleton instance
export default new DatabaseService();
