#!/bin/bash
# ============================================================================
# Ventia SSL Certificate Setup
# Creates dummy certs → starts nginx → gets real certs from Let's Encrypt
# Usage: ./docker/init-certbot.sh [email]
# ============================================================================

set -e

DOMAINS=(app.ventia-latam.com backend.ventia-latam.com messaging.ventia-latam.com)
EMAIL="${1:-admin@ventia-latam.com}"
COMPOSE_FILE="docker-compose.dev.yml"

echo "=== Ventia SSL Setup ==="
echo "Domains: ${DOMAINS[*]}"
echo "Email: $EMAIL"
echo ""

# Step 1: Create dummy certificates so nginx can start
echo "[1/4] Creating dummy certificates..."
for domain in "${DOMAINS[@]}"; do
  cert_path="/etc/letsencrypt/live/$domain"

  docker compose -f "$COMPOSE_FILE" run --rm --entrypoint "\
    sh -c 'mkdir -p $cert_path && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout $cert_path/privkey.pem \
      -out $cert_path/fullchain.pem \
      -subj /CN=$domain'" certbot

  echo "  - $domain: dummy cert created"
done

# Step 2: Start nginx with dummy certs
echo ""
echo "[2/4] Starting nginx..."
docker compose -f "$COMPOSE_FILE" up -d nginx
sleep 5

# Step 3: Delete dummy certs and request real ones
echo ""
echo "[3/4] Requesting real certificates from Let's Encrypt..."
for domain in "${DOMAINS[@]}"; do
  cert_path="/etc/letsencrypt/live/$domain"

  # Remove dummy cert
  docker compose -f "$COMPOSE_FILE" run --rm --entrypoint "\
    rm -rf /etc/letsencrypt/live/$domain && \
    rm -rf /etc/letsencrypt/archive/$domain && \
    rm -rf /etc/letsencrypt/renewal/$domain.conf" certbot

  # Request real cert
  docker compose -f "$COMPOSE_FILE" run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
      --email $EMAIL \
      -d $domain \
      --agree-tos \
      --no-eff-email \
      --force-renewal" certbot

  echo "  - $domain: real cert obtained"
done

# Step 4: Reload nginx with real certs
echo ""
echo "[4/4] Reloading nginx..."
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload

echo ""
echo "=== SSL setup complete ==="
echo "Certificates will auto-renew via the certbot container."
echo ""
echo "To start all services:"
echo "  docker compose -f $COMPOSE_FILE up -d"
