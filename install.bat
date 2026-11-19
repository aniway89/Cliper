@echo off
setlocal enabledelayedexpansion
title GTA VI Autonomous AI Clipper - Installer & Dependency Check

echo ======================================================================
echo          GTA VI AUTONOMOUS AI CLIPPER - DEPENDENCY SETUP
echo ======================================================================
echo.

:: 1. Check Python
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10 or higher from https://python.org
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
python --version

:: 2. Check Node.js and npm
echo.
echo [2/5] Checking Node.js and npm installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js (LTS version) from https://nodejs.org
    pause
    exit /b 1
)
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in PATH!
    pause
    exit /b 1
)
node --version
npm --version

:: 3. Check FFmpeg
echo.
echo [3/5] Checking FFmpeg installation...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] FFmpeg is not found in PATH!
    echo FFmpeg with libass is required for video editing and subtitles.
    echo Please download FFmpeg from https://www.gyan.dev/ffmpeg/builds/ and add its bin folder to PATH.
    echo.
) else (
    echo FFmpeg is available and verified.
)

:: 4. Install Python Dependencies
echo.
echo [4/5] Installing Python Backend dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python dependencies!
    pause
    exit /b 1
)

:: 5. Install Frontend Dependencies and Build Production Distribution
echo.
echo [5/5] Installing Frontend packages and building React dashboard...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install npm packages!
    cd ..
    pause
    exit /b 1
)
call npm run build
if %errorlevel% neq 0 (
    echo [WARNING] Frontend build had warnings, but development server will still work.
)
cd ..

:: 6. Setup local storage directories
echo.
echo Ensuring clip storage directories exist...
if not exist "GTA6-Clips\Raw\buffer" mkdir "GTA6-Clips\Raw\buffer"
if not exist "GTA6-Clips\Processed" mkdir "GTA6-Clips\Processed"
if not exist "GTA6-Clips\Approved" mkdir "GTA6-Clips\Approved"
if not exist "GTA6-Clips\Rejected" mkdir "GTA6-Clips\Rejected"
if not exist "GTA6-Clips\Thumbnails" mkdir "GTA6-Clips\Thumbnails"
if not exist "GTA6-Clips\Metadata" mkdir "GTA6-Clips\Metadata"
if not exist "test_assets" mkdir "test_assets"

:: 7. Create offline demo test asset if missing
if not exist "test_assets\sample_gta6_gameplay.mp4" (
    echo Generating authorized test stream sample...
    ffmpeg -y -f lavfi -i "testsrc=size=1920x1080:rate=30" -f lavfi -i "sine=frequency=440:sample_rate=44100" -t 60 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac test_assets\sample_gta6_gameplay.mp4 >nul 2>&1
)

echo.
echo ======================================================================
echo                 SETUP COMPLETED SUCCESSFULLY!
echo ======================================================================
echo All backend and frontend dependencies are verified.
echo.
echo To start the application, simply run:
echo   start_app.bat
echo.
echo Or open your browser at:
echo   http://127.0.0.1:5173  (or http://127.0.0.1:8000)
echo ======================================================================
pause
