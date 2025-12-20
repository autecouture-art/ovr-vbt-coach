import sqlite3
import os

DB_FILE = "training_v2.db"

def init_db():
    """新しいデータベース構造を初期化する"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # ---------------------------------------------------------
    # 1. Exercises Table (種目マスタ & プロファイル)
    # ---------------------------------------------------------
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,           -- 種目名 (Bench Press, etc.)
        category TEXT,                       -- push, pull, legs, etc.
        current_e1rm REAL,                   -- 現在の推定1RM (kg)
        lvp_slope REAL,                      -- LVP傾き (AI分析用)
        lvp_intercept REAL,                  -- LVP切片 (AI分析用)
        vmax REAL,                           -- 最軽重量での最大速度 (m/s)
        one_vrm REAL,                        -- 1RM時の速度閾値 (m/s)
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # ---------------------------------------------------------
    # 2. Sessions Table (トレーニングセッション)
    # ---------------------------------------------------------
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,            -- 開始時刻 (ISO8601)
        end_time TEXT,                       -- 終了時刻
        body_weight REAL,                    -- その日の体重
        readiness_score INTEGER,             -- その日の調子 (1-10)
        notes TEXT,                          -- セッション全体のメモ
        status TEXT DEFAULT 'in_progress'    -- in_progress, completed
    )
    ''')

    # ---------------------------------------------------------
    # 3. Sets Table (セット単位の管理 - スーパーセット/ドロップ対応)
    # ---------------------------------------------------------
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        set_index INTEGER NOT NULL,          -- そのセッション内での通し番号
        
        weight_kg REAL NOT NULL,             -- 重量
        target_reps INTEGER,                 -- 目標レップ数
        actual_reps INTEGER,                 -- 完了レップ数
        rpe REAL,                            -- RPE (6.0 - 10.0)
        
        set_type TEXT DEFAULT 'normal',      -- normal, amrap, drop, superset_a, superset_b
        target_velocity_zone TEXT,           -- 目標速度帯 (Speed, Power, Hypertrophy, Strength)
        
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    )
    ''')

    # ---------------------------------------------------------
    # 4. Reps Table (レップごとの詳細データ - VBT/Manual混在)
    # ---------------------------------------------------------
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS reps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        set_id INTEGER NOT NULL,
        rep_index INTEGER NOT NULL,          -- セット内でのレップ番号
        
        -- VBT Data (Manual入力時はNULL許容)
        mean_velocity REAL,                  -- 平均速度 (m/s)
        peak_velocity REAL,                  -- 最高速度 (m/s)
        mean_power REAL,                     -- 平均パワー (W)
        peak_power REAL,                     -- 最高パワー (W)
        rom REAL,                            -- 可動域 (cm)
        time_to_peak REAL,                   -- ピーク到達時間 (s)
        rep_duration REAL,                   -- 挙上時間 (s)
        
        -- Validity & Source
        is_valid BOOLEAN DEFAULT 1,          -- 外れ値除外フラグ
        data_source TEXT DEFAULT 'vbt',      -- vbt, manual
        
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (set_id) REFERENCES sets(id)
    )
    ''')

    # ---------------------------------------------------------
    # 5. Personal Records Table (PR通知用)
    # ---------------------------------------------------------
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS personal_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_id INTEGER NOT NULL,
        metric_type TEXT NOT NULL,           -- e1rm, max_velocity, volume
        value REAL NOT NULL,                 -- 記録値
        weight_kg REAL,                      -- その時の重量 (速度PRの場合)
        achieved_at TEXT NOT NULL,           -- 達成日時
        set_id INTEGER,                      -- どのセットで出したか
        
        FOREIGN KEY (exercise_id) REFERENCES exercises(id),
        FOREIGN KEY (set_id) REFERENCES sets(id)
    )
    ''')

    conn.commit()
    conn.close()
    print(f"Database initialized: {DB_FILE}")

if __name__ == "__main__":
    init_db()



