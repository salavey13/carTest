from flask import Flask, render_template_string, jsonify, request
from flask_sse import sse
import os
import json
import sys
import time
import webbrowser
import logging
import pystray
from PIL import Image, ImageDraw
import requests

from cyberui import HTML_TEMPLATE
from skill_config import get_skill_data, SKILL_DEPENDENCIES
from musthooks import (
    create_project_folder,
    clone_repository,
    apply_zip_updates,
    download_and_install,
    save_config,
    run_command,
    load_config,
    load_projects,
    initialize_login_checklist,
    create_project,
    switch_project,
    mark_step_completed,
    is_tool_installed,
    is_npm_package_installed,
    ensure_v0_projects_dir,
    ensure_default_project,
    install_cli_tool,
    pull_git_updates,
    check_git_status,
)
from vercehooks import configure_vercel, sync_env_vars
from supahooks import reset_supabase_db, initialize_supabase, apply_demo_data, apply_custom_sql, save_admin_to_database, create_or_update_user, calculate_elapsed_time
from telehooks import set_webhook
from promohooks import RARITY_COLORS, generate_achievements, calculate_progress, calculate_user_level
from advhooks import generate_embeddings, create_pull_request
from utils import init_sse  # Import from utils

app = Flask(__name__)
# Initialize SSE
init_sse(app)

# Global Variables
current_project = None
projects = []
DEFAULT_PROJECT_NAME = "cartest"

# Configuration
PROJECTS_DIR = os.path.expanduser("~/Documents/V0_Projects")
TEMP_DIR = os.path.join(os.getenv("TEMP", os.path.expanduser("~/AppData/Local/Temp")), "setup_temp")
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR, exist_ok=True)

COLORS = {
    "bg": "#1a1a1a",
    "fg": "#ffffff",
    "btn": "#4d4d4d",
    "cyberpunk": {
        "neon": "#0ff",
        "pink": "#ff1493",
        "purple": "#9400d3",
    }
}

LEVELS = {
    "Beginner": 1,
    "Intermediate": 2,
    "Advanced": 3,
    "Badass": 4
}

# Factory function to create action lambdas with current_project
def create_action_lambda(action_func, required_level):
    def wrapper(project):
        return lambda: action_func(project)
    return wrapper

# Grouped Actions with User Level Checks
grouped_actions = {
    "Project Management": [
        ("Создать папку проекта", create_action_lambda(create_project_folder, "Beginner"), "Beginner"),
        ("Установить Git", create_action_lambda(lambda p: download_and_install("Git", p), "Beginner"), "Beginner"),
        ("Установить Node.js", create_action_lambda(lambda p: download_and_install("Node.js", p), "Beginner"), "Beginner"),
        ("Установить VS Code", create_action_lambda(lambda p: download_and_install("VS Code", p), "Beginner"), "Beginner"),
        ("Установить Notepad++", create_action_lambda(lambda p: download_and_install("Notepad++", p), "Beginner"), "Beginner"),
        ("Клонировать репозиторий", create_action_lambda(lambda p: clone_repository(p), "Intermediate"), "Intermediate"),
        ("Применить ZIP обновления", create_action_lambda(lambda p: apply_zip_updates(p), "Badass"), "Badass"),
    ],
    "Vercel Integration": [
        ("Установить Supabase CLI", create_action_lambda(lambda p: install_cli_tool("supabase", p), "Intermediate"), "Intermediate"),
        ("Настроить Vercel", create_action_lambda(lambda p: configure_vercel(p), "Intermediate"), "Intermediate"),
        ("Синхронизировать переменные окружения", create_action_lambda(lambda p: sync_env_vars(p), "Intermediate"), "Intermediate"),
    ],
    "Supabase Integration": [
        ("Установить Vercel CLI", create_action_lambda(lambda p: install_cli_tool("vercel", p), "Intermediate"), "Intermediate"),
        ("Генерировать вложения", create_action_lambda(lambda p: generate_embeddings(p), "Badass"), "Badass"),
        ("Сбросить базу данных Supabase", create_action_lambda(lambda p: reset_supabase_db(p), "Intermediate"), "Intermediate"),
        ("Инициализировать Supabase", create_action_lambda(lambda p: initialize_supabase(p), "Intermediate"), "Intermediate"),
        ("Загрузить демо данные Supabase", create_action_lambda(lambda p: apply_demo_data(p), "Intermediate"), "Intermediate"),
        ("Применить custom.sql", create_action_lambda(lambda p: apply_custom_sql(p), "Intermediate"), "Intermediate"),
    ],
    "Telegram Integration": [
        ("Настроить Telegram бот", create_action_lambda(lambda p: configure_telegram_bot(p), "Advanced"), "Advanced"),
        ("Установить Webhook", create_action_lambda(lambda p: set_webhook(p), "Advanced"), "Advanced"),
    ],
    "Advanced Features": [
        ("Показать таблицу лидеров", create_action_lambda(lambda p: unlock_leaderboard(p), "Badass"), "Badass"),
        ("Создать Pull Request", create_action_lambda(lambda p: create_pull_request(p, "update", "Обновления", "Автоматические обновления"), "Badass"), "Badass"),
        ("Применить обновления Git", create_action_lambda(pull_git_updates, "Intermediate"), "Intermediate"),
    ],
}

def unlock_leaderboard(current_project):
    """
    Unlock the leaderboard by checking completion of all tasks and updating the config.
    """
    config = load_config(current_project)
    total_tasks = 13  # Adjust this number based on the total tasks in your system
    completed_tasks = len(generate_achievements(config))
    
    if completed_tasks >= total_tasks:
        config["leaderboard_unlocked"] = "completed"
        save_config(current_project, config)
        return {
            "status": "success",
            "message": "Таблица лидеров разблокирована!",
            "refresh": True
        }, 200
    else:
        raise Exception("Не все задачи выполнены для разблокировки таблицы лидеров.")

def create_image():
    width, height = 64, 64
    image = Image.new('RGB', (width, height), COLORS["bg"])
    dc = ImageDraw.Draw(image)
    dc.rectangle((width // 2, 0, width, height // 2), fill=COLORS["cyberpunk"]["purple"])
    dc.rectangle((0, height // 2, width // 2, height), fill=COLORS["cyberpunk"]["pink"])
    dc.rectangle((0, 0, width, height), outline=COLORS["cyberpunk"]["neon"], width=2)
    return image

def on_clicked(icon, item):
    if str(item) == "Exit":
        icon.stop()
        shutdown_server()

def setup_tray_icon():
    icon = pystray.Icon("Cyberpunk Skill Tree")
    icon.icon = create_image()
    icon.title = "Cyberpunk Skill Tree"
    icon.menu = pystray.Menu(
        pystray.MenuItem("Exit", on_clicked)
    )
    icon.run()

def open_browser():
    time.sleep(1)
    webbrowser.open("http://127.0.0.1:1313")

@app.route('/')
def index():
    global current_project
    current_project = request.args.get('project', DEFAULT_PROJECT_NAME)
    projects = load_projects()
    config = load_config(current_project)
    
    user_level = calculate_user_level(config)
    git_status = check_git_status(current_project)
    git_status_color = "green" if git_status == '✅' else "red"
    
    return render_template_string(
        HTML_TEMPLATE,
        colors=COLORS,
        projects=projects,
        current_project=current_project,
        skill_data=get_skill_data(config),
        SKILL_DEPENDENCIES=SKILL_DEPENDENCIES,
        user_level=user_level,
        git_status=git_status,
        git_status_color=git_status_color
    )


    
@app.route('/execute/')
def execute_skill():
    global current_project
    current_project = request.args.get('project', DEFAULT_PROJECT_NAME)
    skill = request.args.get('skill')
    if not skill:
        return jsonify({
            "message": "Название навыка не указано.",
            "refresh": False
        }), 400

    config = load_config(current_project)
    skill_key = skill.lower().replace(" ", "_")

    if skill_key in config:
        return jsonify({
            "message": f"Навык '{skill}' уже был освоен ранее.",
            "refresh": False
        }), 400

    user_level = calculate_user_level(config)

    for category, actions in grouped_actions.items():
        for action_name, action_func, required_level in actions:
            if action_name == skill:
                if LEVELS[user_level] >= LEVELS[required_level]:
                    try:
                        # Execute the action with the current project
                        result, status = action_func(current_project)()

                        if isinstance(result, dict):
                            return jsonify(result), status
                        if isinstance(result, str) and result.startswith('{'):
                            import json
                            return jsonify(json.loads(result)), status

                        config[skill_key] = "completed"
                        save_config(current_project, config)
                        return jsonify({
                            "message": f"🎉 Навык '{skill}' освоен!",
                            "refresh": True
                        }), 200
                    except Exception as e:
                        error_msg = f"Ошибка при выполнении навыка '{skill}': {str(e)}"
                        print(error_msg)
                        return jsonify({
                            "message": error_msg,
                            "refresh": False
                        }), 500
                else:
                    return jsonify({
                        "message": f"❌ Уровень '{required_level}' требуется для освоения навыка '{skill}'. Ваш текущий уровень: '{user_level}'.",
                        "refresh": False
                    }), 403

    return jsonify({
        "message": f"Навык '{skill}' не найден.",
        "refresh": False
    }), 404

@app.route('/reset_progress')
def reset_progress():
    global current_project
    current_project = request.args.get('project', DEFAULT_PROJECT_NAME)
    config = {"создать_папку_проекта": "completed"}
    save_config(current_project, config)
    return jsonify({
        "message": "Прогресс сброшен. Начните свое приключение заново!",
        "refresh": True
    })

@app.route('/api/leaderboard')
def api_leaderboard():
    try:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/users?select=user_id,metadata&status=eq.admin",
            headers={"apikey": SUPABASE_KEY}
        )
        if response.status_code == 200:
            users = response.json()
            leaderboard_data = []
            for idx, user in enumerate(users[:10]):
                nickname = user['metadata'].get('nickname', 'Неизвестный')
                total_time = user['metadata'].get('total_time', 'N/A')
                achievements = user['metadata'].get('achievements', [])
                leaderboard_data.append({
                    "rank": idx + 1,
                    "nickname": nickname,
                    "user_id": user['user_id'],
                    "total_time": total_time,
                    "achievements": achievements
                })
            return jsonify(leaderboard_data)
        return jsonify([]), 500
    except Exception as e:
        print(f"Error fetching leaderboard data: {str(e)}")
        return jsonify([]), 500

@app.route('/api/git_status')
def api_git_status():
    global current_project
    current_project = request.args.get('project', DEFAULT_PROJECT_NAME)
    status = check_git_status(current_project)
    return jsonify({"status": status})