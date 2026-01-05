"""
OVR VBT Coach - Web App (Browser UI)

- 既存のコアロジック（vbt_core.TrainingDatabase 等）を利用しつつ、
  ブラウザから「セッション開始/終了」「手入力でセット記録」「履歴閲覧」を行える
  最小構成のWeb UIを提供します。

起動:
  python web_app.py
  -> http://localhost:8000
"""

from __future__ import annotations

from pathlib import Path
import sqlite3
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from vbt_core import TrainingDatabase


APP_DIR = Path(__file__).resolve().parent
WEB_DIR = APP_DIR / "web"
INDEX_HTML = WEB_DIR / "index.html"

# 実行ディレクトリに依存せず、常にリポジトリ直下のDBを参照する
db = TrainingDatabase(str(APP_DIR / "training_v2.db"))
app = FastAPI(title="OVR VBT Coach (Web)")


class SessionStartRequest(BaseModel):
    body_weight: Optional[float] = Field(default=None, ge=0)
    readiness: Optional[int] = Field(default=None, ge=1, le=10)
    notes: str = ""


class SessionEndRequest(BaseModel):
    notes: Optional[str] = None


class ManualSetRequest(BaseModel):
    exercise: str = Field(min_length=1)
    weight_kg: float = Field(ge=0)
    reps: int = Field(ge=1, le=100)
    rpe: Optional[float] = Field(default=None, ge=0, le=10)
    set_type: str = Field(default="normal", min_length=1)


def _read_index_html() -> str:
    if not INDEX_HTML.exists():
        raise RuntimeError(f"Missing {INDEX_HTML}")
    return INDEX_HTML.read_text(encoding="utf-8")


def _list_exercises(db_file: str) -> list[str]:
    conn = sqlite3.connect(db_file)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM exercises ORDER BY name ASC")
        return [r[0] for r in cursor.fetchall()]
    finally:
        conn.close()


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return _read_index_html()


@app.get("/api/state")
def get_state() -> dict[str, Any]:
    return {"current_session_id": db.current_session_id}


@app.get("/api/exercises")
def get_exercises() -> dict[str, Any]:
    return {"exercises": _list_exercises(db.db_file)}


@app.post("/api/session/start")
def start_session(req: SessionStartRequest) -> dict[str, Any]:
    session_id = db.start_session(body_weight=req.body_weight, readiness=req.readiness, notes=req.notes or "")
    return {"session_id": session_id}


@app.post("/api/session/end")
def end_session(req: SessionEndRequest) -> dict[str, Any]:
    if not db.current_session_id:
        raise HTTPException(status_code=409, detail="No active session.")
    db.end_session(notes=req.notes)
    return {"ok": True}


@app.get("/api/today")
def get_today() -> dict[str, Any]:
    return {
        "current_session_id": db.current_session_id,
        "today_volume": db.get_today_volume(),
        "today_sets": db.get_today_sets(),
    }


@app.post("/api/manual_set")
def add_manual_set(req: ManualSetRequest) -> dict[str, Any]:
    # セッションがなければ自動開始（GUIと同じ挙動）
    db.start_set(req.exercise, req.weight_kg, set_type=req.set_type)
    for _ in range(req.reps):
        db.add_rep(
            velocity=0.0,
            power=0.0,
            peak_power=0.0,
            rom=0.0,
            time_to_peak=0.0,
            rep_duration=0.0,
            data_source="manual",
        )
    if req.rpe is not None:
        db.update_set_info(rpe=req.rpe)
    return {"ok": True}


@app.get("/api/sessions")
def list_sessions(limit: int = 50) -> dict[str, Any]:
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 500")
    return {"sessions": db.get_all_sessions(limit=limit)}


@app.get("/api/sessions/{session_id}/sets")
def list_session_sets(session_id: int) -> dict[str, Any]:
    if session_id < 1:
        raise HTTPException(status_code=400, detail="invalid session_id")
    return {"session_id": session_id, "sets": db.get_session_sets(session_id)}


@app.get("/api/weekly")
def weekly(weeks_ago: int = 0) -> dict[str, Any]:
    if weeks_ago < 0 or weeks_ago > 52:
        raise HTTPException(status_code=400, detail="weeks_ago must be between 0 and 52")
    return db.get_weekly_volume(weeks_ago=weeks_ago)


@app.get("/api/prs")
def prs(days: int = 14) -> dict[str, Any]:
    if days < 1 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 1 and 365")
    return {"prs": db.get_recent_prs(days=days)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("web_app:app", host="0.0.0.0", port=8000, reload=False)

