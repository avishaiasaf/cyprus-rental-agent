#!/usr/bin/env bash
set -euo pipefail

RESPONSE=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")

if [ "$RESPONSE" != "200" ]; then
  echo "$(date): Health check FAILED (HTTP $RESPONSE)" >> /var/log/cyprus-rental-health.log

  # Optional: send Telegram alert (uncomment and set vars)
  # BOT_TOKEN="your-bot-token"
  # CHAT_ID="your-chat-id"
  # curl -sf "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  #   -d "chat_id=${CHAT_ID}" \
  #   -d "text=Cyprus Rental Agent health check FAILED (HTTP $RESPONSE)" > /dev/null
fi
