import os
import cv2
import numpy as np
import subprocess
import json
import logging
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path
from app.services.subtitles_service import transcribe_audio_segment

logger = logging.getLogger(__name__)

EVENT_TEMPLATES = [
    {
        "type": "Police Chase & Chaos",
        "title": "5-STAR WANTED LEVEL COP CHASE ESCAPE!",
        "hook": "HE ACTUALLY SURVIVED THIS?! 🚔💀",
        "description": "Insane high-speed police chase across Vice City in GTA VI.",
        "hashtags": "#GTA6 #ViceCity #CopChase #GamingShorts #GTAClips"
    },
    {
        "type": "Explosion & Combat",
        "title": "GTA 6 EXPLOSION PHYSICS ARE UNREAL!",
        "hook": "THE PHYSICS IN GTA 6 ARE NUTS 💥",
        "description": "Massive vehicular explosion and ragdoll reaction in GTA VI.",
        "hashtags": "#GTAVI #GTA6Gameplay #Explosion #NextGenGaming"
    },
    {
        "type": "Funny NPC Glitch",
        "title": "LEONIDA NPC AI GONE COMPLETELY ROGUE 😂",
        "hook": "THE NPCS IN GTA 6 HAVE NO CHILL 😭",
        "description": "Unbelievable NPC interaction caught live in Vice City.",
        "hashtags": "#GTA6NPC #FunnyMoments #GamingHumor #Shorts"
    },
    {
        "type": "Streamer Reaction & Clutch",
        "title": "STREAMER CANNOT BELIEVE WHAT JUST HAPPENED!",
        "hook": "WAIT FOR HIS REACTION AT THE END 😱",
        "description": "Wild live reaction to unexpected turn of events in GTA 6.",
        "hashtags": "#GTA6 #StreamerMoments #Reactions #GamingClips"
    },
    {
        "type": "Stunt & Driving",
        "title": "CLEANEST VEHICLE STUNT IN GTA 6 HISTORY",
        "hook": "1 IN A MILLION GTA 6 MOMENT 🔥",
        "description": "Calculated high-speed stunt landing in downtown Vice City.",
        "hashtags": "#GTA6Stunt #ViceCityDrive #GamingSkills #ViralShorts"
    }
]

def analyze_audio_energy(video_path: str, start_time: float, duration: float) -> Tuple[float, float]:
    """
    Analyzes RMS energy and dynamic peak variance in the audio stream.
    Returns: (mean_energy_score, peak_variance_score) both 0-100.
    """
    try:
        temp_wav = video_path + f"_temp_{int(start_time)}.wav"
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-t", str(duration),
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            temp_wav
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode != 0 or not os.path.exists(temp_wav):
            return 50.0, 50.0
            
        with open(temp_wav, "rb") as f:
            # Skip 44-byte WAV header
            f.seek(44)
            audio_bytes = f.read()
            
        if os.path.exists(temp_wav):
            try:
                os.remove(temp_wav)
            except Exception:
                pass
                
        if not audio_bytes:
            return 50.0, 50.0
            
        samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32)
        if len(samples) == 0:
            return 50.0, 50.0
            
        # RMS energy
        rms = np.sqrt(np.mean(samples**2))
        max_possible_rms = 32768.0
        normalized_rms = min(100.0, (rms / 8000.0) * 100.0)
        
        # Peak bursts (sudden loud reactions, explosions)
        chunk_size = 1600 # 100ms
        chunks = [np.max(np.abs(samples[i:i+chunk_size])) for i in range(0, len(samples), chunk_size) if len(samples[i:i+chunk_size]) > 0]
        peak_var = np.std(chunks) if chunks else 0.0
        normalized_var = min(100.0, (peak_var / 6000.0) * 100.0)
        
        return float(normalized_rms), float(normalized_var)
    except Exception as e:
        logger.warning(f"Audio analysis exception: {e}")
        return 55.0, 60.0

def analyze_visual_motion(video_path: str, start_time: float, duration: float) -> Tuple[float, int]:
    """
    Samples frames using OpenCV to compute optical motion intensity and scene cut frequency.
    Returns: (motion_score [0-100], scene_cuts_count)
    """
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return 50.0, 0
            
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        start_frame = int(start_time * fps)
        total_frames = int(duration * fps)
        
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        
        prev_gray = None
        motion_diffs = []
        scene_cuts = 0
        step = max(1, int(fps / 4)) # Sample 4 times per second for CPU speed
        
        read_count = 0
        while read_count < total_frames:
            ret, frame = cap.read()
            if not ret:
                break
            read_count += 1
            if read_count % step != 0:
                continue
                
            # Resize frame down for fast analysis
            small = cv2.resize(frame, (160, 90))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            
            if prev_gray is not None:
                diff = cv2.absdiff(gray, prev_gray)
                mean_diff = np.mean(diff)
                motion_diffs.append(mean_diff)
                # Scene cut threshold
                if mean_diff > 35.0:
                    scene_cuts += 1
                    
            prev_gray = gray
            
        cap.release()
        
        if not motion_diffs:
            return 50.0, 0
            
        avg_motion = np.mean(motion_diffs)
        # Scale to 0-100
        motion_score = min(100.0, (avg_motion / 20.0) * 100.0)
        return float(motion_score), scene_cuts
    except Exception as e:
        logger.warning(f"Visual motion analysis error: {e}")
        return 55.0, 1

def evaluate_moment_score(
    video_path: str,
    start_time: float,
    duration: float,
    transcript_text: str = ""
) -> Dict[str, Any]:
    """
    Multimodal AI Moment Evaluator:
    Combines:
    - Audio energy & peak reactions
    - Visual motion intensity & scene changes
    - Dialogue / transcript keywords
    Outputs:
    Score 1-100, Breakdown, Event Type, Title, Hook, Hashtags, Reason
    """
    audio_energy, peak_var = analyze_audio_energy(video_path, start_time, duration)
    motion_score, scene_cuts = analyze_visual_motion(video_path, start_time, duration)
    
    # Text bonus
    text_bonus = 0.0
    text_lower = transcript_text.lower()
    keywords = ["cop", "police", "omg", "look", "wtf", "run", "dead", "shoot", "car", "helicopter", "bro", "no way", "clutch", "busted", "wasted", "explode"]
    matched_keywords = [k for k in keywords if k in text_lower]
    text_bonus = min(25.0, len(matched_keywords) * 6.0)
    
    # 5 Criteria:
    # 1. Entertainment value (max 25)
    entertainment_val = min(25.0, (audio_energy * 0.15) + (peak_var * 0.10))
    # 2. Surprise factor (max 20)
    surprise_factor = min(20.0, (peak_var * 0.12) + (scene_cuts * 3.0))
    # 3. Uniqueness (max 15)
    uniqueness = min(15.0, 8.0 + (text_bonus * 0.3))
    # 4. Gameplay intensity (max 20)
    gameplay_intensity = min(20.0, (motion_score * 0.20))
    # 5. Reaction quality (max 20)
    reaction_quality = min(20.0, (peak_var * 0.12) + (audio_energy * 0.08))
    
    total_score = min(100.0, entertainment_val + surprise_factor + uniqueness + gameplay_intensity + reaction_quality)
    
    # Determine dominant event type and metadata
    if "cop" in text_lower or "police" in text_lower or (motion_score > 60 and scene_cuts >= 2):
        template = EVENT_TEMPLATES[0]
    elif "explode" in text_lower or peak_var > 65:
        template = EVENT_TEMPLATES[1]
    elif "npc" in text_lower or "bro" in text_lower or text_bonus > 15:
        template = EVENT_TEMPLATES[2]
    elif reaction_quality > 15 or peak_var > 60:
        template = EVENT_TEMPLATES[3]
    else:
        template = EVENT_TEMPLATES[4]
        
    reason = (
        f"High action moment detected (Motion: {motion_score:.1f}%, Audio Peak: {peak_var:.1f}%, "
        f"Cuts: {scene_cuts}, Audio Energy: {audio_energy:.1f}%). Identified as {template['type']}."
    )
    
    return {
        "score": round(total_score, 1),
        "entertainment_breakdown": {
            "entertainment_value": round(entertainment_val, 1),
            "surprise_factor": round(surprise_factor, 1),
            "uniqueness": round(uniqueness, 1),
            "gameplay_intensity": round(gameplay_intensity, 1),
            "reaction_quality": round(reaction_quality, 1)
        },
        "event_type": template["type"],
        "title": template["title"],
        "hook": template["hook"],
        "description": template["description"],
        "hashtags": template["hashtags"],
        "reason": reason
    }
