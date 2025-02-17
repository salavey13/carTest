from flask import request, jsonify
from musthooks import save_config, load_config
from supahooks import save_admin_to_database
# telehooks.py

import uuid
# configure_telegram_bot    +!
# set_webhook               +
# set_admin_chat_id         -!

import os


def set_webhook(current_project):
    """
    Set webhook for Telegram Bot.
    Returns a JSON response indicating success or failure.
    """
    config = load_config(current_project)

    # Check if VERCEL_PROJECT_URL is configured
    if "VERCEL_PROJECT_URL" not in config:
        return jsonify({
            "message": "URL Vercel не настроен.",
            "status": "error"
        }), 400

    # Construct the webhook URL
    webhook_url = f"https://{config['VERCEL_PROJECT_URL']}/api/telegramWebhook"

    try:
        # Run the command to set the webhook
        result = subprocess.run(
            ["npx", "tsx", "scripts/setWebhook.ts"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # Return success response
        return jsonify({
            "message": "Webhook установлен успешно.",
            "status": "success",
            "details": result.stdout
        }), 200

    except subprocess.CalledProcessError as e:
        # Return error response
        return jsonify({
            "message": f"Не удалось установить webhook: {e.stderr}",
            "status": "error"
        }), 500



def set_admin_chat_id(current_project, admin_chat_id):
    """
    Set the admin chat ID for Telegram notifications.
    Returns a JSON response indicating success or failure.
    """
    config = load_config(current_project)

    # Validate admin_chat_id
    if not admin_chat_id:
        return jsonify({
            "message": "ID админского чата не может быть пустым.",
            "status": "error"
        }), 400

    # Save the admin chat ID to the configuration
    config["ADMIN_CHAT_ID"] = admin_chat_id
    save_config(current_project, config)

    return jsonify({
        "message": "ID админского чата успешно настроен.",
        "status": "success"
    }), 200
    


def configure_telegram_bot(current_project):
    """
    Configure Telegram Bot token and admin chat ID.
    Returns a JSON response indicating success or failure.
    """
    if not current_project:
        return jsonify({
            "message": "Проект не выбран.",
            "status": "error"
        }), 400

    config = load_config(current_project)

    # Step 1: Configure Telegram Bot Token
    if "TELEGRAM_BOT_TOKEN" not in config:
        bot_token = request.args.get("bot_token")  # Retrieve token from query parameters
        if not bot_token:
            return jsonify({
                "message": "Токен Telegram бота не указан.",
                "status": "error"
            }), 400

        config["TELEGRAM_BOT_TOKEN"] = bot_token
        save_config(current_project, config)

        return jsonify({
            "message": "Токен Telegram бота настроен успешно.",
            "status": "success"
        }), 200

    # Step 2: Configure Admin Chat ID
    if "ADMIN_CHAT_ID" not in config:
        admin_chat_id = request.args.get("admin_chat_id")  # Retrieve admin chat ID from query parameters
        if not admin_chat_id:
            return jsonify({
                "message": "ID админского чата не указан.",
                "status": "error"
            }), 400

        # Save the Admin Chat ID to the configuration
        config["ADMIN_CHAT_ID"] = admin_chat_id
        config["TELEGRAM_BOT_CONFIGURED"] = "True"
        save_config(current_project, config)

        # Create or update user in Supabase when ADMIN_CHAT_ID is set
        elapsed_time = calculate_elapsed_time(current_project)
        save_admin_to_database(admin_chat_id, elapsed_time, current_project)

        # Enable the nag screen
        config["SHOW_NAG_SCREEN"] = "True"
        save_config(current_project, config)

        return jsonify({
            "message": "ID админского чата настроен успешно.",
            "status": "success"
        }), 200

    # Step 3: Add environment variables to Vercel if VERCEL_PROJECT_URL is configured
    if "VERCEL_PROJECT_URL" in config:
        try:
            if "TELEGRAM_BOT_TOKEN" in config:
                run_command(f"vercel env add TELEGRAM_BOT_TOKEN {config['TELEGRAM_BOT_TOKEN']} production")
            if "ADMIN_CHAT_ID" in config:
                run_command(f"vercel env add ADMIN_CHAT_ID {config['ADMIN_CHAT_ID']} production")

            return jsonify({
                "message": "Переменные окружения Telegram добавлены в Vercel.",
                "status": "success"
            }), 200
        except Exception as e:
            return jsonify({
                "message": f"Ошибка при добавлении переменных окружения в Vercel: {str(e)}",
                "status": "error"
            }), 500

    return jsonify({
        "message": "Конфигурация Telegram бота завершена.",
        "status": "success"
    }), 200
