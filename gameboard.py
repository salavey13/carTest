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
V0_DEV_URL = "https://v0.dev/chat/fork-of-rastaman-shop-KvYJosUCML9"
VERCEL_URL = "https://vercel.com"
SUPABASE_URL = "https://supabase.com"
GITHUB_URL = "https://github.com/salavey13/cartest"
TEMP_DIR = os.path.join(os.getenv("TEMP"), "setup_temp")

# Supabase Configuration
SUPABASE_API_URL = "https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM"

# Load configuration from VERSION.ini
config = {
    "TOOLS_INSTALLED": []  # List of tools that have been installed
}
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
    "VS Code": "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user",
    "Vercel CLI": "https://vercel.com/install/cli",
    "Supabase CLI": "https://github.com/supabase/cli/releases/latest/download/supabase_windows_x64.zip"
}

# Save configuration to VERSION.ini
def save_config():
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        for key, value in config.items():
            if isinstance(value, list):  # Handle lists (e.g., TOOLS_INSTALLED)
                f.write(f"{key}={','.join(value)}\n")
            else:
                f.write(f"{key}={value}\n")

# Run a shell command and show output
def run_command(command, success_message="Успех", error_message="Ошибка"):
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        messagebox.showinfo("Успех", success_message + "\n" + result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Ошибка", error_message + "\n" + e.stderr)
        return False

# Timer Logic
def start_timer():
    """Start the timer and return the start time."""
    return time.time()

def stop_timer(start_time):
    """Stop the timer and return the elapsed time in seconds."""
    return round(time.time() - start_time)



def show_leaderboard():
    """Display the leaderboard in a new window."""
    leaderboard_window = tk.Toplevel()
    leaderboard_window.title("Таблица лидеров")
    leaderboard_window.geometry("800x600")

    # Header Section
    header_frame = ttk.Frame(leaderboard_window)
    header_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(header_frame, text="Лидеры настройки проекта", font=("Arial", 18, "bold")).pack()

    # Body Section
    body_frame = ttk.Frame(leaderboard_window)
    body_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

    # Fetch and Display Leaderboard Data
    try:
        response = requests.get(
            f"{SUPABASE_API_URL}/rest/v1/users?select=user_id,metadata&status=eq.admin",
            headers={"apikey": SUPABASE_ANON_KEY}
        )
        if response.status_code == 200:
            users = response.json()
            for idx, user in enumerate(users[:10]):  # Top 10 users
                nickname = user['metadata'].get('nickname', 'Неизвестный')
                total_time = user['metadata'].get('total_time', 'N/A')
                achievements = ", ".join(user['metadata'].get('achievements', []))
                ttk.Label(body_frame, text=f"{idx + 1}. {nickname} ({user['user_id']}) - {total_time} секунд", font=("Arial", 14, "bold")).pack(anchor=tk.W)
                ttk.Label(body_frame, text=f"   🏆 Достижения: {achievements}", font=("Arial", 12)).pack(anchor=tk.W)
        else:
            ttk.Label(body_frame, text="Не удалось загрузить таблицу лидеров.", font=("Arial", 12)).pack()
    except Exception as e:
        ttk.Label(body_frame, text=f"Ошибка: {str(e)}", font=("Arial", 12)).pack()

def show_landing_page():
    """Display the landing page with project details and leaderboard integration."""
    # Create a new window for the landing page
    landing_window = tk.Toplevel()
    landing_window.title("О проекте")
    landing_window.geometry("800x600")
    landing_window.resizable(False, False)

    # Header Section
    header_frame = ttk.Frame(landing_window)
    header_frame.pack(fill=tk.X, padx=20, pady=10)

    # ASCII Art Logo
    ascii_art = """
   / ___//   |  / /   /   | |  / / ____/\ \/ <  /__  /
   \__ \/ /| | / /   / /| | | / / __/    \  // / /_ < 
  ___/ / ___ |/ /___/ ___ | |/ / /	/ // /___/ / 
 /____/_/  |_/_____/_/  |_|___/_____/   /_//_//____/  
    """
    ttk.Label(header_frame, text=ascii_art, font=("Courier", 10), justify=tk.CENTER).pack()

    # Title and Description
    title_frame = ttk.Frame(landing_window)
    title_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(title_frame, text="Проект: Self-Evolving Developer Dashboard", font=("Arial", 18, "bold")).pack()
    ttk.Label(title_frame, text="Автоматизируйте всё, геймифицируйте что угодно!", font=("Arial", 14)).pack()

    # Features Section
    features_frame = ttk.Frame(landing_window)
    features_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(features_frame, text="Основные возможности:", font=("Arial", 16, "bold")).pack(anchor=tk.W)
    features = [
        "• Автоматическое обновление через ZIP-архивы",
        "• Интеграция с Vercel и Supabase",
        "• Геймифицированная панель управления",
        "• Настройка Telegram бота для уведомлений",
        "• Создание Pull Requests в GitHub"
    ]
    for feature in features:
        ttk.Label(features_frame, text=feature, font=("Arial", 12)).pack(anchor=tk.W)

    # Quick Links Section
    links_frame = ttk.Frame(landing_window)
    links_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(links_frame, text="Быстрые ссылки:", font=("Arial", 16, "bold")).pack(anchor=tk.W)
    links = {
        "Vercel": "https://vercel.com",
        "Supabase": "https://supabase.com",
        "GitHub": "https://github.com/salavey13/cartest",
        "v0.dev Проект": "https://v0.dev/chat/fork-of-rastaman-shop-KvYJosUCML9",
        "Qwen Chat": "https://chat.qwenlm.ai"
    }
    for name, url in links.items():
        link_label = ttk.Label(links_frame, text=f"• {name}", font=("Arial", 12), foreground="blue", cursor="hand2")
        link_label.pack(anchor=tk.W)
        link_label.bind("<Button-1>", lambda e, u=url: open_link(u))

    # Leaderboard Button
    leaderboard_button = ttk.Button(landing_window, text="Показать таблицу лидеров", command=show_leaderboard)
    leaderboard_button.pack(pady=10)

    # Close Button
    close_button = ttk.Button(landing_window, text="Закрыть", command=landing_window.destroy)
    close_button.pack(pady=20)



    


    
# Supabase User Management
def create_user(user_id):
    """Create a new user in Supabase."""
    url = f"{SUPABASE_API_URL}/rest/v1/users"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    payload = {
        "user_id": user_id,
        "status": "admin",
        "metadata": {}
    }
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code != 201:
        print("Failed to create user:", response.text)

def update_user_metadata(user_id, key, value):
    """Update the metadata field for a user."""
    url = f"{SUPABASE_API_URL}/rest/v1/users?user_id=eq.{user_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    payload = {
        "metadata": {key: value}
    }
    response = requests.patch(url, json=payload, headers=headers)
    if response.status_code != 200:
        print("Failed to update user metadata:", response.text)


# Gamification
def generate_achievements(metadata):
    """Generate achievements based on metadata."""
    achievements = []
    if "git_installed" in metadata:
        achievements.append("✅ Git Installed!")
    if "node_installed" in metadata:
        achievements.append("✅ Node.js Installed!")
    if "vercel_configured" in metadata:
        achievements.append("✅ Vercel Configured!")
    return achievements

def get_user_level(metadata):
    """Determine the user's level based on achievements."""
    achievements = generate_achievements(metadata)
    if len(achievements) >= 3:
        return "Badass"
    elif len(achievements) >= 2:
        return "Advanced"
    elif len(achievements) >= 1:
        return "Intermediate"
    else:
        return "Beginner"

# Install and Track Tools
def download_and_install(tool_name):
    """Download and install a tool with timing."""
    url = DOWNLOAD_URLS.get(tool_name)
    if not url:
        messagebox.showerror("Ошибка", f"URL для {tool_name} не найден.")
        return
    file_path = os.path.join(TEMP_DIR, f"{tool_name.replace(' ', '_')}-Installer.exe")
    if not os.path.exists(TEMP_DIR):
        os.makedirs(TEMP_DIR)

    # Download
    start_time = start_timer()
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

# Generate Installation Achievement
def generate_installation_achievement(tool_name):
    """Generate an achievement for installing a tool."""
    achievement = f"🔧 {tool_name} Установлен!"
    if achievement not in generate_achievements(config.get("metadata", {})):
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
    if not achievements:
        achievements.append("✨ Начните с настройки Vercel!")
    return achievements
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
def set_webhook():
    """Set webhook for Telegram Bot."""
    if "VERCEL_PROJECT_URL" not in config:
        messagebox.showerror("Ошибка", "URL Vercel не настроен.")
        return
    webhook_url = f"https://{config['VERCEL_PROJECT_URL']}/api/telegramWebhook"
    run_command(f"npx tsx scripts/setWebhook.ts", "Webhook установлен успешно.", "Не удалось установить webhook.")

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





def refresh_dashboard():
    """Refresh the dashboard UI."""
    user_level = get_user_level()
    for widget in root.winfo_children():
        widget.destroy()

    # Header
    header_frame = ttk.Frame(root)
    header_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(header_frame, text="Панель управления проектом", font=("Arial", 24)).pack()
    
    # Add an "About" button to trigger the landing page
    about_button = ttk.Button(root, text="О проекте", command=show_landing_page)
    about_button.pack(pady=20)
    
    # Progress Section
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

    def add_button(text, command, warning=None, level="Beginner"):
        """Helper function to add general action buttons with optional warnings and level restrictions."""
        if user_level == "Badass" or level == "Beginner":
            def safe_command():
                if warning and not messagebox.askyesno("Подтверждение", warning):
                    return
                command()
            ttk.Button(actions_frame, text=text, command=safe_command).pack(fill=tk.X, padx=10, pady=5)

    # Configuration Buttons
    add_button("Настроить Vercel", configure_vercel, level="Beginner")
    add_button("Настроить Telegram бот", configure_telegram_bot, level="Intermediate")
    add_button("Установить Webhook", set_webhook, level="Advanced")
    add_button("Перегенерировать вложения", generate_embeddings, "Это может занять некоторое время. Продолжить?", level="Advanced")

    # Telegram Dashboard Unlock Check
    if is_telegram_dashboard_unlocked():
        messagebox.showinfo("Успех", "Вы разблокировали Telegram Dashboard! Перейдите к продвинутым настройкам.")
        ttk.Button(actions_frame, text="Открыть Telegram Dashboard", command=open_telegram_dashboard).pack(fill=tk.X, padx=10, pady=5)

    def add_envbutton(text, command, level="Beginner"):
        btn = ttk.Button(actions_frame, text=text, command=command, style="Rounded.TButton")
        btn.pack(fill=tk.X, padx=10, pady=5)

    add_envbutton("Скачать и установить Git", lambda: download_and_install("Git"))
    add_envbutton("Скачать и установить Node.js", lambda: download_and_install("Node.js"))
    add_envbutton("Скачать и установить Notepad++", lambda: download_and_install("Notepad++"))
    add_envbutton("Скачать и установить VS Code", lambda: download_and_install("VS Code"))

    # Leaderboard Button
    add_envbutton("Показать таблицу лидеров", fetch_leaderboard)

    # Exit Button
    ttk.Button(root, text="Выход", command=root.quit).pack(fill=tk.X, padx=20, pady=10)

# GUI Setup
root = tk.Tk()
root.title("Панель управления проектом")
root.geometry("800x600")
root.configure(bg="#2d2d2d")  # Dark theme background
style = ttk.Style()
style.theme_use("clam")
style.configure("TLabel", background="#2d2d2d", foreground="#ffffff", font=("Arial", 12))
style.configure("TButton", background="#4d4d4d", foreground="#ffffff", font=("Arial", 12))
style.configure("TFrame", background="#2d2d2d")

# Initialize User
config["USER_ID"] = str(uuid.uuid4())
create_user(config["USER_ID"])

refresh_dashboard()
root.mainloop()
