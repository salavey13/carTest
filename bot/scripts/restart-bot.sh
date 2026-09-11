#!/usr/bin/env bash
# restart-bot.sh — генерация SSH-ключа и рестарт бота на VPS
#
# Usage:
#   bash scripts/restart-bot.sh --generate-key
#   bash scripts/restart-bot.sh root@212.67.11.25 --slug=vip-bike
#
# Шаг 1: --generate-key создаёт ~/.ssh/claudeclaw-ops (если нет)
# Шаг 2: выводит публичный ключ для добавления в authorized_keys на VPS
# Шаг 3: после добавления ключа выполняет рестарт

set -euo pipefail

SSH_TARGET=""
SLUG=""
GENERATE_KEY=false

for arg in "$@"; do
  case "$arg" in
    --generate-key) GENERATE_KEY=true ;;
    --slug=*) SLUG="${arg#--slug=}" ;;
    --*) echo "Неизвестный флаг: $arg"; exit 1 ;;
    *) SSH_TARGET="$arg" ;;
  esac
done

KEY_FILE="$HOME/.ssh/claudeclaw-ops"

if [[ "$GENERATE_KEY" == "true" ]]; then
  if [[ ! -f "$KEY_FILE" ]]; then
    echo "Генерирую SSH-ключ: $KEY_FILE"
    ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "claudeclaw-ops-$(date +%Y%m%d)"
    echo ""
    echo "✅ Ключ создан. Добавь публичный ключ в authorized_keys на VPS:"
    echo ""
    cat "$KEY_FILE.pub"
    echo ""
    echo "Команда для VPS:"
    echo "  echo '$(cat "$KEY_FILE.pub")' >> /root/.ssh/authorized_keys"
    echo ""
    echo "После добавления ключа запусти:"
    echo "  bash scripts/restart-bot.sh root@<VPS_IP> --slug=vip-bike"
  else
    echo "Ключ уже существует: $KEY_FILE"
    echo "Публичный ключ:"
    cat "$KEY_FILE.pub"
  fi
  exit 0
fi

if [[ -z "$SSH_TARGET" ]]; then
  echo "Usage: bash scripts/restart-bot.sh root@<VPS_IP> --slug=<name>"
  echo "       bash scripts/restart-bot.sh --generate-key"
  exit 1
fi

if [[ -z "$SLUG" ]]; then
  SLUG="vip-bike"
fi

SERVICE_NAME="claudeclaw-$SLUG"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "❌ Ключ не найден: $KEY_FILE"
  echo "Сначала запусти: bash scripts/restart-bot.sh --generate-key"
  exit 1
fi

echo "Рестартую сервис $SERVICE_NAME на $SSH_TARGET..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no "$SSH_TARGET" "sudo systemctl restart $SERVICE_NAME && echo '✅ Сервис перезапущен' || echo '❌ Ошибка рестарта'"
