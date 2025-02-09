import os
import subprocess
import tkinter as tk
from tkinter import messagebox, filedialog, ttk
from datetime import datetime
import time
import uuid
import requests

# Configuration
PROJECTS_DIR = os.path.expanduser("~/Documents/V0_Projects")
REPO_DIR = os.path.join(PROJECTS_DIR, "cartest")
VERSION_FILE = os.path.join(REPO_DIR, "version.ini")
V0_DEV_URL = "https://v0.dev/chat/cartest-tupabase-template-hdQdrfzkTFA"
VERCEL_URL = "https://vercel.com"
SUPABASE_URL = "https://supabase.com"
GITHUB_URL = "https://github.com/salavey13/cartest"
TEMP_DIR = os.path.join(os.getenv("TEMP"), "setup_temp")
# Default configuration template for version.ini
DEFAULT_CONFIG = """CURRENT_VERSION=0
LAST_APPLIED_ZIP=
VERCEL_PROJECT_URL=
SUPABASE_PROJECT_ID=
TELEGRAM_BOT_TOKEN=
ADMIN_CHAT_ID=
"""

def ensure_version_file():
    """
    Ensure that the V0_Projects folder and version.ini file exist.
    If version.ini is missing, create it with default values.
    """
    # Create V0_Projects folder if it doesn't exist
    if not os.path.exists(PROJECTS_DIR):
        os.makedirs(PROJECTS_DIR)
        print(f"Папка {PROJECTS_DIR} создана.")

    # Check if version.ini exists, if not, create it with default values
    if not os.path.exists(VERSION_FILE):
        with open(VERSION_FILE, "w", encoding="utf-8") as f:
            f.write(DEFAULT_CONFIG)
        print(f"Файл {VERSION_FILE} создан с базовыми настройками.")
    else:
        print(f"Файл {VERSION_FILE} уже существует.")
# Supabase Configuration
SUPABASE_API_URL = "https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM"


# Load configuration from VERSION.ini
config = {"TOOLS_INSTALLED": []}
if os.path.exists(VERSION_FILE):
    with open(VERSION_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                key, value = line.strip().split("=", 1)
                config[key] = value


# URLs for downloads
DOWNLOAD_URLS = {
    "Git": "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe",
    "Node.js": "https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi",
    "Notepad++": "https://github.com/notepad-plus-plus/notepad-plus-plus/releases/download/v8.7.6/npp.8.7.6.Installer.x64.exe",
    "VS Code": "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user"
}

# Save configuration to VERSION.ini
def save_config():
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        for key, value in config.items():
            if isinstance(value, list):
                f.write(f"{key}={','.join(value)}\n")
            else:
                f.write(f"{key}={value}\n")

# Timer Logic
active_timers = {}
# Initialize User
config["USER_ID"] = "413553377"
#str(uuid.uuid4())
# Assuming create_user function exists and is defined elsewhere
# create_user(config["USER_ID"])

# Actions Section
def add_button(text, command, warning=None, level="Beginner"):
    def safe_command():
        if warning and not messagebox.askyesno("Подтверждение", warning):
            return
        start_timer(config["USER_ID"])
        try:
            command()
        finally:
            elapsed_time = stop_timer(config["USER_ID"], is_manual_stop=True)
            messagebox.showinfo("Время", f"Затраченное время: {elapsed_time} секунд.")
    ttk.Button(actions_frame, text=text, command=safe_command).pack(fill=tk.X, padx=10, pady=5)
    
def start_timer(user_id):
    start_time = time.time()
    active_timers[user_id] = {"start_time": start_time, "is_running": True}
    return start_time

def stop_timer(user_id, is_manual_stop=True):
    if user_id not in active_timers or not active_timers[user_id]["is_running"]:
        return None
    start_time = active_timers[user_id]["start_time"]
    elapsed_time = round(time.time() - start_time)
    active_timers[user_id]["is_running"] = False
    update_user_metadata(user_id, "total_time", elapsed_time, is_manual_stop)
    return elapsed_time

def update_user_metadata(user_id, key, value, is_manual_stop=True):
    url = f"{SUPABASE_API_URL}/rest/v1/users?user_id=eq.{user_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        user_data = response.json()[0]
        metadata = user_data.get("metadata", {})
        total_time = metadata.get("total_time", 0)
        if key == "total_time":
            metadata["total_time"] = total_time + value
            metadata["last_action"] = "manual_stop" if is_manual_stop else "timer_expired"
        payload = {"metadata": metadata}
        response = requests.patch(url, json=payload, headers=headers)
        if response.status_code != 200:
            print("Failed to update user metadata:", response.text)

def run_command(command, success_message="Успех", error_message="Ошибка"):
    """Run a shell command and show output."""
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        messagebox.showinfo("Успех", success_message + "\n" + result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Ошибка", error_message + "\n" + e.stderr)
        return False

def create_project_folder():
    """Create the V0_Projects folder and clone the cartest repository if Git is installed."""
    # Check if Git is installed
    git_installed = subprocess.run("where git", shell=True, capture_output=True, text=True)
    if git_installed.returncode != 0:
        messagebox.showwarning("Внимание", "Git не установлен. Пожалуйста, установите Git перед клонированием репозитория.")
        return

    # Create the V0_Projects folder if it doesn't exist
    if not os.path.exists(PROJECTS_DIR):
        os.makedirs(PROJECTS_DIR)
        messagebox.showinfo("Успех", f"Папка {PROJECTS_DIR} создана.")
    else:
        messagebox.showinfo("Информация", f"Папка {PROJECTS_DIR} уже существует.")

    # Check if the cartest repository is already cloned
    if not os.path.exists(REPO_DIR):
        # Clone the cartest repository
        repo_url = "https://github.com/salavey13/cartest.git"
        try:
            subprocess.run(f"cd \"{PROJECTS_DIR}\" && git clone {repo_url}", shell=True, check=True)
            messagebox.showinfo("Успех", "Репозиторий cartest успешно клонирован.")
        except subprocess.CalledProcessError as e:
            messagebox.showerror("Ошибка", f"Не удалось клонировать репозиторий cartest: {e.stderr}")
    else:
        messagebox.showinfo("Информация", "Репозиторий cartest уже клонирован.")
    ensure_version_file()


def add_ascii_art():
    """Add ASCII art to the dashboard."""
    ascii_art = """
    _|_|_|  _|        _|      _|    _|  _|_|_|    
  _|        _|          _|  _|    _|_|        _|  
    _|_|    _|            _|        _|    _|_|    
        _|  _|            _|        _|        _|  
  _|_|_|    _|_|_|_|      _|        _|  _|_|_|    
    """
    ttk.Label(root, text=ascii_art, font=("Courier New", 10), background="#1e1e1e", foreground="#ffffff").pack(pady=10)


def apply_zip_updates():
    """Handle ZIP updates."""
    zip_path = filedialog.askopenfilename(
        title="Выберите ZIP файл",
        filetypes=[("ZIP Files", "*.zip")],
        initialdir=REPO_DIR
    )
    if not zip_path:
        messagebox.showwarning("Внимание", "ZIP файл не выбран.")
        return
    # Extract ZIP and apply updates
    try:
        extract_dir = os.path.join(os.path.dirname(zip_path), "temp_unzip")
        subprocess.run(f"powershell -Command \"Expand-Archive -Force '{zip_path}' -DestinationPath '{extract_dir}'\"", shell=True, check=True)
        subprocess.run(f"xcopy /s /y \"{extract_dir}\\*\" \"{REPO_DIR}\"", shell=True, check=True)
        subprocess.run(f"rmdir /s /q \"{extract_dir}\"", shell=True, check=True)
        # Update version file
        current_version = int(config.get("CURRENT_VERSION", 0))
        next_version = current_version + 1
        config["CURRENT_VERSION"] = str(next_version)
        config["LAST_APPLIED_ZIP"] = os.path.basename(zip_path)
        save_config()
        # Create pull request
        branch_name = f"update-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        subprocess.run(f"git checkout -b {branch_name}", shell=True, check=True)
        subprocess.run("git add .", shell=True, check=True)
        commit_msg = f"Обновления от {os.path.basename(zip_path)} | Версия {next_version}"
        subprocess.run(f"git commit -m \"{commit_msg}\"", shell=True, check=True)
        subprocess.run(f"git push origin {branch_name}", shell=True, check=True)
        subprocess.run("git checkout main", shell=True, check=True)
        subprocess.run("git pull origin main", shell=True, check=True)
        subprocess.Popen(["start", "https://github.com/salavey13/cartest/pulls"], shell=True)
        messagebox.showinfo("Успех", "ZIP обновления применены успешно и создан Pull Request.")
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Ошибка", f"Не удалось применить ZIP обновления: {e.stderr}")

def reset_supabase_db(sql_file=None):
    """Reset Supabase database with optional SQL file."""
    if sql_file is None:
        sql_file = filedialog.askopenfilename(
            title="Выберите SQL файл",
            filetypes=[("SQL Files", "*.sql")],
            initialdir=REPO_DIR
        )
        if not sql_file:
            messagebox.showwarning("Внимание", "SQL файл не выбран.")
            return
    # Warn about resetting the database
    if not messagebox.askyesno("Подтверждение", "Сброс базы данных удалит все текущие данные. Продолжить?"):
        return
    run_command(f"supabase db reset --sql \"{sql_file}\"", "База данных сброшена успешно.", "Не удалось сбросить базу данных.")

def configure_vercel():
    """Configure Vercel deployment."""
    if "VERCEL_PROJECT_URL" in config:
        messagebox.showinfo("Информация", f"Vercel уже настроен: {config['VERCEL_PROJECT_URL']}")
        return
    try:
        subprocess.run("vercel login", shell=True, check=True)
        subprocess.run(f"cd \"{REPO_DIR}\" && vercel projects create cartest --yes", shell=True, check=True)
        subprocess.run(f"cd \"{REPO_DIR}\" && vercel deploy --prod", shell=True, check=True)
        vercel_url = subprocess.check_output("vercel inspect --scope", shell=True, text=True).strip()
        config["VERCEL_PROJECT_URL"] = vercel_url
        save_config()
        messagebox.showinfo("Успех", f"Vercel настроен успешно: {vercel_url}")
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Ошибка", f"Не удалось настроить Vercel: {e.stderr}")

def configure_telegram_bot():
    """Configure Telegram Bot token and admin chat ID."""
    if "TELEGRAM_BOT_TOKEN" not in config:
        bot_token = tk.simpledialog.askstring("Ввод", "Введите токен вашего Telegram бота:")
        if bot_token:
            config["TELEGRAM_BOT_TOKEN"] = bot_token
            save_config()
            messagebox.showinfo("Успех", "Токен Telegram бота настроен успешно.")
        else:
            messagebox.showwarning("Внимание", "Токен Telegram бота не установлен.")
    if "ADMIN_CHAT_ID" not in config:
        admin_chat_id = tk.simpledialog.askstring("Ввод", "Введите ID админского чата:")
        if admin_chat_id:
            config["ADMIN_CHAT_ID"] = admin_chat_id
            save_config()
            messagebox.showinfo("Успех", "ID админского чата настроен успешно.")
        else:
            messagebox.showwarning("Внимание", "ID админского чата не установлен.")
    if "VERCEL_PROJECT_URL" in config:
        if "TELEGRAM_BOT_TOKEN" in config:
            run_command(f"vercel env add TELEGRAM_BOT_TOKEN {config['TELEGRAM_BOT_TOKEN']} production")
        if "ADMIN_CHAT_ID" in config:
            run_command(f"vercel env add ADMIN_CHAT_ID {config['ADMIN_CHAT_ID']} production")

def set_webhook():
    """Set webhook for Telegram Bot."""
    if "VERCEL_PROJECT_URL" not in config:
        messagebox.showerror("Ошибка", "URL Vercel не настроен.")
        return
    webhook_url = f"https://{config['VERCEL_PROJECT_URL']}/api/telegramWebhook"
    run_command(f"npx tsx scripts/setWebhook.ts", "Webhook установлен успешно.", "Не удалось установить webhook.")

def generate_embeddings():
    """Regenerate embeddings for semantic search."""
    if not messagebox.askyesno(
        "Подтверждение",
        "Это перегенерирует все вложения для семантического поиска. Это может занять некоторое время. Продолжить?",
    ):
        return
    run_command(
        "npx tsx utils/embeddingsGenerator.ts",
        "Вложения успешно перегенерированы.",
        "Не удалось перегенерировать вложения.",
    )

def generate_installation_achievement(tool_name):
    """Generate an achievement for installing a tool."""
    achievement = f"🔧 {tool_name} Установлен!"
    if achievement not in generate_achievements():
        messagebox.showinfo("Достижение разблокировано!", achievement)
        
def generate_achievements():
    """Generate gamified achievements based on customization and installation progress."""
    achievements = []
    if "VERCEL_PROJECT_URL" in config:
        achievements.append("🌟 Vercel настроен!")
    if "SUPABASE_PROJECT_ID" in config:
        achievements.append("🚀 База данных Supabase готова!")
    if "TELEGRAM_BOT_TOKEN" in config and "ADMIN_CHAT_ID" in config:
        achievements.append("🔥 Telegram бот настроен!")
    if os.path.exists(os.path.join(REPO_DIR, "seed.sql")):
        achievements.append("🌱 Данные загружены через seed.sql!")
    # Add achievements for installed tools
    for tool in config.get("TOOLS_INSTALLED", []):
        achievements.append(f"🔧 {tool} Установлен!")
    if not achievements:
        achievements.append("✨ Начните с настройки Vercel!")
    return achievements

def get_user_level():
    """Determine the user's level based on achievements."""
    achievements = generate_achievements()
    if len(achievements) >= 5:
        return "Badass"
    elif len(achievements) >= 3:
        return "Advanced"
    elif len(achievements) >= 1:
        return "Intermediate"
    else:
        return "Beginner"

def is_telegram_dashboard_unlocked():
    return all(key in config for key in ["VERCEL_PROJECT_URL", "TELEGRAM_BOT_TOKEN", "ADMIN_CHAT_ID"])

def open_telegram_dashboard():
    telegram_window = tk.Toplevel(root)
    telegram_window.title("Telegram Dashboard")
    telegram_window.geometry("800x600")
    # Bot Management Section
    bot_frame = ttk.Frame(telegram_window)
    bot_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(bot_frame, text="Bot Management", font=("Arial", 16)).pack(anchor=tk.W)
    ttk.Button(bot_frame, text="Send Custom Message", command=lambda: messagebox.showinfo("Info", "Custom message sent!")).pack(fill=tk.X, padx=10, pady=5)
    ttk.Button(bot_frame, text="Broadcast Message", command=lambda: messagebox.showinfo("Info", "Broadcast message sent!")).pack(fill=tk.X, padx=10, pady=5)
    # Payment Handling Section
    payment_frame = ttk.Frame(telegram_window)
    payment_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(payment_frame, text="Payment Handling", font=("Arial", 16)).pack(anchor=tk.W)
    ttk.Button(payment_frame, text="Create Invoice", command=lambda: messagebox.showinfo("Info", "Invoice created!")).pack(fill=tk.X, padx=10, pady=5)
    ttk.Button(payment_frame, text="View Payment History", command=lambda: messagebox.showinfo("Info", "Payment history viewed!")).pack(fill=tk.X, padx=10, pady=5)
    # User Management Section
    user_frame = ttk.Frame(telegram_window)
    user_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(user_frame, text="User Management", font=("Arial", 16)).pack(anchor=tk.W)
    ttk.Button(user_frame, text="View Users", command=lambda: messagebox.showinfo("Info", "Users viewed!")).pack(fill=tk.X, padx=10, pady=5)
    ttk.Button(user_frame, text="Edit User", command=lambda: messagebox.showinfo("Info", "User edited!")).pack(fill=tk.X, padx=10, pady=5)

def download_and_install(tool_name):
    """Download and install a tool with timing."""
    
    # Check if the tool is already installed
    if tool_name == "Vercel CLI":
        result = subprocess.run("vercel --version", shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            messagebox.showinfo("Информация", "Vercel CLI уже установлен.")
            return
    
    if tool_name == "Supabase CLI":
        result = subprocess.run("supabase --version", shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            messagebox.showinfo("Информация", "Supabase CLI уже установлен.")
            return

    # Install via npm
    if tool_name in ["Vercel CLI", "Supabase CLI"]:
        command = f"npm install -g {tool_name.lower().replace(' ', '')}"
        start_time = config["USER_ID"]
        
        if not run_command(command, f"{tool_name} установлен успешно.", f"Не удалось установить {tool_name}."):
            return
        
        elapsed_time = stop_timer(start_time)
        update_user_metadata(config["USER_ID"], f"{tool_name.lower()}_installed", elapsed_time)
        
        # Add to installed tools and save config
        if tool_name not in config.get("TOOLS_INSTALLED", []):
            config.setdefault("TOOLS_INSTALLED", []).append(tool_name)
            save_config()
        
        messagebox.showinfo("Успех", f"{tool_name} успешно установлен за {elapsed_time} секунд.")
        generate_installation_achievement(tool_name)
        return

    # For other tools, proceed with the existing installation logic
    url = DOWNLOAD_URLS.get(tool_name)
    if not url:
        messagebox.showerror("Ошибка", f"URL для {tool_name} не найден.")
        return
    
    file_path = os.path.join(TEMP_DIR, f"{tool_name.replace(' ', '_')}-Installer.exe")
    if not os.path.exists(TEMP_DIR):
        os.makedirs(TEMP_DIR)

    # Download
    start_time = config["USER_ID"]
    if not run_command(f'powershell -Command "Invoke-WebRequest -Uri \'{url}\' -OutFile \'{file_path}\'"',
                       f"{tool_name} скачан успешно.", f"Не удалось скачать {tool_name}."):
        return

    # Install
    install_args = {
        "Git": "/VERYSILENT /NORESTART /NOCANCEL",
        "Node.js": "/quiet",
        "Notepad++": "/S",
        "VS Code": "/verysilent /suppressmsgboxes"
    }
    args = install_args.get(tool_name, "")
    if not run_command(f'"{file_path}" {args}',
                       f"{tool_name} установлен успешно.", f"Не удалось установить {tool_name}."):
        return

    elapsed_time = stop_timer(start_time)
    update_user_metadata(config["USER_ID"], f"{tool_name.lower()}_installed", elapsed_time)

    # Add to installed tools and save config
    if tool_name not in config.get("TOOLS_INSTALLED", []):
        config.setdefault("TOOLS_INSTALLED", []).append(tool_name)
        save_config()

    messagebox.showinfo("Успех", f"{tool_name} успешно установлен за {elapsed_time} секунд.")
    generate_installation_achievement(tool_name)
 
# Leaderboard Display
def show_leaderboard():
    leaderboard_window = tk.Toplevel()
    leaderboard_window.title("Таблица лидеров")
    leaderboard_window.geometry("800x600")
    header_frame = ttk.Frame(leaderboard_window)
    header_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(header_frame, text="Лидеры настройки проекта", font=("Arial", 18, "bold")).pack()
    body_frame = ttk.Frame(leaderboard_window)
    body_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
    try:
        response = requests.get(
            f"{SUPABASE_API_URL}/rest/v1/users?select=user_id,metadata&status=eq.admin",
            headers={"apikey": SUPABASE_ANON_KEY}
        )
        if response.status_code == 200:
            users = response.json()
            users.sort(key=lambda x: x['metadata'].get('total_time', float('inf')))
            for idx, user in enumerate(users[:10]):
                nickname = user['metadata'].get('nickname', 'Неизвестный')
                total_time = user['metadata'].get('total_time', 'N/A')
                achievements = ", ".join(user['metadata'].get('achievements', []))
                ttk.Label(body_frame, text=f"{idx + 1}. {nickname} ({user['user_id']}) - {total_time} секунд", font=("Arial", 14, "bold")).pack(anchor=tk.W)
                ttk.Label(body_frame, text=f"   🏆 Достижения: {achievements}", font=("Arial", 12)).pack(anchor=tk.W)
        else:
            ttk.Label(body_frame, text="Не удалось загрузить таблицу лидеров.", font=("Arial", 12)).pack()
    except Exception as e:
        ttk.Label(body_frame, text=f"Ошибка: {str(e)}", font=("Arial", 12)).pack()
        
def refresh_dashboard():
    """Refresh the dashboard UI."""
    user_level = get_user_level()
    for widget in root.winfo_children():
        widget.destroy()
    
    # Header
    header_frame = ttk.Frame(root)
    header_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(header_frame, text="Панель управления проектом", font=("Arial", 16)).pack()
    # Progress Section (continued)
    progress_frame = ttk.Frame(root)
    progress_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(progress_frame, text="Прогресс настройки:", font=("Arial", 16)).pack(anchor=tk.W)
    achievements = generate_achievements()
    for achievement in achievements:
        ttk.Label(progress_frame, text=f"✅ {achievement}", font=("Arial", 12)).pack(anchor=tk.W)

       

    # Actions Section
    actions_frame = ttk.Frame(root, style="Dark.TFrame")
    actions_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(actions_frame, text="Действия:", font=("Arial", 16), style="Dark.TLabel").pack(anchor=tk.W)

    def add_envbutton(text, command, level="Beginner"):
        """Helper function to add buttons for environment setup tasks."""
        btn = ttk.Button(actions_frame, text=text, command=command, style="Rounded.TButton")
        btn.pack(fill=tk.X, padx=10, pady=5)

    def add_button(text, command, warning=None, level="Beginner"):
        """Helper function to add general action buttons with optional warnings and level restrictions."""
        if user_level == "Badass" or level == "Beginner":
            def safe_command():
                if warning and not messagebox.askyesno("Подтверждение", warning):
                    return
                command()
            ttk.Button(actions_frame, text=text, command=safe_command).pack(fill=tk.X, padx=10, pady=5)

    add_envbutton("Создать папку проекта", create_project_folder)
    # Tool Installation Buttons
    installed_tools = config.get("TOOLS_INSTALLED", [])
    tools_to_install = ["Git", "Node.js", "Notepad++", "VS Code", "Vercel CLI", "Supabase CLI"]

    for tool in tools_to_install:
        if tool not in installed_tools:
            add_envbutton(f"Скачать и установить {tool}", lambda t=tool: download_and_install(t))

    # Leaderboard Button
    add_button("Показать таблицу лидеров", show_leaderboard)
    add_button("Применить ZIP обновления", apply_zip_updates, "Это перезапишет текущие файлы. Продолжить?", level="Beginner")
    add_button("Сбросить базу данных Supabase", reset_supabase_db, "Это удалит все текущие данные. Продолжить?", level="Intermediate")
    add_button("Настроить Vercel", configure_vercel, level="Beginner")
    add_button("Настроить Telegram бот", configure_telegram_bot, level="Intermediate")
    add_button("Установить Webhook", set_webhook, level="Advanced")
    add_button("Перегенерировать вложения", generate_embeddings, "Это может занять некоторое время. Продолжить?", level="Advanced")

    # Telegram Dashboard Unlock Check
    if is_telegram_dashboard_unlocked():
        messagebox.showinfo("Успех", "Вы разблокировали Telegram Dashboard! Перейдите к продвинутым настройкам.")
        ttk.Button(actions_frame, text="Открыть Telegram Dashboard", command=open_telegram_dashboard).pack(fill=tk.X, padx=10, pady=5)

    # Pro Tips Section
    pro_tips_frame = ttk.Frame(root)
    pro_tips_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(pro_tips_frame, text="Pro Tips:", font=("Arial", 13)).pack(anchor=tk.W)
    ttk.Label(pro_tips_frame, text="• Интеграция Vercel + Supabase: Перейдите в настройки проекта Vercel -> Расширения -> Supabase Integration.", font=("Arial", 10)).pack(anchor=tk.W)
    ttk.Label(pro_tips_frame, text="• Автоматизация: Используйте GitHub Actions для автоматического деплоя изменений.", font=("Arial", 10)).pack(anchor=tk.W)

    # Links Section
    links_frame = ttk.Frame(root)
    links_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(links_frame, text="Полезные ссылки:", font=("Arial", 16)).pack(anchor=tk.W)
    links = [
        ("Vercel", VERCEL_URL),
        ("Supabase", SUPABASE_URL),
        ("GitHub", GITHUB_URL),
        ("v0.dev Проект", V0_DEV_URL),
        ("Qwen Chat", "https://chat.qwenlm.ai"),
        ("Supabase SQL Console", "https://supabase.com/dashboard/project/inmctohsodgdohamhzag/sql/new"),
    ]
    for name, url in links:
        ttk.Button(links_frame, text=name, command=lambda u=url: subprocess.Popen(["start", u], shell=True)).pack(fill=tk.X, padx=10, pady=2)

    # Exit Button
    #ttk.Button(root, text="Выход", command=root.quit).pack(fill=tk.X, padx=20, pady=10)

    # ASCII Art
    add_ascii_art()

# GUI Setup
root = tk.Tk()
root.title("Панель управления проектом")
root.configure(bg="#1d1d1d")  # Dark theme background
style = ttk.Style()
style.theme_use("clam")
style.configure("TLabel", background="#2d2d2d", foreground="#ffffff", font=("Arial", 8))
style.configure("TButton", background="#4d4d4d", foreground="#ffffff", font=("Arial", 8))
style.configure("TFrame", background="#2d2d2d")

refresh_dashboard()
root.mainloop()