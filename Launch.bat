@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Unified Engineering Workbench

echo ========================================================
echo        UNIFIED ENGINEERING WORKBENCH (Windows 11)
echo ========================================================
echo.

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
set "SERVER_EXE=%APP_DIR%\build\Release\workbench_server.exe"
if not exist "%SERVER_EXE%" set "SERVER_EXE=%APP_DIR%\build\workbench_server.exe"
if not exist "%SERVER_EXE%" set "SERVER_EXE=%APP_DIR%\workbench_server.exe"
set "HTML_PATH=%APP_DIR%\src\frontend\index.html"
set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

:: 1. Start C++17 HTTP Server if available
if exist "%SERVER_EXE%" (
    echo Starting native C++17 REST backend on 127.0.0.1:7474...
    start "Unified Engineering Workbench Backend" /MIN "%SERVER_EXE%" 7474 "%APP_DIR%"
    timeout /t 1 /nobreak >nul 2>&1
    set "TARGET_URL=http://127.0.0.1:7474/index.html"
) else (
    echo [Notice] workbench_server.exe not found; opening in direct presentation mode.
    set "TARGET_URL=%HTML_PATH%"
)

echo Opening workbench at: %TARGET_URL%
echo.

:: Try Chrome
if exist "%CHROME%" (
    echo Launching in Google Chrome...
    start "" "%CHROME%" "%TARGET_URL%"
    goto :done
)

:: Try Edge (x86 path)
if exist "%EDGE%" (
    echo Launching in Microsoft Edge...
    start "" "%EDGE%" "%TARGET_URL%"
    goto :done
)

:: Try Edge (default path)
if exist "%EDGE2%" (
    echo Launching in Microsoft Edge...
    start "" "%EDGE2%" "%TARGET_URL%"
    goto :done
)

:: Final fallback: Default system browser
echo Launching in default browser...
start "" "%TARGET_URL%"

:done
echo.
echo Workbench launched successfully!
timeout /t 2 /nobreak >nul 2>&1
exit /b 0
