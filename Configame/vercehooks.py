from flask import request, jsonify
from musthooks import save_config, load_config
import subprocess
import os

# Configuration
PROJECTS_DIR = os.path.expanduser("~/Documents/V0_Projects")

# Configure Vercel deployment
def configure_vercel(project_name: str):
    config = load_config(project_name)
    REPO_DIR = os.path.join(PROJECTS_DIR, project_name)  # Dynamic repo path

    if "VERCEL_PROJECT_URL" in config:
        return jsonify({
            "message": f"Vercel уже настроен: {config['VERCEL_PROJECT_URL']}",
            "status": "info"
        }), 200

    try:
        # Log in to Vercel
        subprocess.run("vercel login", shell=True, check=True)

        # Create a new Vercel project
        subprocess.run(f"cd \"{REPO_DIR}\" && vercel projects create {project_name} --yes", shell=True, check=True)

        # Deploy the project to Vercel
        subprocess.run(f"cd \"{REPO_DIR}\" && vercel deploy --prod", shell=True, check=True)

        # Fetch and save the Vercel project URL
        vercel_url = get_vercel_project_url(project_name)
        if vercel_url:
            config["VERCEL_PROJECT_URL"] = vercel_url
            save_config(project_name, config)
            return jsonify({
                "message": f"Vercel настроен успешно: {vercel_url}",
                "status": "success"
            }), 200
        else:
            return jsonify({
                "message": "Не удалось получить URL проекта Vercel.",
                "status": "error"
            }), 500

    except subprocess.CalledProcessError as e:
        return jsonify({
            "message": f"Не удалось настроить Vercel: {e.stderr}",
            "status": "error"
        }), 500


def get_vercel_project_url(project_name):
    try:
        result = subprocess.run(
            ["vercel", "inspect", project_name, "--scope"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        vercel_url = result.stdout.strip()
        return vercel_url
    except subprocess.CalledProcessError as e:
        print(f"Failed to fetch Vercel project URL: {e.stderr}")
        return None


def sync_env_vars(current_project):
    config = load_config(current_project)

    if "VERCEL_PROJECT_URL" not in config or "SUPABASE_PROJECT_ID" not in config:
        return jsonify({
            "message": "Vercel и Supabase должны быть настроены перед синхронизацией переменных окружения.",
            "status": "error"
        }), 400

    try:
        # Pull environment variables from Vercel
        subprocess.run("vercel env pull .env.production", shell=True, check=True)

        # Update configuration
        config["env_vars_synced"] = "True"
        save_config(current_project, config)

        # Generate installation achievement
        generate_installation_achievement("Sync Env Vars", current_project)

        return jsonify({
            "message": "Переменные окружения успешно синхронизированы с Vercel.",
            "status": "success"
        }), 200

    except subprocess.CalledProcessError as e:
        return jsonify({
            "message": f"Не удалось синхронизировать переменные окружения: {e.stderr}",
            "status": "error"
        }), 500