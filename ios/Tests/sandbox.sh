#!/bin/sh
# A throwaway copy of the Mac's server for trying the iPhone app, never the real data.
#   ios/Tests/sandbox.sh start   copy db.json, start an isolated server with the iPhone gateway on; prints a pairing code
#                                only if no device is paired yet (pairings persist across runs, so the simulator stays paired)
#   ios/Tests/sandbox.sh code    print a fresh pairing code
#   ios/Tests/sandbox.sh stop    stop it (pairing is kept)
#   ios/Tests/sandbox.sh reset   stop it and forget every paired device
# Ports 4000/4001/4002 and /tmp only; the real app on 3000/3001 is not touched.
cd "$(dirname "$0")/../.."
case "$1" in
start)
  cp db.json /tmp/sandbox-db.json
  # Run under the Kubera binary: it is the one the macOS firewall already lets accept connections.
  (env -u ANTHROPIC_API_KEY ELECTRON_RUN_AS_NODE=1 NEWS_COLLECT_HOURS=0 DB_FILE=/tmp/sandbox-db.json PROXY_PORT=4000 INTERNAL_PORT=4001 \
    LAN_PORT=4002 SQLITE_READS=on SQLITE_WRITES=on /Applications/Kubera.app/Contents/MacOS/Kubera server.js > /tmp/sandbox.log 2>&1 &)
  sleep 8
  curl -s -m 8 -X POST "http://127.0.0.1:4000/api/lan/enabled?on=1" > /dev/null
  if grep -q '"id"' /tmp/.kubera-lan.json 2>/dev/null; then echo "a device is already paired; use '$0 code' for another"; else "$0" code; fi ;;
code)
  curl -s -m 5 -X POST http://127.0.0.1:4000/api/lan/pair | node -pe "'pairing code: ' + JSON.parse(require('fs').readFileSync(0,'utf8')).code" ;;
stop|reset)
  for p in 4000 4001 4002; do lsof -tiTCP:$p -sTCP:LISTEN | xargs kill 2>/dev/null; done
  pkill -f "dns-sd -R Kubera"
  [ "$1" = reset ] && rm -f /tmp/.kubera-lan.json
  echo "$1 done" ;;
*) echo "usage: $0 start|code|stop|reset"; exit 1 ;;
esac
