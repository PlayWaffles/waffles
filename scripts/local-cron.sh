#!/bin/bash
# Local cron simulator for game roundup
# Run: ./scripts/local-cron.sh

INTERVAL=${1:-300}  # Default 5 minutes (300 seconds)
PORT=${2:-3000}
BASE="http://localhost:${PORT}/api/cron"
# Endpoints to tick each interval (all POST, Bearer-authed). In production these
# are driven by an external scheduler with the same auth header.
ENDPOINTS=("roundup-games" "settle-rounds")

# Load PARTYKIT_SECRET from .env
export $(grep PARTYKIT_SECRET .env | xargs)

echo "🔄 Starting local cron (every ${INTERVAL}s) on :${PORT}"
echo "   Endpoints: ${ENDPOINTS[*]}"
echo "   Press Ctrl+C to stop"
echo ""

while true; do
  for ep in "${ENDPOINTS[@]}"; do
    echo "[$(date '+%H:%M:%S')] Calling ${ep}..."
    curl -s -X POST "${BASE}/${ep}" \
      -H "Authorization: Bearer $PARTYKIT_SECRET" \
      -H "Content-Type: application/json" | jq -r '.'
  done
  echo ""
  sleep $INTERVAL
done
