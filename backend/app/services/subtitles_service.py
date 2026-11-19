import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Try loading faster-whisper
WHISPER_MODEL = None

def get_whisper_model():
    global WHISPER_MODEL
    if WHISPER_MODEL is None:
        try:
            from faster_whisper import WhisperModel
            logger.info("Initializing faster-whisper on CPU (int8)...")
            # Using 'tiny' or 'base' model for CPU efficiency and fast inference
            WHISPER_MODEL = WhisperModel("tiny", device="cpu", compute_type="int8")
            logger.info("faster-whisper model loaded successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize faster-whisper: {e}")
            WHISPER_MODEL = None
    return WHISPER_MODEL

def transcribe_audio_segment(audio_path: str) -> List[Dict[str, Any]]:
    """
    Transcribes audio segment and returns word-level timestamps if possible.
    Returns: List of dicts: [{'start': 0.5, 'end': 1.2, 'text': 'LOOK OUT'}]
    """
    model = get_whisper_model()
    if not model or not os.path.exists(audio_path):
        return []
    
    try:
        import numpy as np
        # Read the 16kHz mono 16-bit PCM WAV extracted by ffmpeg
        with open(audio_path, "rb") as f:
            f.seek(44)  # Skip standard 44-byte WAV header
            raw_data = f.read()
            
        if not raw_data:
            return []
            
        audio_np = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32) / 32768.0
        segments, info = model.transcribe(audio_np, word_timestamps=True)
        words_list = []
        for segment in segments:
            if segment.words:
                for w in segment.words:
                    clean_word = w.word.strip()
                    if clean_word:
                        words_list.append({
                            "start": float(w.start),
                            "end": float(w.end),
                            "text": clean_word
                        })
            else:
                words_list.append({
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "text": segment.text.strip()
                })
        return words_list
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        return []

def format_ass_time(seconds: float) -> str:
    """Format seconds into ASS timestamp: H:MM:SS.cs"""
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centis = int(round((seconds - int(seconds)) * 100))
    if centis >= 100:
        centis = 99
    return f"{hrs}:{mins:02d}:{secs:02d}.{centis:02d}"

HIGHLIGHT_KEYWORDS = {
    "GTA", "VI", "LOOK", "OUT", "COP", "COPS", "BUSTED", "WASTED", "RUN", "DRIVE", "FAST",
    "INSANE", "WTF", "OMG", "BRO", "NO", "WAY", "CAR", "EXPLOSION", "HELI", "CRAZY", "SHOOT",
    "NPC", "LEONIDA", "VICE", "CITY", "JASON", "LUCIA", "DEAD", "WIN", "CLUTCH", "MONEY"
}

def generate_ass_subtitles(
    words: List[Dict[str, Any]],
    output_ass_path: str,
    preset: str = "viral",
    top_hook_text: Optional[str] = None
) -> str:
    """
    Generates an Advanced SubStation Alpha (.ass) subtitle file formatted for 1080x1920 vertical video.
    """
    is_viral = (preset == "viral")
    is_cinematic = (preset == "cinematic")
    
    font_name = "Arial"
    primary_color = "&H00FFFFFF"    # White in ASS (&HAABBGGRR)
    highlight_color = "&H0000FFFF"  # Bright Yellow
    border_color = "&H00000000"     # Pure Black
    font_size = 32 if is_viral else (24 if is_cinematic else 28)
    
    # 1080x1920 PlayRes
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color},&H000000FF,{border_color},&H80000000,-1,0,0,0,100,100,1,0,1,4,2,2,40,40,280,1
Style: HookBanner,{font_name},34,&H00FFFFFF,&H000000FF,&H00101010,&HCC000000,-1,0,0,0,100,100,1,0,1,4,3,8,40,40,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    
    # Optional Top Hook Banner (shows during the first 4 seconds)
    if top_hook_text and is_viral:
        hook_clean = top_hook_text.upper().replace("\n", " ")
        events.append(f"Dialogue: 1,0:00:00.00,0:00:04.50,HookBanner,,0,0,0,,{{\\an8\\bord4\\shad2}}{hook_clean}")
    
    # Group words into short punchy caption lines (2-4 words per line for TikTok/Reels readability)
    if words:
        chunk_size = 3 if is_viral else 4
        chunks = []
        for i in range(0, len(words), chunk_size):
            chunks.append(words[i:i + chunk_size])
            
        for chunk in chunks:
            start_time = format_ass_time(chunk[0]["start"])
            end_time = format_ass_time(chunk[-1]["end"] + 0.1)
            
            # Build text with highlights
            formatted_words = []
            for w in chunk:
                word_clean = w["text"].upper() if is_viral else w["text"]
                clean_test = re.sub(r'[^A-Za-z0-9]', '', word_clean.upper())
                if is_viral and clean_test in HIGHLIGHT_KEYWORDS:
                    formatted_words.append(f"{{\\c{highlight_color}\\b1}}{word_clean}{{\\c{primary_color}\\b1}}")
                else:
                    formatted_words.append(word_clean)
                    
            line_text = " ".join(formatted_words)
            # Centered in lower middle (alignment 2, marginV 280-320 above bottom UI)
            events.append(f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{line_text}")
    else:
        # If no speech was spoken, insert a clean gaming marker if viral
        if top_hook_text:
            hook_clean = top_hook_text.upper()
            events.append(f"Dialogue: 0,0:00:00.50,0:00:05.00,Default,,0,0,0,,{{\\c{highlight_color}\\b1}}{hook_clean}")
            
    content = header + "\n".join(events) + "\n"
    
    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    return output_ass_path
