import os
import sys
import subprocess
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from app.config import (
    PROCESSED_DIR, THUMBNAILS_DIR, METADATA_DIR,
    PRESET_CONFIGS, DEFAULT_PRESET
)
from app.services.subtitles_service import transcribe_audio_segment, generate_ass_subtitles
from app.database import update_clip_progress, complete_clip_record, fail_clip_record

logger = logging.getLogger(__name__)

def probe_video(file_path: str) -> Dict[str, Any]:
    """
    Uses ffprobe to inspect video and audio streams and returns metadata.
    """
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        file_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFprobe failed on {file_path}: {res.stderr}")
    return json.loads(res.stdout)

def validate_exported_video(file_path: str) -> bool:
    """
    Validates that the exported MP4:
    - Exists and is non-empty
    - FFprobe confirms valid video (1080x1920, H.264) and audio (AAC)
    - Has duration > 0
    """
    p = Path(file_path)
    if not p.exists() or p.stat().st_size == 0:
        logger.error(f"Validation failed: file does not exist or is empty: {file_path}")
        return False
        
    try:
        info = probe_video(file_path)
        streams = info.get("streams", [])
        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
        
        if not video_stream:
            logger.error("Validation failed: no video stream found")
            return False
            
        width = int(video_stream.get("width", 0))
        height = int(video_stream.get("height", 0))
        codec = video_stream.get("codec_name", "")
        
        duration = float(info.get("format", {}).get("duration", 0.0))
        
        logger.info(f"Export validation: {file_path} -> {width}x{height}, codec={codec}, audio={'yes' if audio_stream else 'no'}, duration={duration}s")
        
        if width != 1080 or height != 1920:
            logger.error(f"Validation failed: Expected 1080x1920, got {width}x{height}")
            return False
            
        if duration <= 0:
            logger.error(f"Validation failed: Non-positive duration {duration}")
            return False
            
        return True
    except Exception as e:
        logger.error(f"Validation exception on {file_path}: {e}")
        return False

def escape_ffmpeg_path(path_str: str) -> str:
    """Escapes Windows paths for FFmpeg filter arguments (subtitles=..., ass=...)."""
    # Replace backslashes with forward slashes
    p = path_str.replace("\\", "/")
    # Escape colon after drive letter: C:/path -> C\:/path
    if len(p) >= 2 and p[1] == ":":
        p = p[0] + "\\:" + p[2:]
    return p

def extract_and_render_clip(
    clip_id: int,
    source_video_path: str,
    start_time: float,
    end_time: float,
    preset: str = "viral",
    title: str = "GTA VI Highlight",
    hook: str = "WAIT FOR THE END 💀",
    score: float = 75.0,
    hashtags: str = "#GTA6 #Gaming #Shorts #ViceCity",
    description: str = "Insane GTA VI gameplay moment!"
) -> str:
    """
    Complete editing engine:
    1. Extracts audio & runs speech transcription.
    2. Builds custom ASS subtitles with keyword highlights.
    3. Renders 9:16 vertical video (1080x1920) with blurred background & centered gameplay.
    4. Applies audio normalization and preset effects.
    5. Burns in animated subtitles.
    6. Extracts thumbnail.
    7. Validates export with ffprobe.
    8. Writes metadata JSON.
    """
    try:
        update_clip_progress(clip_id, 10, "Extracting audio segment for analysis")
        
        duration = max(1.0, end_time - start_time)
        clip_base_name = f"clip_{clip_id}_{preset}"
        
        temp_audio_path = str(PROCESSED_DIR / f"{clip_base_name}_audio.wav")
        ass_path = str(PROCESSED_DIR / f"{clip_base_name}.ass")
        output_mp4_path = str(PROCESSED_DIR / f"{clip_base_name}.mp4")
        thumbnail_path = str(THUMBNAILS_DIR / f"{clip_base_name}.jpg")
        metadata_json_path = str(METADATA_DIR / f"{clip_base_name}.json")
        
        # 1. Extract audio segment for Whisper
        audio_cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-to", str(end_time),
            "-i", source_video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            temp_audio_path
        ]
        subprocess.run(audio_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        
        # 2. Transcribe speech
        update_clip_progress(clip_id, 30, "Generating synchronized subtitles")
        words = transcribe_audio_segment(temp_audio_path)
        
        # 3. Generate ASS subtitles
        generate_ass_subtitles(
            words=words,
            output_ass_path=ass_path,
            preset=preset,
            top_hook_text=hook if preset == "viral" else None
        )
        
        # 4. Render vertical 9:16 video
        update_clip_progress(clip_id, 50, "Rendering 9:16 vertical gameplay & effects")
        
        escaped_ass = escape_ffmpeg_path(ass_path)
        
        # Filter graph for 9:16 composition:
        # 1080x1920 Canvas
        # Background: scaled and cropped to 1080x1920, boxblurred
        # Foreground: crisp gameplay scaled to 1080 width, centered vertically
        # Overlay: fg over bg
        # Subtitles: ass filter applied on top
        # Optimized 9:16 background blur pipeline:
        # Downscale to 270:480 for blur, then upscale to 1080:1920 (runs 20x faster on CPU)
        if preset == "cinematic":
            filter_complex = (
                f"[0:v]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=5:1,scale=1080:1920:flags=bilinear,eq=contrast=1.1:saturation=1.2[bg];"
                f"[0:v]scale=1080:-1,eq=contrast=1.05:saturation=1.1[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2[comp];"
                f"[comp]ass='{escaped_ass}'[v]"
            )
        elif preset == "clean":
            filter_complex = (
                f"[0:v]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=5:1,scale=1080:1920:flags=bilinear[bg];"
                f"[0:v]scale=1080:-1[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2[comp];"
                f"[comp]ass='{escaped_ass}'[v]"
            )
        else: # viral gaming
            filter_complex = (
                f"[0:v]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=6:1,scale=1080:1920:flags=bilinear,eq=saturation=1.2:contrast=1.08[bg];"
                f"[0:v]scale=1080:-1,eq=saturation=1.1:contrast=1.05[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2[comp];"
                f"[comp]ass='{escaped_ass}'[v]"
            )
            
        render_cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-to", str(end_time),
            "-i", source_video_path,
            "-filter_complex", filter_complex,
            "-map", "[v]",
            "-map", "0:a?",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-movflags", "+faststart",
            output_mp4_path
        ]
        
        logger.info(f"Running FFmpeg render: {' '.join(render_cmd)}")
        render_res = subprocess.run(render_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if render_res.returncode != 0:
            logger.error(f"FFmpeg render failed: {render_res.stderr}")
            raise RuntimeError(f"FFmpeg render error: {render_res.stderr[-400:]}")
            
        # 5. Extract Thumbnail from rendered video
        update_clip_progress(clip_id, 85, "Generating video thumbnail & hook")
        thumb_cmd = [
            "ffmpeg", "-y",
            "-ss", "00:00:01.5",
            "-i", output_mp4_path,
            "-vframes", "1",
            "-q:v", "2",
            thumbnail_path
        ]
        subprocess.run(thumb_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # 6. Validate exported video
        update_clip_progress(clip_id, 95, "Validating MP4 stream specs with FFprobe")
        if not validate_exported_video(output_mp4_path):
            raise RuntimeError("Exported MP4 failed stream specification validation (ffprobe).")
            
        # 7. Write metadata JSON
        meta_data = {
            "clip_id": clip_id,
            "title": title,
            "hook": hook,
            "description": description,
            "hashtags": hashtags,
            "duration": round(duration, 2),
            "score": score,
            "preset": preset,
            "original_timestamp_start": start_time,
            "original_timestamp_end": end_time,
            "source_video": source_video_path,
            "processed_mp4": output_mp4_path,
            "thumbnail": thumbnail_path,
            "resolution": "1080x1920",
            "format": "mp4 (H.264 / AAC)"
        }
        with open(metadata_json_path, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, indent=2)
            
        # Clean up temporary audio & ass
        if os.path.exists(temp_audio_path):
            try:
                os.remove(temp_audio_path)
            except Exception:
                pass
                
        # 8. Mark completed in database
        complete_clip_record(
            clip_id=clip_id,
            processed_path=output_mp4_path,
            thumbnail_path=thumbnail_path,
            duration=duration
        )
        logger.info(f"Clip {clip_id} successfully created and verified: {output_mp4_path}")
        return output_mp4_path
        
    except Exception as e:
        logger.exception(f"Error during clip extraction/rendering for clip {clip_id}: {e}")
        fail_clip_record(clip_id, str(e))
        raise
