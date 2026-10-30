#!/bin/sh
# Compares the Swift core with the web app's own code on a real database.
#   ios/Tests/run-parity.sh [path/to/db.json]
# Works on a COPY under /tmp; the database is only read, and the golden file
# (your finances) is written outside the repo.
set -e
cd "$(dirname "$0")/../.."
DB="${1:-db.json}"
WORK=/tmp/kubera-parity
mkdir -p "$WORK"
cp "$DB" "$WORK/db.json"
npx esbuild ios/Tests/golden/make-golden.mjs --bundle --platform=node --format=esm --outfile="$WORK/make-golden.mjs" --log-level=warning
node "$WORK/make-golden.mjs" "$WORK/db.json" "$WORK/golden.json" "$(pwd)"
cd ios
KUBERA_DB="$WORK/db.json" KUBERA_GOLDEN="$WORK/golden.json" swift test 2>&1 | tail -25
