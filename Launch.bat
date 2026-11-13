@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Unified Engineering Workbench

echo ========================================================
echo        UNIFIED ENGINEERING WORKBENCH (Windows 11)
echo ========================================================
echo.

:: Resolve index.html path relative to this bat file (handles spaces in path)
set "HTML_PATH=%~dp0index.html"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

echo Starting workbench at: %HTML_PATH%
echo.

:: Try Chrome first
if exist "%CHROME%" (
    echo Launching in Google Chrome...
    start "" "%CHROME%" "%HTML_PATH%"
    goto :done
)

:: Try Edge (x86 path)
if exist "%EDGE%" (
    echo Launching in Microsoft Edge...
    start "" "%EDGE%" "%HTML_PATH%"
    goto :done
)

:: Try Edge (default path)
if exist "%EDGE2%" (
    echo Launching in Microsoft Edge...
    start "" "%EDGE2%" "%HTML_PATH%"
    goto :done
)

:: Final fallback: Windows shell open (default browser)
echo Launching in default browser...
start "" "%HTML_PATH%"

:done
echo.
echo Workbench launched successfully!
echo You can close this window.
timeout /t 2 /nobreak >nul 2>&1
exit /b 0
