from flask import request, jsonify
# promohooks.py
from skill_config import get_skill_data, SKILL_DESCRIPTIONS
# show_landing_page         +
# generate_achievements     +
# calculate_progress
# show_leaderboard          +
# display_achievements      +
# calculate_user_level      +

RARITY_COLORS = {
    "Common": "#808080",       # Gray
    "Rare": "#3498db",         # Blue
    "Epic": "#8e44ad",         # Purple
    "Legendary": "#e67e22",    # Orange
    "MYTHIC": "#ff0000",       # Red (Ultimate)
}


def calculate_user_level(config):
    """Determine the user's level based on achievements."""
    achievements = generate_achievements(config)
    print(f"Completed achievements: {achievements}")
    if len(achievements) >= 5:
        return "Badass"
    elif len(achievements) >= 3:
        return "Advanced"
    elif len(achievements) >= 1:
        return "Intermediate"
    else:
        return "Beginner"


        
# Progress Calculation
def calculate_progress(config):
    """Calculate user progress based on completed achievements."""
    total_achievements = 13 #sum(len(category) for category in ACHIEVEMENTS.values())
    #completed_achievements = sum(
    #    1 for category in ACHIEVEMENTS.values() for achievement in category if achievement["key"] in config
    #)
    completed_achievements = len(generate_achievements(config))
    return int((completed_achievements / total_achievements) * 100)

            
def generate_achievements(config):
    """
    Generate a list of achievements based on the user's progress stored in the config.
    Each achievement is represented as a tuple: (achievement_message, rarity).
    """
    achievements = []

    # Helper function to simplify appending achievements
    def add_achievement(condition, message, rarity):
        if condition:
            achievements.append((message, rarity))

    # Basic Setup Achievements
    add_achievement("создать_папку_проекта" in config, "✅ Project Folder настроен!", "Common")
    add_achievement("установить_git" in config, "🔧 Git настроен!", "Common")
    add_achievement("установить_node.js" in config, "🔧 Node.js настроен!", "Common")
    add_achievement("установить_vs_code" in config, "💻 VS Code настроен!", "Common")
    add_achievement("установить_notepad++" in config, "📝 Notepad++ настроен!", "Common")

    # Vercel Integration
    add_achievement(config.get("VERCEL_PROJECT_URL"), "🌟 Vercel настроен!", "Rare")

    # Supabase Integration
    if config.get("SUPABASE_PROJECT_ID"):
        if not is_using_demo_database(config):
            add_achievement(True, "🚀 Собственная база данных Supabase готова!", "Rare")
        else:
            add_achievement(True, "🌟 Демо-база данных Supabase настроена!", "Common")

    # Telegram Bot Integration
    add_achievement(
        config.get("TELEGRAM_BOT_TOKEN") and config.get("ADMIN_CHAT_ID"),
        "🔥 Telegram бот настроен!",
        "Epic"
    )

    # Advanced Features
    add_achievement("webhook_set" in config, "🔗 Webhook Set!", "Epic")
    add_achievement("embeddings_generated" in config, "🧠 Embeddings Generated!", "Legendary")
    add_achievement("pull_request_created" in config, "🎉 Pull Request Created!", "Legendary")

    # Leaderboard Unlock
    add_achievement("leaderboard_unlocked" in config, "🏆 Leaderboard Unlocked!", "MYTHIC")

    # Login Checklist
    add_achievement(config.get("github") == "completed", "✅ GitHub залогиненен!", "Common")
    add_achievement(config.get("vercel") == "completed", "✅ Vercel залогиненен!", "Common")
    add_achievement(config.get("v0_dev") == "completed", "✅ v0.dev залогиненен!", "Common")
    add_achievement(config.get("supabase") == "completed", "✅ Supabase залогиненен!", "Common")

    # Dynamically Generate Achievements for All Skills in SKILL_DESCRIPTIONS
    for skill_name, skill_info in SKILL_DESCRIPTIONS.items():
        skill_key = skill_name.lower().replace(" ", "_")
        if skill_key in config and config[skill_key] == "completed":
            achievements.append((f"✨ {skill_info['label']} разблокирован!", "Common"))

    # Default Achievement if No Progress
    if not achievements:
        achievements.append(("✨ Начните с логина в GitHub!", "Common"))

    return achievements
    
