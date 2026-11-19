@echo off
title GTA VI Autonomous AI Clipper
echo ===================================================
echo     GTA VI AUTONOMOUS AI CLIPPER - LAUNCHER
echo ===================================================
echo.
echo [1/2] Starting Backend FastAPI Server on http://127.0.0.1:8000...
start "GTA VI Clipper Backend" cmd /k "python backend\run_server.py"

echo [2/2] Starting Frontend Vite Server on http://127.0.0.1:5173...
start "GTA VI Clipper Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application started successfully!
echo Open your browser at: http://127.0.0.1:5173 (or http://127.0.0.1:8000)
echo.
pause

