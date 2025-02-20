# Описания навыков для всплывающих подсказок в стиле RPG
SKILL_DATA = {
    "Создать папку проекта": {
        "icon": "📁",
        "label": "Основа проекта",
        "description": "Создайте базовую директорию для вашего проекта. Это первый шаг к организации вашего рабочего пространства.",
        "unlocked": True,
        "dependencies": [],
        "position": {"row": 3, "col": 3}
    },
    "Установить Git": {
        "icon": "⚙️",
        "label": "Контроль версий",
        "description": "Настройте Git для управления изменениями в вашем коде. Без этого вы рискуете потеряться в хаосе файлов.",
        "unlocked": False,
        "dependencies": [],
        "position": {"row": 2, "col": 2}
    },
    "Установить VS Code": {
        "icon": "💻",
        "label": "Редактор кода",
        "description": "Установите Visual Studio Code — мощный инструмент для написания и отладки кода.",
        "unlocked": False,
        "dependencies": [],
        "position": {"row": 2, "col": 4}
    },
    "Установить Node.js": {
        "icon": "🌐",
        "label": "JavaScript-движок",
        "description": "Установите Node.js для работы с JavaScript вне браузера. Это основа современной веб-разработки.",
        "unlocked": False,
        "dependencies": [],
        "position": {"row": 4, "col": 2}
    },
    "Установить Notepad++": {
        "icon": "📝",
        "label": "Текстовый редактор",
        "description": "Установите Notepad++ для быстрого редактирования текстовых файлов. Простой, но эффективный инструмент.",
        "unlocked": False,
        "dependencies": [],
        "position": {"row": 4, "col": 4}
    },
    "Клонировать репозиторий": {
        "icon": "⬇️",
        "label": "Клонирование репозитория",
        "description": "Скопируйте удаленный репозиторий на свой компьютер. Требуется: Git.",
        "unlocked": False,
        "dependencies": ["Установить Git", "Создать папку проекта"],
        "position": {"row": 2, "col": 3}
    },
    "Применить ZIP обновления": {
        "icon": "📦",
        "label": "Обновление из ZIP",
        "description": "Примените обновления из ZIP-архива. Требуется: Клонировать репозиторий.",
        "unlocked": False,
        "dependencies": ["Клонировать репозиторий"],
        "position": {"row": 0, "col": 9}
    },
    "Создать Pull Request": {
        "icon": "📤",
        "label": "Отправка изменений",
        "description": "Отправьте свои изменения в основной репозиторий для проверки. Требуется: Git, репозиторий.",
        "unlocked": False,
        "dependencies": ["Клонировать репозиторий"],
        "position": {"row": 1, "col": 3}
    },
    "Установить Supabase CLI": {
        "icon": "🔑",
        "label": "Supabase CLI",
        "description": "Установите инструмент командной строки для работы с базой данных Supabase. Требуется: Node.js.",
        "unlocked": False,
        "dependencies": ["Установить Node.js"],
        "position": {"row": 2, "col": 5}
    },
    "Инициализировать Supabase": {
        "icon": "🎲",
        "label": "Инициализация базы данных",
        "description": "Подключитесь к базе данных Supabase и начните работу. Требуется: Supabase CLI, репозиторий.",
        "unlocked": False,
        "dependencies": ["Установить Supabase CLI", "Клонировать репозиторий"],
        "position": {"row": 1, "col": 4}
    },
    "Сбросить базу данных Supabase": {
        "icon": "🔄",
        "label": "Сброс базы данных",
        "description": "Очистите базу данных и вернитесь к начальному состоянию. Требуется: Supabase CLI.",
        "unlocked": False,
        "dependencies": ["Инициализировать Supabase"],
        "position": {"row": 1, "col": 5}
    },
    "Загрузить демо данные Supabase": {
        "icon": "📋",
        "label": "Демо-данные",
        "description": "Загрузите тестовые данные в базу данных Supabase. Требуется: Supabase CLI.",
        "unlocked": False,
        "dependencies": ["Инициализировать Supabase"],
        "position": {"row": 0, "col": 4}
    },
    "Применить custom.sql": {
        "icon": "📜",
        "label": "Пользовательский SQL",
        "description": "Выполните собственный SQL-скрипт для настройки базы данных. Требуется: Supabase CLI.",
        "unlocked": False,
        "dependencies": ["Инициализировать Supabase"],
        "position": {"row": 0, "col": 5}
    },
    "Установить Vercel CLI": {
        "icon": "🚀",
        "label": "Vercel CLI",
        "description": "Установите инструмент командной строки для развертывания приложений на Vercel. Требуется: Node.js.",
        "unlocked": False,
        "dependencies": ["Установить Node.js"],
        "position": {"row": 3, "col": 1}
    },
    "Настроить Vercel": {
        "icon": "☁️",
        "label": "Облачное развертывание",
        "description": "Настройте проект для развертывания на платформе Vercel. Требуется: Vercel CLI, репозиторий.",
        "unlocked": False,
        "dependencies": ["Установить Vercel CLI", "Клонировать репозиторий"],
        "position": {"row": 3, "col": 5}
    },
    "Синхронизировать переменные окружения": {
        "icon": "🔗",
        "label": "Синхронизация переменных",
        "description": "Синхронизируйте переменные окружения между Vercel и Supabase. Требуется: Vercel CLI, Supabase.",
        "unlocked": False,
        "dependencies": ["Настроить Vercel", "Инициализировать Supabase"],
        "position": {"row": 0, "col": 6}
    },
    "Настроить Telegram бот": {
        "icon": "🤖",
        "label": "Telegram-бот",
        "description": "Создайте и настройте Telegram-бота для автоматизации задач. Требуется: Vercel.",
        "unlocked": False,
        "dependencies": ["Настроить Vercel"],
        "position": {"row": 3, "col": 0}
    },
    "Установить Webhook": {
        "icon": "📡",
        "label": "Webhook",
        "description": "Настройте автоматические уведомления через Webhook. Требуется: Telegram-бот.",
        "unlocked": False,
        "dependencies": ["Настроить Telegram бот"],
        "position": {"row": 3, "col": 6}
    },
    "Показать таблицу лидеров": {
        "icon": "🏆",
        "label": "Таблица лидеров",
        "description": "Просмотрите таблицу лидеров для мотивации и анализа прогресса. Требуется: Admin Chat ID.",
        "unlocked": False,
        "dependencies": ["Настроить Telegram бот"],
        "position": {"row": 0, "col": 7}
    },
    "Генерировать вложения": {
        "icon": "🧠",
        "label": "Генерация вложений",
        "description": "Создайте семантические вложения для поиска. Требуется: Node.js.",
        "unlocked": False,
        "dependencies": ["Установить Node.js"],
        "position": {"row": 0, "col": 8}
    },
    "hidden_achievement_1": {
        "icon": "🎮",
        "label": "Секретное достижение",
        "description": "Вы нашли скрытое достижение! Продолжайте исследовать возможности системы.",
        "unlocked": False,
        "dependencies": [],
        "position": {"row": 5, "col": 9}
    },
    "hidden_achievement_2": {
        "icon": "🎨",
        "label": "UI-мастер",
        "description": "Еще одно секретное достижение! Вы внимательны и любопытны.",
        "unlocked": False,
        "dependencies": [],
        "position": {"row": 6, "col": 9}
    }
}





SKILL_DESCRIPTIONS = {
    "Создать папку проекта": {
        "icon": "🏰",
        "label": "Камень фундамента",
        "desc": "Создайте мистическое хранилище для ваших артефактов проекта. Это начало вашего пути!"
    },
    # Основные инструменты (Внутреннее кольцо)
    "Установить Git": {
        "icon": "⚡",
        "label": "Ткач времени",
        "desc": "Овладейте древним искусством контроля версий."
    },
    "Установить VS Code": {
        "icon": "⚔️",
        "label": "Страж кода",
        "desc": "Получите легендарный редактор кода."
    },
    "Установить Node.js": {
        "icon": "🌐",
        "label": "Асинхронный чародей",
        "desc": "Призовите силу асинхронной магии."
    },
    "Установить Notepad++": {
        "icon": "📝",
        "label": "Маг текста",
        "desc": "Расширьте свои возможности редактирования текста."
    },
    # Ветвь контроля версий
    "Клонировать репозиторий": {
        "icon": "🌌",
        "label": "Повелитель порталов",
        "desc": "Создайте магический портал в удаленное хранилище кода."
    },
#    "Применить ZIP обновления": {
#        "icon": "📦",
#        "label": "Алхимик обновлений",
#        "desc": "Примените магические обновления из ZIP-архива."
#    },
    "Создать Pull Request": {
        "icon": "🎭",
        "label": "Кодовый дипломат",
        "desc": "Отправьте свои изменения на суд старейшин."
    },
    # Ветвь базы данных
    "Установить Supabase CLI": {
        "icon": "🗝️",
        "label": "Рыцарь базы данных",
        "desc": "Получите контроль над базой данных через командную строку."
    },
    "Инициализировать Supabase": {
        "icon": "🎲",
        "label": "Призыватель базы данных",
        "desc": "Пробудите силу базы данных."
    },
    "Сбросить базу данных Supabase": {
        "icon": "🔄",
        "label": "Обнулитель базы данных",
        "desc": "Сбросьте базу данных до начального состояния."
    },
    "Загрузить демо данные Supabase": {
        "icon": "📋",
        "label": "Загрузчик демо-данных",
        "desc": "Загрузите демо-данные в базу данных."
    },
    "Применить custom.sql": {
        "icon": "📜",
        "label": "Волшебник SQL",
        "desc": "Примените пользовательский SQL-скрипт."
    },
    # Ветвь развертывания
    "Установить Vercel CLI": {
        "icon": "🚀",
        "label": "Рыцарь Vercel",
        "desc": "Получите контроль над облачным развертыванием через командную строку."
    },
    "Настроить Vercel": {
        "icon": "☁️",
        "label": "Всадник облаков",
        "desc": "Откройте врата в облачное развертывание."
    },
    "Синхронизировать переменные окружения": {
        "icon": "🔗",
        "label": "Синхронизатор окружения",
        "desc": "Синхронизируйте переменные окружения с Vercel."
    },
    # Интеграция с Telegram
    "Настроить Telegram бот": {
        "icon": "🤖",
        "label": "Призыватель бота",
        "desc": "Создайте магического помощника в Telegram."
    },
    "Установить Webhook": {
        "icon": "📡",
        "label": "Ткач Webhook",
        "desc": "Настройте автоматические уведомления через Webhook."
    },
    # Дополнительные возможности
    "Показать таблицу лидеров": {
        "icon": "🏆",
        "label": "Наблюдатель таблицы лидеров",
        "desc": "Просмотрите таблицу лидеров."
    },
    "Генерировать вложения": {
        "icon": "🧠",
        "label": "Генератор вложений",
        "desc": "Генерируйте семантические вложения для поиска."
    }
}

# Пасхалки (специальные скрытые возможности)
EASTER_EGG_SKILLS = {
    "hidden_achievement_1": {
        "icon": "🎮",
        "label": "Властелин игры",
        "desc": "Вы нашли секретное достижение! Продолжайте исследовать дерево навыков...",
        # Перенесли пасхалку в правый нижний угол, чтобы избежать пересечения
        "position": {"row": 8, "col": 9}
    },
    "hidden_achievement_2": {
        "icon": "🎨",
        "label": "UI-чародей",
        "desc": "Еще одна пасхалка! Вы точно внимательный исследователь!",
        "position": {"row": 8, "col": 10}
    }
}

# Конфигурация зависимостей навыков
SKILL_DEPENDENCIES = {
    "Создать папку проекта": [],  # Центральный узел
    "Установить Git": [],
    "Установить Node.js": [],
    "Установить VS Code": [],
    "Установить Notepad++": [],
    "Клонировать репозиторий": ["Установить Git", "Создать папку проекта"],
    "Применить ZIP обновления": ["Клонировать репозиторий"],
    "Создать Pull Request": ["Клонировать репозиторий"],
    "Установить Supabase CLI": ["Установить Node.js"],
    "Инициализировать Supabase": ["Установить Supabase CLI", "Клонировать репозиторий"],
    "Сбросить базу данных Supabase": ["Инициализировать Supabase"],
    "Загрузить демо данные Supabase": ["Инициализировать Supabase"],
    "Применить custom.sql": ["Инициализировать Supabase"],
    "Установить Vercel CLI": ["Установить Node.js"],
    "Настроить Vercel": ["Установить Vercel CLI", "Клонировать репозиторий"],
    "Синхронизировать переменные окружения": ["Настроить Vercel", "Инициализировать Supabase"],
    "Настроить Telegram бот": ["Настроить Vercel"],
    "Установить Webhook": ["Настроить Telegram бот"],
    "Показать таблицу лидеров": ["Настроить Telegram бот"],
    "Генерировать вложения": ["Установить Node.js", "Синхронизировать переменные окружения"]
}

# Улучшенное позиционирование узлов на сетке (расширенная схема для уменьшения наложений)
SKILL_POSITIONS = {
    # Root Node
    "Создать папку проекта": {"row": 8, "col": 5}, 
    
    # Level 1 (Direct dependencies of root)
    "Установить Git": {"row": 7, "col": 4},
    "Установить VS Code": {"row": 8, "col": 2},
    "Установить Node.js": {"row": 6, "col": 4},
    "Установить Notepad++": {"row": 8, "col": 1},
    
    # Level 2 (Dependencies of level 1 nodes)
    "Клонировать репозиторий": {"row": 7, "col": 6},
    "Установить Supabase CLI": {"row": 5, "col": 3},
    "Установить Vercel CLI": {"row": 5, "col": 6},
    
    # Level 3 (Dependencies of level 2 nodes)
    "Создать Pull Request": {"row": 2, "col": 10},
    "Инициализировать Supabase": {"row": 4, "col": 4},
    "Настроить Vercel": {"row": 4, "col": 7},
    
    # Level 4 (Dependencies of level 3 nodes)
    "Сбросить базу данных Supabase": {"row": 3, "col": 3},
    "Загрузить демо данные Supabase": {"row": 3, "col": 4},
    "Применить custom.sql": {"row": 3, "col": 5},
    "Синхронизировать переменные окружения": {"row": 3, "col": 7},
    "Настроить Telegram бот": {"row": 3, "col": 8},
    
    # Level 5 (Dependencies of level 4 nodes)
    "Установить Webhook": {"row": 2, "col": 8},
    "Показать таблицу лидеров": {"row": 2, "col": 9},
    "Генерировать вложения": {"row": 2, "col": 1},
    
    # Easter Eggs
    "hidden_achievement_1": {"row": 8, "col": 9},
    "hidden_achievement_2": {"row": 8, "col": 10},
    
    "Применить ZIP обновления": {"row": 8, "col": 7},
}
# Обновлённые позиции для узлов-заполнителей (placeholders) — размещены в свободных областях
placeholder_positions = [
    {"row": 10, "col": 0},
    #{"row": 6, "col": 1},
]
  
def is_skill_visible(skill_name, config):
    """Определяет, должен ли навык быть видимым, исходя из зависимостей."""
    if skill_name == "Создать папку проекта":
        return True

    dependencies = SKILL_DEPENDENCIES.get(skill_name, [])
    if not dependencies:
        return True

    for dep in dependencies:
        dep_key = dep.lower().replace(" ", "_")
        if config.get(dep_key, "not_started") == "completed":
            return True
    return False

def is_skill_unlocked(skill_name, config):
    """Определяет, разблокирован ли навык (все зависимости завершены)."""
    if skill_name == "Создать папку проекта":
        return True

    dependencies = SKILL_DEPENDENCIES.get(skill_name, [])
    for dep in dependencies:
        dep_key = dep.lower().replace(" ", "_")
        if config.get(dep_key, "not_started") != "completed":
            return False
    return True
    
# Helper function to determine if a skill is completed
def is_completed(skill_name, config):
    skill_key = skill_name.lower().replace(" ", "_")
    return config.get(skill_key) == "completed"

def get_skill_data(config):
    """Возвращает все видимые навыки с их метаданными."""
    skill_data = {}

    # Add all skills from SKILL_DESCRIPTIONS
    for skill_name, skill_info in SKILL_DESCRIPTIONS.items():
        skill_key = skill_name.lower().replace(" ", "_")
        unlocked = is_skill_unlocked(skill_name, config)
        completed = is_completed(skill_name, config)

        skill_data[skill_name] = {
            "name": skill_name,
            "icon": skill_info["icon"],
            "label": skill_info["label"],
            "description": skill_info["desc"],
            "unlocked": unlocked,
            "position": SKILL_POSITIONS.get(skill_name, {"row": 0, "col": 0}),
            "dependencies": SKILL_DEPENDENCIES.get(skill_name, []),
            "completed": completed
        }

    # Add Easter eggs
    for egg_id, egg_info in EASTER_EGG_SKILLS.items():
        completed = is_completed(egg_id, config)

        skill_data[egg_id] = {
            "name": egg_id,
            "icon": egg_info["icon"],
            "label": egg_info["label"],
            "description": egg_info["desc"],
            "position": egg_info["position"],
            "unlocked": True,
            "dependencies": [],
            "is_easter_egg": True,
            "completed": completed
        }

    # Add placeholder nodes
    for i, pos in enumerate(placeholder_positions):
        placeholder_id = f"future_skill_{i}"

        skill_data[placeholder_id] = {
            "name": placeholder_id,
            "icon": "🔧",
            "label": "Future Skill",
            "description": "Предложите свой навык для добавления в дерево!",
            "unlocked": True,
            "position": pos,
            "dependencies": [],
            "is_placeholder": True,
            "completed": False
        }

    return skill_data