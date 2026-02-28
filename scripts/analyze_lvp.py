#!/usr/bin/env python3
"""
OVR Export Data LVP解析スクリプト

OVR_Export_Data.xlsx を読み込み、種目ごとのLoad-Velocity Profileを算出します。
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score
from datetime import datetime
import json
from pathlib import Path
from typing import Dict, List, Tuple


def load_excel_data(file_path: str) -> pd.DataFrame:
    """Excelファイルを読み込む"""
    try:
        df = pd.read_excel(file_path)
        print(f"✓ データ読み込み完了: {len(df)} 行")
        return df
    except FileNotFoundError:
        print(f"✗ エラー: ファイルが見つかりません - {file_path}")
        print(f"  カレントディレクトリ: {Path.cwd()}")
        return None
    except Exception as e:
        print(f"✗ エラー: {e}")
        return None


def clean_exercise_name(name: str) -> str:
    """種目名を正規化（空白・大文字小文字の統一）"""
    if pd.isna(name):
        return "Unknown"
    return str(name).strip()


def filter_sufficient_data(df: pd.DataFrame, min_sets: int = 3) -> pd.DataFrame:
    """
    十分なデータ量がある種目のみを抽出

    Args:
        df: 生データ
        min_sets: 最低限必要なセット数（デフォルト: 3セット = 異なる3つの負荷）
    """
    # 種目ごとのデータ数を集計
    exercise_counts = (
        df.groupby("Exercise")
        .agg(
            unique_loads=("Load (kg)", lambda x: x.nunique()),
            total_reps=("Rep", "count"),
        )
        .reset_index()
    )

    # フィルタ条件: 異なる負荷が3種類以上 かつ 総レップ数が5以上
    sufficient = exercise_counts[
        (exercise_counts["unique_loads"] >= min_sets)
        & (exercise_counts["total_reps"] >= 5)
    ]["Exercise"]

    filtered = df[df["Exercise"].isin(sufficient)].copy()
    filtered["Exercise"] = filtered["Exercise"].apply(clean_exercise_name)

    return filtered, exercise_counts


def calculate_lvp(
    exercise_df: pd.DataFrame,
) -> Tuple[Dict | None, pd.DataFrame | None]:
    """
    単一種目のLVPを算出

    Returns:
        (LVPデータ, 解析用DataFrame)
    """

    # 種目名を取得
    exercise_name = exercise_df["Exercise"].iloc[0]

    # セットごとの平均速度を集計（同じ負荷の平均をとる）
    set_data = (
        exercise_df.groupby(["Load (kg)", "Set"])[["Mean V (m/s)", "Peak V (m/s)"]]
        .mean()
        .reset_index()
    )

    # 負荷ごとの平均速度（同じ負荷のセットを平均）
    load_velocity = (
        set_data.groupby("Load (kg)")
        .agg(
            mean_velocity=("Mean V (m/s)", "mean"),
            peak_velocity=("Peak V (m/s)", "mean"),
            n_sets=("Set", "count"),
        )
        .reset_index()
        .sort_values("Load (kg)")
    )

    # データ数チェック
    if len(load_velocity) < 3:
        return None, None

    X = load_velocity[["Load (kg)"]].values
    y = load_velocity["mean_velocity"].values

    # 線形回帰
    model = LinearRegression()
    model.fit(X, y)

    # 予測値とR²
    y_pred = model.predict(X)
    r2 = r2_score(y, y_pred)

    # Vmax（0kg時の推定速度）
    vmax = model.predict([[0]])[0]

    # V1RM（速度0.15-0.20m/s時の負荷を推定し、その時の速度を使用）
    # V1RMの一般的な速度は0.15-0.20m/sと言われている
    # ここでは0.17m/sを1RM時の代表速度として使用
    v1rm_target = 0.17

    # 0.17m/sとなる負荷を逆算
    if abs(model.coef_[0]) > 1e-6:
        load_at_v1rm = (v1rm_target - model.intercept_) / model.coef_[0]
        v1rm = v1rm_target
    else:
        # 傾きがほぼ0の場合は計算不可
        load_at_v1rm = np.nan
        v1rm = np.nan

    lvp_data = {
        "lift": exercise_name,
        "vmax": round(vmax, 3),
        "v1rm": round(v1rm, 3),
        "slope": round(model.coef_[0], 4),
        "intercept": round(model.intercept_, 3),
        "r_squared": round(r2, 3),
        "last_updated": datetime.now().isoformat(),
        # 追加情報
        "data_points": len(load_velocity),
        "load_range": {
            "min_kg": float(load_velocity["Load (kg)"].min()),
            "max_kg": float(load_velocity["Load (kg)"].max()),
        },
        "velocity_range": {
            "min_m_s": float(load_velocity["mean_velocity"].min()),
            "max_m_s": float(load_velocity["mean_velocity"].max()),
        },
        "estimated_1rm_kg": round(load_at_v1rm, 1) if not np.isnan(load_at_v1rm) else None,
    }

    return lvp_data, load_velocity


def analyze_all_exercises(
    df: pd.DataFrame,
) -> Tuple[List[Dict], pd.DataFrame, Dict]:
    """
    全種目のLVPを算出

    Returns:
        (LVPデータリスト, 種目別集計表, 解析サマリー)
    """
    filtered_df, exercise_counts = filter_sufficient_data(df)

    if len(filtered_df) == 0:
        print("✗ 警告: 十分なデータがある種目がありません")
        return [], pd.DataFrame(), {}

    lvp_results = []
    summary = {
        "total_exercises": len(filtered_df["Exercise"].unique()),
        "analyzed_exercises": 0,
        "skipped_exercises": 0,
        "analysis_timestamp": datetime.now().isoformat(),
    }

    for exercise in filtered_df["Exercise"].unique():
        exercise_df = filtered_df[filtered_df["Exercise"] == exercise]

        lvp_data, load_velocity = calculate_lvp(exercise_df)

        if lvp_data:
            lvp_results.append(lvp_data)
            summary["analyzed_exercises"] += 1
        else:
            summary["skipped_exercises"] += 1

    # R²でソート（高い順）
    lvp_results.sort(key=lambda x: x["r_squared"], reverse=True)

    return lvp_results, exercise_counts, summary


def generate_initial_data_ts(lvp_results: List[Dict]) -> str:
    """
    LVP解析結果をTypeScript形式で出力（アプリ初期データ用）
    """
    timestamp = datetime.now().isoformat()

    lines = [
        "// ========================================",
        "// LVP Initial Data",
        "// Generated from OVR Export Data",
        f"// Generated: {timestamp}",
        "// ========================================",
        "",
        "import { LVPData } from './types';",
        "",
        "export const INITIAL_LVP_DATA: LVPData[] = [",
    ]

    for lvp in lvp_results:
        lines.extend([
            "  {",
            f"    lift: '{lvp['lift']}',",
            f"    vmax: {lvp['vmax']},",
            f"    v1rm: {lvp['v1rm']},",
            f"    slope: {lvp['slope']},",
            f"    intercept: {lvp['intercept']},",
            f"    r_squared: {lvp['r_squared']},",
            f"    last_updated: '{lvp['last_updated']}'",
            "  },"
        ])

    lines.extend([
        ");",
        "",
        "// ========================================",
        "// Exercise Categories (based on analyzed data)",
        "// ========================================",
        "",
        "export const INITIAL_EXERCISES = [",
    ])

    for lvp in lvp_results:
        # 種目名からカテゴリを推測
        name_lower = lvp['lift'].lower()
        if 'bench' in name_lower or 'press' in name_lower:
            category = 'bench'
        elif 'squat' in name_lower:
            category = 'squat'
        elif 'deadlift' in name_lower or 'dead' in name_lower:
            category = 'deadlift'
        elif 'pull' in name_lower or 'row' in name_lower:
            category = 'pull'
        else:
            category = 'accessory'

        lines.extend([
            "  {",
            f"    id: '{lvp['lift'].lower().replace(' ', '_')}',",
            f"    name: '{lvp['lift']}',",
            f"    category: '{category}',",
            f"    has_lvp: true,",
            "  },"
        ])

    lines.extend([
        ");",
        "",
    ])

    return "\n".join(lines)


def print_summary(lvp_results: List[Dict], exercise_counts: pd.DataFrame, summary: Dict):
    """解析サマリーを表示"""

    print("\n" + "=" * 60)
    print("LVP 解析サマリー")
    print("=" * 60)

    print(f"\n📊 全体統計:")
    print(f"  解析対象種目数: {summary.get('total_exercises', 0)}")
    print(f"  LVP算出成功: {summary.get('analyzed_exercises', 0)}")
    print(f"  スキップ数: {summary.get('skipped_exercises', 0)}")

    if lvp_results:
        print(f"\n🏅 トップ種目（R²順）:")
        for i, lvp in enumerate(lvp_results[:10], 1):
            print(
                f"  {i}. {lvp['lift']}: "
                f"R²={lvp['r_squared']:.3f}, "
                f"Vmax={lvp['vmax']:.2f}m/s, "
                f"推定1RM={lvp.get('estimated_1rm_kg', 'N/A')}kg"
            )

    print("\n📋 種目別データ数:")
    if not exercise_counts.empty:
        for _, row in exercise_counts.head(15).iterrows():
            print(
                f"  {row['Exercise']}: "
                f"{row['unique_loads']}負荷, "
                f"{row['total_reps']}レップ"
            )

    print("\n" + "=" * 60)


def main():
    """メイン処理"""

    # Excelファイルのパス
    # カレントディレクトリまたは親ディレクトリを検索
    possible_paths = [
        "OVR_Export_Data 2.xlsx",
        "OVR_Export_Data.xlsx",
        "../OVR_Export_Data 2.xlsx",
        "../OVR_Export_Data.xlsx",
        "../../OVR_Export_Data 2.xlsx",
        "../../OVR_Export_Data.xlsx",
    ]

    file_path = None
    for path in possible_paths:
        if Path(path).exists():
            file_path = path
            break

    if not file_path:
        print("=" * 60)
        print("LVP 解析スクリプト")
        print("=" * 60)
        print("\n✗ Excelファイルが見つかりません")
        print("\n期待されるファイル名:")
        for p in possible_paths:
            print(f"  - {p}")
        print(f"\nカレントディレクトリ: {Path.cwd()}")
        print("\nファイルをカレントディレクトリに配置してください。")
        return

    # データ読み込み
    print("=" * 60)
    print("LVP 解析スクリプト")
    print("=" * 60)
    print(f"\n📂 ファイル: {file_path}")

    df = load_excel_data(file_path)
    if df is None:
        return

    # カラム確認
    print(f"\n📋 カラム一覧: {list(df.columns)}")

    # カラム名のマッピング（異なるフォーマットに対応）
    column_mapping = {
        "Weight (kg/cm)": "load_kg",
        "Avg Velocity": "mean_velocity",
        "Max Velocity": "peak_velocity",
        "ROM": "rom_cm",
        "Avg Power": "mean_power_w",
        "Max Power": "peak_power_w",
        "Exercise": "exercise",
        "Set Number": "set",
        "Rep Number": "rep",
    }

    # カラム名を正規化
    df = df.rename(columns=column_mapping)

    # 必要なカラムが存在するか確認
    required_cols = ["exercise", "load_kg", "mean_velocity"]
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        print(f"\n✗ 必要なカラムが見つかりません: {missing_cols}")
        print(f"  利用可能なカラム: {list(df.columns)}")
        return

    # Exerciseカラムを"Exercise"に戻す（既存コードとの互換性）
    df = df.rename(columns={"exercise": "Exercise"})
    df = df.rename(columns={"load_kg": "Load (kg)"})
    df = df.rename(columns={"mean_velocity": "Mean V (m/s)"})
    df = df.rename(columns={"peak_velocity": "Peak V (m/s)"})
    df = df.rename(columns={"set": "Set"})
    df = df.rename(columns={"rep": "Rep"})

    # 解析実行
    lvp_results, exercise_counts, summary = analyze_all_exercises(df)

    # サマリー表示
    print_summary(lvp_results, exercise_counts, summary)

    # ファイル出力
    if lvp_results:
        # TypeScriptファイル
        ts_content = generate_initial_data_ts(lvp_results)
        ts_path = Path("src/data/initialLVPData.ts")
        ts_path.parent.mkdir(parents=True, exist_ok=True)
        ts_path.write_text(ts_content, encoding="utf-8")
        print(f"\n✓ TypeScriptファイル出力: {ts_path}")

        # JSONファイル（生データ）
        json_path = Path("src/data/initialLVPData.json")
        json_path.write_text(
            json.dumps(lvp_results, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"✓ JSONファイル出力: {json_path}")

        # サマリーテキスト
        summary_path = Path("LVP_ANALYSIS_SUMMARY.md")
        summary_lines = [
            "# LVP 解析サマリー",
            f"\n生成日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"\n## 全体統計",
            f"- 解析対象種目数: {summary.get('total_exercises', 0)}",
            f"- LVP算出成功: {summary.get('analyzed_exercises', 0)}",
            f"- スキップ数: {summary.get('skipped_exercises', 0)}",
            f"\n## トップ種目（R²順）",
        ]

        for i, lvp in enumerate(lvp_results[:10], 1):
            summary_lines.extend([
                f"\n### {i}. {lvp['lift']}",
                f"- **R²**: {lvp['r_squared']:.3f}",
                f"- **傾き**: {lvp['slope']:.4f}",
                f"- **切片**: {lvp['intercept']:.3f}",
                f"- **Vmax** (0kg時の推定速度): {lvp['vmax']:.2f} m/s",
                f"- **V1RM**: {lvp['v1rm']:.3f} m/s",
                f"- **推定1RM**: {lvp.get('estimated_1rm_kg', 'N/A')} kg",
                f"- **データポイント数**: {lvp['data_points']}",
                f"- **負荷範囲**: {lvp['load_range']['min_kg']:.1f} - {lvp['load_range']['max_kg']:.1f} kg",
                f"- **速度範囲**: {lvp['velocity_range']['min_m_s']:.2f} - {lvp['velocity_range']['max_m_s']:.2f} m/s",
            ])

        summary_path.write_text("\n".join(summary_lines), encoding="utf-8")
        print(f"✓ サマリーファイル出力: {summary_path}")
    else:
        print("\n✗ LVPデータが生成できませんでした")


if __name__ == "__main__":
    main()
