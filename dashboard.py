import os
import subprocess
import tkinter as tk
from tkinter import messagebox, filedialog
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
    with open(VERSION_FILE, "r") as f:
        for line in f:
            if "=" in line:
                key, value = line.strip().split("=", 1)
                config[key] = value

def save_config():
    """Save configuration to VERSION.ini."""
    with open(VERSION_FILE, "w") as f:
        for key, value in config.items():
            f.write(f"{key}={value}\n")

def run_command(command, success_message="Success", error_message="Error"):
    """Run a shell command and show output."""
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        messagebox.showinfo("Success", success_message + "\n" + result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Error", error_message + "\n" + e.stderr)
        return False

def apply_zip_updates():
    """Handle ZIP updates."""
    zip_path = filedialog.askopenfilename(
        title="Select ZIP File",
        filetypes=[("ZIP Files", "*.zip")],
        initialdir=REPO_DIR
    )
    if not zip_path:
        messagebox.showwarning("Warning", "No ZIP file selected.")
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
        commit_msg = f"Applied ZIP update: {os.path.basename(zip_path)} | Version {next_version}"
        subprocess.run(f"git commit -m \"{commit_msg}\"", shell=True, check=True)
        subprocess.run(f"git push origin {branch_name}", shell=True, check=True)
        subprocess.run("git checkout main", shell=True, check=True)
        subprocess.run("git pull origin main", shell=True, check=True)
        subprocess.Popen(["start", "https://github.com/salavey13/cartest/pulls"], shell=True)

        messagebox.showinfo("Success", "ZIP updates applied successfully and pull request created.")
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Error", f"Failed to apply ZIP updates: {e.stderr}")

def reset_supabase_db(sql_file=None):
    """Reset Supabase database with optional SQL file."""
    if sql_file is None:
        sql_file = filedialog.askopenfilename(
            title="Select SQL File",
            filetypes=[("SQL Files", "*.sql")],
            initialdir=REPO_DIR
        )
        if not sql_file:
            messagebox.showwarning("Warning", "No SQL file selected.")
            return

    run_command(f"supabase db reset --sql \"{sql_file}\"", "Database reset successfully.", "Failed to reset database.")

def configure_vercel():
    """Configure Vercel deployment."""
    if "VERCEL_PROJECT_URL" in config:
        messagebox.showinfo("Info", f"Vercel already configured: {config['VERCEL_PROJECT_URL']}")
        return

    try:
        subprocess.run("vercel login", shell=True, check=True)
        subprocess.run(f"cd \"{REPO_DIR}\" && vercel projects create cartest --yes", shell=True, check=True)
        subprocess.run(f"cd \"{REPO_DIR}\" && vercel deploy --prod", shell=True, check=True)
        vercel_url = subprocess.check_output("vercel inspect --scope", shell=True, text=True).strip()
        config["VERCEL_PROJECT_URL"] = vercel_url
        save_config()
        messagebox.showinfo("Success", f"Vercel configured successfully: {vercel_url}")
    except subprocess.CalledProcessError as e:
        messagebox.showerror("Error", f"Failed to configure Vercel: {e.stderr}")

def configure_telegram_bot():
    """Configure Telegram Bot token and admin chat ID."""
    if "TELEGRAM_BOT_TOKEN" not in config:
        bot_token = tk.simpledialog.askstring("Input", "Enter your Telegram Bot Token:")
        if bot_token:
            config["TELEGRAM_BOT_TOKEN"] = bot_token
            save_config()
            messagebox.showinfo("Success", "Telegram Bot Token configured successfully.")
        else:
            messagebox.showwarning("Warning", "Telegram Bot Token not set.")

    if "ADMIN_CHAT_ID" not in config:
        admin_chat_id = tk.simpledialog.askstring("Input", "Enter Admin Chat ID:")
        if admin_chat_id:
            config["ADMIN_CHAT_ID"] = admin_chat_id
            save_config()
            messagebox.showinfo("Success", "Admin Chat ID configured successfully.")
        else:
            messagebox.showwarning("Warning", "Admin Chat ID not set.")

    if "VERCEL_PROJECT_URL" in config:
        if "TELEGRAM_BOT_TOKEN" in config:
            run_command(f"vercel env add TELEGRAM_BOT_TOKEN {config['TELEGRAM_BOT_TOKEN']} production")
        if "ADMIN_CHAT_ID" in config:
            run_command(f"vercel env add ADMIN_CHAT_ID {config['ADMIN_CHAT_ID']} production")

def set_webhook():
    """Set webhook for Telegram Bot."""
    if "VERCEL_PROJECT_URL" not in config:
        messagebox.showerror("Error", "Vercel URL is not configured.")
        return

    webhook_url = f"https://{config['VERCEL_PROJECT_URL']}/api/telegramWebhook"
    run_command(f"npx tsx scripts/setWebhook.ts", "Webhook set successfully.", "Failed to set webhook.")

def generate_achievements():
    """Generate gamified achievements based on customization progress."""
    achievements = []
    if "VERCEL_PROJECT_URL" in config:
        achievements.append("🌟 Vercel Setup Complete!")
    if "SUPABASE_PROJECT_ID" in config:
        achievements.append("🚀 Supabase Database Ready!")
    if "TELEGRAM_BOT_TOKEN" in config and "ADMIN_CHAT_ID" in config:
        achievements.append("🔥 Telegram Bot Configured!")
    if os.path.exists(os.path.join(REPO_DIR, "seed.sql")):
        achievements.append("🌱 Custom Data Uploaded via seed.sql!")
    if not achievements:
        achievements.append("✨ Start Your Journey: Configure Vercel First!")

    return achievements

# GUI Setup
root = tk.Tk()
root.title("Project Dashboard")
root.geometry("800x600")

def refresh_dashboard():
    """Refresh the dashboard UI."""
    for widget in root.winfo_children():
        widget.destroy()

    # Header
    header = tk.Label(root, text="Project Dashboard", font=("Arial", 24), pady=10)
    header.pack()

    # Progress Section
    progress_frame = tk.Frame(root)
    progress_frame.pack(fill=tk.X, padx=20, pady=10)
    tk.Label(progress_frame, text="Customization Progress:", font=("Arial", 16)).pack(anchor=tk.W)
    achievements = generate_achievements()
    for achievement in achievements:
        tk.Label(progress_frame, text=f"✅ {achievement}", font=("Arial", 12)).pack(anchor=tk.W)

    # Actions Section
    actions_frame = tk.Frame(root)
    actions_frame.pack(fill=tk.X, padx=20, pady=10)
    tk.Label(actions_frame, text="Actions:", font=("Arial", 16)).pack(anchor=tk.W)
    tk.Button(actions_frame, text="Apply ZIP Updates", command=apply_zip_updates).pack(fill=tk.X, padx=10, pady=5)
    tk.Button(actions_frame, text="Reset Supabase DB", command=reset_supabase_db).pack(fill=tk.X, padx=10, pady=5)
    tk.Button(actions_frame, text="Configure Vercel", command=configure_vercel).pack(fill=tk.X, padx=10, pady=5)
    tk.Button(actions_frame, text="Configure Telegram Bot", command=configure_telegram_bot).pack(fill=tk.X, padx=10, pady=5)
    tk.Button(actions_frame, text="Set Webhook", command=set_webhook).pack(fill=tk.X, padx=10, pady=5)

    # Links Section
    links_frame = tk.Frame(root)
    links_frame.pack(fill=tk.X, padx=20, pady=10)
    tk.Label(links_frame, text="Quick Links:", font=("Arial", 16)).pack(anchor=tk.W)
    links = [
        ("Vercel", VERCEL_URL),
        ("Supabase", SUPABASE_URL),
        ("GitHub", GITHUB_URL),
        ("v0.dev Project", V0_DEV_URL),
        ("Qwen Chat", "https://chat.qwenlm.ai"),
        ("Supabase SQL Console", "https://app.supabase.com/project/YOUR_PROJECT_ID/sql"),
    ]
    for name, url in links:
        tk.Button(links_frame, text=name, command=lambda u=url: subprocess.Popen(["start", u], shell=True)).pack(fill=tk.X, padx=10, pady=2)

    # Exit Button
    tk.Button(root, text="Exit", command=root.quit).pack(fill=tk.X, padx=20, pady=10)

refresh_dashboard()
root.mainloop()
