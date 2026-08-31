#!/usr/bin/env bash
# Деплой бота claudeclaw на собственный VPS клиента.
# Использование: bash scripts/bootstrap-vps.sh <ssh-target> [OPTIONS]
#
# АРГУМЕНТЫ
#   ssh-target          -- например root@45.133.234.91 или алиас из ~/.ssh/config
#
# ОПЦИИ
#   --dry-run           -- не выполнять SSH, печатать каждый шаг + команды
#   --slug=<name>       -- имя экземпляра (по умолчанию: хост из ssh-target)
#   --env-file=<path>   -- локальный .env который будет скопирован на VPS
#   --ops-key-file=<p>  -- публичный ключ klod-box-ops (иначе ищет ~/.ssh/klod-box-ops.pub или $KLOD_BOX_OPS_PUBKEY)
#   --verbose           -- подробный вывод каждой команды
#
# ТРЕБОВАНИЯ
#   - SSH-доступ к VPS (root или sudo-юзер)
#   - rsync установлен локально
#   - Проект собирается: npm run build (проверяется локально перед деплоем)
#
# ПРИМЕР
#   bash scripts/bootstrap-vps.sh root@45.133.234.91 --slug=maria-bot --env-file=tenants/maria/.env
#   bash scripts/bootstrap-vps.sh root@127.0.0.1 --dry-run --slug=test

set -euo pipefail

# --- Цвета ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

LOG_FILE="/var/log/klod-box/bootstrap.log"
_logwrite() { echo "$*" >> "$LOG_FILE" 2>/dev/null || true; }
log()     { echo -e "${CYAN}[bootstrap]${NC} $*"; _logwrite "[bootstrap] $*"; }
ok()      { echo -e "${GREEN}[OK]${NC} $*";        _logwrite "[OK] $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*";     _logwrite "[WARN] $*"; }
err()     { echo -e "${RED}[ERROR]${NC} $*" >&2;  _logwrite "[ERROR] $*"; }
step()    { echo -e "${BOLD}--- $* ---${NC}";      _logwrite "--- $* ---"; }
die()     { err "$*"; exit 1; }
vlog()    { [[ "$VERBOSE" == "true" ]] && echo -e "${CYAN}[verbose]${NC} $*" || true; }

# --- Разбор аргументов ---
SSH_TARGET=""
DRY_RUN="false"
SLUG=""
ENV_FILE=""
OPS_KEY_FILE=""
VERBOSE="false"

for arg in "$@"; do
  case "$arg" in
    --dry-run)            DRY_RUN="true" ;;
    --verbose)            VERBOSE="true" ;;
    --slug=*)             SLUG="${arg#--slug=}" ;;
    --env-file=*)         ENV_FILE="${arg#--env-file=}" ;;
    --ops-key-file=*)     OPS_KEY_FILE="${arg#--ops-key-file=}" ;;
    --*)                  die "Неизвестный флаг: $arg\nПример: bash scripts/bootstrap-vps.sh root@IP --slug=mybot --env-file=.env" ;;
    *)                    SSH_TARGET="$arg" ;;
  esac
done

[[ -z "$SSH_TARGET" ]] && \
  die "Укажи SSH-таргет первым аргументом.\nПример: bash scripts/bootstrap-vps.sh root@45.133.234.91 --slug=mybot"

# --- Slug из ssh-target если не задан ---
if [[ -z "$SLUG" ]]; then
  # Берём хост из user@host, заменяем не-slug символы на дефис
  SLUG=$(echo "$SSH_TARGET" | sed 's/.*@//' | tr -cs 'a-z0-9' '-' | sed 's/-$//')
  [[ -z "$SLUG" ]] && SLUG="claudeclaw"
fi

# Валидация slug
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$ ]] || \
  die "Slug '$SLUG' невалиден. Только a-z, 0-9, дефис (не в начале/конце). Задай --slug=<name>"

# --- Пути ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Инициализация лога ---
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || LOG_FILE="/tmp/klod-box-bootstrap.log"
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/klod-box-bootstrap.log"
echo "=== bootstrap start $(date '+%Y-%m-%d %H:%M:%S') slug=$SLUG target=$SSH_TARGET ===" \
  >> "$LOG_FILE" 2>/dev/null || true

REMOTE_BASE="/opt/claudeclaw"
REMOTE_DIR="$REMOTE_BASE/$SLUG"
SERVICE_NAME="claudeclaw-$SLUG"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

# --- Публичный ключ klod-box-ops ---
OPS_PUBKEY=""
if [[ -n "$OPS_KEY_FILE" ]]; then
  [[ -f "$OPS_KEY_FILE" ]] || die "Файл публичного ключа не найден: $OPS_KEY_FILE"
  OPS_PUBKEY=$(cat "$OPS_KEY_FILE")
elif [[ -n "${KLOD_BOX_OPS_PUBKEY:-}" ]]; then
  OPS_PUBKEY="$KLOD_BOX_OPS_PUBKEY"
elif [[ -f "$HOME/.ssh/klod-box-ops.pub" ]]; then
  OPS_PUBKEY=$(cat "$HOME/.ssh/klod-box-ops.pub")
  vlog "Ключ ops взят из ~/.ssh/klod-box-ops.pub"
else
  warn "Ключ klod-box-ops не задан. Ops-мониторинг не будет иметь SSH-доступа к этому боту."
  warn "Добавь позже: ssh $SSH_TARGET 'echo YOUR_PUBKEY >> /home/claudeclaw/.ssh/authorized_keys'"
fi

# --- Обёртки для SSH и rsync ---
# В dry-run режиме только печатаем
run_ssh() {
  local cmd="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] ssh $SSH_TARGET << 'CMD'"
    echo "  $cmd"
    echo "  CMD"
  else
    vlog "ssh $SSH_TARGET ..."
    ssh "$SSH_TARGET" "$cmd"
  fi
}

run_ssh_heredoc() {
  # run_ssh_heredoc <remote-cmd> <<'EOF' ... EOF
  # Передаёт stdin как heredoc в SSH
  local cmd="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] ssh $SSH_TARGET '$cmd' < heredoc"
    cat  # выводим содержимое heredoc на экран в dry-run
  else
    vlog "ssh $SSH_TARGET '$cmd' < heredoc"
    ssh "$SSH_TARGET" "$cmd"
  fi
}

run_rsync() {
  local src="$1"; local dst="$2"; shift 2; local opts=("$@")
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] rsync -az --delete ${opts[*]:-} '$src' '$SSH_TARGET:$dst'"
  else
    vlog "rsync $src -> $SSH_TARGET:$dst"
    rsync -az --delete "${opts[@]:-}" "$src" "$SSH_TARGET:$dst"
  fi
}

run_scp() {
  local src="$1"; local dst="$2"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] scp '$src' '$SSH_TARGET:$dst'"
  else
    vlog "scp $src -> $SSH_TARGET:$dst"
    scp "$src" "$SSH_TARGET:$dst"
  fi
}

# --- Cleanup при ошибке (не в dry-run) ---
CLEANUP_ON_ERROR="false"
cleanup() {
  local exit_code=$?
  if [[ "$exit_code" -ne 0 && "$DRY_RUN" == "false" && "$CLEANUP_ON_ERROR" == "true" ]]; then
    err "Установка прервана (код $exit_code). Очищаю незавершённую инсталляцию..."
    ssh "$SSH_TARGET" "
      systemctl stop $SERVICE_NAME 2>/dev/null || true
      systemctl disable $SERVICE_NAME 2>/dev/null || true
      rm -f $SERVICE_FILE
      systemctl daemon-reload 2>/dev/null || true
    " 2>/dev/null || true
    err "Очищено. Повтори после исправления ошибки."
  fi
}
trap cleanup EXIT

# ===================================================================
echo ""
echo -e "${BOLD}=== bootstrap-vps.sh ===${NC}"
log "Цель:              $SSH_TARGET"
log "Slug:              $SLUG"
log "Удалённая папка:   $REMOTE_DIR"
log "Systemd-юнит:      $SERVICE_NAME"
[[ -n "$ENV_FILE" ]]  && log ".env файл:         $ENV_FILE"
[[ -n "$OPS_PUBKEY" ]] && log "Ops-ключ:          задан"
[[ "$DRY_RUN" == "true" ]] && echo -e "${YELLOW}РЕЖИМ DRY-RUN -- SSH не выполняется, только план${NC}"
echo ""

# === ШАГ 1: Preflight ===
step "Шаг 1: preflight"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] ssh -o ConnectTimeout=10 $SSH_TARGET 'echo ok'"
  echo "  [dry-run] ssh $SSH_TARGET 'sudo -n true || sudo true'"
  echo "  [dry-run] ssh $SSH_TARGET 'df -k / | awk NR==2{print \$4}'  -- проверить >= 2GB свободно"
  ok "Preflight: dry-run (проверки пропущены)"
else
  # SSH-доступ
  ssh -o ConnectTimeout=10 "$SSH_TARGET" "echo ok" >/dev/null 2>&1 || \
    die "Нет SSH-доступа к $SSH_TARGET.\nПроверь ключи и доступность хоста.\nОтладка: ssh -v $SSH_TARGET"

  # sudo
  ssh "$SSH_TARGET" "sudo -n true 2>/dev/null || sudo true" >/dev/null 2>&1 || \
    die "Нет sudo-доступа на $SSH_TARGET.\nЗайди под root или добавь пользователя в sudoers."

  # Свободное место
  FREE_KB=$(ssh "$SSH_TARGET" "df -k / | awk 'NR==2{print \$4}'")
  FREE_GB=$(( FREE_KB / 1024 / 1024 ))
  if (( FREE_GB < 2 )); then
    die "Недостаточно места: ${FREE_GB}GB свободно, нужно >= 2GB.\nОсвободи место: ssh $SSH_TARGET 'df -h /'"
  fi
  ok "Preflight OK (свободно ~${FREE_GB}GB)"
fi

# После preflight включаем cleanup
CLEANUP_ON_ERROR="true"

# === ШАГ 2: Node 20 ===
step "Шаг 2: Node 20"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] node --version  -- если нет v20+:"
  echo "  [dry-run]   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
  echo "  [dry-run]   apt-get install -y nodejs"
  ok "Node 20: dry-run OK"
else
  NODE_OK=$(ssh "$SSH_TARGET" \
    "command -v node >/dev/null 2>&1 && node --version | grep -qP '^v(2[0-9]|[3-9]\d)' && echo yes || echo no" 2>/dev/null || echo no)
  if [[ "$NODE_OK" == "yes" ]]; then
    NODE_VER=$(ssh "$SSH_TARGET" "node --version")
    ok "Node уже установлен: $NODE_VER"
  else
    log "Устанавливаю Node 20 через nodesource..."
    ssh "$SSH_TARGET" "
      set -euo pipefail
      export DEBIAN_FRONTEND=noninteractive
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1
      apt-get install -y nodejs 2>&1
    " || die "Не удалось установить Node 20.\nОтладка: ssh $SSH_TARGET 'apt-get update && apt-get install -y nodejs'"
    NODE_VER=$(ssh "$SSH_TARGET" "node --version")
    ok "Node установлен: $NODE_VER"
  fi
fi

# === ШАГ 2.5: Claude Code CLI ===
step "Шаг 2.5: Claude Code CLI"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] claude --version  -- если нет:"
  echo "  [dry-run]   npm install -g @anthropic-ai/claude-code"
  echo "  [dry-run]   (при необходимости) ln -sf \$(npm root -g)/@anthropic-ai/claude-code/bin/claude.exe /usr/bin/claude"
  ok "Claude Code CLI: dry-run OK"
else
  CLAUDE_VER=$(ssh "$SSH_TARGET" "claude --version 2>/dev/null || echo ''" 2>/dev/null || echo "")
  if [[ -n "$CLAUDE_VER" ]]; then
    ok "claude уже установлен ($CLAUDE_VER)"
  else
    log "Устанавливаю @anthropic-ai/claude-code..."
    ssh "$SSH_TARGET" "
      set -euo pipefail
      npm install -g @anthropic-ai/claude-code 2>&1
    " || die "Не удалось установить @anthropic-ai/claude-code.\nОтладка: ssh $SSH_TARGET 'npm install -g @anthropic-ai/claude-code'"
    # Проверяем наличие binary в PATH
    CLAUDE_BIN=$(ssh "$SSH_TARGET" "command -v claude 2>/dev/null || echo ''" 2>/dev/null || echo "")
    if [[ -z "$CLAUDE_BIN" ]]; then
      log "claude не найден в PATH, создаю symlink из npm root..."
      ssh "$SSH_TARGET" "
        set -euo pipefail
        NPM_ROOT=\$(npm root -g)
        CLAUDE_EXE=\"\$NPM_ROOT/@anthropic-ai/claude-code/bin/claude.exe\"
        if [[ -f \"\$CLAUDE_EXE\" ]]; then
          ln -sf \"\$CLAUDE_EXE\" /usr/bin/claude
        else
          echo 'claude binary не найден в npm root' >&2
          exit 1
        fi
      " || die "claude binary не найден после установки.\nОтладка: ssh $SSH_TARGET 'npm root -g && ls \$(npm root -g)/@anthropic-ai/claude-code/bin/'"
    fi
    CLAUDE_VER=$(ssh "$SSH_TARGET" "claude --version 2>&1" || echo "unknown")
    ok "Claude Code CLI установлен: $CLAUDE_VER"
  fi
fi

# === ШАГ 3: git ===
step "Шаг 3: git"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] command -v git || apt-get install -y git"
  ok "git: dry-run OK"
else
  GIT_OK=$(ssh "$SSH_TARGET" "command -v git >/dev/null 2>&1 && echo yes || echo no")
  if [[ "$GIT_OK" == "yes" ]]; then
    ok "git уже установлен"
  else
    ssh "$SSH_TARGET" "export DEBIAN_FRONTEND=noninteractive && apt-get install -y git" || \
      die "Не удалось установить git.\nОтладка: ssh $SSH_TARGET 'apt-get update && apt-get install -y git'"
    ok "git установлен"
  fi
fi

# === ШАГ 4: пользователь claudeclaw ===
step "Шаг 4: пользователь claudeclaw"

SUDOERS_CONTENT="claudeclaw ALL=(ALL) NOPASSWD: /bin/systemctl restart claudeclaw-*, /bin/systemctl start claudeclaw-*, /bin/systemctl stop claudeclaw-*, /bin/systemctl status claudeclaw-*, /usr/bin/systemctl restart claudeclaw-*, /usr/bin/systemctl start claudeclaw-*, /usr/bin/systemctl stop claudeclaw-*, /usr/bin/systemctl status claudeclaw-*"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] useradd -r -m -s /bin/bash claudeclaw  (если нет)"
  echo "  [dry-run] echo '$SUDOERS_CONTENT' > /etc/sudoers.d/claudeclaw"
  echo "  [dry-run] chmod 0440 /etc/sudoers.d/claudeclaw"
  ok "claudeclaw: dry-run OK"
else
  ssh "$SSH_TARGET" "
    set -euo pipefail
    if ! id claudeclaw >/dev/null 2>&1; then
      useradd -r -m -s /bin/bash claudeclaw
      echo 'Пользователь claudeclaw создан'
    else
      echo 'Пользователь claudeclaw уже существует'
    fi
    mkdir -p /home/claudeclaw
    chown claudeclaw:claudeclaw /home/claudeclaw
    # NOPASSWD sudo только для управления своими сервисами
    echo '$SUDOERS_CONTENT' > /etc/sudoers.d/claudeclaw
    chmod 0440 /etc/sudoers.d/claudeclaw
    # Проверяем sudoers синтаксис
    visudo -cf /etc/sudoers.d/claudeclaw
  " || die "Не удалось настроить пользователя claudeclaw.\nОтладка: ssh $SSH_TARGET 'id claudeclaw; cat /etc/sudoers.d/claudeclaw'"
  ok "Пользователь claudeclaw настроен"
fi

# === ШАГ 5: rsync проекта ===
step "Шаг 5: rsync проекта -> $REMOTE_DIR"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] mkdir -p $REMOTE_DIR && chown claudeclaw:claudeclaw $REMOTE_DIR"
  echo "  [dry-run] rsync -az --delete $PROJECT_ROOT/ $SSH_TARGET:$REMOTE_DIR/"
  echo "  [dry-run] Исключения: .git/ node_modules/ tenants/ ops/ .agents/ dist/"
  ok "rsync: dry-run OK"
else
  run_ssh "mkdir -p $REMOTE_DIR && chown claudeclaw:claudeclaw $REMOTE_DIR"
  rsync -az --delete \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='tenants/' \
    --exclude='ops/' \
    --exclude='.agents/' \
    --exclude='dist/' \
    --exclude='*.log' \
    "$PROJECT_ROOT/" \
    "$SSH_TARGET:$REMOTE_DIR/" || \
    die "rsync завершился с ошибкой.\nОтладка: rsync -avz $PROJECT_ROOT/ $SSH_TARGET:$REMOTE_DIR/"
  ok "Проект синхронизирован в $REMOTE_DIR"
fi

# === ШАГ 6: npm ci && npm run build ===
step "Шаг 6: npm ci && npm run build"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] cd $REMOTE_DIR && npm ci"
  echo "  [dry-run] cd $REMOTE_DIR && npm run build"
  ok "build: dry-run OK"
else
  ssh "$SSH_TARGET" "
    set -euo pipefail
    cd $REMOTE_DIR
    npm ci 2>&1
    npm run build 2>&1
    chown -R claudeclaw:claudeclaw $REMOTE_DIR
  " || die "Сборка упала.\nОтладка: ssh $SSH_TARGET 'cd $REMOTE_DIR && npm run build 2>&1 | tail -40'"
  ok "Сборка завершена"
fi

# === ШАГ 6.5: Playwright Chromium ===
step "Шаг 6.5: Playwright Chromium"

if [[ -n "${SKIP_PLAYWRIGHT:-}" ]]; then
  log "Шаг 6.5: пропускаем (SKIP_PLAYWRIGHT=1)"
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] sudo -u claudeclaw bash -c 'cd $REMOTE_DIR && npx playwright install --with-deps chromium'"
  ok "Playwright: dry-run OK"
else
  log "Устанавливаю Playwright Chromium + системные apt-зависимости..."
  # Двухшаговая установка:
  # 1) apt-deps ставим как root (claudeclaw user не имеет NOPASSWD на apt — упадёт с sudo password required)
  # 2) Browser binaries — уже как claudeclaw в его HOME (он юзает их)
  ssh "$SSH_TARGET" "
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    # Шаг 1: системные deps под root (npx playwright install-deps -- ставит apt-пакеты Chromium)
    cd $REMOTE_DIR && npx --yes playwright install-deps chromium 2>&1 | tail -5
    # Шаг 2: browser binary под claudeclaw (в его ~/.cache/ms-playwright/)
    sudo -u claudeclaw bash -c 'cd $REMOTE_DIR && npx --yes playwright install chromium 2>&1 | tail -5'
  " || warn "Playwright Chromium не установлен полностью (non-fatal — playwright MCP сервер не сработает, остальное работает).\nОтладка: ssh $SSH_TARGET 'npx playwright install-deps chromium && sudo -u claudeclaw npx playwright install chromium'"
  ok "Playwright Chromium установлен"
fi

# === ШАГ 6.6: OfficeCLI (docx/xlsx/pptx бинарь) ===
step "Шаг 6.6: OfficeCLI"

if [[ -n "${SKIP_OFFICECLI:-}" ]]; then
  log "Шаг 6.6: пропускаем (SKIP_OFFICECLI=1)"
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash (как claudeclaw)"
  ok "OfficeCLI: dry-run OK"
else
  log "Устанавливаю officecli бинарь для пользователя claudeclaw..."
  ssh "$SSH_TARGET" "
    set -euo pipefail
    sudo -u claudeclaw bash -lc 'curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash 2>&1 | tail -10 && officecli --version 2>&1 | head -1'
  " || warn "Не удалось установить officecli (non-fatal — скилл officecli не сработает на этом VPS, остальное работает).\nОтладка: ssh $SSH_TARGET 'sudo -u claudeclaw bash -lc \"curl -fsSL https://raw.githubusercontent.com/iOfficeAI/OfficeCLI/main/install.sh | bash\"'"
  ok "OfficeCLI установлен"
fi

# === ШАГ 6.7: notes/ vault + git init ===
# Бот спавнит `git add . && git commit && git push` в workspace/notes/ для каждого /note.
# Без существующей папки + git repo бот падает с unhandled ENOENT и крашится целиком.
step "Шаг 6.7: notes vault init (workspace/notes + git repo)"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] sudo -u claudeclaw mkdir -p $REMOTE_DIR/workspace/notes/INBOX"
  echo "  [dry-run] sudo -u claudeclaw git init / config / initial commit"
  ok "notes vault: dry-run OK"
else
  ssh "$SSH_TARGET" "
    set -euo pipefail
    sudo -u claudeclaw bash -c '
      mkdir -p $REMOTE_DIR/workspace/notes/INBOX
      cd $REMOTE_DIR/workspace/notes
      if [[ ! -d .git ]]; then
        git init -q
        git config user.email bot@claudeclaw.local
        git config user.name \"ClaudeClaw Bot\"
        echo \"# notes vault\" > README.md
        git add . && git commit -q -m init
      fi
    '
  " || warn "notes vault init не удался (non-fatal — /note команда упадёт без него).\nОтладка: ssh $SSH_TARGET 'sudo -u claudeclaw bash -c \"cd $REMOTE_DIR/workspace/notes && git status\"'"
  ok "notes vault инициализирован"
fi

# === ШАГ 7: .env ===
step "Шаг 7: .env"

if [[ "$DRY_RUN" == "true" ]]; then
  if [[ -n "$ENV_FILE" ]]; then
    echo "  [dry-run] scp $ENV_FILE $SSH_TARGET:$REMOTE_DIR/.env"
    echo "  [dry-run] chmod 600 $REMOTE_DIR/.env && chown claudeclaw:claudeclaw $REMOTE_DIR/.env"
  else
    echo "  [dry-run] --env-file не задан -- .env нужно добавить вручную"
    echo "  [dry-run] Команда: scp <path>/.env $SSH_TARGET:$REMOTE_DIR/.env"
  fi
  ok ".env: dry-run OK"
else
  if [[ -n "$ENV_FILE" ]]; then
    [[ -f "$ENV_FILE" ]] || die ".env файл не найден: $ENV_FILE"
    scp "$ENV_FILE" "$SSH_TARGET:$REMOTE_DIR/.env" || \
      die "Не удалось скопировать .env.\nОтладка: scp -v $ENV_FILE $SSH_TARGET:$REMOTE_DIR/.env"
    ssh "$SSH_TARGET" "chmod 600 $REMOTE_DIR/.env && chown claudeclaw:claudeclaw $REMOTE_DIR/.env"
    ok ".env скопирован и защищён (chmod 600)"
  else
    warn "--env-file не задан. Добавь .env вручную:"
    warn "  scp <path>/.env $SSH_TARGET:$REMOTE_DIR/.env"
    warn "  ssh $SSH_TARGET 'chmod 600 $REMOTE_DIR/.env && chown claudeclaw:claudeclaw $REMOTE_DIR/.env'"
  fi
fi

# === ШАГ 7.5: авторизация Claude Code CLI ===
step "Шаг 7.5: авторизация Claude Code CLI"

AUTH_METHOD="${AUTH_METHOD:-z.ai}"
SKIP_AUTH="${SKIP_AUTH:-}"

if [[ -n "$SKIP_AUTH" ]]; then
  log "Шаг 7.5: пропускаем (SKIP_AUTH=1)"
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] ssh $SSH_TARGET 'cd $REMOTE_DIR && bash scripts/auth-cli.sh --method=$AUTH_METHOD --target-user=claudeclaw'"
  ok "auth-cli: dry-run OK"
else
  log "Запускаю auth-cli.sh на VPS (метод: $AUTH_METHOD)..."
  ssh "$SSH_TARGET" "
    set -euo pipefail
    cd $REMOTE_DIR
    bash scripts/auth-cli.sh --method=$AUTH_METHOD --target-user=claudeclaw
  " || die "auth-cli.sh завершился с ошибкой.\nОтладка: ssh $SSH_TARGET 'cd $REMOTE_DIR && bash scripts/auth-cli.sh --method=$AUTH_METHOD --target-user=claudeclaw'\nЛог: ssh $SSH_TARGET 'tail -30 /var/log/klod-box/auth-cli.log'"
  ok "Авторизация CLI выполнена (метод: $AUTH_METHOD)"
fi

# === ШАГ 7.6: Composio MCP (tool_router URL → ~/.claude.json) ===
# Composio MCP — HTTP remote endpoint на стороне Composio.
# URL генерируется через @composio/core SDK однократно на пару (COMPOSIO_API_KEY, COMPOSIO_USER_ID),
# затем прописывается в ~/.claude.json mcpServers.composio (per-user, не settings.json).
# Если COMPOSIO_API_KEY пуст в .env — шаг пропускается, бот работает без Composio actions.
# Verified live на yulya-china (2026-05-11): бот реально записывает в Notion через mcp__composio__*.
step "Шаг 7.6: Composio MCP (tool_router URL)"

SKIP_COMPOSIO_MCP="${SKIP_COMPOSIO_MCP:-}"

if [[ -n "$SKIP_COMPOSIO_MCP" ]]; then
  log "Шаг 7.6: пропускаем (SKIP_COMPOSIO_MCP=1)"
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] scp -r $SCRIPT_DIR/composio-bootstrap-template/ $SSH_TARGET:/home/claudeclaw/composio-bootstrap/"
  echo "  [dry-run] ssh $SSH_TARGET 'npm install && node bootstrap.mjs' → patch ~/.claude.json"
  ok "composio-mcp: dry-run OK"
else
  COMPOSIO_KEY_PRESENT=$(ssh "$SSH_TARGET" "grep -E '^COMPOSIO_API_KEY=' $REMOTE_DIR/.env 2>/dev/null | sed 's/^COMPOSIO_API_KEY=//' | grep -c '^ak_' || true")
  if [[ "$COMPOSIO_KEY_PRESENT" != "1" ]]; then
    log "Шаг 7.6: COMPOSIO_API_KEY пуст или не начинается с ak_ — пропускаем"
  else
    log "Заливаю composio-bootstrap на VPS и генерирую tool_router URL..."
    scp -q -r "$SCRIPT_DIR/composio-bootstrap-template/" "$SSH_TARGET:/tmp/composio-bootstrap-stage/" \
      || die "scp composio-bootstrap-template failed"
    ssh "$SSH_TARGET" "
      set -euo pipefail
      sudo -u claudeclaw bash -c '
        set -euo pipefail
        mkdir -p /home/claudeclaw/composio-bootstrap
        cp /tmp/composio-bootstrap-stage/bootstrap.mjs /home/claudeclaw/composio-bootstrap/
        cp /tmp/composio-bootstrap-stage/package.json /home/claudeclaw/composio-bootstrap/
        cd /home/claudeclaw/composio-bootstrap
        test -d node_modules || npm install --silent 2>&1 | tail -3
      '
      rm -rf /tmp/composio-bootstrap-stage
      COMPOSIO_API_KEY=\$(grep -E '^COMPOSIO_API_KEY=' $REMOTE_DIR/.env | sed 's/^COMPOSIO_API_KEY=//')
      COMPOSIO_USER_ID=\$(grep -E '^COMPOSIO_USER_ID=' $REMOTE_DIR/.env | sed 's/^COMPOSIO_USER_ID=//')
      if [[ -z \"\$COMPOSIO_USER_ID\" ]]; then COMPOSIO_USER_ID='$SLUG'; fi
      BOOTSTRAP_OUT=\$(sudo -u claudeclaw COMPOSIO_API_KEY=\"\$COMPOSIO_API_KEY\" COMPOSIO_USER_ID=\"\$COMPOSIO_USER_ID\" bash -c 'cd /home/claudeclaw/composio-bootstrap && node bootstrap.mjs' 2>&1)
      MCP_URL=\$(echo \"\$BOOTSTRAP_OUT\" | grep '^URL:' | sed 's/^URL: //')
      if [[ -z \"\$MCP_URL\" ]]; then
        echo \"ERROR: bootstrap.mjs не вернул URL. Output:\"
        echo \"\$BOOTSTRAP_OUT\"
        exit 1
      fi
      echo \"Composio tool_router URL: \$MCP_URL\"
      sudo -u claudeclaw python3 - <<PYEOF
import json, os
p = '/home/claudeclaw/.claude.json'
d = json.load(open(p)) if os.path.exists(p) else {}
d.setdefault('mcpServers', {})['composio'] = {
    'type': 'http',
    'url': '\$MCP_URL',
    'headers': {'x-api-key': '\$COMPOSIO_API_KEY'}
}
json.dump(d, open(p, 'w'), indent=2)
os.chmod(p, 0o600)
print('OK, mcpServers:', list(d['mcpServers'].keys()))
PYEOF
    " || die "Composio MCP setup failed.\nDebug: ssh $SSH_TARGET 'sudo -u claudeclaw cat /home/claudeclaw/.claude.json'"
    ok "Composio MCP настроен (~/.claude.json mcpServers.composio)"
  fi
fi

# === ШАГ 7.7: MCP-настройки (seed-mcp-settings.sh) ===
step "Шаг 7.7: MCP-настройки"

SKIP_MCP="${SKIP_MCP:-}"

if [[ -n "$SKIP_MCP" ]]; then
  log "Шаг 7.7: пропускаем (SKIP_MCP=1)"
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] ssh $SSH_TARGET 'mkdir -p $REMOTE_DIR/tenants/$SLUG && cp $REMOTE_DIR/.env $REMOTE_DIR/tenants/$SLUG/.env'"
  echo "  [dry-run] ssh $SSH_TARGET 'cd $REMOTE_DIR && bash scripts/seed-mcp-settings.sh --slug=$SLUG --target-user=claudeclaw'"
  ok "seed-mcp-settings: dry-run OK"
else
  log "Запускаю seed-mcp-settings.sh на VPS (slug: $SLUG)..."
  ssh "$SSH_TARGET" "
    set -euo pipefail
    # seed-mcp-settings.sh читает tenants/<slug>/.env -- готовим его из основного .env
    mkdir -p $REMOTE_DIR/tenants/$SLUG
    if [[ ! -f $REMOTE_DIR/tenants/$SLUG/.env ]]; then
      cp $REMOTE_DIR/.env $REMOTE_DIR/tenants/$SLUG/.env
      chmod 600 $REMOTE_DIR/tenants/$SLUG/.env
    fi
    chown -R claudeclaw:claudeclaw $REMOTE_DIR/tenants/ 2>/dev/null || true
    cd $REMOTE_DIR
    bash scripts/seed-mcp-settings.sh --slug=$SLUG --target-user=claudeclaw
  " || die "seed-mcp-settings.sh завершился с ошибкой.\nОтладка: ssh $SSH_TARGET 'cd $REMOTE_DIR && bash scripts/seed-mcp-settings.sh --slug=$SLUG --target-user=claudeclaw'"
  ok "MCP-настройки применены (/home/claudeclaw/.claude/settings.json)"
fi

# === ШАГ 7.8: установка bundled skills + plugins на VPS ===
# Должна быть ДО старта systemd-юнита, иначе при первом запуске Claude Code
# попытается стартовать MCP-сервер kie-ai по пути kie-ai-mcp/dist/index.js и упадёт ENOENT.
step "Шаг 7.8: bundled skills + plugins (install-default-skills.sh)"

if [[ -n "${SKIP_SKILLS_INSTALL:-}" ]]; then
  log "Шаг 7.8: пропускаем (SKIP_SKILLS_INSTALL=1)"
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] bash $SCRIPT_DIR/install-default-skills.sh $SSH_TARGET"
  ok "install-default-skills: dry-run OK"
else
  log "Запускаю install-default-skills.sh для $SSH_TARGET..."
  bash "$SCRIPT_DIR/install-default-skills.sh" "$SSH_TARGET" \
    || die "install-default-skills.sh завершился с ошибкой.\nОтладка: bash scripts/install-default-skills.sh $SSH_TARGET"
  ok "Скиллы и плагины установлены на VPS"
fi

# === ШАГ 7.9: рендер CLAUDE.md из workspace/CLAUDE.template.md ===
# Критичный шаг — без CLAUDE.md бот не знает свои MCP-инструменты.
# Шаблон: workspace/CLAUDE.template.md ({{CLIENT_NAME}}, {{CLIENT_ROLE}}, {{CLIENT_DESCRIPTION}},
#          {{ASSISTANT_NAME}}, {{WORKSPACE_PATH}}, {{PROJECT_PATH}}).
# Источник данных: tenants/<slug>/tenant.yaml (если есть), иначе placeholders.
step "Шаг 7.9: рендер CLAUDE.md из workspace/CLAUDE.template.md"

SKIP_CLAUDE_MD_RENDER="${SKIP_CLAUDE_MD_RENDER:-}"

if [[ -n "$SKIP_CLAUDE_MD_RENDER" ]]; then
  log "Шаг 7.9: пропускаем (SKIP_CLAUDE_MD_RENDER=1)"
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] sed s/{{CLIENT_NAME}}/.../ workspace/CLAUDE.template.md > $REMOTE_DIR/CLAUDE.md"
  echo "  [dry-run] chown claudeclaw:claudeclaw $REMOTE_DIR/CLAUDE.md"
  echo "  [dry-run] wc -l $REMOTE_DIR/CLAUDE.md  -- ожидается >= 200 строк"
  ok "CLAUDE.md render: dry-run OK"
else
  # Читаем мета из tenants/<slug>/tenant.yaml если он есть локально
  TENANT_YAML_LOCAL="$PROJECT_ROOT/tenants/$SLUG/tenant.yaml"
  if [[ -f "$TENANT_YAML_LOCAL" ]]; then
    _yaml_get_local() {
      grep -m1 "^[[:space:]]*${2}:" "$1" 2>/dev/null \
        | sed "s/^[[:space:]]*${2}:[[:space:]]*//" | tr -d "\"'" || echo ""
    }
    _yaml_get_nested_local() {
      awk "/^[[:space:]]*${2}:/{found=1} found && /^[[:space:]]*${3}:/{print; found=0}" "$1" \
        | sed "s/^[[:space:]]*${3}:[[:space:]]*//" | tr -d "\"'" | head -1 || echo ""
    }
    CM_CLIENT_NAME=$(_yaml_get_local "$TENANT_YAML_LOCAL" "name" || true)
    [[ -z "$CM_CLIENT_NAME" ]] && CM_CLIENT_NAME=$(_yaml_get_nested_local "$TENANT_YAML_LOCAL" "client" "name" || true)
    CM_CLIENT_ROLE=$(_yaml_get_nested_local "$TENANT_YAML_LOCAL" "client" "role" || true)
    CM_CLIENT_PROJECT=$(_yaml_get_nested_local "$TENANT_YAML_LOCAL" "client" "project" || true)
    CM_ASSISTANT_NAME=$(_yaml_get_nested_local "$TENANT_YAML_LOCAL" "bot" "name" || true)
  fi

  CM_CLIENT_NAME="${CM_CLIENT_NAME:-Клиент}"
  CM_CLIENT_ROLE="${CM_CLIENT_ROLE:-}"
  CM_CLIENT_PROJECT="${CM_CLIENT_PROJECT:-}"
  CM_ASSISTANT_NAME="${CM_ASSISTANT_NAME:-Клод}"

  if [[ -n "$CM_CLIENT_ROLE" && -n "$CM_CLIENT_PROJECT" ]]; then
    CM_CLIENT_DESC="$CM_CLIENT_ROLE, проект $CM_CLIENT_PROJECT"
  elif [[ -n "$CM_CLIENT_ROLE" ]]; then
    CM_CLIENT_DESC="$CM_CLIENT_ROLE"
  else
    CM_CLIENT_DESC="персональный AI-ассистент"
  fi

  CM_WORKSPACE_PATH="$REMOTE_DIR/workspace"
  CM_PROJECT_PATH="$REMOTE_DIR"

  log "Рендеринг CLAUDE.md: CLIENT_NAME='$CM_CLIENT_NAME', ASSISTANT_NAME='$CM_ASSISTANT_NAME'"

  ssh "$SSH_TARGET" "
    set -euo pipefail
    if [[ ! -f $REMOTE_DIR/workspace/CLAUDE.template.md ]]; then
      echo 'ERROR: workspace/CLAUDE.template.md не найден на VPS' >&2
      exit 1
    fi
    sudo -u claudeclaw sed \
      -e \"s|{{CLIENT_NAME}}|$CM_CLIENT_NAME|g\" \
      -e \"s|{{CLIENT_ROLE}}|$CM_CLIENT_ROLE|g\" \
      -e \"s|{{CLIENT_DESCRIPTION}}|$CM_CLIENT_DESC|g\" \
      -e \"s|{{ASSISTANT_NAME}}|$CM_ASSISTANT_NAME|g\" \
      -e \"s|{{WORKSPACE_PATH}}|$CM_WORKSPACE_PATH|g\" \
      -e \"s|{{PROJECT_PATH}}|$CM_PROJECT_PATH|g\" \
      $REMOTE_DIR/workspace/CLAUDE.template.md > $REMOTE_DIR/CLAUDE.md
    chown claudeclaw:claudeclaw $REMOTE_DIR/CLAUDE.md
  " || die "Рендер CLAUDE.md завершился с ошибкой.\nОтладка: ssh $SSH_TARGET 'ls -la $REMOTE_DIR/workspace/CLAUDE.template.md'"

  # Рендер плейсхолдеров в workspace/reference/*.md (детальные справочники под задачу).
  # ops.md содержит {{PROJECT_PATH}} — без рендера расписание/команды у бота сломаются.
  ssh "$SSH_TARGET" "
    set -euo pipefail
    if [[ -d $REMOTE_DIR/workspace/reference ]] && ls $REMOTE_DIR/workspace/reference/*.md >/dev/null 2>&1; then
      sudo -u claudeclaw sed -i \
        -e \"s|{{PROJECT_PATH}}|$CM_PROJECT_PATH|g\" \
        -e \"s|{{WORKSPACE_PATH}}|$CM_WORKSPACE_PATH|g\" \
        $REMOTE_DIR/workspace/reference/*.md
      chown claudeclaw:claudeclaw $REMOTE_DIR/workspace/reference/*.md
    fi
  " || warn "Рендер reference/*.md не удался (non-fatal — проверь {{PROJECT_PATH}} в workspace/reference/ops.md)."

  # Архитектура с v0.9.5: короткое ядро CLAUDE.md (~90 строк) + детали в workspace/reference/.
  # Раньше ждали >= 200 строк (старый раздутый шаблон) — теперь порог низкий.
  CLAUDE_MD_LINES=$(ssh "$SSH_TARGET" "wc -l < $REMOTE_DIR/CLAUDE.md" 2>/dev/null || echo "0")
  PLACEHOLDERS_LEFT=$(ssh "$SSH_TARGET" "grep -c '{{' $REMOTE_DIR/CLAUDE.md 2>/dev/null || echo 0")
  if (( CLAUDE_MD_LINES < 50 )); then
    warn "CLAUDE.md содержит только $CLAUDE_MD_LINES строк (ожидалось >= 50). Template мог не скопироваться."
  elif (( PLACEHOLDERS_LEFT > 0 )); then
    warn "В CLAUDE.md остались неотрендеренные плейсхолдеры ({{...}}): $PLACEHOLDERS_LEFT. Проверь tenant.yaml."
  else
    ok "CLAUDE.md отрендерен ($CLAUDE_MD_LINES строк, плейсхолдеров нет) + reference/ готовы"
  fi
fi

# === ШАГ 8: systemd-юнит ===
step "Шаг 8: systemd-юнит $SERVICE_NAME"

UNIT_CONTENT="[Unit]
Description=claudeclaw bot instance '$SLUG'
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=claudeclaw
WorkingDirectory=$REMOTE_DIR
ExecStart=/usr/bin/node dist/index.js
EnvironmentFile=$REMOTE_DIR/.env
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

[Install]
WantedBy=multi-user.target"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] cat > $SERVICE_FILE << 'EOF'"
  echo "$UNIT_CONTENT" | sed 's/^/  /'
  echo "  [dry-run] EOF"
  ok "systemd: dry-run OK"
else
  ssh "$SSH_TARGET" "cat > $SERVICE_FILE" << UNITEOF
$UNIT_CONTENT
UNITEOF
  [[ $? -eq 0 ]] || die "Не удалось создать $SERVICE_FILE.\nОтладка: ssh $SSH_TARGET 'ls -la /etc/systemd/system/'"
  ok "Systemd-юнит создан: $SERVICE_FILE"
fi

# === ШАГ 9: ключ klod-box-ops ===
step "Шаг 9: ключ klod-box-ops"

if [[ -n "$OPS_PUBKEY" ]]; then
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] mkdir -p /home/claudeclaw/.ssh && chmod 700 /home/claudeclaw/.ssh"
    echo "  [dry-run] echo '<ops-pubkey>' >> /home/claudeclaw/.ssh/authorized_keys"
    echo "  [dry-run] chmod 600 /home/claudeclaw/.ssh/authorized_keys"
    ok "ops-key: dry-run OK"
  else
    # Передаём ключ через stdin (heredoc) -- безопасно для любых спецсимволов публичного ключа
    ssh "$SSH_TARGET" "
      set -euo pipefail
      mkdir -p /home/claudeclaw/.ssh
      chmod 700 /home/claudeclaw/.ssh
      KEYFILE=/home/claudeclaw/.ssh/authorized_keys
      touch \"\$KEYFILE\"
      KEY=\$(cat)
      if ! grep -qxF \"\$KEY\" \"\$KEYFILE\" 2>/dev/null; then
        echo \"\$KEY\" >> \"\$KEYFILE\"
        echo 'Ключ добавлен'
      else
        echo 'Ключ уже есть'
      fi
      chmod 600 \"\$KEYFILE\"
      chown -R claudeclaw:claudeclaw /home/claudeclaw/.ssh
    " << KEYEOF
$OPS_PUBKEY
KEYEOF
    [[ $? -eq 0 ]] || die "Не удалось добавить ключ klod-box-ops.\nОтладка: ssh $SSH_TARGET 'ls -la /home/claudeclaw/.ssh/'"
    ok "Ключ klod-box-ops добавлен в authorized_keys claudeclaw"
  fi
else
  log "Шаг 9: пропускаем (ключ не задан)"
fi

# === ШАГ 10: daemon-reload + enable + start ===
step "Шаг 10: systemctl enable --now $SERVICE_NAME"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] systemctl daemon-reload"
  echo "  [dry-run] systemctl enable --now $SERVICE_NAME"
  ok "systemctl: dry-run OK"
else
  ssh "$SSH_TARGET" "
    set -euo pipefail
    systemctl daemon-reload
    systemctl enable --now $SERVICE_NAME
  " || die "Не удалось запустить $SERVICE_NAME.\nОтладка: ssh $SSH_TARGET 'journalctl -u $SERVICE_NAME -n 50 --no-pager'"
  ok "Сервис $SERVICE_NAME запущен"
fi

# === ШАГ 11: Verify ===
step "Шаг 11: проверка статуса"

# Отключаем cleanup -- установка завершена, откатывать нечего
CLEANUP_ON_ERROR="false"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] systemctl is-active $SERVICE_NAME  -- ожидается 'active'"
  echo "  [dry-run] claude --version                 -- CLAUDE CLI версия"
  echo "  [dry-run] sudo -u claudeclaw test -f /home/claudeclaw/.claude/.credentials.json"
  echo "  [dry-run] sudo -u claudeclaw test -f /home/claudeclaw/.claude/settings.json"
  echo ""
  echo "=== Dry-run завершён ==="
  echo "  Slug:    $SLUG"
  echo "  Target:  $SSH_TARGET"
  echo "  Dir:     $REMOTE_DIR"
  echo "  Service: $SERVICE_NAME"
  echo "  Log:     $LOG_FILE"
  echo ""
  echo "Для реального запуска убери --dry-run"
else
  sleep 3
  STATUS=$(ssh "$SSH_TARGET" "systemctl is-active $SERVICE_NAME 2>&1" || true)
  if [[ "$STATUS" == "active" ]]; then
    ok "Сервис $SERVICE_NAME активен"
    # -- дополнительные проверки --
    CLAUDE_VER_CHECK=$(ssh "$SSH_TARGET" "claude --version 2>/dev/null || echo ''" 2>/dev/null || echo "")
    if [[ -n "$CLAUDE_VER_CHECK" ]]; then
      ok "CLAUDE CLI: $CLAUDE_VER_CHECK"
    else
      warn "CLAUDE CLI: не найден в PATH (проверь шаг 2.5)"
    fi
    CREDS_OK=$(ssh "$SSH_TARGET" \
      "sudo -u claudeclaw test -f /home/claudeclaw/.claude/.credentials.json && echo yes || echo no" \
      2>/dev/null || echo "no")
    if [[ "$CREDS_OK" == "yes" ]]; then
      ok "credentials: present"
    else
      warn "credentials: not found (/home/claudeclaw/.claude/.credentials.json)"
      warn "Запусти: ssh $SSH_TARGET 'cd $REMOTE_DIR && bash scripts/auth-cli.sh --method=$AUTH_METHOD --target-user=claudeclaw'"
    fi
    MCP_OK=$(ssh "$SSH_TARGET" \
      "sudo -u claudeclaw test -f /home/claudeclaw/.claude/settings.json && echo yes || echo no" \
      2>/dev/null || echo "no")
    if [[ "$MCP_OK" == "yes" ]]; then
      ok "MCP settings: present"
    else
      warn "MCP settings: not found (/home/claudeclaw/.claude/settings.json)"
      warn "Запусти: ssh $SSH_TARGET 'cd $REMOTE_DIR && bash scripts/seed-mcp-settings.sh --slug=$SLUG --target-user=claudeclaw'"
    fi
    echo ""
    echo -e "${GREEN}=== Установка завершена ===${NC}"
    echo "  Slug:        $SLUG"
    echo "  VPS:         $SSH_TARGET"
    echo "  Директория:  $REMOTE_DIR"
    echo "  Сервис:      $SERVICE_NAME"
    echo "  Лог:         $LOG_FILE"
    echo ""
    echo "Полезные команды:"
    echo "  Логи:   ssh $SSH_TARGET 'journalctl -u $SERVICE_NAME -f'"
    echo "  Статус: ssh $SSH_TARGET 'systemctl status $SERVICE_NAME'"
    echo "  Стоп:   ssh $SSH_TARGET 'systemctl stop $SERVICE_NAME'"
  else
    err "Сервис $SERVICE_NAME не активен (статус: $STATUS)"
    err "Посмотри логи: ssh $SSH_TARGET 'journalctl -u $SERVICE_NAME -n 100 --no-pager'"
    err "Последние строки: ssh $SSH_TARGET 'journalctl -u $SERVICE_NAME --since -2min --no-pager'"
    exit 1
  fi
fi
