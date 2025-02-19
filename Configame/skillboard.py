from flask import Flask, render_template_string, jsonify, request
import os
import json
import sys
import threading
import time
import webbrowser
import logging
import pystray
from PIL import Image, ImageDraw
import requests

from cyberui import HTML_TEMPLATE
from skill_config import get_skill_data, SKILL_DEPENDENCIES

# Global Colors configuration
COLORS = {
    "bg": "#1a1a1a",        # Dark background
    "fg": "#ffffff",        # White text
    "btn": "#4d4d4d",      # Button/line color
    "cyberpunk": {
        "neon": "#0ff",     # Cyan neon
        "pink": "#ff1493",  # Deep pink
        "purple": "#9400d3", # Dark violet
    }
}
# Imports for modularized hooks
from musthooks import (
    create_project_folder,
    clone_repository,       # Clone the repository
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
    is_npm_package_installed,
    pull_git_updates,
    check_git_status,
)
from vercehooks import (
    configure_vercel,       # Configure Vercel deployment
    #complete_deployment,    # Finalize deployment steps
    sync_env_vars,
)
from supahooks import (
    reset_supabase_db,      # Reset the Supabase database
    initialize_supabase,    # Initialize Supabase connection
    apply_demo_data,        # Apply demo data to the database
    apply_custom_sql,       # Apply custom SQL scripts
    save_admin_to_database,
    create_or_update_user,
    calculate_elapsed_time,
) 
from telehooks import (
    # local configure_telegram_bot, # Configure Telegram bot token and admin chat ID
    set_webhook,            # Set webhook for Telegram bot
    # set_admin_chat_id,      # Set admin chat ID for notifications
)
from promohooks import (
    RARITY_COLORS,
    #local show_landing_page,      # Display the landing page with project details
    generate_achievements,  # Generate gamified achievements
    calculate_progress,     # Calculate user progress
    # local show_leaderboard,       # Display the leaderboard
    # loacl display_achievements,    # Display the Achievements
    calculate_user_level,
)
from advhooks import (
    generate_embeddings,    # Regenerate embeddings for semantic search
    create_pull_request,    # Create a pull request in GitHub
)
# Global Variables
current_project = None
projects = []
DEFAULT_PROJECT_NAME = "cartest"  # Default project name

# Configuration
PROJECTS_DIR = os.path.expanduser("~/Documents/V0_Projects")
VERSION_FILE = os.path.join(PROJECTS_DIR, "version.ini")  # Moved outside the repo

REPO_DIR = os.path.join(PROJECTS_DIR, DEFAULT_PROJECT_NAME)  # Dynamic repo path
V0_DEV_URL = "https://v0.dev/chat/fork-of-rastaman-shop-KvYJosUCML9"
VERCEL_URL = "https://vercel.com"
SUPABASE_URL = "https://supabase.com"
GITHUB_URL = f"https://github.com/salavey13/{DEFAULT_PROJECT_NAME}"
TEMP_DIR = os.path.join(os.getenv("TEMP"), "setup_temp")
# Supabase Configuration
SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM"

LEVELS = {
    "Beginner": 1,
    "Intermediate": 2,
    "Advanced": 3,
    "Badass": 4
}

# Grouped Actions with User Level Checks
grouped_actions = {
    "Project Management": [
        ("Создать папку проекта", create_project_folder, "Beginner"),
        ("Установить Git", lambda: download_and_install("Git", current_project), "Beginner"),
        ("Установить Node.js", lambda: download_and_install("Node.js", current_project), "Beginner"),
        ("Установить VS Code", lambda: download_and_install("VS Code", current_project), "Beginner"),
        ("Установить Notepad++", lambda: download_and_install("Notepad++", current_project), "Beginner"),
        ("Клонировать репозиторий", lambda: clone_repository(current_project), "Intermediate"),
        ("Применить ZIP обновления", lambda: apply_zip_updates(current_project), "Badass"),
    ],
    "Vercel Integration": [
        ("Установить Supabase CLI", lambda: install_cli_tool("supabase", current_project), "Intermediate"),
        ("Настроить Vercel", lambda: configure_vercel(current_project), "Intermediate"),
        ("Синхронизировать переменные окружения", lambda: sync_env_vars(current_project), "Intermediate"),
    ],
    "Supabase Integration": [
        ("Установить Vercel CLI", lambda: install_cli_tool("vercel", current_project), "Intermediate"),
        ("Генерировать вложения", lambda: generate_embeddings(current_project), "Badass"),
        ("Сбросить базу данных Supabase", lambda: reset_supabase_db(current_project), "Intermediate"),
        ("Инициализировать Supabase", lambda: initialize_supabase(current_project), "Intermediate"),
        ("Загрузить демо данные Supabase", lambda: apply_demo_data(current_project), "Intermediate"),
        ("Применить custom.sql", lambda: apply_custom_sql(current_project), "Intermediate"),
    ],
    "Telegram Integration": [
        ("Настроить Telegram бот", lambda: configure_telegram_bot(current_project), "Advanced"),
        ("Установить Webhook", lambda: set_webhook(current_project), "Advanced"),
    ],
    "Advanced Features": [
        ("Показать таблицу лидеров", lambda: unlock_leaderboard(current_project), "Badass"),
        ("Создать Pull Request", lambda: create_pull_request(current_project, "update", "Обновления", "Автоматические обновления"), "Badass"),
        ("Применить обновления Git", pull_git_updates, "Intermediate"),
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
        return True
    else:
        raise Exception("Не все задачи выполнены для разблокировки таблицы лидеров.")
        

        

       

    
def create_image():
    # Create a simple black-and-white image for the tray icon
    width, height = 64, 64
    image = Image.new('RGB', (width, height), COLORS["bg"])
    dc = ImageDraw.Draw(image)
    dc.rectangle((width // 2, 0, width, height // 2), fill=COLORS["cyberpunk"]["purple"])
    dc.rectangle((0, height // 2, width // 2, height), fill=COLORS["cyberpunk"]["pink"])
    

    # Optionally, add a neon border or other elements
    dc.rectangle(
        (0, 0, width, height),                # Full border
        outline=COLORS["cyberpunk"]["neon"], # Neon outline
        width=2                               # Border thickness
    )
    return image

def on_clicked(icon, item):
    if str(item) == "Exit":
        icon.stop()
         # Directly shut down the Flask server
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
    # Wait for the server to start before opening the browser
    time.sleep(1)
    webbrowser.open("http://127.0.0.1:1313")




app = Flask(__name__)

# Suppress Werkzeug logs
log = logging.getLogger('werkzeug')
#log.setLevel(logging.ERROR)


@app.route('/')
def index():
    current_project = request.args.get('project', DEFAULT_PROJECT_NAME)
    projects = load_projects()
    config = load_config(current_project)
    
    # Calculate user level
    user_level = calculate_user_level(config)
    
    # Check Git status
    git_status = check_git_status(current_project)
    git_status_color = "green" if git_status == '✅' else "red"
    
    # Pass user_level, git_status, and git_status_color to the template
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

@app.route('/shutdown', methods=['POST'])
def shutdown():
    threading.Thread(target=shutdown_server).start()
    return jsonify({"message": "Завершение работы сервера..."})
    
@app.route('/execute/')
def execute_skill():
    current_project = request.args.get('project', DEFAULT_PROJECT_NAME)
    skill = request.args.get('skill')  # Ensure skill is retrieved from query parameters
    if not skill:
        return jsonify({
            "message": "Название навыка не указано.",
            "refresh": False
        }), 400  # Return 400 if skill name is missing

    config = load_config(current_project)
    skill_key = skill.lower().replace(" ", "_")

    # Check if the skill is already completed
    if skill_key in config:
        return jsonify({
            "message": f"Навык '{skill}' уже был освоен ранее.",
            "refresh": False
        }), 400  # Return 400 if the skill was already completed

    # Calculate the user's current level
    user_level = calculate_user_level(config)

 
    


    # Find the skill in grouped_actions and check its required level
    for category, actions in grouped_actions.items():
        for action_name, action_func, required_level in actions:
            if action_name == skill:
                # Check if the user's level meets the required level for the skill
                if LEVELS[user_level] >= LEVELS[required_level]:
                    try:
                        # Execute the skill's function
                        
                        
                        
                        
                        
                        #### TEST TEST TEST #####
                        #########################
                        
                        action_func()
                        
                        #########################
                        #### TEST TEST TEST #####






                        config[skill_key] = "completed"
                        save_config(current_project, config)
                        return jsonify({
                            "message": f"🎉 Навык '{skill}' освоен!",
                            "refresh": True
                        })
                    except Exception as e:
                        return jsonify({
                            "message": f"Ошибка при выполнении навыка '{skill}': {str(e)}",
                            "refresh": False
                        }), 500  # Return 500 for server errors
                else:
                    return jsonify({
                        "message": f"❌ Уровень '{required_level}' требуется для освоения навыка '{skill}'. Ваш текущий уровень: '{user_level}'.",
                        "refresh": False
                    }), 403  # Return 403 for forbidden access

    # If the skill is not found in grouped_actions
    return jsonify({
        "message": f"Навык '{skill}' не найден.",
        "refresh": False
    }), 404  # Return 404 if the skill is not found

@app.route('/reset_progress')
def reset_progress():
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
            for idx, user in enumerate(users[:10]):  # Top 10 users
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
        else:
            return jsonify([]), 500  # Return empty list if there's an error
    except Exception as e:
        print(f"Error fetching leaderboard data: {str(e)}")
        return jsonify([]), 500
        
@app.route('/api/git_status')
def api_git_status():
    current_project = request.args.get('project', DEFAULT_PROJECT_NAME)
    status = check_git_status(current_project)
    return jsonify({
        "status": status
    })