#!/bin/zsh
# 이 맥에 "매일 07:00 업데이트" 예약을 건다. 다시 실행하면 예약을 새로 덮어쓴다.
# 해제: launchctl bootout gui/$(id -u)/com.ai-radar.daily && rm ~/Library/LaunchAgents/com.ai-radar.daily.plist
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_BIN="$(command -v claude)" || { echo "claude 명령을 찾을 수 없음. Claude Code부터 설치하세요."; exit 1; }
PLIST=~/Library/LaunchAgents/com.ai-radar.daily.plist
chmod +x "$DIR/scripts/daily.sh"
mkdir -p ~/Library/LaunchAgents "$DIR/logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.ai-radar.daily</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$DIR/scripts/daily.sh</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$CLAUDE_BIN"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StandardErrorPath</key><string>$DIR/logs/launchd.err</string>
</dict></plist>
PL
launchctl bootout gui/$(id -u)/com.ai-radar.daily 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST"
echo "예약 완료: 매일 07:00 · $DIR"
echo "지금 바로 시험 실행: launchctl kickstart gui/$(id -u)/com.ai-radar.daily"
