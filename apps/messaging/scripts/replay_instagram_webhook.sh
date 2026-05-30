#!/usr/bin/env bash
#
# Replays a high-fidelity Instagram webhook against the messaging app, signing it with
# X-Hub-Signature-256 exactly like Meta does (HMAC-SHA256 over the raw body using
# INSTAGRAM_APP_SECRET). It exercises the full real pipeline:
#   controller (signature check) -> InstagramEventsJob -> IncomingMessageService
#   -> DB -> ActionCable broadcast -> frontend -> "Performance por anuncio" dashboard.
#
# NOTE: this is a SIMULATION — the payload shape matches Meta's docs byte-for-byte, but the
# only 100% real ad referral comes from an actually-delivered Click-to-Instagram-Direct ad
# that you tap yourself. Use this for local/dev iteration.
#
# Port 3001 is not published to the host (docker-compose uses `expose`), so by default the
# request is signed and sent from INSIDE the container, which already has INSTAGRAM_APP_SECRET.
#
# Usage:
#   ./apps/messaging/scripts/replay_instagram_webhook.sh            # ad referral (default)
#   ./apps/messaging/scripts/replay_instagram_webhook.sh --story    # reply-to-story
#   ./apps/messaging/scripts/replay_instagram_webhook.sh --postback # carousel button tap
#   ./apps/messaging/scripts/replay_instagram_webhook.sh --ad --container ventia-messaging
#
# Overrides (env or flags):
#   --container <name>   messaging container (default: ventia-messaging)
#   --url <url>          webhook URL as seen from where the curl runs (default: http://localhost:3001/webhooks/instagram)
#   --ig-id <id>         your Channel::Instagram.instagram_id (default: 17841425569980702)
#   --sender <igsid>     contact IGSID (default: 2193327221443362)
#   --host               sign+send from the HOST instead of the container (needs INSTAGRAM_APP_SECRET exported and the port reachable)
#
set -euo pipefail

MODE="ad"
CONTAINER="ventia-messaging"
URL="http://localhost:3001/webhooks/instagram"
IG_ID="17841425569980702"
SENDER="2193327221443362"
RUN_ON_HOST=0

while [ $# -gt 0 ]; do
  case "$1" in
    --ad) MODE="ad"; shift ;;
    --story) MODE="story"; shift ;;
    --postback) MODE="postback"; shift ;;
    --container) CONTAINER="$2"; shift 2 ;;
    --url) URL="$2"; shift 2 ;;
    --ig-id) IG_ID="$2"; shift 2 ;;
    --sender) SENDER="$2"; shift 2 ;;
    --host) RUN_ON_HOST=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

NOW="$(date +%s)"
TS="${NOW}000"
MID="ig.${MODE}.${NOW}"   # unique per run — dedup happens via Redis + Message.exists?(source_id:)

# Build the messaging[0] event per mode. Postback is a distinct event (no "message").
if [ "$MODE" = "postback" ]; then
  EVENT='"postback": {
        "mid": "'"${MID}"'",
        "title": "Quiero este",
        "payload": "BUY_RUNNER_123"
      }'
else
  if [ "$MODE" = "story" ]; then
    CONTEXT='"reply_to": { "story": { "id": "18468529870103136", "url": "https://picsum.photos/seed/ventia-story/600/1067" } }'
    TEXT="Buena noticia!!!"
  else
    CONTEXT='"referral": {
          "ref": "promo-mayo-2026",
          "ad_id": "120210000000000123",
          "source": "ADS",
          "type": "OPEN_THREAD",
          "ads_context_data": {
            "ad_title": "Zapatillas Runner 2x1",
            "photo_url": "https://picsum.photos/seed/ventia-ad/600/600"
          }
        }'
    TEXT="Hola, vi su anuncio ¿tienen stock?"
  fi
  EVENT='"message": {
        "mid": "'"${MID}"'",
        "text": "'"${TEXT}"'",
        '"${CONTEXT}"'
      }'
fi

BODY=$(cat <<JSON
{
  "object": "instagram",
  "entry": [{
    "id": "${IG_ID}",
    "time": ${TS},
    "messaging": [{
      "sender": { "id": "${SENDER}" },
      "recipient": { "id": "${IG_ID}" },
      "timestamp": ${TS},
      ${EVENT}
    }]
  }]
}
JSON
)

echo "→ Replaying Instagram webhook (mode=${MODE}, mid=${MID})"

# The signature MUST be computed over the exact bytes sent. We sign with printf '%s' (no
# trailing newline) and send with --data-raw (no trailing newline) so they match.
SIGN_AND_POST='
  SIG="sha256=$(printf "%s" "$BODY" | openssl dgst -sha256 -hmac "$INSTAGRAM_APP_SECRET" | sed "s/^.*= //")"
  curl -sS -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "X-Hub-Signature-256: $SIG" \
    --data-raw "$BODY" -w "\nHTTP %{http_code}\n"
'

if [ "$RUN_ON_HOST" = "1" ]; then
  # Auto-load the secret from apps/messaging/.env if it isn't already exported.
  if [ -z "${INSTAGRAM_APP_SECRET:-}" ]; then
    ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
    if [ -f "$ENV_FILE" ]; then
      # tr -d '\r' handles CRLF .env files; sed strips wrapping quotes; xargs trims stray whitespace.
      INSTAGRAM_APP_SECRET="$(grep -E '^INSTAGRAM_APP_SECRET=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//; s/["'\'']$//' | xargs)"
    fi
  fi
  : "${INSTAGRAM_APP_SECRET:?could not find INSTAGRAM_APP_SECRET (export it or set it in apps/messaging/.env)}"
  BODY="$BODY" WEBHOOK_URL="$URL" INSTAGRAM_APP_SECRET="$INSTAGRAM_APP_SECRET" sh -c "$SIGN_AND_POST"
else
  docker exec -e BODY="$BODY" -e WEBHOOK_URL="$URL" "$CONTAINER" sh -c "$SIGN_AND_POST"
fi
