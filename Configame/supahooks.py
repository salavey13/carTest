from flask import request, jsonify
import os
import time
import requests
from datetime import datetime
from musthooks import load_config, save_config, run_command
from promohooks import generate_achievements  # Generate gamified achievements
from tkinter import messagebox

# Configuration
PROJECTS_DIR = os.path.expanduser("~/Documents/V0_Projects")
# Supabase Configuration
SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzMzk1ODUsImV4cCI6MjA1MzkxNTU4NX0.AdNu5CBn6pp-P5M2lZ6LjpcqTXrhOdTOYMCiQrM_Ud4"

def show_nag_screen(config, current_project):
    """
    Show the nag screen to encourage the user to configure their own Supabase database.
    Returns a JSON response that the frontend can use to display the nag screen.
    """
    if is_using_demo_database(config):
        time.sleep(2)  # 2-second delay
        
        # Calculate the elapsed time since configuration started
        start_time = int(config.get("config_start_time", 0))
        elapsed_time = round((time.time() - start_time) / 3600, 2)  # Convert to hours
        
        # Prepare the nag screen message
        nag_message = (
            f"Вы уже потратили {elapsed_time} часов на настройку этого шедевра!\n\n"
            "Подсчитайте, сколько времени вы бы потратили, делая это вручную. "
            "Чаевые больше не будут поступать на мой демо Telegram-бот или сервер от вашей тестовой аудитории. "
            "Вы смогли перенастроить всё, вы великолепный ублюдок! "
            "Пожалуйста, поддержите меня, поставив лайк на моём видео на YouTube! :)"
        )
        
        # Return the nag screen message as a JSON response
        return jsonify({
            "message": nag_message,
            "show_nag_screen": True
        }), 200
    
    else:
        # Disable the nag screen if the user has configured their own database
        config["SHOW_NAG_SCREEN"] = "False"
        save_config(current_project, config)
        
        return jsonify({
            "message": "Nag screen disabled.",
            "show_nag_screen": False
        }), 200

def apply_demo_data(project_name: str):
    config = load_config(project_name)
    if not is_using_demo_database(config):
        return jsonify({"message": "Применение демо-данных доступно только для Вашей демо-базы данных.", "success": False}), 400
    
    demo_sql_path = os.path.join(PROJECTS_DIR, "supabase", "migrations", "20240101000000_init.sql")
    if os.path.exists(demo_sql_path):
        result = run_command(f"supabase db reset --sql {demo_sql_path}", "20240101000000_init SQL применён успешно.", "Не удалось применить 20240101000000_init SQL.")
        if result:
            config["CUSTOM_SQL_APPLIED_COMPLETED"] = "True"
            save_config(project_name, config)
            return jsonify({"message": "Демо-данные успешно применены.", "success": True}), 200
        else:
            return jsonify({"message": "Не удалось применить демо-данные.", "success": False}), 500
    else:
        return jsonify({"message": "Файл демо-данных не найден.", "success": False}), 404

def apply_custom_sql(project_name: str):
    config = load_config(project_name)
    custom_sql_path = os.path.join(REPO_DIR, "custom.sql")
    if os.path.exists(custom_sql_path):
        result = run_command(f"supabase db reset --sql {custom_sql_path}", "Custom SQL применён успешно.", "Не удалось применить Custom SQL.")
        if result:
            config["CUSTOM_SQL_APPLIED_COMPLETED"] = "True"
            save_config(project_name, config)
            return jsonify({"message": "Custom SQL успешно применён.", "success": True}), 200
        else:
            return jsonify({"message": "Не удалось применить Custom SQL.", "success": False}), 500
    else:
        return jsonify({"message": "Custom SQL файл не найден.", "success": False}), 404

def initialize_supabase(project_name: str):
    config = load_config(project_name)
    if "SUPABASE_PROJECT_ID" not in config:
        result = run_command("supabase init", "Supabase инициализирован успешно.", "Не удалось инициализировать Supabase.")
        if result:
            config["SUPABASE_PROJECT_ID"] = "initialized"
            save_config(project_name, config)
            return jsonify({"message": "Supabase успешно инициализирован.", "success": True}), 200
        else:
            return jsonify({"message": "Не удалось инициализировать Supabase.", "success": False}), 500
    else:
        return jsonify({"message": "Supabase уже инициализирован.", "success": True}), 200

def is_using_demo_database(config):
    default_supabase_url = "https://inmctohsodgdohamhzag.supabase.co"
    default_supabase_project_id = "inmctohsodgdohamhzag"
    supabase_url = config.get("SUPABASE_URL", "")
    supabase_project_id = config.get("SUPABASE_PROJECT_ID", "")
    return supabase_url == default_supabase_url or supabase_project_id == default_supabase_project_id
    
# Reset Supabase database
def reset_supabase_db(project_name: str):
    """
    Reset the Supabase database with an optional SQL file.
    This function integrates with Flask to handle file uploads and user confirmation via HTTP requests.
    """
    config = load_config(project_name)
    
    # Check if the user is using the demo database
    if is_using_demo_database(config):
        return jsonify({
            "message": "Сброс базы данных отключен для демо-базы данных. Пожалуйста, настройте собственную базу данных Supabase.",
            "success": False
        }), 403  # Forbidden status code
    
    # Get the SQL file from the request
    sql_file = request.form.get('sql_file')
    if not sql_file:
        return jsonify({
            "message": "SQL файл не выбран.",
            "success": False
        }), 400  # Bad Request status code
    
    # Confirm the reset action
    confirmation = request.form.get('confirmation')
    if confirmation != 'yes':
        return jsonify({
            "message": "Сброс базы данных отменён пользователем.",
            "success": False
        }), 400  # Bad Request status code
    
    # Run the reset command
    try:
        result = run_command(
            f"supabase db reset --sql \"{sql_file}\"",
            "База данных сброшена успешно.",
            "Не удалось сбросить базу данных."
        )
        if result:
            return jsonify({
                "message": "База данных успешно сброшена.",
                "success": True
            }), 200  # Success status code
        else:
            return jsonify({
                "message": "Не удалось сбросить базу данных.",
                "success": False
            }), 500  # Internal Server Error status code
    except Exception as e:
        return jsonify({
            "message": f"Ошибка при сбросе базы данных: {str(e)}",
            "success": False
        }), 500  # Internal Server Error status code

def calculate_elapsed_time(project_name: str):
    config = load_config(project_name)
    if "project_creation_date" not in config:
        config["project_creation_date"] = datetime.now().isoformat()
        save_config(project_name, config)
    creation_date = datetime.fromisoformat(config["project_creation_date"])
    elapsed_time = (datetime.now() - creation_date).total_seconds()
    return jsonify({"elapsed_time": round(elapsed_time)}), 200

def save_admin_to_database(admin_chat_id: str, elapsed_time, project_name: str):
    config = load_config(project_name)
    url = f"{SUPABASE_URL}/rest/v1/users"
    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
    }
    data = {
        "user_id": admin_chat_id,
        "role": "admin",
        "metadata": {
            "nickname": f"New Admin from {project_name}",
            "total_time": elapsed_time,
            "achievements": generate_achievements(config),
        },
    }
    response = requests.post(url, json=data, headers=headers)
    if response.status_code == 201:
        return jsonify({"message": "Администратор успешно добавлен в базу данных.", "success": True}), 200
    else:
        return jsonify({"message": "Не удалось добавить администратора в базу данных.", "success": False}), 500

def create_or_update_user(user_id, elapsed_time, project_name: str):
    config = load_config(project_name)
    url = f"{SUPABASE_URL}/rest/v1/users"
    headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    payload = {
        "user_id": user_id,
        "metadata": {
            "total_time": elapsed_time,
            "achievements": generate_achievements(config),
            "nickname": f"New User from {project_name}"
        }
    }
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 201:
        return jsonify({"message": "Пользователь успешно создан/обновлён.", "success": True}), 200
    else:
        return jsonify({"message": "Не удалось создать/обновить пользователя.", "success": False}), 500