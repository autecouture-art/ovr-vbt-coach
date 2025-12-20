"""
OVR Velocity Excel データ読み込みモジュール
デバイスからエクスポートされた Excel ファイルを解析
"""
import pandas as pd
from pathlib import Path
from typing import Optional, List
import sys


def read_excel_file(file_path: str) -> Optional[pd.DataFrame]:
    """
    Excel ファイルを読み込む
    
    Args:
        file_path: Excel ファイルのパス
        
    Returns:
        DataFrame または None
    """
    path = Path(file_path)
    
    if not path.exists():
        print(f"[EXCEL] エラー: ファイルが見つかりません: {file_path}")
        return None
    
    if not path.suffix.lower() in ['.xlsx', '.xls']:
        print(f"[EXCEL] エラー: Excel ファイルではありません: {file_path}")
        return None
    
    try:
        # まずすべてのシートを確認
        xl = pd.ExcelFile(file_path)
        print(f"[EXCEL] ファイル読み込み: {path.name}")
        print(f"[EXCEL] シート一覧: {xl.sheet_names}")
        
        # 最初のシートを読み込む
        df = pd.read_excel(file_path, sheet_name=0)
        print(f"[EXCEL] データ行数: {len(df)}")
        print(f"[EXCEL] カラム: {list(df.columns)}")
        
        return df
        
    except Exception as e:
        print(f"[EXCEL] 読み込みエラー: {str(e)}")
        return None


def analyze_excel_data(df: pd.DataFrame) -> dict:
    """
    Excel データを分析
    
    Args:
        df: DataFrame
        
    Returns:
        分析結果の辞書
    """
    result = {
        "rows": len(df),
        "columns": list(df.columns),
        "dtypes": df.dtypes.to_dict(),
        "summary": {}
    }
    
    # 数値カラムの統計
    numeric_cols = df.select_dtypes(include=['number']).columns
    for col in numeric_cols:
        result["summary"][col] = {
            "min": df[col].min(),
            "max": df[col].max(),
            "mean": df[col].mean(),
            "count": df[col].count(),
        }
    
    return result


def display_excel_info(file_path: str):
    """
    Excel ファイルの情報を表示
    
    Args:
        file_path: Excel ファイルのパス
    """
    df = read_excel_file(file_path)
    
    if df is None:
        return
    
    print()
    print("=" * 60)
    print("Excel ファイル情報")
    print("=" * 60)
    
    # カラム情報
    print("\n【カラム一覧】")
    for i, col in enumerate(df.columns):
        dtype = df[col].dtype
        print(f"  {i}: {col} ({dtype})")
    
    # 最初の数行を表示
    print("\n【データプレビュー（最初の5行）】")
    print(df.head().to_string())
    
    # 数値カラムの統計
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        print("\n【数値カラムの統計】")
        print(df[numeric_cols].describe().to_string())
    
    return df


def compare_with_ble_data(excel_df: pd.DataFrame, ble_log_path: str):
    """
    Excel データと BLE ログを比較
    
    Args:
        excel_df: Excel から読み込んだ DataFrame
        ble_log_path: BLE ログファイルのパス
    """
    from parser import parse_hex_string
    
    # BLE ログを読み込む
    ble_path = Path(ble_log_path)
    if not ble_path.exists():
        print(f"[COMPARE] エラー: BLE ログが見つかりません: {ble_log_path}")
        return
    
    ble_data = []
    with open(ble_path, 'r') as f:
        for line in f:
            parts = line.strip().split(' ', 2)
            if len(parts) >= 3:
                hex_str = parts[2]
                parsed = parse_hex_string(hex_str)
                if parsed:
                    ble_data.append({
                        "timestamp": f"{parts[0]} {parts[1]}",
                        "velocity_ms": parsed.velocity_ms,
                        "power_aw": parsed.power_aw,
                        "raw": parsed.to_dict()["raw_fields"]
                    })
    
    print()
    print("=" * 60)
    print("BLE データと Excel データの比較")
    print("=" * 60)
    print(f"\nBLE データ数: {len(ble_data)}")
    print(f"Excel データ数: {len(excel_df)}")
    
    if len(ble_data) > 0:
        # BLE データの統計
        velocities = [d["velocity_ms"] for d in ble_data]
        powers = [d["power_aw"] for d in ble_data]
        
        print(f"\n【BLE データの統計】")
        print(f"  Velocity 平均: {sum(velocities)/len(velocities):.2f} m/s")
        print(f"  Power 平均: {sum(powers)/len(powers):.0f} aW")


def list_excel_files(directory: str = ".") -> List[Path]:
    """
    ディレクトリ内の Excel ファイルを一覧表示
    
    Args:
        directory: 検索するディレクトリ
        
    Returns:
        Excel ファイルのパスリスト
    """
    dir_path = Path(directory)
    excel_files = list(dir_path.glob("*.xlsx")) + list(dir_path.glob("*.xls"))
    
    if len(excel_files) == 0:
        print(f"[EXCEL] Excel ファイルが見つかりません: {directory}")
    else:
        print(f"[EXCEL] 見つかった Excel ファイル:")
        for i, f in enumerate(excel_files, 1):
            print(f"  {i}. {f.name}")
    
    return excel_files


# メイン実行
if __name__ == "__main__":
    print("=" * 60)
    print("OVR Velocity Excel データリーダー")
    print("=" * 60)
    
    if len(sys.argv) > 1:
        # 引数でファイルパスが指定された場合
        file_path = sys.argv[1]
        display_excel_info(file_path)
    else:
        # 引数がない場合は、カレントディレクトリの Excel ファイルを一覧表示
        print("\n使い方:")
        print("  python excel_reader.py <Excelファイルパス>")
        print()
        
        # カレントディレクトリの Excel ファイルを探す
        excel_files = list_excel_files(".")
        
        if len(excel_files) > 0:
            print("\n最初のファイルを読み込みます...")
            display_excel_info(str(excel_files[0]))






