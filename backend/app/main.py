import os
import shutil
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import (
    PROCESSED_DIR, THUMBNAILS_DIR, RAW_DIR, APPROVED_DIR, REJECTED_DIR,
    TEST_ASSETS_DIR, PRESET_CONFIGS, DEFAULT_PRESET, DEFAULT_SCORE_THRESHOLD
)
from app.database import (
    init_db, get_latest_stream, get_all_clips, get_clip_by_id,
    set_clip_user_action, get_stats, get_all_settings, update_setting,
    create_clip_record, update_clip_progress, fail_clip_record
)
from app.services.stream_service import stream_monitor
from app.services.editing_service import extract_and_render_clip

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gta6_clipper")

# Initialize database
init_db()

app = FastAPI(
    title="GTA VI Autonomous AI Clipper API",
    description="Local-first AI livestream clipper and automatic video editing engine.",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount media directories for browser preview and download
app.mount("/media/processed", StaticFiles(directory=str(PROCESSED_DIR)), name="processed")
app.mount("/media/thumbnails", StaticFiles(directory=str(THUMBNAILS_DIR)), name="thumbnails")
app.mount("/media/raw", StaticFiles(directory=str(RAW_DIR)), name="raw")
static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Request Models
class ConnectStreamRequest(BaseModel):
    url: str
    local_file: Optional[str] = None

class ClipActionRequest(BaseModel):
    action: str  # APPROVED, REJECTED, NONE

class SettingsUpdateRequest(BaseModel):
    active_preset: Optional[str] = None
    score_threshold: Optional[str] = None
    buffer_duration: Optional[str] = None
    target_clip_duration: Optional[str] = None

class ManualClipRequest(BaseModel):
    start_time: float
    end_time: float
    preset: Optional[str] = None
    title: Optional[str] = None
    hook: Optional[str] = None

# Stream Endpoints
@app.post("/api/stream/connect")
def connect_stream(req: ConnectStreamRequest):
    url = req.url.strip()
    if not url and not req.local_file:
        raise HTTPException(status_code=400, detail="Stream URL is required.")
        
    state = stream_monitor.connect(url, local_file_override=req.local_file)
    return {"success": True, "state": state}

@app.get("/api/stream/status")
def get_stream_status():
    return stream_monitor.get_state()

@app.post("/api/stream/start")
def start_monitoring():
    state = stream_monitor.start_monitoring()
    return {"success": True, "state": state}

@app.post("/api/stream/pause")
def pause_monitoring():
    state = stream_monitor.pause_monitoring()
    return {"success": True, "state": state}

@app.post("/api/stream/stop")
def stop_monitoring():
    state = stream_monitor.stop_monitoring()
    return {"success": True, "state": state}

# Clips Endpoints
@app.get("/api/clips")
def list_clips(filter_action: str = Query("ALL", alias="filter")):
    clips = get_all_clips(limit=50, filter_action=filter_action)
    # Format URLs for frontend
    for clip in clips:
        if clip.get("processed_path"):
            clip["video_url"] = f"/media/processed/{Path(clip['processed_path']).name}"
        else:
            clip["video_url"] = None
        if clip.get("thumbnail_path"):
            clip["thumbnail_url"] = f"/media/thumbnails/{Path(clip['thumbnail_path']).name}"
        else:
            clip["thumbnail_url"] = None
    return {"clips": clips}

@app.get("/api/clips/{clip_id}")
def get_clip(clip_id: int):
    clip = get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
    if clip.get("processed_path"):
        clip["video_url"] = f"/media/processed/{Path(clip['processed_path']).name}"
    if clip.get("thumbnail_path"):
        clip["thumbnail_url"] = f"/media/thumbnails/{Path(clip['thumbnail_path']).name}"
    return clip

@app.post("/api/clips/{clip_id}/action")
def update_clip_action(clip_id: int, req: ClipActionRequest):
    clip = get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
        
    action = req.action.upper()
    set_clip_user_action(clip_id, action)
    
    # Organize in Approved / Rejected folders
    src_file = clip.get("processed_path")
    if src_file and os.path.exists(src_file):
        filename = Path(src_file).name
        if action == "APPROVED":
            shutil.copy2(src_file, APPROVED_DIR / filename)
        elif action == "REJECTED":
            shutil.copy2(src_file, REJECTED_DIR / filename)
            
    return {"success": True, "clip_id": clip_id, "action": action}

@app.post("/api/clips/{clip_id}/retry")
def retry_clip(clip_id: int, background_tasks: BackgroundTasks):
    clip = get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
        
    source = clip.get("raw_path") or str(TEST_ASSETS_DIR / "sample_gta6_gameplay.mp4")
    start_t = clip.get("original_timestamp", 0.0)
    end_t = start_t + (clip.get("duration") or 25.0)
    preset = clip.get("preset", "viral")
    
    update_clip_progress(clip_id, 5, "Retrying rendering job", "PROCESSING")
    
    def _do_render():
        try:
            extract_and_render_clip(
                clip_id=clip_id,
                source_video_path=source,
                start_time=start_t,
                end_time=end_t,
                preset=preset,
                title=clip.get("title", "GTA VI Highlight"),
                hook=clip.get("hook", "WAIT FOR THIS 💀"),
                score=clip.get("score", 70.0),
                hashtags=clip.get("hashtags", "#GTA6 #Gaming"),
                description=clip.get("description", "GTA 6 highlight")
            )
        except Exception as e:
            logger.error(f"Retry render failed: {e}")
            
    background_tasks.add_task(_do_render)
    return {"success": True, "message": "Rendering retry queued"}

@app.post("/api/clips/manual-generate")
def manual_generate_clip(req: ManualClipRequest, background_tasks: BackgroundTasks):
    settings = get_all_settings()
    active_preset = req.preset or settings.get("active_preset", "viral")
    
    source = stream_monitor.active_source_video
    if not source or not os.path.exists(source):
        source = str(TEST_ASSETS_DIR / "sample_gta6_gameplay.mp4")
        
    from app.services.editing_service import probe_video
    try:
        meta = probe_video(source)
        total_dur = float(meta.get("format", {}).get("duration", 30.0))
    except Exception:
        total_dur = 30.0
        
    end_t = min(total_dur, req.end_time) if req.end_time > 0 else total_dur
    start_t = max(0.0, end_t - 20.0)
    duration = max(5.0, round(end_t - start_t, 1))
    
    title = req.title or (stream_monitor.title if stream_monitor.title else "GTA VI Highlight")
    hook = req.hook or "CHECK THIS MOMENT OUT 🔥"
    score = 88.0
    
    clip_id = create_clip_record(
        moment_id=None,
        title=title,
        hook=hook,
        description="Manually captured live moment.",
        hashtags="#GTA6 #Gaming #Shorts",
        duration=duration,
        score=score,
        preset=active_preset,
        raw_path=source,
        original_timestamp=start_t
    )
    
    def _do_render():
        extract_and_render_clip(
            clip_id=clip_id,
            source_video_path=source,
            start_time=start_t,
            end_time=end_t,
            preset=active_preset,
            title=title,
            hook=hook,
            score=score
        )
        
    background_tasks.add_task(_do_render)
    return {"success": True, "clip_id": clip_id, "message": "Clip generation queued"}

# Dashboard Stats & Settings
@app.get("/api/stats")
def get_dashboard_stats():
    return get_stats()

@app.get("/api/settings")
def get_settings():
    return {
        "settings": get_all_settings(),
        "presets": PRESET_CONFIGS
    }

@app.post("/api/settings")
def update_settings(req: SettingsUpdateRequest):
    if req.active_preset:
        update_setting("active_preset", req.active_preset)
    if req.score_threshold:
        update_setting("score_threshold", req.score_threshold)
    if req.buffer_duration:
        update_setting("buffer_duration", req.buffer_duration)
    if req.target_clip_duration:
        update_setting("target_clip_duration", req.target_clip_duration)
    return {"success": True, "settings": get_all_settings()}

@app.get("/api/presets")
def get_presets():
    return PRESET_CONFIGS

# Mount frontend production build if available
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

