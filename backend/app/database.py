import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import DB_PATH

def get_connection():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS streams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        channel_name TEXT,
        thumbnail_url TEXT,
        is_live INTEGER DEFAULT 0,
        status TEXT DEFAULT 'IDLE',
        created_at TEXT,
        updated_at TEXT
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS moments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stream_id INTEGER,
        timestamp_start REAL,
        timestamp_end REAL,
        score REAL,
        entertainment_breakdown TEXT,
        event_type TEXT,
        transcript TEXT,
        reason TEXT,
        auto_clipped INTEGER DEFAULT 0,
        created_at TEXT
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moment_id INTEGER,
        title TEXT,
        hook TEXT,
        description TEXT,
        hashtags TEXT,
        duration REAL,
        score REAL,
        preset TEXT DEFAULT 'viral',
        status TEXT DEFAULT 'QUEUED',
        status_stage TEXT DEFAULT 'Queued for rendering',
        progress INTEGER DEFAULT 0,
        raw_path TEXT,
        processed_path TEXT,
        thumbnail_path TEXT,
        original_timestamp REAL,
        error_message TEXT,
        user_action TEXT DEFAULT 'NONE',
        created_at TEXT,
        updated_at TEXT
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    
    # Initialize default settings if not exists
    defaults = {
        "active_preset": "viral",
        "score_threshold": "65",
        "buffer_duration": "300",
        "target_clip_duration": "30",
        "auto_clip_enabled": "1"
    }
    for k, v in defaults.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))
        
    conn.commit()
    conn.close()

# Helper queries
def create_stream_record(url: str, title: str, channel_name: str, thumbnail_url: str, is_live: bool, status: str = "CONNECTED") -> int:
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute("""
    INSERT INTO streams (url, title, channel_name, thumbnail_url, is_live, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (url, title, channel_name, thumbnail_url, 1 if is_live else 0, status, now, now))
    stream_id = c.lastrowid
    conn.commit()
    conn.close()
    return stream_id

def update_stream_status(stream_id: int, status: str, is_live: Optional[bool] = None):
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    if is_live is not None:
        c.execute("UPDATE streams SET status = ?, is_live = ?, updated_at = ? WHERE id = ?", (status, 1 if is_live else 0, now, stream_id))
    else:
        c.execute("UPDATE streams SET status = ?, updated_at = ? WHERE id = ?", (status, now, stream_id))
    conn.commit()
    conn.close()

def get_latest_stream():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM streams ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def record_moment(stream_id: int, start: float, end: float, score: float, breakdown: dict, event_type: str, transcript: str, reason: str, auto_clipped: bool = False) -> int:
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute("""
    INSERT INTO moments (stream_id, timestamp_start, timestamp_end, score, entertainment_breakdown, event_type, transcript, reason, auto_clipped, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (stream_id, start, end, score, json.dumps(breakdown), event_type, transcript, reason, 1 if auto_clipped else 0, now))
    moment_id = c.lastrowid
    conn.commit()
    conn.close()
    return moment_id

def create_clip_record(moment_id: Optional[int], title: str, hook: str, description: str, hashtags: str, duration: float, score: float, preset: str, raw_path: str = "", original_timestamp: float = 0.0) -> int:
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute("""
    INSERT INTO clips (moment_id, title, hook, description, hashtags, duration, score, preset, status, status_stage, progress, raw_path, original_timestamp, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', 'Queued for processing', 0, ?, ?, ?, ?)
    """, (moment_id, title, hook, description, hashtags, duration, score, preset, raw_path, original_timestamp, now, now))
    clip_id = c.lastrowid
    conn.commit()
    conn.close()
    return clip_id

def update_clip_progress(clip_id: int, progress: int, stage: str, status: str = "PROCESSING"):
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute("UPDATE clips SET progress = ?, status_stage = ?, status = ?, updated_at = ? WHERE id = ?", (progress, stage, status, now, clip_id))
    conn.commit()
    conn.close()

def complete_clip_record(clip_id: int, processed_path: str, thumbnail_path: str, duration: float):
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute("""
    UPDATE clips SET status = 'COMPLETED', status_stage = 'Video rendered & validated', progress = 100, processed_path = ?, thumbnail_path = ?, duration = ?, updated_at = ?
    WHERE id = ?
    """, (processed_path, thumbnail_path, duration, now, clip_id))
    conn.commit()
    conn.close()

def fail_clip_record(clip_id: int, error_message: str):
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute("UPDATE clips SET status = 'FAILED', status_stage = 'Rendering failed', error_message = ?, updated_at = ? WHERE id = ?", (error_message, now, clip_id))
    conn.commit()
    conn.close()

def get_all_clips(limit: int = 50, filter_action: Optional[str] = None):
    conn = get_connection()
    c = conn.cursor()
    if filter_action and filter_action != "ALL":
        c.execute("SELECT * FROM clips WHERE user_action = ? ORDER BY id DESC LIMIT ?", (filter_action, limit))
    else:
        c.execute("SELECT * FROM clips ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_clip_by_id(clip_id: int):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM clips WHERE id = ?", (clip_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def set_clip_user_action(clip_id: int, action: str):
    conn = get_connection()
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute("UPDATE clips SET user_action = ?, updated_at = ? WHERE id = ?", (action, now, clip_id))
    conn.commit()
    conn.close()

def get_stats():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM moments")
    moments_count = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM clips WHERE status = 'COMPLETED'")
    clips_completed = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM clips WHERE status IN ('QUEUED', 'PROCESSING')")
    clips_processing = c.fetchone()[0]
    
    c.execute("SELECT COALESCE(SUM(duration), 0) FROM clips WHERE status = 'COMPLETED'")
    total_duration = c.fetchone()[0]
    
    conn.close()
    return {
        "moments_detected": moments_count,
        "clips_generated": clips_completed,
        "clips_processing": clips_processing,
        "total_rendered_duration": round(float(total_duration), 1)
    }

def get_all_settings():
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT key, value FROM settings")
    settings = {row["key"]: row["value"] for row in c.fetchall()}
    conn.close()
    return settings

def update_setting(key: str, value: str):
    conn = get_connection()
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()
