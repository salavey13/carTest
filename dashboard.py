import os
import subprocess
import tkinter as tk
from tkinter import messagebox, filedialog, ttk
from datetime import datetime

# Configuration
PROJECTS_DIR = os.path.expanduser("~/Documents/V0_Projects")
REPO_DIR = os.path.join(PROJECTS_DIR, "cartest")
VERSION_FILE = os.path.join(REPO_DIR, "version.ini")
V0_DEV_URL = "https://v0.dev/chat/fork-of-rastaman-shop-KvYJosUCML9"
VERCEL_URL = "https://vercel.com"
SUPABASE_URL = "https://supabase.com"
GITHUB_URL = "https://github.com/salavey13/cartest"

# Load configuration from VERSION.ini
config = {}
if os.path.exists(VERSION_FILE):
    with open(VERSION_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                key, value = line.strip().split("=", 1)
                config[key] = value


def save_config():
    """Save configuration to VERSION.ini."""
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        for key, value in config.items():
            f.write(f"{key}={value}\n")


def run_command(command, success_message="Успех", error_message="Ошибка"):
    """Run a shell command and show output."""
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        messagebox.showinfo("Успех", success_message + "\n" + result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Ошибка", error_message + "\n" + e.stderr)
        return False


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


def generate_achievements():
    """Generate gamified achievements based on customization progress."""
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


def refresh_dashboard():
    """Refresh the dashboard UI."""
    user_level = get_user_level()

    for widget in root.winfo_children():
        widget.destroy()

    # Header
    header_frame = ttk.Frame(root)
    header_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(header_frame, text="Панель управления проектом", font=("Arial", 24)).pack()

    # Progress Section
    progress_frame = ttk.Frame(root)
    progress_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(progress_frame, text="Прогресс настройки:", font=("Arial", 16)).pack(anchor=tk.W)

    achievements = generate_achievements()
    for achievement in achievements:
        ttk.Label(progress_frame, text=f"✅ {achievement}", font=("Arial", 12)).pack(anchor=tk.W)

    # Actions Section
    actions_frame = ttk.Frame(root)
    actions_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(actions_frame, text="Действия:", font=("Arial", 16)).pack(anchor=tk.W)

    def add_button(text, command, warning=None, level="Beginner"):
        """Helper function to add buttons with optional warnings and level restrictions."""
        if user_level == "Badass" or level == "Beginner":
            def safe_command():
                if warning and not messagebox.askyesno("Подтверждение", warning):
                    return
                command()
            ttk.Button(actions_frame, text=text, command=safe_command).pack(fill=tk.X, padx=10, pady=5)

    add_button("Применить ZIP обновления", apply_zip_updates, "Это перезапишет текущие файлы. Продолжить?", level="Beginner")
    add_button("Сбросить базу данных Supabase", reset_supabase_db, "Это удалит все текущие данные. Продолжить?", level="Intermediate")
    add_button("Настроить Vercel", configure_vercel, level="Beginner")
    add_button("Настроить Telegram бот", configure_telegram_bot, level="Intermediate")
    add_button("Установить Webhook", set_webhook, level="Advanced")
    add_button("Перегенерировать вложения", generate_embeddings, "Это может занять некоторое время. Продолжить?", level="Advanced")

    # Pro Tips Section
    pro_tips_frame = ttk.Frame(root)
    pro_tips_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(pro_tips_frame, text="Pro Tips:", font=("Arial", 16)).pack(anchor=tk.W)
    ttk.Label(pro_tips_frame, text="• Интеграция Vercel + Supabase: Перейдите в настройки проекта Vercel -> Расширения -> Supabase Integration.", font=("Arial", 12)).pack(anchor=tk.W)
    ttk.Label(pro_tips_frame, text="• Автоматизация: Используйте GitHub Actions для автоматического деплоя изменений.", font=("Arial", 12)).pack(anchor=tk.W)

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
        ("Supabase SQL Console", "https://app.supabase.com/project/YOUR_PROJECT_ID/sql"),
    ]

    for name, url in links:
        ttk.Button(links_frame, text=name, command=lambda u=url: subprocess.Popen(["start", u], shell=True)).pack(fill=tk.X, padx=10, pady=2)

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

refresh_dashboard()
root.mainloop()
