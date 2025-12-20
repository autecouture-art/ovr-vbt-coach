"""
OVR VBT Coach - GUI アプリケーション (v2.3 Final)
CustomTkinter を使用したメイン画面
全機能実装: セッションセットアップ、LVPグラフ、スーパーセット、履歴閲覧、週次サマリー、AIコーチ、カレンダー、音声入力
"""
import customtkinter as ctk
import asyncio
import threading
import sys
from datetime import datetime, timedelta
import time
import calendar
import re

# matplotlib 埋め込み用
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import matplotlib
matplotlib.use('TkAgg')

# 音声認識（オプション）
try:
    import speech_recognition as sr
    SPEECH_AVAILABLE = True
except ImportError:
    SPEECH_AVAILABLE = False
    print("[Warning] speech_recognition not installed. Voice input disabled.")

from ble_client import OVRVelocityClient, DISPLAY_MODE_GUI
from vbt_core import TrainingDatabase, OneRMCalculator, AudioCoach, VelocityLossManager, PersonalRecordManager, AICoach
from parser import VelocityData

# テーマ設定
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

# --- Dialogs ---

class SessionSetupDialog(ctk.CTkToplevel):
    """セッション開始時の設定ダイアログ"""
    def __init__(self, parent, callback):
        super().__init__(parent)
        self.callback = callback
        self.title("Session Setup")
        self.geometry("400x450")
        self.resizable(False, False)
        
        self.transient(parent)
        
        # Center dialog on screen
        self.update_idletasks()
        x = (self.winfo_screenwidth() // 2) - (400 // 2)
        y = (self.winfo_screenheight() // 2) - (450 // 2)
        self.geometry(f"400x450+{x}+{y}")
        
        # Grab focus after setup
        self.after(10, lambda: self.grab_set())
        self.after(20, lambda: self.focus())
        
        ctk.CTkLabel(self, text="Today's Session", font=ctk.CTkFont(size=24, weight="bold")).pack(pady=20)
        
        ctk.CTkLabel(self, text="Body Weight (kg):").pack(pady=(10, 0))
        self.weight_var = ctk.StringVar(value="75.0")
        ctk.CTkEntry(self, textvariable=self.weight_var, width=150).pack(pady=5)
        
        ctk.CTkLabel(self, text="How do you feel? (1-10):").pack(pady=(20, 0))
        self.readiness_var = ctk.IntVar(value=5)
        
        readiness_frame = ctk.CTkFrame(self, fg_color="transparent")
        readiness_frame.pack(pady=10)
        
        for i in range(1, 11):
            btn = ctk.CTkButton(readiness_frame, text=str(i), width=30, height=30,
                              command=lambda x=i: self.set_readiness(x))
            btn.pack(side="left", padx=2)
        
        self.readiness_label = ctk.CTkLabel(self, text="5 - Normal", font=ctk.CTkFont(size=16))
        self.readiness_label.pack(pady=5)
        
        ctk.CTkLabel(self, text="Notes (optional):").pack(pady=(20, 0))
        self.notes_var = ctk.StringVar()
        ctk.CTkEntry(self, textvariable=self.notes_var, width=300).pack(pady=5)
        
        ctk.CTkButton(self, text="Start Training!", command=self.on_start, 
                     fg_color="green", height=50, font=ctk.CTkFont(size=18, weight="bold")).pack(pady=30)
        
    def set_readiness(self, value):
        print(f"[DEBUG] set_readiness called with value: {value}")
        self.readiness_var.set(value)
        labels = {
            1: "1 - Terrible", 2: "2 - Very Bad", 3: "3 - Bad",
            4: "4 - Below Average", 5: "5 - Normal",
            6: "6 - Above Average", 7: "7 - Good", 8: "8 - Great",
            9: "9 - Excellent", 10: "10 - Peak!"
        }
        self.readiness_label.configure(text=labels.get(value, str(value)))
        print(f"[DEBUG] Readiness label updated to: {labels.get(value, str(value))}")
        
    def on_start(self):
        print("[DEBUG] on_start called - Start Training button clicked")
        try:
            body_weight = float(self.weight_var.get())
            readiness = self.readiness_var.get()
            notes = self.notes_var.get()
            print(f"[DEBUG] Session params - Weight: {body_weight}, Readiness: {readiness}, Notes: {notes}")
            self.callback(body_weight, readiness, notes)
            self.destroy()
        except ValueError as e:
            print(f"[DEBUG] ValueError in on_start: {e}")
            pass


class ManualEntryDialog(ctk.CTkToplevel):
    """手動入力用ダイアログ"""
    def __init__(self, parent, callback):
        super().__init__(parent)
        self.callback = callback
        self.title("Manual Entry")
        self.geometry("300x400")
        
        ctk.CTkLabel(self, text="Manual Entry", font=ctk.CTkFont(size=20, weight="bold")).pack(pady=20)
        
        self.reps_var = ctk.StringVar(value="10")
        ctk.CTkLabel(self, text="Reps:").pack()
        ctk.CTkEntry(self, textvariable=self.reps_var).pack(pady=5)
        
        self.rpe_var = ctk.StringVar(value="8")
        ctk.CTkLabel(self, text="RPE:").pack()
        ctk.CTkEntry(self, textvariable=self.rpe_var).pack(pady=5)
        
        self.note_var = ctk.StringVar()
        ctk.CTkLabel(self, text="Note:").pack()
        ctk.CTkEntry(self, textvariable=self.note_var).pack(pady=5)
        
        ctk.CTkButton(self, text="Save", command=self.on_save, fg_color="green").pack(pady=20)
        
    def on_save(self):
        try:
            reps = int(self.reps_var.get())
            rpe = float(self.rpe_var.get())
            note = self.note_var.get()
            self.callback(reps, rpe, note)
            self.destroy()
        except ValueError:
            print("Invalid input")


class CalendarWidget(ctk.CTkFrame):
    """カスタムカレンダーウィジェット"""
    def __init__(self, parent, on_date_select=None, session_dates=None):
        super().__init__(parent)
        self.on_date_select = on_date_select
        self.session_dates = session_dates or set()
        
        self.current_date = datetime.now()
        self.selected_date = None
        
        self._build_ui()
        
    def _build_ui(self):
        # Navigation
        nav_frame = ctk.CTkFrame(self, fg_color="transparent")
        nav_frame.pack(fill="x", pady=5)
        
        ctk.CTkButton(nav_frame, text="<", width=40, command=self.prev_month).pack(side="left", padx=5)
        self.month_label = ctk.CTkLabel(nav_frame, text="", font=ctk.CTkFont(size=16, weight="bold"))
        self.month_label.pack(side="left", expand=True)
        ctk.CTkButton(nav_frame, text=">", width=40, command=self.next_month).pack(side="right", padx=5)
        
        # Days header
        days_frame = ctk.CTkFrame(self)
        days_frame.pack(fill="x")
        for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]:
            ctk.CTkLabel(days_frame, text=day, width=40).pack(side="left", expand=True)
        
        # Calendar grid
        self.grid_frame = ctk.CTkFrame(self)
        self.grid_frame.pack(fill="both", expand=True)
        
        self._update_calendar()
        
    def _update_calendar(self):
        # Clear grid
        for widget in self.grid_frame.winfo_children():
            widget.destroy()
            
        year = self.current_date.year
        month = self.current_date.month
        
        self.month_label.configure(text=f"{calendar.month_name[month]} {year}")
        
        cal = calendar.Calendar(firstweekday=0)
        month_days = cal.monthdayscalendar(year, month)
        
        for week_idx, week in enumerate(month_days):
            for day_idx, day in enumerate(week):
                if day == 0:
                    btn = ctk.CTkLabel(self.grid_frame, text="", width=40, height=40)
                else:
                    date_str = f"{year}-{month:02d}-{day:02d}"
                    has_session = date_str in self.session_dates
                    
                    if has_session:
                        btn = ctk.CTkButton(self.grid_frame, text=str(day), width=40, height=40,
                                           fg_color="#27ae60", hover_color="#2ecc71",
                                           command=lambda d=date_str: self._on_click(d))
                    else:
                        btn = ctk.CTkButton(self.grid_frame, text=str(day), width=40, height=40,
                                           fg_color="transparent", hover_color="#3a3a3a",
                                           command=lambda d=date_str: self._on_click(d))
                        
                btn.grid(row=week_idx, column=day_idx, padx=2, pady=2)
                
    def _on_click(self, date_str):
        self.selected_date = date_str
        if self.on_date_select:
            self.on_date_select(date_str)
            
    def prev_month(self):
        if self.current_date.month == 1:
            self.current_date = self.current_date.replace(year=self.current_date.year - 1, month=12)
        else:
            self.current_date = self.current_date.replace(month=self.current_date.month - 1)
        self._update_calendar()
        
    def next_month(self):
        if self.current_date.month == 12:
            self.current_date = self.current_date.replace(year=self.current_date.year + 1, month=1)
        else:
            self.current_date = self.current_date.replace(month=self.current_date.month + 1)
        self._update_calendar()
        
    def set_session_dates(self, dates: set):
        self.session_dates = dates
        self._update_calendar()


class VoiceInputManager:
    """音声入力マネージャー"""
    def __init__(self, callback):
        self.callback = callback
        self.recognizer = sr.Recognizer() if SPEECH_AVAILABLE else None
        self.is_listening = False
        
    def start_listening(self):
        if not SPEECH_AVAILABLE or self.is_listening:
            return
            
        self.is_listening = True
        threading.Thread(target=self._listen, daemon=True).start()
        
    def _listen(self):
        try:
            with sr.Microphone() as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=5)
                
            text = self.recognizer.recognize_google(audio, language="ja-JP")
            self.callback(text)
        except sr.WaitTimeoutError:
            self.callback(None)
        except sr.UnknownValueError:
            self.callback(None)
        except Exception as e:
            print(f"[Voice] Error: {e}")
            self.callback(None)
        finally:
            self.is_listening = False
            
    def parse_command(self, text: str) -> dict:
        """音声コマンドを解析"""
        result = {"weight": None, "reps": None, "exercise": None}
        
        if not text:
            return result
            
        text = text.lower()
        
        # 重量の抽出 (例: "80キロ", "100kg")
        weight_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:キロ|kg|キログラム)', text)
        if weight_match:
            result["weight"] = float(weight_match.group(1))
            
        # レップ数の抽出 (例: "5レップ", "10回")
        reps_match = re.search(r'(\d+)\s*(?:レップ|回|rep)', text)
        if reps_match:
            result["reps"] = int(reps_match.group(1))
            
        # 種目の抽出
        exercises = {
            "スクワット": "Squat",
            "ベンチ": "Bench Press",
            "デッド": "Deadlift",
            "オーバーヘッド": "Overhead Press"
        }
        for jp, en in exercises.items():
            if jp in text:
                result["exercise"] = en
                break
                
        return result


# --- Main App ---

class VBTApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("OVR VBT Coach v2.3 Final")
        self.geometry("1400x950")
        
        # コアロジック
        self.db = TrainingDatabase()
        self.audio = AudioCoach()
        self.v_loss_manager = VelocityLossManager(cutoff_percent=20)
        self.pr_manager = PersonalRecordManager(self.db)
        self.ai_coach = AICoach(self.db)
        self.voice_manager = VoiceInputManager(self.on_voice_result) if SPEECH_AVAILABLE else None
        
        self.ble_client = None
        self.ble_thread = None
        self.loop = None
        self.is_running = False
        self.is_alerting = False
        
        self._init_variables()
        self._setup_ui()
        
        self.protocol("WM_DELETE_WINDOW", self.on_close)
        
        self.after(100, self.show_session_setup)

    def _init_variables(self):
        self.current_exercise = ctk.StringVar(value="Bench Press")
        self.current_weight = ctk.DoubleVar(value=60.0)
        self.current_rpe = ctk.StringVar(value="")
        self.target_reps = ctk.StringVar(value="10")
        
        self.set_type = ctk.StringVar(value="normal")
        self.velocity_loss_cutoff = ctk.IntVar(value=20)
        self.voice_enabled = ctk.BooleanVar(value=True)
        
        self.status_message = ctk.StringVar(value="準備完了")
        self.connection_status = ctk.StringVar(value="未接続")
        self.ai_advice = ctk.StringVar(value="")
        self.voice_status = ctk.StringVar(value="🎤 Ready" if SPEECH_AVAILABLE else "🎤 Disabled")
        
        self.current_e1rm = None
        self.body_weight = None
        self.readiness = 5

    def show_session_setup(self):
        dialog = SessionSetupDialog(self, self.on_session_setup_complete)
        
    def on_session_setup_complete(self, body_weight, readiness, notes):
        print(f"[DEBUG] on_session_setup_complete called with: weight={body_weight}, readiness={readiness}, notes={notes}")
        try:
            self.body_weight = body_weight
            self.readiness = readiness
            
            print("[DEBUG] Starting session in database...")
            self.session_id = self.db.start_session(body_weight=body_weight, readiness=readiness, notes=notes)
            print(f"[DEBUG] Session ID: {self.session_id}")
            
            print("[DEBUG] Getting weekly volume...")
            this_week = self.db.get_weekly_volume(0)
            last_week = self.db.get_weekly_volume(1)
            
            print("[DEBUG] Getting AI advice...")
            advice = self.ai_coach.get_session_advice(readiness, this_week['total_volume'], last_week['total_volume'])
            self.ai_advice.set(advice)
            self.status_message.set(advice)
            
            print("[DEBUG] Speaking...")
            self.audio.speak(f"セッション開始。調子は{readiness}")
            
            print("[DEBUG] Updating UI...")
            self.update_history_list()
            self.update_weekly_summary()
            self.update_calendar_tab()
            
            print("[DEBUG] on_session_setup_complete completed successfully")
        except Exception as e:
            print(f"[ERROR] Exception in on_session_setup_complete: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

    def _setup_ui(self):
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # Sidebar
        self.sidebar = ctk.CTkFrame(self, width=300, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_rowconfigure(14, weight=1)

        self._setup_sidebar()

        # Main Tabview
        self.tabview = ctk.CTkTabview(self)
        self.tabview.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        
        self.tab_monitor = self.tabview.add("Monitor")
        self.tab_graph = self.tabview.add("LVP Graph")
        self.tab_log = self.tabview.add("Session Log")
        self.tab_calendar = self.tabview.add("Calendar")
        self.tab_weekly = self.tabview.add("Weekly")

        self._setup_monitor_tab()
        self._setup_graph_tab()
        self._setup_log_tab()
        self._setup_calendar_tab()
        self._setup_weekly_tab()

    def _setup_sidebar(self):
        ctk.CTkLabel(self.sidebar, text="VBT COACH", font=ctk.CTkFont(size=24, weight="bold")).grid(row=0, column=0, padx=20, pady=(20, 10))
        
        # Exercise & Weight
        box1 = ctk.CTkFrame(self.sidebar)
        box1.grid(row=1, column=0, padx=15, pady=10, sticky="ew")
        
        ctk.CTkLabel(box1, text="Exercise").pack(anchor="w", padx=10, pady=(5,0))
        self.exercise_menu = ctk.CTkOptionMenu(box1, variable=self.current_exercise,
                                             values=["Squat", "Bench Press", "Deadlift", "Overhead Press"],
                                             command=self.on_exercise_change)
        self.exercise_menu.pack(fill="x", padx=10, pady=5)
        
        ctk.CTkLabel(box1, text="Weight (kg)").pack(anchor="w", padx=10)
        w_frame = ctk.CTkFrame(box1, fg_color="transparent")
        w_frame.pack(fill="x", padx=5, pady=5)
        
        ctk.CTkButton(w_frame, text="-2.5", width=40, command=lambda: self.change_weight(-2.5)).pack(side="left", padx=2)
        self.weight_entry = ctk.CTkEntry(w_frame, textvariable=self.current_weight, width=60, justify="center")
        self.weight_entry.pack(side="left", padx=2, fill="x", expand=True)
        ctk.CTkButton(w_frame, text="+2.5", width=40, command=lambda: self.change_weight(2.5)).pack(side="left", padx=2)
        
        # AI & Voice buttons
        btn_frame = ctk.CTkFrame(box1, fg_color="transparent")
        btn_frame.pack(fill="x", padx=5, pady=5)
        
        self.ai_weight_btn = ctk.CTkButton(btn_frame, text="🤖 AI", width=70, command=self.apply_ai_recommended_weight, fg_color="#9b59b6")
        self.ai_weight_btn.pack(side="left", padx=2)
        
        self.voice_btn = ctk.CTkButton(btn_frame, text="🎤 Voice", width=70, command=self.start_voice_input, 
                                      fg_color="#e74c3c" if SPEECH_AVAILABLE else "gray",
                                      state="normal" if SPEECH_AVAILABLE else "disabled")
        self.voice_btn.pack(side="left", padx=2)

        # Set Type
        box2 = ctk.CTkFrame(self.sidebar)
        box2.grid(row=2, column=0, padx=15, pady=10, sticky="ew")
        
        ctk.CTkLabel(box2, text="Set Type").pack(anchor="w", padx=10, pady=(5,0))
        ctk.CTkRadioButton(box2, text="Normal", variable=self.set_type, value="normal", command=self.on_set_type_change).pack(anchor="w", padx=10, pady=2)
        ctk.CTkRadioButton(box2, text="Drop Set", variable=self.set_type, value="drop", command=self.on_set_type_change).pack(anchor="w", padx=10, pady=2)
        ctk.CTkRadioButton(box2, text="AMRAP", variable=self.set_type, value="amrap", command=self.on_set_type_change).pack(anchor="w", padx=10, pady=2)
        ctk.CTkRadioButton(box2, text="Superset A", variable=self.set_type, value="superset_a", command=self.on_set_type_change).pack(anchor="w", padx=10, pady=2)
        ctk.CTkRadioButton(box2, text="Superset B", variable=self.set_type, value="superset_b", command=self.on_set_type_change).pack(anchor="w", padx=10, pady=2)
        
        ctk.CTkLabel(box2, text="V-Loss Cutoff").pack(anchor="w", padx=10, pady=(5,0))
        self.cutoff_slider = ctk.CTkSlider(box2, from_=5, to=40, variable=self.velocity_loss_cutoff, command=self.update_cutoff_label)
        self.cutoff_slider.pack(fill="x", padx=10, pady=5)
        self.cutoff_label = ctk.CTkLabel(box2, text="20%")
        self.cutoff_label.pack(anchor="e", padx=10)

        # Action Buttons
        self.new_set_btn = ctk.CTkButton(self.sidebar, text="START SET", 
                                       command=self.start_new_set, fg_color="green",
                                       height=40, font=ctk.CTkFont(weight="bold"))
        self.new_set_btn.grid(row=3, column=0, padx=20, pady=10)
        
        self.manual_btn = ctk.CTkButton(self.sidebar, text="Manual Entry", 
                                      command=self.open_manual_entry, fg_color="#e67e22")
        self.manual_btn.grid(row=4, column=0, padx=20, pady=10)

        self.finish_set_btn = ctk.CTkButton(self.sidebar, text="FINISH SET",
                                          command=self.finish_current_set, fg_color="gray",
                                          height=30)
        self.finish_set_btn.grid(row=5, column=0, padx=20, pady=(0, 10))

        # System
        self.voice_switch = ctk.CTkSwitch(self.sidebar, text="Voice Coach", variable=self.voice_enabled, command=self.toggle_voice)
        self.voice_switch.grid(row=8, column=0, padx=20, pady=10)
        
        self.connect_btn = ctk.CTkButton(self.sidebar, text="BLE Connect", command=self.toggle_connection)
        self.connect_btn.grid(row=9, column=0, padx=20, pady=10)
        
        self.status_lbl = ctk.CTkLabel(self.sidebar, textvariable=self.connection_status, text_color="gray")
        self.status_lbl.grid(row=10, column=0, padx=20, pady=5)
        
        # Voice status
        self.voice_status_lbl = ctk.CTkLabel(self.sidebar, textvariable=self.voice_status, text_color="#3498db")
        self.voice_status_lbl.grid(row=11, column=0, padx=20, pady=5)
        
        # AI Advice
        self.advice_lbl = ctk.CTkLabel(self.sidebar, textvariable=self.ai_advice, 
                                      text_color="#f1c40f", wraplength=250, font=ctk.CTkFont(size=12))
        self.advice_lbl.grid(row=12, column=0, padx=20, pady=10)
        
        # Status
        self.msg_lbl = ctk.CTkLabel(self.sidebar, textvariable=self.status_message, 
                                   text_color="#2ecc71", wraplength=250)
        self.msg_lbl.grid(row=13, column=0, padx=20, pady=5)

    def _setup_monitor_tab(self):
        self.tab_monitor.grid_columnconfigure(0, weight=1)
        self.tab_monitor.grid_rowconfigure(0, weight=3)
        self.tab_monitor.grid_rowconfigure(1, weight=1)

        self.monitor_frame = ctk.CTkFrame(self.tab_monitor, fg_color="#1a1a1a")
        self.monitor_frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=0)
        
        self.velocity_label = ctk.CTkLabel(self.monitor_frame, text="0.00", font=ctk.CTkFont(size=160, weight="bold"))
        self.velocity_label.place(relx=0.5, rely=0.4, anchor="center")
        
        ctk.CTkLabel(self.monitor_frame, text="M/S", font=ctk.CTkFont(size=30)).place(relx=0.5, rely=0.65, anchor="center")
        
        self.alert_label = ctk.CTkLabel(self.monitor_frame, text="", font=ctk.CTkFont(size=50, weight="bold"), text_color="red")
        self.alert_label.place(relx=0.5, rely=0.15, anchor="center")

        self.loss_bar = ctk.CTkProgressBar(self.monitor_frame, orientation="horizontal", height=20)
        self.loss_bar.place(relx=0.1, rely=0.85, relwidth=0.8)
        self.loss_bar.set(0)
        
        self.loss_value_label = ctk.CTkLabel(self.monitor_frame, text="Loss: 0%", font=ctk.CTkFont(size=20))
        self.loss_value_label.place(relx=0.5, rely=0.92, anchor="center")
        
        self.pr_notification_label = ctk.CTkLabel(self.monitor_frame, text="", 
                                                font=ctk.CTkFont(size=40, weight="bold"), 
                                                text_color="#f1c40f", fg_color="#000000", corner_radius=10)

        # Stats
        self.stats_frame = ctk.CTkFrame(self.tab_monitor, fg_color="transparent")
        self.stats_frame.grid(row=1, column=0, sticky="nsew", padx=0, pady=10)
        self.stats_frame.grid_columnconfigure((0, 1, 2, 3), weight=1)
        
        f1 = ctk.CTkFrame(self.stats_frame)
        f1.grid(row=0, column=0, padx=5, sticky="nsew")
        ctk.CTkLabel(f1, text="Avg Power").pack(pady=(5,0))
        self.power_label = ctk.CTkLabel(f1, text="0 W", font=ctk.CTkFont(size=24, weight="bold"))
        self.power_label.pack(pady=5)
        
        f2 = ctk.CTkFrame(self.stats_frame)
        f2.grid(row=0, column=1, padx=5, sticky="nsew")
        ctk.CTkLabel(f2, text="ROM").pack(pady=(5,0))
        self.rom_label = ctk.CTkLabel(f2, text="0 cm", font=ctk.CTkFont(size=24, weight="bold"))
        self.rom_label.pack(pady=5)
        
        f3 = ctk.CTkFrame(self.stats_frame)
        f3.grid(row=0, column=2, padx=5, sticky="nsew")
        ctk.CTkLabel(f3, text="Peak Vel").pack(pady=(5,0))
        self.peak_vel_label = ctk.CTkLabel(f3, text="0.00", font=ctk.CTkFont(size=24, weight="bold"))
        self.peak_vel_label.pack(pady=5)

        f4 = ctk.CTkFrame(self.stats_frame)
        f4.grid(row=0, column=3, padx=5, sticky="nsew")
        ctk.CTkLabel(f4, text="Est. 1RM").pack(pady=(5,0))
        self.e1rm_label = ctk.CTkLabel(f4, text="---", font=ctk.CTkFont(size=24, weight="bold"), text_color="#3498db")
        self.e1rm_label.pack(pady=5)

    def _setup_graph_tab(self):
        self.tab_graph.grid_columnconfigure(0, weight=1)
        self.tab_graph.grid_rowconfigure(0, weight=1)
        
        self.fig, self.ax = plt.subplots(figsize=(8, 6), facecolor='#2b2b2b')
        self.ax.set_facecolor('#2b2b2b')
        self.ax.tick_params(colors='white')
        self.ax.spines['bottom'].set_color('white')
        self.ax.spines['top'].set_color('white')
        self.ax.spines['left'].set_color('white')
        self.ax.spines['right'].set_color('white')
        self.ax.set_xlabel('Weight (kg)', color='white')
        self.ax.set_ylabel('Velocity (m/s)', color='white')
        self.ax.set_title('Load-Velocity Profile', color='white', fontsize=14)
        
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.tab_graph)
        self.canvas.get_tk_widget().grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        
        ctk.CTkButton(self.tab_graph, text="Refresh Graph", command=self.update_graph).grid(row=1, column=0, pady=10)

    def _setup_log_tab(self):
        self.tab_log.grid_columnconfigure(0, weight=1)
        self.tab_log.grid_rowconfigure(1, weight=1)
        
        header_text = f"{'Time':<6} | {'Exercise':<12} | {'Weight':>7} | {'Reps':>5} | {'Vel':>6} | {'Type':>10}"
        ctk.CTkLabel(self.tab_log, text=header_text, font=("Courier", 13), anchor="w").grid(row=0, column=0, sticky="ew", padx=10)

        self.history_list = ctk.CTkTextbox(self.tab_log, font=("Courier", 13))
        self.history_list.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)
        self.history_list.configure(state="disabled")

    def _setup_calendar_tab(self):
        """カレンダータブ"""
        self.tab_calendar.grid_columnconfigure(0, weight=1)
        self.tab_calendar.grid_columnconfigure(1, weight=2)
        self.tab_calendar.grid_rowconfigure(0, weight=1)
        
        # 左側: カレンダー
        calendar_frame = ctk.CTkFrame(self.tab_calendar)
        calendar_frame.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        
        ctk.CTkLabel(calendar_frame, text="Training Calendar", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=10)
        
        # セッションがある日付を取得
        sessions = self.db.get_all_sessions(limit=100)
        session_dates = set()
        for s in sessions:
            if s['date']:
                date_part = s['date'][:10]  # YYYY-MM-DD
                session_dates.add(date_part)
        
        self.calendar_widget = CalendarWidget(calendar_frame, on_date_select=self.on_date_selected, session_dates=session_dates)
        self.calendar_widget.pack(fill="both", expand=True, padx=10, pady=10)
        
        # 右側: 選択日の詳細
        detail_frame = ctk.CTkFrame(self.tab_calendar)
        detail_frame.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        
        ctk.CTkLabel(detail_frame, text="Session Details", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=10)
        
        self.calendar_detail_text = ctk.CTkTextbox(detail_frame, font=("Courier", 12))
        self.calendar_detail_text.pack(fill="both", expand=True, padx=10, pady=10)
        self.calendar_detail_text.configure(state="disabled")

    def _setup_weekly_tab(self):
        """週次サマリータブ"""
        self.tab_weekly.grid_columnconfigure(0, weight=1)
        self.tab_weekly.grid_rowconfigure(1, weight=1)
        
        ctk.CTkLabel(self.tab_weekly, text="Weekly Summary", font=ctk.CTkFont(size=18, weight="bold")).grid(row=0, column=0, pady=10)
        
        self.weekly_summary_text = ctk.CTkTextbox(self.tab_weekly, font=("Courier", 13))
        self.weekly_summary_text.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)
        self.weekly_summary_text.configure(state="disabled")

    # --- Voice Input ---
    
    def start_voice_input(self):
        """音声入力開始"""
        if not self.voice_manager:
            return
            
        self.voice_status.set("🎤 Listening...")
        self.voice_btn.configure(fg_color="#27ae60")
        self.voice_manager.start_listening()
        
    def on_voice_result(self, text):
        """音声認識結果の処理"""
        self.after(0, lambda: self._process_voice_result(text))
        
    def _process_voice_result(self, text):
        self.voice_btn.configure(fg_color="#e74c3c")
        
        if text is None:
            self.voice_status.set("🎤 Not recognized")
            return
            
        self.voice_status.set(f"🎤 \"{text}\"")
        
        # コマンド解析
        parsed = self.voice_manager.parse_command(text)
        
        if parsed["weight"]:
            self.current_weight.set(parsed["weight"])
            
        if parsed["exercise"]:
            self.current_exercise.set(parsed["exercise"])
            
        if parsed["weight"] or parsed["exercise"]:
            self.status_message.set(f"Voice: Set {parsed['exercise'] or ''} @ {parsed['weight'] or ''}kg")
            self.audio.speak("了解しました")

    # --- Calendar ---
    
    def on_date_selected(self, date_str):
        """カレンダーで日付が選択された時"""
        # その日のセッションを取得
        sessions = self.db.get_all_sessions(limit=100)
        
        selected_sessions = [s for s in sessions if s['date'] and s['date'].startswith(date_str)]
        
        self.calendar_detail_text.configure(state="normal")
        self.calendar_detail_text.delete("1.0", "end")
        
        if not selected_sessions:
            self.calendar_detail_text.insert("end", f"No training on {date_str}")
        else:
            for session in selected_sessions:
                text = f"Date: {session['date']}\n"
                text += f"Sets: {session['set_count']}\n"
                text += f"Volume: {session['volume']:,.0f} kg\n"
                text += f"Readiness: {session['readiness']}/10\n"
                text += "-" * 40 + "\n"
                
                # そのセッションのセット一覧を取得
                sets = self.db.get_session_sets(session['id'])
                for s in sets:
                    text += f"  #{s['set_index']} {s['exercise']}: {s['weight']}kg x {s['reps']} @ {s['avg_vel']:.2f}m/s\n"
                    
                self.calendar_detail_text.insert("end", text + "\n")
                
        self.calendar_detail_text.configure(state="disabled")

    def update_calendar_tab(self):
        """カレンダータブの更新"""
        sessions = self.db.get_all_sessions(limit=100)
        session_dates = set()
        for s in sessions:
            if s['date']:
                date_part = s['date'][:10]
                session_dates.add(date_part)
        
        if hasattr(self, 'calendar_widget'):
            self.calendar_widget.set_session_dates(session_dates)

    # --- Logic ---

    def apply_ai_recommended_weight(self):
        ex = self.current_exercise.get()
        recommended = self.ai_coach.get_recommended_weight(ex, self.readiness, target_intensity=0.8)
        
        if recommended:
            self.current_weight.set(recommended)
            self.status_message.set(f"🤖 AI Recommended: {recommended}kg (80% intensity)")
            self.audio.speak(f"推奨重量は{int(recommended)}キロです")
        else:
            self.status_message.set("No LVP data yet. Train more to get recommendations!")

    def start_new_set(self):
        ex = self.current_exercise.get()
        weight = self.current_weight.get()
        stype = self.set_type.get()
        
        set_id = self.db.start_set(ex, weight, set_type=stype)
        self.v_loss_manager.start_new_set()
        
        self.reset_monitor_display()
        self.new_set_btn.configure(fg_color="gray", state="disabled")
        self.manual_btn.configure(state="normal")
        self.finish_set_btn.configure(fg_color="#e67e22", state="normal")
        
        self.status_message.set(f"Set Started: {ex} {weight}kg ({stype})")
        self.audio.speak("セット開始")

    def finish_current_set(self):
        ex = self.current_exercise.get()
        self.save_lvp_for_exercise(ex)
        
        self.db.current_set_id = None
        
        self.new_set_btn.configure(fg_color="green", state="normal")
        self.finish_set_btn.configure(fg_color="gray", state="disabled")
        
        self.audio.speak("セット終了")
        self.update_history_list()
        self.update_graph()
        self.update_weekly_summary()
        self.update_calendar_tab()
        
        if self.set_type.get() == "superset_a":
            self.set_type.set("superset_b")
            self.status_message.set("Superset: Switch to Exercise B!")
        elif self.set_type.get() == "superset_b":
            self.set_type.set("superset_a")
            self.status_message.set("Superset: Switch to Exercise A!")
        
        if self.set_type.get() == "drop":
            current = self.current_weight.get()
            next_w = round((current * 0.8) / 2.5) * 2.5
            self.current_weight.set(next_w)
            self.status_message.set(f"Drop Set: Weight dropped to {next_w}kg")
            self.audio.speak(f"次は {int(next_w)}キロ です")

    def save_lvp_for_exercise(self, exercise_name: str):
        data = self.db.get_session_data_for_1rm(exercise_name)
        
        if len(data) >= 2:
            lvp = OneRMCalculator.calculate_lvp(data)
            if lvp:
                slope, intercept = lvp
                self.db.update_exercise_lvp(exercise_name, slope, intercept, self.current_e1rm)

    def update_graph(self):
        ex = self.current_exercise.get()
        data = self.db.get_session_data_for_1rm(ex)
        
        self.ax.clear()
        self.ax.set_facecolor('#2b2b2b')
        self.ax.tick_params(colors='white')
        self.ax.set_xlabel('Weight (kg)', color='white')
        self.ax.set_ylabel('Velocity (m/s)', color='white')
        self.ax.set_title(f'Load-Velocity Profile: {ex}', color='white', fontsize=14)
        
        if data:
            weights = [d[0] for d in data]
            velocities = [d[1] for d in data]
            
            self.ax.scatter(weights, velocities, color='#3498db', s=100, zorder=5)
            
            if len(data) >= 2:
                import numpy as np
                w_arr = np.array(weights)
                v_arr = np.array(velocities)
                slope, intercept = np.polyfit(w_arr, v_arr, 1)
                
                mvt = OneRMCalculator.MVT_TABLE.get(ex, 0.25)
                if slope < 0:
                    e1rm = (mvt - intercept) / slope
                    x_line = np.linspace(min(weights) * 0.9, e1rm, 50)
                    y_line = slope * x_line + intercept
                    
                    self.ax.plot(x_line, y_line, color='#e74c3c', linewidth=2, label='LVP Line')
                    self.ax.scatter([e1rm], [mvt], color='#f1c40f', s=150, marker='*', zorder=6, label=f'Est. 1RM: {int(e1rm)}kg')
                    self.ax.axhline(y=mvt, color='#95a5a6', linestyle='--', alpha=0.5, label=f'MVT: {mvt}m/s')
                    self.ax.legend(facecolor='#2b2b2b', edgecolor='white', labelcolor='white')
        
        self.ax.grid(True, alpha=0.3)
        self.canvas.draw()

    def update_history_list(self):
        sets = self.db.get_today_sets()
        self.history_list.configure(state="normal")
        self.history_list.delete("1.0", "end")
        
        for s in sets:
            ex_short = s['exercise'][:10] if len(s['exercise']) > 10 else s['exercise']
            time_str = s.get('time', '--:--')
            
            line = f"{time_str:<6} | {ex_short:<12} | {s['weight']:>5.1f}kg | {s['reps']:>5} | {s['avg_vel']:>5.2f} | {s['type']:>10}\n"
            self.history_list.insert("end", line)
            
        self.history_list.configure(state="disabled")
        
        vol = self.db.get_today_volume()
        self.status_message.set(f"Total Volume: {vol:.0f} kg")

    def update_weekly_summary(self):
        this_week = self.db.get_weekly_volume(0)
        last_week = self.db.get_weekly_volume(1)
        recent_prs = self.db.get_recent_prs(days=7)
        
        self.weekly_summary_text.configure(state="normal")
        self.weekly_summary_text.delete("1.0", "end")
        
        text = "=" * 50 + "\n"
        text += "  THIS WEEK\n"
        text += "=" * 50 + "\n\n"
        text += f"  📅 Period: {this_week['week_start']} ~ {this_week['week_end']}\n"
        text += f"  📊 Total Volume: {this_week['total_volume']:,.0f} kg\n"
        text += f"  🏋️ Sessions: {this_week['session_count']}\n"
        text += f"  📝 Sets: {this_week['set_count']}\n\n"
        
        if last_week['total_volume'] > 0:
            ratio = (this_week['total_volume'] / last_week['total_volume']) * 100
            text += f"  📈 vs Last Week: {ratio:.0f}% ({last_week['total_volume']:,.0f} kg)\n\n"
        
        text += "=" * 50 + "\n"
        text += "  RECENT PRs (Last 7 Days)\n"
        text += "=" * 50 + "\n\n"
        
        if recent_prs:
            for pr in recent_prs:
                if pr['type'] == 'max_velocity':
                    text += f"  ⚡ {pr['exercise']}: {pr['value']:.2f}m/s @ {pr['weight']}kg ({pr['date']})\n"
                elif pr['type'] == 'e1rm':
                    text += f"  🏆 {pr['exercise']}: Est. 1RM = {int(pr['value'])}kg ({pr['date']})\n"
        else:
            text += "  No PRs yet this week. Keep pushing!\n"
            
        self.weekly_summary_text.insert("end", text)
        self.weekly_summary_text.configure(state="disabled")

    def update_1rm_display(self):
        ex = self.current_exercise.get()
        data = self.db.get_session_data_for_1rm(ex)
        
        val = OneRMCalculator.estimate_1rm(data, ex)
        if val:
            self.current_e1rm = val
            self.e1rm_label.configure(text=f"{int(val)} kg")
        else:
            self.current_e1rm = None
            self.e1rm_label.configure(text="---")

    # --- Event Handlers ---

    def change_weight(self, delta):
        val = self.current_weight.get() + delta
        if val < 0: val = 0
        self.current_weight.set(val)

    def on_exercise_change(self, value):
        self.update_1rm_display()
        self.update_graph()

    def update_cutoff_label(self, value):
        self.cutoff_label.configure(text=f"{int(value)}%")
        self.v_loss_manager.cutoff_percent = int(value)

    def on_set_type_change(self):
        stype = self.set_type.get()
        if stype == "amrap":
            self.status_message.set("AMRAP Mode: V-Loss Alert Disabled")
        elif stype == "drop":
            self.status_message.set("Drop Set Mode: Auto weight drop enabled")
        elif stype in ("superset_a", "superset_b"):
            self.status_message.set(f"Superset Mode: {stype.upper()}")

    def toggle_voice(self):
        self.audio.enabled = self.voice_enabled.get()

    def open_manual_entry(self):
        if not self.db.current_set_id:
            self.start_new_set()
            
        dialog = ManualEntryDialog(self, self.on_manual_entry_save)
        dialog.grab_set()

    def on_manual_entry_save(self, reps, rpe, note):
        for i in range(reps):
            self.db.add_rep(velocity=0.0, power=0.0, peak_power=0.0, rom=0.0, time_to_peak=0.0, data_source='manual')
            
        self.db.update_set_info(rpe=rpe)
        self.finish_current_set()
        self.status_message.set(f"Manual Entry Saved: {reps} reps @ RPE {rpe}")
        self.update_history_list()

    def reset_monitor_display(self):
        self.alert_label.configure(text="")
        self.velocity_label.configure(text_color="white")
        self.loss_bar.set(0)
        self.loss_value_label.configure(text="Loss: 0%")
        self.is_alerting = False
        self.monitor_frame.configure(fg_color="#1a1a1a")
        self.pr_notification_label.place_forget()

    # --- BLE Integration ---

    def toggle_connection(self):
        if not self.is_running:
            self.start_ble()
        else:
            self.stop_ble()

    def start_ble(self):
        self.is_running = True
        self.connect_btn.configure(text="Disconnect", fg_color="red")
        self.connection_status.set("Connecting...")
        
        self.ble_thread = threading.Thread(target=self._run_ble_loop, daemon=True)
        self.ble_thread.start()

    def stop_ble(self):
        self.is_running = False
        self.connect_btn.configure(text="BLE Connect", fg_color="#1f6aa5")
        self.connection_status.set("Disconnected")

    def _run_ble_loop(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        
        self.ble_client = OVRVelocityClient(
            receive_duration=999999,
            display_mode=DISPLAY_MODE_GUI,
            on_data_received=self.on_ble_data
        )
        
        try:
            self.loop.run_until_complete(self.ble_client.run())
        except Exception as e:
            print(f"BLE Error: {e}")
            self.after(0, lambda: self.connection_status.set(f"Error: {e}"))
            self.is_running = False
            self.after(0, lambda: self.connect_btn.configure(text="BLE Connect", fg_color="#1f6aa5"))
        finally:
            self.loop.close()

    def on_ble_data(self, data: VelocityData):
        self.after(0, lambda: self._process_data(data))

    def _process_data(self, data: VelocityData):
        if self.is_alerting:
            self.monitor_frame.configure(fg_color="#1a1a1a")
            self.is_alerting = False

        if not self.db.current_set_id:
            self.start_new_set()
            
        self.db.add_rep(
            velocity=data.avg_velocity_ms,
            power=data.avg_power_w,
            peak_power=data.peak_power_w,
            rom=data.rom_cm,
            time_to_peak=data.time_to_peak_s,
            data_source='vbt'
        )
        
        ex_id = self.db.current_exercise_id
        weight = self.current_weight.get()
        pr_msgs = self.pr_manager.check_for_pr(ex_id, weight, data.avg_velocity_ms)
        
        if pr_msgs:
            self.show_pr_notification(pr_msgs[0])
            self.audio.speak("記録更新！おめでとうございます！")

        if self.set_type.get() not in ("amrap",):
            is_cutoff, loss_percent = self.v_loss_manager.process_rep(data.avg_velocity_ms)
        else:
            is_cutoff, loss_percent = False, 0.0
        
        if not pr_msgs:
            if is_cutoff:
                self.audio.alert_stop()
            else:
                self.audio.speak_velocity(data.avg_velocity_ms)
            
        self.velocity_label.configure(text=f"{data.avg_velocity_ms:.2f}")
        self.power_label.configure(text=f"{data.avg_power_w} W")
        self.peak_vel_label.configure(text=f"---") 
        self.rom_label.configure(text=f"{data.rom_cm:.1f} cm")
        
        self.loss_bar.set(loss_percent / 100.0)
        self.loss_value_label.configure(text=f"Loss: {loss_percent:.1f}%")
        
        if is_cutoff:
            self.trigger_alert()
            self.loss_value_label.configure(text_color="red")
        else:
            self.loss_value_label.configure(text_color="white")
            
        self.update_history_list()
        self.update_1rm_display()

    def show_pr_notification(self, message):
        self.pr_notification_label.configure(text=f"🏆 {message}")
        self.pr_notification_label.place(relx=0.5, rely=0.5, anchor="center")
        self.after(5000, lambda: self.pr_notification_label.place_forget())

    def trigger_alert(self):
        self.is_alerting = True
        self.alert_label.configure(text="STOP! (Fatigue)")
        self.velocity_label.configure(text_color="#ff5555")
        self.flash_background(0)

    def flash_background(self, count):
        if not self.is_alerting or count > 5:
            self.monitor_frame.configure(fg_color="#1a1a1a")
            return
        
        color = "#880000" if count % 2 == 0 else "#1a1a1a"
        self.monitor_frame.configure(fg_color=color)
        self.after(300, lambda: self.flash_background(count + 1))

    def on_close(self):
        self.stop_ble()
        self.db.end_session(notes="App Closed")
        self.destroy()
        sys.exit()

if __name__ == "__main__":
    app = VBTApp()
    app.mainloop()
