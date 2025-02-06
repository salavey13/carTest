import os
import subprocess
import tkinter as tk
from tkinter import messagebox, filedialog, ttk
from datetime import datetime

# Конфигурация
PROJECTS_DIR = os.path.expanduser("~/Documents/V0_Projects")
REPO_DIR = os.path.join(PROJECTS_DIR, "cartest")
VERSION_FILE = os.path.join(REPO_DIR, "version.ini")
V0_DEV_URL = "https://v0.dev/chat/fork-of-rastaman-shop-KvYJosUCML9"
VERCEL_URL = "https://vercel.com"
SUPABASE_URL = "https://supabase.com"
GITHUB_URL = "https://github.com/salavey13/cartest"

# Загрузка конфигурации из VERSION.ini
config = {}
if os.path.exists(VERSION_FILE):
    with open(VERSION_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                key, value = line.strip().split("=", 1)
                config[key] = value


def save_config():
    """Сохранить конфигурацию в VERSION.ini."""
    with open(VERSION_FILE, "w", encoding="utf-8") as f:
        for key, value in config.items():
            f.write(f"{key}={value}\n")


def run_command(command, success_message="Успех", error_message="Ошибка"):
    """Выполнить команду оболочки и показать результат."""
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        messagebox.showinfo("Успех", success_message + "\n" + result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Ошибка", error_message + "\n" + e.stderr)
        return False


def apply_zip_updates():
    """Обработать ZIP-обновления."""
    zip_path = filedialog.askopenfilename(
        title="Выберите ZIP файл",
        filetypes=[("ZIP файлы", "*.zip")],
        initialdir=REPO_DIR
    )
    if not zip_path:
        messagebox.showwarning("Внимание", "ZIP файл не выбран.")
        return

    # Распаковать ZIP и применить обновления
    try:
        extract_dir = os.path.join(os.path.dirname(zip_path), "temp_unzip")
        subprocess.run(f"powershell -Command \"Expand-Archive -Force '{zip_path}' -DestinationPath '{extract_dir}'\"", shell=True, check=True)
        subprocess.run(f"xcopy /s /y \"{extract_dir}\\*\" \"{REPO_DIR}\"", shell=True, check=True)
        subprocess.run(f"rmdir /s /q \"{extract_dir}\"", shell=True, check=True)

        # Обновить файл версии
        current_version = int(config.get("CURRENT_VERSION", 0))
        next_version = current_version + 1
        config["CURRENT_VERSION"] = str(next_version)
        config["LAST_APPLIED_ZIP"] = os.path.basename(zip_path)
        save_config()

        # Создать Pull Request
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
    """Сбросить базу данных Supabase с опциональным SQL файлом."""
    if sql_file is None:
        sql_file = filedialog.askopenfilename(
            title="Выберите SQL файл",
            filetypes=[("SQL файлы", "*.sql")],
            initialdir=REPO_DIR
        )
        if not sql_file:
            messagebox.showwarning("Внимание", "SQL файл не выбран.")
            return

    # Предупреждение о сбросе базы данных
    if not messagebox.askyesno("Подтверждение", "Сброс базы данных удалит все текущие данные. Продолжить?"):
        return

    run_command(f"supabase db reset --sql \"{sql_file}\"", "База данных сброшена успешно.", "Не удалось сбросить базу данных.")


def configure_vercel():
    """Настроить развертывание Vercel."""
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
    """Настроить токен Telegram бота и ID админского чата."""
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
    """Установить webhook для Telegram бота."""
    if "VERCEL_PROJECT_URL" not in config:
        messagebox.showerror("Ошибка", "URL Vercel не настроен.")
        return

    webhook_url = f"https://{config['VERCEL_PROJECT_URL']}/api/telegramWebhook"
    run_command(f"npx tsx scripts/setWebhook.ts", "Webhook установлен успешно.", "Не удалось установить webhook.")


def generate_embeddings():
    """Перегенерировать вложения для семантического поиска."""
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
    """Генерировать геймифицированные достижения на основе прогресса настройки."""
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
    """Определить уровень пользователя на основе достижений."""
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
    """Проверить, разблокирован ли Telegram Dashboard."""
    return all(key in config for key in ["VERCEL_PROJECT_URL", "TELEGRAM_BOT_TOKEN", "ADMIN_CHAT_ID"])


def open_telegram_dashboard():
    """Открыть панель управления Telegram."""
    telegram_window = tk.Toplevel(root)
    telegram_window.title("Telegram Панель Управления")
    telegram_window.geometry("800x600")

    # Раздел управления ботом
    bot_frame = ttk.Frame(telegram_window)
    bot_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(bot_frame, text="Управление ботом", font=("Arial", 16)).pack(anchor=tk.W)
    ttk.Button(bot_frame, text="Отправить пользовательское сообщение", command=lambda: messagebox.showinfo("Информация", "Пользовательское сообщение отправлено!")).pack(fill=tk.X, padx=10, pady=5)
    ttk.Button(bot_frame, text="Рассылка сообщения", command=lambda: messagebox.showinfo("Информация", "Рассылка сообщения отправлена!")).pack(fill=tk.X, padx=10, pady=5)

    # Раздел обработки платежей
    payment_frame = ttk.Frame(telegram_window)
    payment_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(payment_frame, text="Обработка платежей", font=("Arial", 16)).pack(anchor=tk.W)
    ttk.Button(payment_frame, text="Создать счет", command=lambda: messagebox.showinfo("Информация", "Счет создан!")).pack(fill=tk.X, padx=10, pady=5)
    ttk.Button(payment_frame, text="Просмотреть историю платежей", command=lambda: messagebox.showinfo("Информация", "История платежей просмотрена!")).pack(fill=tk.X, padx=10, pady=5)

    # Раздел управления пользователями
    user_frame = ttk.Frame(telegram_window)
    user_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(user_frame, text="Управление пользователями", font=("Arial", 16)).pack(anchor=tk.W)
    ttk.Button(user_frame, text="Просмотреть пользователей", command=lambda: messagebox.showinfo("Информация", "Пользователи просмотрены!")).pack(fill=tk.X, padx=10, pady=5)
    ttk.Button(user_frame, text="Редактировать пользователя", command=lambda: messagebox.showinfo("Информация", "Пользователь отредактирован!")).pack(fill=tk.X, padx=10, pady=5)


def refresh_dashboard():
    """Обновить интерфейс панели управления."""
    user_level = get_user_level()
    for widget in root.winfo_children():
        widget.destroy()

    # Заголовок
    header_frame = ttk.Frame(root)
    header_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(header_frame, text="Панель управления проектом", font=("Arial", 24)).pack()

    # Раздел прогресса
    progress_frame = ttk.Frame(root)
    progress_frame.pack(fill=tk.X, padx=20, pady=10)
    ttk.Label(progress_frame, text="Прогресс настройки:", font=("Arial", 16)).pack(anchor=tk.W)
    achievements = generate_achievements()
    for achievement in achievements:
        ttk.Label(progress_frame, text=f"✅ {achievement}", font=("Arial", 12)).pack(anchor=tk.W)

    # Раздел действий
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
# Telegram Dashboard Unlock Check
    if is_telegram_dashboard_unlocked():
        messagebox.showinfo("Успех", "Вы разблокировали Telegram Dashboard! Перейдите к продвинутым настройкам.")
        ttk.Button(actions_frame, text="Открыть Telegram Dashboard", command=open_telegram_dashboard).pack(fill=tk.X, padx=10, pady=5)
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
