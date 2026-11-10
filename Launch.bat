@echo off
setlocal
title Unified Engineering Workbench Launcher

echo ========================================================
echo        UNIFIED ENGINEERING WORKBENCH (Windows 11)        
echo ========================================================
echo.
echo Launching application in your default web browser...

set "HTML_PATH=%~dp0index.html"

:: 1. Launch via default Windows association
start "" "%HTML_PATH%"

:: 2. Fallback check: if default association fails or window didn't open
if errorlevel 1 (
    echo Attempting direct browser launch via Microsoft Edge...
    start msedge "%HTML_PATH%"
)

echo.
echo Workbench started successfully.
echo You may keep this window open or close it at any time.
timeout /t 3 >nul
exit
