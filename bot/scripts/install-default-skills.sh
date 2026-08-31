#!/usr/bin/env bash
# Установка default-pack скиллов для бота на VPS.
# Использование: ./install-default-skills.sh <ssh-target> [--target-user=<user>]
#   ssh-target    — например "root@45.133.234.91" или алиас из ~/.ssh/config
#   --target-user — пользователь на VPS (по умолчанию: claudeclaw)
#
# Требует:
#   - SSH-доступ к VPS (ключом или паролем — настраивается через ~/.ssh/config или -i)
#   - Локально установлен Claude Code с глобальными скиллами в ~/.claude/skills/
#   - Локально установлены плагины в ~/.claude/plugins/
#
# Маркетинговые скиллы (контент-фабрика, JTBD, hormozi-offer и др.) — это часть
# отдельного плагина content-dept-fil-ai, который продаётся клиенту как upsell.
# В стандартный пак НЕ включены.

set -euo pipefail

SSH_TARGET=""
TARGET_USER="claudeclaw"

for arg in "$@"; do
  case "$arg" in
    --target-user=*) TARGET_USER="${arg#--target-user=}" ;;
    --*)             echo "Неизвестный флаг: $arg" >&2; exit 1 ;;
    *)               SSH_TARGET="$arg" ;;
  esac
done

if [[ -z "$SSH_TARGET" ]]; then
  echo "Usage: $0 <ssh-target> [--target-user=claudeclaw]"
  echo "Example: $0 lumos-ssh"
  echo "Example: $0 root@45.133.234.91 --target-user=claudeclaw_maria"
  exit 1
fi

# Стандартный универсальный стек (18 скиллов) — утилиты для любого клиентского бота.
UNIVERSAL_SKILLS=(
  # Документы и форматы
  pdf docx pptx xlsx officecli
  # Медиа и веб
  audio-transcribe firecrawl
  # Ресёрч и базы знаний
  last30days knowledge-base-architect
  # Документы-коллаб и коммуникации
  doc-coauthoring internal-comms
  # Стиль речи
  human-style
  # Визуализация данных
  marketing-dashboard
  # Управление AI-системой
  skill-creator update-skill prompt-master
  # Планирование и продуктивность
  task-planner todo retro
)

# Визуальный стек по дефолту: режиссёр-агент + скиллы которые делают прямой
# curl на api.kie.ai через $KIE_API_KEY из env. MCP-сервер kie-ai НЕ нужен —
# скиллы работают через Bash tool (см. visual-production/skills/generate-image/SKILL.md).
# Активация: Claude Code автоподхватывает плагины из ~/.claude/plugins/<name>/.
# Отключить пак: SKIP_VISUAL_PLUGINS=1 ./install-default-skills.sh <ssh-target>
DEFAULT_PLUGINS=(
  visual-production       # 5 агентов (director, coordinator, editor, sound-designer, vfx) + 10 скиллов + 13 команд
  content-dept-fil-ai     # 28 агентов фабрики; внутри skills/designer и skills/visual-prompt-director
  kie-ai-mcp              # MCP сервер: typed tools kie_generate_image / kie_generate_video / kie_generate_avatar (требует build на VPS)
)

if [[ "${SKIP_VISUAL_PLUGINS:-0}" == "1" ]]; then
  DEFAULT_PLUGINS=()
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLED_SKILLS_DIR="$PROJECT_ROOT/bundled-skills"
BUNDLED_PLUGINS_DIR="$PROJECT_ROOT/bundled-plugins"
LOCAL_SKILLS_DIR="$HOME/.claude/skills"
LOCAL_PLUGINS_DIR="$HOME/.claude/plugins"

# Возвращает путь к скиллу: сначала bundled (в архиве), потом local (~/.claude/skills)
resolve_skill() {
  local name="$1"
  if [[ -e "$BUNDLED_SKILLS_DIR/$name" ]]; then
    echo "$BUNDLED_SKILLS_DIR/$name"
  elif [[ -e "$LOCAL_SKILLS_DIR/$name" ]]; then
    echo "$LOCAL_SKILLS_DIR/$name"
  fi
}

resolve_plugin() {
  local name="$1"
  if [[ -d "$BUNDLED_PLUGINS_DIR/$name" ]]; then
    echo "$BUNDLED_PLUGINS_DIR/$name"
  elif [[ -d "$LOCAL_PLUGINS_DIR/$name" ]]; then
    echo "$LOCAL_PLUGINS_DIR/$name"
  fi
}
REMOTE_HOME="/home/$TARGET_USER"
REMOTE_SKILLS="$REMOTE_HOME/.claude/skills"
REMOTE_PLUGINS="$REMOTE_HOME/.claude/plugins"

ALL_SKILLS=("${UNIVERSAL_SKILLS[@]}")
ALL_PLUGINS=()
[[ ${#DEFAULT_PLUGINS[@]} -gt 0 ]] && ALL_PLUGINS+=("${DEFAULT_PLUGINS[@]}")

echo "==> Целевой сервер: $SSH_TARGET"
echo "==> Скиллов к установке: ${#ALL_SKILLS[@]}"
echo "==> Плагинов: ${#ALL_PLUGINS[@]}"

# Создать директории на сервере
ssh "$SSH_TARGET" "mkdir -p $REMOTE_SKILLS $REMOTE_PLUGINS && chown -R $TARGET_USER:$TARGET_USER $REMOTE_HOME/.claude"

# Синкаем скиллы
echo "==> Sync skills"
MISSING=()
for skill in "${ALL_SKILLS[@]}"; do
  src="$(resolve_skill "$skill")"
  if [[ -z "$src" ]]; then
    MISSING+=("$skill")
    continue
  fi
  if [[ -d "$src" ]]; then
    rsync -az --delete "$src/" "$SSH_TARGET:$REMOTE_SKILLS/$skill/"
  else
    rsync -az "$src" "$SSH_TARGET:$REMOTE_SKILLS/$skill"
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "==> ⚠ Не найдены локально: ${MISSING[*]}"
fi

# Синкаем плагины (если есть — для extended режима)
if [[ ${#ALL_PLUGINS[@]} -gt 0 ]]; then
  echo "==> Sync plugins"
  MISSING_PLUGINS=()
  for plug in "${ALL_PLUGINS[@]}"; do
    src="$(resolve_plugin "$plug")"
    if [[ -z "$src" ]]; then
      MISSING_PLUGINS+=("$plug")
      continue
    fi
    rsync -az --delete --exclude 'node_modules' --exclude '.git' \
      "$src/" "$SSH_TARGET:$REMOTE_PLUGINS/$plug/"
  done

  if [[ ${#MISSING_PLUGINS[@]} -gt 0 ]]; then
    echo "==> ⚠ Плагины не найдены локально: ${MISSING_PLUGINS[*]}"
  fi

  # Build плагинов с node-зависимостями (kie-ai-mcp).
  # Делается на VPS-стороне чтобы node_modules собрались под целевую архитектуру.
  for plug in "${ALL_PLUGINS[@]}"; do
    if [[ -f "$(resolve_plugin "$plug")/package.json" ]] && [[ -f "$(resolve_plugin "$plug")/tsconfig.json" ]]; then
      echo "==> Build plugin on VPS: $plug"
      # ВАЖНО: ставим И devDependencies (нужен typescript для tsc),
      # после build вычищаем devDeps через prune.
      ssh "$SSH_TARGET" "
        cd $REMOTE_PLUGINS/$plug && \
        npm install --no-audit --no-fund 2>&1 | tail -3 && \
        npm run build 2>&1 | tail -3 && \
        npm prune --omit=dev --no-audit --no-fund 2>&1 | tail -1
      " || echo "==> ⚠ Build $plug завершился с ошибкой (non-fatal)"
    fi
  done
else
  echo "==> Плагины: универсальный режим — только superpowers (через npm)"
fi

# Установить superpowers из npm (если ещё не стоит)
echo "==> Установка superpowers из официального плагина"
ssh "$SSH_TARGET" "sudo -u $TARGET_USER HOME=$REMOTE_HOME claude plugin install superpowers --scope user 2>&1 | tail -5 || echo 'superpowers install failed (non-fatal)'"

# Финальный chown
ssh "$SSH_TARGET" "chown -R $TARGET_USER:$TARGET_USER $REMOTE_HOME/.claude"

# Проверить
ssh "$SSH_TARGET" "ls $REMOTE_SKILLS | wc -l | xargs -I {} echo 'Установлено скиллов: {}' && ls $REMOTE_PLUGINS | wc -l | xargs -I {} echo 'Установлено плагинов: {}'"

echo "==> Done."
