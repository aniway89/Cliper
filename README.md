# GTA VI Autonomous AI Clipper 🎬🚀

A complete, functional, local-first AI livestream clipping and automatic video editing application designed to monitor live GTA VI gameplay, detect entertaining highlights, extract footage with rolling buffering, and automatically edit/render vertical 9:16 MP4 videos ready for YouTube Shorts, Instagram Reels, and TikTok.

---

## 🌟 Key Features

1. **Livestream Connection & Ingestion**:
   - Accepts YouTube livestream URLs directly from the UI.
   - Live stream validation and metadata extraction (title, channel, thumbnail, live/offline status) powered by `yt-dlp`.
   - Authorized local recording and demo stream support (`test_assets/sample_gta6_gameplay.mp4`).

2. **Multimodal AI Highlight Detection**:
   - **Audio Analysis**: RMS energy, sudden reaction bursts, screams, gunshots, and explosion spikes.
   - **Computer Vision**: Optical motion intensity, scene-cut frequency, and luminance flash monitoring via OpenCV.
   - **Speech-to-Text Transcription**: CPU-optimized `faster-whisper` (int8) with word-level timestamps.
   - **Context-Aware Scoring**: Generates 1–100 scores across 5 criteria (Entertainment Value, Surprise Factor, Uniqueness, Gameplay Intensity, Reaction Quality).
   - **Automatic Clip Selection**: Automatically triggers rendering for moments scoring ≥ 65 (customizable threshold).
   - **De-duplication**: Prevents duplicate clips of the same ongoing event.

3. **FFmpeg Video Editing & Rendering Engine**:
   - Converts standard 16:9 gameplay to vertical 9:16 format (1080 × 1920) with blurred background framing.
   - Dynamic animated subtitles with keyword highlighting in neon yellow/gold.
   - Audio normalization via FFmpeg `loudnorm` filter.
   - Generates engaging hooks, titles, hashtags, and thumbnails.
   - Automatic `ffprobe` stream validation ensuring valid H.264 video, AAC audio, and non-zero duration.

4. **Three Built-in Editing Presets**:
   - **PRESET A: VIRAL GAMING**: Dynamic subtitles, highlighted keywords, dynamic zoom, top hook banner, punchy color contrast.
   - **PRESET B: CLEAN GAMEPLAY**: Minimalist subtitle typography, centered gameplay framing, original unaltered gameplay audio, smooth transitions.
   - **PRESET C: CINEMATIC GTA**: Cinematic color grading & contrast, slow push-in zoom, minimalist gold captions, rich audio enhancement.

5. **Organized Local Storage**:
   ```
   GTA6-Clips/
   ├── Raw/
   │   └── buffer/
   ├── Processed/
   ├── Approved/
   ├── Rejected/
   ├── Thumbnails/
   └── Metadata/
   ```

---

## 🚀 Quick Start Guide

### 1. Requirements
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ (tested on Node v24)
- FFmpeg (with `libass` and `libx264` support)

### 2. Backend Server
From the project root:
```bash
python backend/run_server.py
```
*Backend runs at `http://127.0.0.1:8000`.*

### 3. Frontend Dashboard
From the `frontend/` directory:
```bash
cd frontend
npm run dev
```
*Frontend runs at `http://127.0.0.1:5173` (proxied to backend) or directly via `http://127.0.0.1:8000` (pre-built production bundle).*

---

## 🎮 How to Use

1. Open `http://127.0.0.1:5173` or `http://127.0.0.1:8000` in your web browser.
2. In the **Livestream Connection** card, paste a live YouTube stream URL (e.g. `https://www.youtube.com/watch?v=STREAM_ID`) or click **"Use Authorized Test Stream"**.
3. Click **Connect Stream**.
4. Click **Start Monitoring** to begin autonomous AI analysis.
5. As highlights are detected, the processing queue will transcribe speech, style captions, and render finished 9:16 MP4 clips into `GTA6-Clips/Processed/`.
6. Click **Preview** on any clip to play the vertical video in the built-in player modal, or click **Download MP4** to save it directly to your computer.
7. Click the **Check (Approve)** or **X (Reject)** buttons to organize approved videos into `GTA6-Clips/Approved/`.

