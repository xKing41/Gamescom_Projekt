#!/bin/sh
# Startet Hort unter Linux. Chromiums Sandbox braucht ein chrome-sandbox mit Root-Rechten;
# nach dem Entpacken eines Archivs fehlen die meist. Dann läuft das Spiel ohne diese Sandbox –
# es lädt ohnehin nur seine eigenen Dateien und hat keinen Netzzugang.
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -u "$DIR/chrome-sandbox" ]; then
  exec "$DIR/hort" "$@"
fi
exec "$DIR/hort" --no-sandbox "$@"
