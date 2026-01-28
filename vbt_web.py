"""
OVR VBT Coach - Web版アプリケーション
FlaskベースのWebインターフェース
"""
from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit
from datetime import datetime, timedelta
import json
import threading
import asyncio

from vbt_core import TrainingDatabase, OneRMCalculator, PersonalRecordManager, AICoach
from ble_client import OVRVelocityClient, DISPLAY_MODE_GUI
from parser import VelocityData

app = Flask(__name__, static_folder='static')
app.config['SECRET_KEY'] = 'ovr-vbt-coach-secret-key-2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# データベースインスタンス
db = TrainingDatabase()
pr_manager = PersonalRecordManager(db)
ai_coach = AICoach(db)

# BLE関連（サーバー側でBLE接続を管理）
ble_client = None
ble_thread = None
ble_loop = None
ble_running = False


@app.route('/')
def index():
    """メインページ"""
    return render_template('index.html')


@app.route('/static/manifest.json')
def manifest():
    """PWAマニフェスト"""
    return app.send_static_file('manifest.json')


@app.route('/static/service-worker.js')
def service_worker():
    """Service Worker"""
    return app.send_static_file('service-worker.js'), 200, {'Content-Type': 'application/javascript'}


@app.route('/api/session/start', methods=['POST'])
def start_session():
    """セッション開始"""
    data = request.json
    body_weight = data.get('body_weight', 75.0)
    readiness = data.get('readiness', 5)
    notes = data.get('notes', '')
    
    try:
        session_id = db.start_session(
            body_weight=float(body_weight),
            readiness=int(readiness),
            notes=notes
        )
        
        # 週次データ取得
        this_week = db.get_weekly_volume(0)
        last_week = db.get_weekly_volume(1)
        
        # AIアドバイス
        advice = ai_coach.get_session_advice(
            int(readiness),
            this_week['total_volume'],
            last_week['total_volume']
        )
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'advice': advice,
            'this_week': this_week,
            'last_week': last_week
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/session/end', methods=['POST'])
def end_session():
    """セッション終了"""
    data = request.json
    notes = data.get('notes', 'Session ended')
    
    try:
        db.end_session(notes=notes)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/session/status', methods=['GET'])
def get_session_status():
    """現在のセッション状態を取得"""
    session_id = db.current_session_id
    
    if not session_id:
        return jsonify({
            'active': False,
            'session_id': None
        })
    
    # 今日のボリュームとセット数
    volume = db.get_today_volume()
    sets = db.get_today_sets()
    
    return jsonify({
        'active': True,
        'session_id': session_id,
        'volume': volume,
        'set_count': len(sets)
    })


@app.route('/api/set/start', methods=['POST'])
def start_set():
    """セット開始"""
    data = request.json
    exercise = data.get('exercise', 'Bench Press')
    weight = data.get('weight', 60.0)
    set_type = data.get('set_type', 'normal')
    target_reps = data.get('target_reps')
    
    try:
        set_id = db.start_set(
            exercise_name=exercise,
            weight=float(weight),
            set_type=set_type,
            target_reps=int(target_reps) if target_reps else None
        )
        
        return jsonify({
            'success': True,
            'set_id': set_id
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/set/finish', methods=['POST'])
def finish_set():
    """セット終了"""
    data = request.json
    exercise = data.get('exercise', 'Bench Press')
    
    try:
        # LVP保存
        lvp_data = db.get_session_data_for_1rm(exercise)
        if len(lvp_data) >= 2:
            lvp = OneRMCalculator.calculate_lvp(lvp_data)
            if lvp:
                slope, intercept = lvp
                e1rm = OneRMCalculator.estimate_1rm(lvp_data, exercise)
                db.update_exercise_lvp(exercise, slope, intercept, e1rm)
        
        db.current_set_id = None
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/rep/manual', methods=['POST'])
def add_manual_rep():
    """手入力でレップを追加（Non-VBT）"""
    data = request.json
    reps = data.get('reps', 10)
    rpe = data.get('rpe', 8.0)
    note = data.get('note', '')
    
    try:
        # セットが開始されていない場合は開始
        if not db.current_set_id:
            exercise = data.get('exercise', 'Bench Press')
            weight = data.get('weight', 60.0)
            db.start_set(exercise, weight, 'normal')
        
        # レップを追加（速度0で記録）
        for i in range(int(reps)):
            db.add_rep(
                velocity=0.0,
                power=0.0,
                peak_power=0.0,
                rom=0.0,
                time_to_peak=0.0,
                data_source='manual'
            )
        
        # セット情報を更新
        db.update_set_info(rpe=float(rpe))
        
        # セット終了
        exercise = data.get('exercise', 'Bench Press')
        lvp_data = db.get_session_data_for_1rm(exercise)
        if len(lvp_data) >= 2:
            lvp = OneRMCalculator.calculate_lvp(lvp_data)
            if lvp:
                slope, intercept = lvp
                e1rm = OneRMCalculator.estimate_1rm(lvp_data, exercise)
                db.update_exercise_lvp(exercise, slope, intercept, e1rm)
        
        db.current_set_id = None
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/today/sets', methods=['GET'])
def get_today_sets():
    """今日のセット一覧を取得"""
    try:
        sets = db.get_today_sets()
        volume = db.get_today_volume()
        
        return jsonify({
            'success': True,
            'sets': sets,
            'volume': volume
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/history', methods=['GET'])
def get_history():
    """履歴を取得"""
    limit = request.args.get('limit', 30, type=int)
    exercise = request.args.get('exercise', None)
    
    try:
        if exercise:
            history = db.get_exercise_history(exercise, limit=limit)
            return jsonify({
                'success': True,
                'type': 'exercise',
                'exercise': exercise,
                'history': history
            })
        else:
            sessions = db.get_all_sessions(limit=limit)
            return jsonify({
                'success': True,
                'type': 'sessions',
                'sessions': sessions
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/weekly', methods=['GET'])
def get_weekly():
    """週次サマリーを取得"""
    weeks_ago = request.args.get('weeks_ago', 0, type=int)
    
    try:
        this_week = db.get_weekly_volume(0)
        last_week = db.get_weekly_volume(1)
        recent_prs = db.get_recent_prs(days=7)
        
        return jsonify({
            'success': True,
            'this_week': this_week,
            'last_week': last_week,
            'recent_prs': recent_prs
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/prs', methods=['GET'])
def get_prs():
    """PR一覧を取得"""
    days = request.args.get('days', 7, type=int)
    
    try:
        prs = db.get_recent_prs(days=days)
        return jsonify({
            'success': True,
            'prs': prs
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@app.route('/api/lvp', methods=['GET'])
def get_lvp():
    """LVPグラフデータを取得"""
    exercise = request.args.get('exercise', 'Bench Press')
    
    try:
        data = db.get_session_data_for_1rm(exercise)
        
        if len(data) < 2:
            return jsonify({
                'success': True,
                'has_data': False,
                'data': []
            })
        
        weights = [d[0] for d in data]
        velocities = [d[1] for d in data]
        
        # LVP計算
        lvp = OneRMCalculator.calculate_lvp(data)
        e1rm = OneRMCalculator.estimate_1rm(data, exercise)
        
        # LVP線のデータポイント
        lvp_line = []
        if lvp:
            slope, intercept = lvp
            mvt = OneRMCalculator.MVT_TABLE.get(exercise, 0.25)
            
            if slope < 0 and e1rm:
                # グラフ範囲
                min_weight = min(weights) * 0.9
                max_weight = e1rm * 1.1
                
                # 線のデータポイント
                for w in range(int(min_weight), int(max_weight), 5):
                    v = slope * w + intercept
                    if v > 0:
                        lvp_line.append({'weight': w, 'velocity': v})
        
        return jsonify({
            'success': True,
            'has_data': True,
            'exercise': exercise,
            'data_points': [{'weight': w, 'velocity': v} for w, v in zip(weights, velocities)],
            'lvp_line': lvp_line,
            'e1rm': e1rm,
            'mvt': OneRMCalculator.MVT_TABLE.get(exercise, 0.25)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


# WebSocket接続（将来のBLE連携用）
@socketio.on('connect')
def handle_connect():
    """WebSocket接続"""
    print(f'[WebSocket] クライアント接続: {request.sid}')
    emit('connected', {'status': 'ok'})


@socketio.on('disconnect')
def handle_disconnect():
    """WebSocket切断"""
    print(f'[WebSocket] クライアント切断: {request.sid}')


def on_ble_data_received(data: VelocityData):
    """BLEデータ受信時のコールバック"""
    # データベースに保存
    if db.current_set_id:
        db.add_rep(
            velocity=data.avg_velocity_ms,
            power=data.avg_power_w,
            peak_power=data.peak_power_w,
            rom=data.rom_cm,
            time_to_peak=data.time_to_peak_s,
            data_source='vbt'
        )
    
    # WebSocket経由で全クライアントにブロードキャスト
    socketio.emit('velocity_data', {
        'velocity': data.avg_velocity_ms,
        'power': data.avg_power_w,
        'peak_power': data.peak_power_w,
        'rom': data.rom_cm,
        'time_to_peak': data.time_to_peak_s,
        'timestamp': datetime.now().isoformat()
    })


def run_ble_loop():
    """BLE接続ループ（別スレッドで実行）"""
    global ble_loop, ble_client, ble_running
    
    ble_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(ble_loop)
    
    ble_client = OVRVelocityClient(
        receive_duration=999999,  # 無限に受信
        display_mode=DISPLAY_MODE_GUI,
        on_data_received=on_ble_data_received
    )
    
    try:
        ble_loop.run_until_complete(ble_client.run())
    except Exception as e:
        print(f"[BLE] エラー: {e}")
        socketio.emit('ble_status', {
            'status': 'error',
            'message': str(e)
        })
        ble_running = False
    finally:
        ble_loop.close()


@socketio.on('ble_start')
def handle_ble_start():
    """BLE接続開始リクエスト"""
    global ble_thread, ble_running
    
    if ble_running:
        emit('ble_status', {'status': 'already_running', 'message': '既に接続中です'})
        return
    
    try:
        ble_running = True
        ble_thread = threading.Thread(target=run_ble_loop, daemon=True)
        ble_thread.start()
        
        emit('ble_status', {
            'status': 'connecting',
            'message': 'BLEデバイスをスキャン中...'
        })
        
        # 接続状態を定期的に確認
        def check_connection():
            if ble_running and ble_client and ble_client.client and ble_client.client.is_connected:
                socketio.emit('ble_status', {
                    'status': 'connected',
                    'message': 'BLEデバイスに接続しました'
                })
            elif ble_running:
                socketio.emit('ble_status', {
                    'status': 'scanning',
                    'message': 'デバイスをスキャン中...'
                })
        
        socketio.start_background_task(check_connection)
        
    except Exception as e:
        ble_running = False
        emit('ble_status', {
            'status': 'error',
            'message': f'接続エラー: {str(e)}'
        })


@socketio.on('ble_stop')
def handle_ble_stop():
    """BLE接続停止リクエスト"""
    global ble_client, ble_running
    
    try:
        ble_running = False
        
        if ble_client and ble_loop:
            # 非同期タスクをキャンセル
            if ble_loop.is_running():
                for task in asyncio.all_tasks(ble_loop):
                    task.cancel()
        
        emit('ble_status', {
            'status': 'stopped',
            'message': 'BLE接続を停止しました'
        })
    except Exception as e:
        emit('ble_status', {
            'status': 'error',
            'message': f'停止エラー: {str(e)}'
        })


def broadcast_velocity_data(data):
    """速度データを全クライアントにブロードキャスト"""
    socketio.emit('velocity_data', {
        'velocity': data.avg_velocity_ms,
        'power': data.avg_power_w,
        'peak_power': data.peak_power_w,
        'rom': data.rom_cm,
        'time_to_peak': data.time_to_peak_s,
        'timestamp': datetime.now().isoformat()
    })


if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    
    print("=" * 60)
    print("OVR VBT Coach - Web版")
    print("=" * 60)
    print("サーバー起動中...")
    print(f"ブラウザで http://localhost:{port} にアクセスしてください")
    print("=" * 60)
    
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)

