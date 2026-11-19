from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CLIPS_DIR = BASE_DIR / "GTA6-Clips"
RAW_DIR = CLIPS_DIR / "Raw"
BUFFER_DIR = RAW_DIR / "buffer"
PROCESSED_DIR = CLIPS_DIR / "Processed"
APPROVED_DIR = CLIPS_DIR / "Approved"
REJECTED_DIR = CLIPS_DIR / "Rejected"
THUMBNAILS_DIR = CLIPS_DIR / "Thumbnails"
METADATA_DIR = CLIPS_DIR / "Metadata"
TEST_ASSETS_DIR = BASE_DIR / "test_assets"

DB_PATH = BASE_DIR / "gta6_clipper.db"

# Ensure all directories exist
for d in [BUFFER_DIR, PROCESSED_DIR, APPROVED_DIR, REJECTED_DIR, THUMBNAILS_DIR, METADATA_DIR, TEST_ASSETS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

DEFAULT_SCORE_THRESHOLD = 65.0
BUFFER_RETENTION_SECONDS = 300  # 5 minutes rolling window
MIN_CLIP_DURATION = 15.0
MAX_CLIP_DURATION = 60.0
DEFAULT_TARGET_CLIP_DURATION = 30.0

DEFAULT_PRESET = "viral"

PRESET_CONFIGS = {
    "viral": {
        "id": "viral",
        "name": "VIRAL GAMING",
        "description": "Dynamic subtitles, highlighted keywords, subtle dynamic zoom, strong opening hook.",
        "font_size": 28,
        "primary_color": "&H00FFFFFF",     # White
        "highlight_color": "&H0000FFFF",   # Neon Yellow
        "border_color": "&H00000000",      # Black border
        "border_width": 3,
        "zoom_effect": True,
        "top_hook_banner": True,
        "normalize_audio": True,
    },
    "clean": {
        "id": "clean",
        "name": "CLEAN GAMEPLAY",
        "description": "Minimal editing, clean subtitles, original gameplay audio, smooth transitions.",
        "font_size": 22,
        "primary_color": "&H00FFFFFF",
        "highlight_color": "&H00FFFFFF",
        "border_color": "&H80000000",
        "border_width": 2,
        "zoom_effect": False,
        "top_hook_banner": False,
        "normalize_audio": True,
    },
    "cinematic": {
        "id": "cinematic",
        "name": "CINEMATIC GTA",
        "description": "Cinematic framing, subtle slow push-in zoom, minimal captions, rich audio.",
        "font_size": 20,
        "primary_color": "&H00E0E0E0",
        "highlight_color": "&H00D4AF37",   # Subtle gold
        "border_color": "&H00000000",
        "border_width": 1.5,
        "zoom_effect": True,
        "top_hook_banner": False,
        "normalize_audio": True,
    }
}
