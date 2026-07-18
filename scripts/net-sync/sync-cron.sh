#!/usr/bin/env bash
#
# veeey.net ← egyptvitamins.net catalog sync (Phase 2). Runs every 10 min via cron
# ON THE veeey.net BOX ONLY (both DBs are local there). Stateless full hash-diff
# scan: the importer upserts changed products/lots/stock and archives products
# that vanished from WP (WP is the stock master). Idempotent + self-healing.
#
# The WP DB password is built here from wp-config via `wp eval`, so it is NEVER
# stored in the crontab or an env file. flock (in the crontab line) prevents
# overlapping runs.
#
# Install (on the box, once):
#   NODE_DIR=$(dirname "$(command -v node)")
#   ( crontab -l 2>/dev/null; \
#     echo "PATH=$NODE_DIR:/usr/local/bin:/usr/bin:/bin"; \
#     echo "*/10 * * * * /usr/bin/flock -n /tmp/veeey-net-sync.lock /opt/veeey/scripts/net-sync/sync-cron.sh >> /opt/veeey/net-sync.log 2>&1"; \
#     echo "30 3 * * * /usr/bin/flock -n /tmp/veeey-net-images.lock /opt/veeey/scripts/net-sync/sync-cron.sh --images >> /opt/veeey/net-sync.log 2>&1" \
#   ) | crontab -
set -euo pipefail

APP_DIR="${NET_SYNC_APP_DIR:-/opt/veeey}"
WP_PATH="${NET_SYNC_WP_PATH:-/home/egyptvitamins.net/public_html}"
WP_OSUSER="${NET_SYNC_WP_OSUSER:-egypt1907}"
PHP_BIN="${NET_SYNC_PHP:-/usr/local/lsws/lsphp82/bin/php}"
WP_CLI="${NET_SYNC_WP_CLI:-/usr/local/bin/wp}"
export NET_SYNC_WP_PREFIX="${NET_SYNC_WP_PREFIX:-SFPgx_}"

cd "$APP_DIR"

# Build the source DSN from wp-config (URL-encoded; localhost → 127.0.0.1 for TCP).
DSN=$(sudo -u "$WP_OSUSER" "$PHP_BIN" "$WP_CLI" --path="$WP_PATH" eval \
  'echo "mysql://".rawurlencode(DB_USER).":".rawurlencode(DB_PASSWORD)."@".(strpos(DB_HOST,":")!==false?str_replace("localhost","127.0.0.1",DB_HOST):str_replace("localhost","127.0.0.1",DB_HOST).":3306")."/".DB_NAME;')
export NET_SYNC_MYSQL_URL="$DSN"

TSX="$APP_DIR/node_modules/.bin/tsx"
STAMP=$(date -u +%FT%TZ)

if [ "${1:-}" = "--images" ]; then
  echo "----- $STAMP net-sync IMAGES start -----"
  "$TSX" scripts/net-sync/run-images.ts --commit
  echo "----- $(date -u +%FT%TZ) net-sync IMAGES done -----"
else
  echo "----- $STAMP net-sync start -----"
  "$TSX" scripts/net-sync/run.ts --commit
  echo "----- $(date -u +%FT%TZ) net-sync done -----"
fi
