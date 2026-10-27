#!/usr/bin/env bash
# Полная установка VtubeOverlay с нуля на чистом Ubuntu (20.04/22.04/24.04).
# Запускать из корня проекта: sudo ./install.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите через sudo: sudo ./install.sh" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
CADDYFILE="/etc/caddy/Caddyfile"

log() { echo -e "\n\033[1;32m==>\033[0m $1"; }

# --- 1. Системные пакеты ---
log "Обновляю систему и ставлю базовые пакеты"
# Сторонние PPA с битым/отсутствующим ключом (например, уже добавленный
# ранее deadsnakes) не должны останавливать установку - apt-get update
# возвращает ненулевой код при ЛЮБОЙ проблемной репе, даже если нужные
# нам пакеты доступны из основных зеркал.
apt-get update -y || true
apt-get install -y ca-certificates curl gnupg git ufw

# --- 2. Docker Engine + Compose plugin ---
if ! command -v docker >/dev/null 2>&1; then
  log "Ставлю Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  ARCH="$(dpkg --print-architecture)"
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y || true
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker уже установлен, пропускаю"
fi

# --- 3. Caddy (TLS reverse proxy) ---
if ! command -v caddy >/dev/null 2>&1; then
  log "Ставлю Caddy"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y || true
  apt-get install -y caddy
else
  log "Caddy уже установлен, пропускаю"
fi

# --- 4. Файрвол ---
log "Настраиваю ufw (80/443/22)"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw allow 443/udp >/dev/null 2>&1 || true
# Без TLS - для VTube Studio: OBS грузит оверлей по http://<ip>:3000/overlay/<token>,
# тогда браузер не считает ws://127.0.0.1 к VTube Studio mixed content.
# Для входа в дашборд используйте только https-домен, не этот порт.
ufw allow "${APP_PORT:-3000}/tcp" >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

# --- 5. .env ---
if [ -f "$ENV_FILE" ]; then
  log ".env уже есть, использую существующий (удалите файл, чтобы пройти настройку заново)"
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
else
  log "Настройка .env"
  read -rp "Домен сайта (напр. overlay.example.com): " SITE_DOMAIN
  read -rp "Twitch Client ID: " TWITCH_CLIENT_ID
  read -rsp "Twitch Client Secret: " TWITCH_CLIENT_SECRET; echo
  read -rp "Email для Let's Encrypt (уведомления об истечении сертификата): " ACME_EMAIL

  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  AUTH_SECRET="$(openssl rand -base64 32)"

  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=vtube
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=vtube_overlay
DATABASE_URL="postgresql://vtube:$POSTGRES_PASSWORD@postgres:5432/vtube_overlay"
AUTH_SECRET="$AUTH_SECRET"
NEXTAUTH_URL="https://$SITE_DOMAIN"
TWITCH_CLIENT_ID="$TWITCH_CLIENT_ID"
TWITCH_CLIENT_SECRET="$TWITCH_CLIENT_SECRET"
APP_PORT=3000
EOF
  chmod 600 "$ENV_FILE"
  echo "$SITE_DOMAIN" > "$PROJECT_DIR/.deploy-domain"
  echo "$ACME_EMAIL" > "$PROJECT_DIR/.deploy-email"
fi

SITE_DOMAIN="${SITE_DOMAIN:-$(cat "$PROJECT_DIR/.deploy-domain" 2>/dev/null || true)}"
ACME_EMAIL="${ACME_EMAIL:-$(cat "$PROJECT_DIR/.deploy-email" 2>/dev/null || true)}"

if [ -z "$SITE_DOMAIN" ]; then
  SITE_DOMAIN="$(grep -oP '(?<=NEXTAUTH_URL=")https://\K[^"/]+' "$ENV_FILE" || true)"
fi

# --- 6. Caddyfile ---
log "Пишу Caddyfile для $SITE_DOMAIN"
{
  echo "{"
  [ -n "$ACME_EMAIL" ] && echo "    email $ACME_EMAIL"
  echo "}"
  echo ""
  echo "$SITE_DOMAIN {"
  echo "    reverse_proxy localhost:${APP_PORT:-3000}"
  echo ""
  echo "    @overlay path /api/public/*"
  echo "    handle @overlay {"
  echo "        reverse_proxy localhost:${APP_PORT:-3000} {"
  echo "            flush_interval -1"
  echo "        }"
  echo "    }"
  echo "}"
} > "$CADDYFILE"
systemctl enable --now caddy
caddy validate --config "$CADDYFILE" || log "Внимание: caddy validate сообщил об ошибке, проверьте $CADDYFILE"
systemctl reload caddy || systemctl restart caddy

# --- 7. Сборка и запуск приложения ---
log "Собираю и запускаю контейнеры (это может занять пару минут)"
cd "$PROJECT_DIR"
docker compose up -d --build

log "Готово"
echo "Сайт:            https://$SITE_DOMAIN (сертификат Caddy выпустит сам за 10-30 секунд)"
echo "Логи приложения: docker compose logs -f app"
echo "Логи БД:         docker compose logs -f postgres"
echo ""
echo "Не забудьте добавить в настройках Twitch-приложения (https://dev.twitch.tv/console/apps):"
echo "  OAuth Redirect URL: https://$SITE_DOMAIN/api/auth/callback/twitch"
