#!/bin/zsh
set -euo pipefail

LABEL="com.user.bugreportweb.sync"
LOG_FILE="$HOME/Project/BugReportWeb/logs/auto-sync.log"

launchctl kickstart -k "gui/$(id -u)/$LABEL"
sleep 2

if [ -f "$LOG_FILE" ]; then
  tail -n 40 "$LOG_FILE"
else
  echo "log file not found: $LOG_FILE"
fi
