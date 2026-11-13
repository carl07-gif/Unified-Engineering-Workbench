#!/usr/bin/env bash
# Unified Engineering Workbench - Unix / Linux Launcher
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

SERVER_BIN=""
if [ -f "$DIR/workbench_server" ]; then
    SERVER_BIN="$DIR/workbench_server"
elif [ -f "$DIR/build/workbench_server" ]; then
    SERVER_BIN="$DIR/build/workbench_server"
elif [ -f "$DIR/build_wsl/workbench_server" ]; then
    SERVER_BIN="$DIR/build_wsl/workbench_server"
fi

TARGET_URL="file://$DIR/src/frontend/index.html"
if [ -n "$SERVER_BIN" ]; then
    echo "Starting C++17 REST backend on 127.0.0.1:7474..."
    "$SERVER_BIN" 7474 "$DIR" &
    SERVER_PID=$!
    sleep 0.5
    TARGET_URL="http://127.0.0.1:7474/index.html"
fi

echo "Opening workbench: $TARGET_URL"
if command -v xdg-open > /dev/null; then
    xdg-open "$TARGET_URL" 2>/dev/null &
elif command -v open > /dev/null; then
    open "$TARGET_URL" 2>/dev/null &
else
    echo "Please open $TARGET_URL in your browser."
fi
