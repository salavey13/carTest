HTML_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>🎮 Cyberpunk Skillz 🤖</title>
    <style>
        body {
            background: radial-gradient(circle, {{ colors.cyberpunk.purple }}, #000000);
            color: white;
            font-family: 'Segoe UI', sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
            transition: background 2s ease;
            z-index: -1;
        }

        /* User level specific backgrounds */
        body[data-level="Beginner"] {
            background: radial-gradient(circle, {{ colors.cyberpunk.purple }}, #000000);
        }
        body[data-level="Intermediate"] {
            background: radial-gradient(circle, {{ colors.cyberpunk.pink }}, #1a1a1a);
        }
        body[data-level="Advanced"] {
            background: radial-gradient(circle, {{ colors.cyberpunk.neon }}, #000000);
        }
        body[data-level="Badass"] {
            background: radial-gradient(circle, #ff00ff, #000000);
        }

        .skill-tree {
            position: relative;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
        }

        .skill-node {
            position: absolute;
            width: 113px;
            height: 69px;
            cursor: pointer;
            touch-action: none;
        }

        .skill-box {
            width: 100%;
            height: 100%;
            border: 2px solid transparent;
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            opacity: 0.9;
            position: relative;
            overflow: hidden;
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
            -webkit-user-select: none;  /* Safari */
            -moz-user-select: none;     /* Firefox */
            -ms-user-select: none;      /* IE10+/Edge */
            user-select: none;          /* Standard syntax */
        }

        .skill-box::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: -1;
            border-radius: 24px;
        }

        .skill-box[data-category="ProjectSetup"]::before {
            background: linear-gradient(145deg, {{ colors.cyberpunk.pink }}, #ff1493);
            animation: gradientShiftProject 10s ease infinite;
        }

        .skill-box[data-category="VersionControl"]::before {
            background: linear-gradient(145deg, {{ colors.cyberpunk.purple }}, #7b68ee);
            animation: gradientShiftVersion 10s ease infinite;
        }

        .skill-box[data-category="DatabaseManagement"]::before {
            background: linear-gradient(145deg, {{ colors.cyberpunk.neon }}, #00ffff);
            animation: gradientShiftDatabase 10s ease infinite;
        }

        .skill-box[data-category="Deployment"]::before {
            background: linear-gradient(145deg, {{ colors.cyberpunk.pink }}, #ff6f61);
            animation: gradientShiftDeployment 10s ease infinite;
        }

        .skill-box[data-category="Integration"]::before {
            background: linear-gradient(145deg, {{ colors.cyberpunk.purple }}, #9370db);
            animation: gradientShiftIntegration 10s ease infinite;
        }

        .skill-box[data-category="AdvancedFeatures"]::before {
            background: linear-gradient(145deg, {{ colors.cyberpunk.neon }}, #40e0d0);
            animation: gradientShiftAdvanced 10s ease infinite;
        }

        .skill-box.locked {
            opacity: 0.5;
            filter: grayscale(80%);
            border: 2px dashed {{ colors.cyberpunk.neon }};
        }

        .skill-box.unlocked {
            opacity: 1;
            border: 2px solid {{ colors.cyberpunk.neon }};
        }

        .skill-box.completed {
            opacity: 1;
            border: 2px solid #00ff00;
            filter: brightness(110%);
        }

        .skill-box.new-unlocked {
            transform: scale(1.13);
            box-shadow: 0 0 20px {{ colors.cyberpunk.neon }};
            animation: pulse 2s infinite, glow 3s infinite;
            position: relative;
        }

        .skill-box.new-unlocked::after {
            content: '✨';
            position: absolute;
            right: -10px;
            top: -10px;
            font-size: 1.5em;
            color: {{ colors.cyberpunk.neon }};
            animation: sparkle 2s infinite;
        }

        .skill-box.invisible {
            display: none;
        }

        .skill-box:hover {
            transform: scale(1.1) rotate(2deg);
            box-shadow: 0 0 20px {{ colors.cyberpunk.purple }};
            opacity: 1;
        }

        .skill-box::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 120%;
            height: 120%;
            background: radial-gradient(circle at center, transparent, rgba(255,255,255,0.1));
            border-radius: 50%;
            pointer-events: none;
            z-index: -1;
            opacity: 0;
            animation: radialPulse 5s infinite;
        }

        .header {
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            padding: 13px;
            border-bottom: 2px solid {{ colors.cyberpunk.purple }};
            display: flex;
            align-items: center;
            gap: 20px;
            width: 100%;
            justify-content: space-around;
            z-index: 10;
        }

        .header h1 {
            text-align: center;
            font-size: 3rem;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 1rem;
            background: linear-gradient(90deg, {{ colors.cyberpunk.neon }}, {{ colors.cyberpunk.pink }});
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        #project-select, #reset-button, #close-button {
            background: rgba(0, 0, 0, 0.5);
            color: {{ colors.cyberpunk.neon }};
            border: 2px solid {{ colors.cyberpunk.neon }};
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        #reset-button {
            background: rgba(0, 0, 0, 0.5);
            color: {{ colors.cyberpunk.pink }};
            border: 2px solid {{ colors.cyberpunk.pink }};
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.3rem;
        }

        #project-select:hover, #reset-button:hover, #close-button:hover {
            box-shadow: 0 0 20px {{ colors.cyberpunk.neon }};
        }

        #reset-button:hover, #close-button:hover {
            box-shadow: 0 0 20px {{ colors.cyberpunk.pink }};
        }

        .container {
            width: 95%;
            max-width: 1200px;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .skill-connection {
            position: absolute;
            width: 2px;
            border-radius: 1px;
            z-index: -1;
            transition: all 0.3s ease;
        }

        .skill-connection.dimmed {
            opacity: 0.3;
            filter: brightness(50%);
        }

        .skill-connection.active {
            opacity: 1;
            stroke-width: 4px;
            animation: pulse 2s infinite;
        }

        .skill-connection path {
            stroke: linear-gradient(to right, {{ colors.cyberpunk.neon }}, {{ colors.cyberpunk.purple }}, {{ colors.cyberpunk.pink }});
            stroke-linecap: round;
            stroke-dasharray: 5, 5;
        }

        .particle {
            position: absolute;
            width: 2px;
            height: 2px;
            border-radius: 50%;
            animation: moveParticle 3s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite, glow 2s ease-in-out infinite;
        }

        /* Legend Container */
        .legend {
          position: absolute;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(26, 26, 26, 0.7));
          padding: 15px;
          border-radius: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          align-items: center;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
          border: 1px solid {{ colors.cyberpunk.neon }};
          backdrop-filter: blur(5px);
        }

        /* Legend Items */
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          transition: transform 0.3s ease;
        }

        .legend-item:hover {
          transform: translateY(-2px);
        }

        /* Legendary Links (v0 and GitHub) */
        .legend-item.legendary {
          position: relative;
        }

        .legend-link {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-weight: bold;
          transition: color 0.3s ease, transform 0.3s ease;
        }

        .legend-link:hover {
          transform: scale(1.05);
        }

        .v0-link {
          color: #ff69b4; /* Hot Pink */
        }

        .v0-link:hover {
          color: #ff85c1;
          text-shadow: 0 0 5px #ff69b4;
        }

        .github-link {
          color: {{ colors.cyberpunk.neon }};
        }

        .github-link:hover {
          color: #00ffff;
          text-shadow: 0 0 5px {{ colors.cyberpunk.neon }};
        }

        /* Legend Dot */
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          box-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
          transition: transform 0.3s ease;
        }

        .legend-item:hover .legend-dot {
          transform: scale(1.2);
        }

        /* User Level */
        .legend-user-level {
          font-size: 16px;
          padding: 5px 10px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .level-text {
          color: white;
          font-weight: bold;
        }

        .level-text[data-level="Beginner"] {
          color: {{ colors.cyberpunk.purple }};
        }
        .level-text[data-level="Intermediate"] {
          color: {{ colors.cyberpunk.pink }};
        }
        .level-text[data-level="Advanced"] {
          color: {{ colors.cyberpunk.neon }};
        }
        .level-text[data-level="Badass"] {
          color: #ff00ff;
          text-shadow: 0 0 5px #ff00ff;
        }

        /* Tooltips */
        .tooltip {
            display: none;
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid {{ colors.cyberpunk.neon }};
            padding: 15px;
            border-radius: 16px;
            width: 300px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        }

        .tooltip::before {
            content: '';
            position: absolute;
            top: -10px;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: transparent transparent {{ colors.cyberpunk.neon }} transparent;
        }

        @keyframes gradientShiftProject {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }

        @keyframes gradientShiftVersion {
            0%, 100% { background-position: 50% 0%; }
            50% { background-position: 50% 100%; }
        }

        @keyframes gradientShiftDatabase {
            0%, 100% { background-position: 100% 50%; }
            50% { background-position: 0% 50%; }
        }

        @keyframes gradientShiftDeployment {
            0%, 100% { background-position: 50% 100%; }
            50% { background-position: 50% 0%; }
        }

        @keyframes gradientShiftIntegration {
            0%, 100% { background-position: 0% 0%; }
            50% { background-position: 100% 100%; }
        }

        @keyframes gradientShiftAdvanced {
            0%, 100% { background-position: 100% 0%; }
            50% { background-position: 0% 100%; }
        }

        @keyframes pulse {
            0% { transform: scale(1); stroke-width: 4px; opacity: 1; }
            50% { transform: scale(1.1); stroke-width: 6px; opacity: 0.7; }
            100% { transform: scale(1); stroke-width: 4px; opacity: 1; }
        }

        @keyframes glow {
            0% { box-shadow: 0 0 0 0 {{ colors.cyberpunk.neon }}; }
            50% { box-shadow: 0 0 5px 5px {{ colors.cyberpunk.neon }}; }
            100% { box-shadow: 0 0 0 0 {{ colors.cyberpunk.neon }}; }
        }

        @keyframes sparkle {
            0% { opacity: 0; transform: scale(0.5) rotate(0deg); }
            50% { opacity: 1; transform: scale(1) rotate(180deg); }
            100% { opacity: 0; transform: scale(0.5) rotate(360deg); }
        }

        @keyframes radialPulse {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            50% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        }

        @keyframes moveParticle {
            0% { transform: translate(0, 0); opacity: 1; }
            100% { transform: translate(var(--end-x), var(--end-y)); opacity: 0; }
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            .skill-box {
                width: 90px;
                height: 55px;
            }
            .tooltip {
                width: 200px;
            }
            .legend {
                bottom: 10px;
                right: 10px;
                padding: 10px;
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
              }

              .legend-item {
                font-size: 12px;
              }

              .legend-dot {
                width: 8px;
                height: 8px;
              }

              .legend-user-level {
                font-size: 14px;
              }
        }

        @media (max-width: 480px) {
            .header h1 {
                font-size: 1.5rem;
            }
            .skill-box {
                width: 70px;
                height: 40px;
            }
            .tooltip {
                width: 150px;
            }.legend {
                bottom: 5px;
                right: 5px;
                padding: 8px;
              }

              .legend-item {
                font-size: 10px;
              }

              .legend-dot {
                width: 6px;
                height: 6px;
              }

              .legend-user-level {
                font-size: 12px;
              }
        }
    </style>
</head>
<body>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">
    <script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>

    <div id="toast-container"></div>
    <div id="notifications" style="position: fixed; bottom: 10px; right: 10px; background: #1a1a1a; color: #fff; padding: 10px; border-radius: 5px; max-width: 300px;">
        <h4>Уведомления</h4>
        <ul id="notification-list"></ul>
    </div>
    <div class="header">
        <select id="project-select">
            {% for project in projects %}
            <option value="{{ project }}" {% if project == current_project %}selected{% endif %}>
                {{ project }}
            </option>
            {% endfor %}
        </select>
        <h1>🎮 Cyberpunk Skillz 🤖</h1>
        <button id="reset-button">♻</button>
    </div>

    <!-- Leaderboard Section -->
    <div id="leaderboard-section" style="display: none; margin-top: 20px;">
        <h2 style="color: #ff0000; text-align: center;">🏆 Таблица Лидеров 🏆</h2>
        <div id="leaderboard-content" style="padding: 20px; background-color: #1a1a1a; color: #ffffff;">
            <!-- Leaderboard content will be dynamically populated here -->
        </div>
    </div>

    <div class="skill-tree" id="skillTree"></div>
    <div class="legend">
        <!-- Skill Categories -->
        <div class="legend-item">
            <div class="legend-dot" style="background: white;"></div>
            <span>Настройка проекта</span>
        </div>
        {% if user_level in ['Intermediate', 'Advanced', 'Badass'] %}
        <div class="legend-item">
            <div class="legend-dot" style="background: yellow;"></div>
            <span>Контроль версий</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: blue;"></div>
            <span>Управление базой данных</span>
        </div>
        {% endif %}
        {% if user_level in ['Advanced', 'Badass'] %}
        <div class="legend-item">
            <div class="legend-dot" style="background: {{ colors.cyberpunk.pink }};"></div>
            <span>Развертывание</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: {{ colors.cyberpunk.purple }};"></div>
            <span>Интеграция</span>
        </div>
        {% endif %}
        {% if user_level in ['Badass'] %}
        <div class="legend-item">
            <div class="legend-dot" style="background: {{ colors.cyberpunk.neon }};"></div>
            <span>Продвинутые возможности</span>
        </div>
        {% endif %}

        <!-- V0 Project Link (Visible at Beginner+) -->
        <div class="legend-item legendary">
        <a href="https://v0.dev/chat/cartest-tupabase-template-hdQdrfzkTFA" target="_blank" class="legend-link v0-link">
          <div class="legend-dot" style="background: #ff69b4;"></div>
          <span>V0 Project</span>
        </a>
        </div>

        <!-- GitHub Link (Visible at Intermediate+) -->
        {% if user_level in ['Intermediate', 'Advanced', 'Badass'] %}
        <div class="legend-item legendary">
        <a href="https://github.com/salavey13/carTest" target="_blank" class="legend-link github-link">
          <div class="legend-dot" style="background: {{ colors.cyberpunk.neon }};"></div>
          <span>GitHub</span>
        </a>
        </div>
        {% endif %}

        <!-- Git Status (Visible at Intermediate+) -->
        {% if user_level in ['Intermediate', 'Advanced', 'Badass'] %}
        <div class="legend-item">
        <div class="legend-dot" style="background: {{ git_status_color }};"></div>
        <span>Статус Git: {{ git_status }}</span>
        </div>
        {% endif %}

        <!-- Current User Level -->
        <div class="legend-user-level">
        <span>Ваш уровень: </span>
        <strong class="level-text" data-level="{{ user_level }}">{{ user_level }}</strong>
        </div>
        </div>

    <script>
        var skill_data = {{ skill_data | tojson | safe }};
        console.log(skill_data);
        var colors = {{ colors | tojson | safe }};
        
        var SKILL_DEPENDENCIES = {{ SKILL_DEPENDENCIES | tojson | safe }};

        const CATEGORY_COLORS = {
            "ProjectSetup": colors.cyberpunk.pink,
            "VersionControl": colors.cyberpunk.purple,
            "DatabaseManagement": colors.cyberpunk.neon,
            "Deployment": colors.cyberpunk.pink,
            "Integration": colors.cyberpunk.purple,
            "AdvancedFeatures": colors.cyberpunk.neon,
        };

        const SKILL_CATEGORIES = {
            "Создать папку проекта": "ProjectSetup",
            "Установить Git": "VersionControl",
            "Установить Node.js": "ProjectSetup",
            "Установить VS Code": "ProjectSetup",
            "Установить Notepad++": "ProjectSetup",
            "Клонировать репозиторий": "VersionControl",
            "Применить ZIP обновления": "VersionControl",
            "Создать Pull Request": "VersionControl",
            "Установить Supabase CLI": "DatabaseManagement",
            "Инициализировать Supabase": "DatabaseManagement",
            "Сбросить базу данных Supabase": "DatabaseManagement",
            "Загрузить демо данные Supabase": "DatabaseManagement",
            "Применить custom.sql": "DatabaseManagement",
            "Установить Vercel CLI": "Deployment",
            "Настроить Vercel": "Deployment",
            "Синхронизировать переменные окружения": "Deployment",
            "Настроить Telegram бот": "Integration",
            "Установить Webhook": "Integration",
            "Показать таблицу лидеров": "AdvancedFeatures",
            "Генерировать вложения": "AdvancedFeatures",
        };
            
        // Function to determine particle color based on skill type and dependencies
        function getParticleColor(skillName, colors) {


            const category = SKILL_CATEGORIES[skillName];
            const dependencies = SKILL_DEPENDENCIES[skillName] || [];
            if (dependencies.length > 0) {
                const dependencyColors = dependencies.map(dep => CATEGORY_COLORS[SKILL_CATEGORIES[dep]]);
                return blendColors([CATEGORY_COLORS[category], ...dependencyColors]);
            }
            return CATEGORY_COLORS[category] || colors.cyberpunk.neon;
        }

        function blendColors(colors) {
            let r = 0, g = 0, b = 0;
            colors.forEach(color => {
                r += parseInt(color.slice(1, 3), 16);
                g += parseInt(color.slice(3, 5), 16);
                b += parseInt(color.slice(5, 7), 16);
            });
            r = Math.floor(r / colors.length);
            g = Math.floor(g / colors.length);
            b = Math.floor(b / colors.length);
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }

        function createSkillNodes() {
            const fragment = document.createDocumentFragment();
            for (const [skillName, skill] of Object.entries(skill_data)) {
                const node = document.createElement('div');
                node.className = 'skill-node';
                node.style.top = `${skill.position.row * cellSize.height}px`;
                node.style.left = `${skill.position.col * cellSize.width}px`;

                const box = document.createElement('div');
                box.className = `skill-box ${skill.unlocked ? 'unlocked' : 'locked'} ${skill.completed ? 'completed' : ''} ${skill.unlocked && !skill.completed ? 'new-unlocked' : ''}`;
                box.dataset.skill = skillName;
                const category = SKILL_CATEGORIES[skillName];
                if (category) {
                    box.setAttribute('data-category', category);
                }

                // Tooltip
                const createTooltip = (content) => {
                    tooltipContainer.innerHTML = content;
                    tooltipContainer.style.display = 'block';
                };

                const hideTooltip = () => {
                    tooltipContainer.style.display = 'none';
                };

                const showTooltip = (event) => {
                    const tooltipContent = `
                        <div style="color: ${colors.cyberpunk.neon}; margin-bottom: 10px;">
                            ${skill.label} (${skill.unlocked ? '✨ ДОСТУПНО' : '🔒 ЗАБЛОКИРОВАНО'})
                        </div>
                        <div>${skill.description}</div>
                        <div>(${skill.name})</div>
                        ${skill.dependencies && skill.dependencies.length > 0 ? `
                            <div style="margin-top: 10px; color: ${colors.cyberpunk.neon};">
                                Требуется:
                                <ul style="margin: 5px 0; padding-left: 20px;">
                                    ${skill.dependencies.map(dep => `<li>${dep}</li>`).join('')}
                                </ul>
                            </div>` : ''
                        }
                    `;
                    
                    createTooltip(tooltipContent);
                    
                    // Position tooltip relative to mouse cursor but adjust for screen boundaries
                    const tooltipRect = tooltipContainer.getBoundingClientRect();
                    const screenWidth = window.innerWidth;
                    const screenHeight = window.innerHeight;
                    let left = event.clientX + 10;
                    let top = event.clientY + 10;

                    if (left + tooltipRect.width > screenWidth) {
                        left = screenWidth - tooltipRect.width - 10;
                    }
                    if (top + tooltipRect.height > screenHeight) {
                        top = screenHeight - tooltipRect.height - 10;
                    }

                    tooltipContainer.style.left = `${left}px`;
                    tooltipContainer.style.top = `${top}px`;
                };

                // Event listeners for showing and hiding tooltips
                box.addEventListener('mouseenter', showTooltip);
                box.addEventListener('mouseleave', hideTooltip);
                box.addEventListener('touchstart', showTooltip);
                box.addEventListener('touchend', hideTooltip);

                // Skill icon & label
                const icon = document.createElement('div');
                icon.className = 'skill-icon';
                icon.innerHTML = skill.icon;

                const label = document.createElement('div');
                label.className = 'skill-label';
                label.innerText = skill.label;
                
                // Assemble elements
                box.appendChild(icon);
                box.appendChild(label);
                node.appendChild(box);
                fragment.appendChild(node);
                
                
            }
            document.querySelector('.skill-tree').appendChild(fragment);
        }

        function redrawConnectionsAndParticles() {
            const container = document.querySelector('.skill-tree');
            document.querySelectorAll('.skill-connection, .particle').forEach(el => el.remove());

            for (const [skillName, skill] of Object.entries(skill_data)) {
                if (skill.dependencies.length > 0) {
                    skill.dependencies.forEach(depName => {
                        const depSkill = skill_data[depName];
                        if (!depSkill) return;

                        const skillNode = document.querySelector(`.skill-box[data-skill="${skillName}"]`);
                        const depSkillNode = document.querySelector(`.skill-box[data-skill="${depName}"]`);

                        if (skillNode && !skillNode.classList.contains('invisible') && depSkillNode && !depSkillNode.classList.contains('invisible')) {
                            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                            svg.setAttribute("class", `skill-connection ${!skill.unlocked ? 'dimmed' : 'active'}`);
                            svg.style.position = "absolute";
                            svg.style.left = "0";
                            svg.style.top = "0";
                            svg.style.width = "100%";
                            svg.style.height = "100%";
                            svg.style.overflow = "visible";

                            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

                            const x1 = (depSkill.position.col + 0.5) * cellSize.width;
                            const y1 = (depSkill.position.row + 0.5) * cellSize.height;
                            const x2 = (skill.position.col + 0.5) * cellSize.width;
                            const y2 = (skill.position.row + 0.5) * cellSize.height;

                            const cp1x = x1 + (x2 - x1) * 0.3 + Math.random() * 50 - 25;
                            const cp1y = y1 + (y2 - y1) * 0.3 + Math.random() * 50 - 25;
                            const cp2x = x2 - (x2 - x1) * 0.3 + Math.random() * 50 - 25;
                            const cp2y = y2 - (y2 - y1) * 0.3 + Math.random() * 50 - 25;

                            path.setAttribute("d", `M ${x1},${y1} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`);
                            path.setAttribute("stroke", "url(#gradientStroke)");
                            path.setAttribute("stroke-width", "2");
                            path.setAttribute("fill", "none");
                            path.setAttribute("stroke-linecap", "round");

                            svg.appendChild(path);
                            container.appendChild(svg);

                            const particleCount = 10;
                            for (let i = 0; i < particleCount; i++) {
                                const particle = document.createElement('div');
                                particle.className = 'particle';
                                particle.style.left = `${x1}px`;
                                particle.style.top = `${y1}px`;
                                particle.style.background = getParticleColor(skillName, colors);
                                particle.style.animationDelay = `${Math.random() * 2}s`;

                                const dx = x2 - x1;
                                const dy = y2 - y1;
                                const jitterX = Math.random() * 30 - 15;
                                const jitterY = Math.random() * 30 - 15;

                                particle.style.setProperty('--end-x', `${dx + jitterX}px`);
                                particle.style.setProperty('--end-y', `${dy + jitterY}px`);

                                container.appendChild(particle);
                            }
                        }
                    });
                }
            }
        }

        function updateSkillVisibility() {
            for (const [skillName, skill] of Object.entries(skill_data)) {
                const skillNode = document.querySelector(`.skill-box[data-skill="${skillName}"]`);
                const allDependenciesCompleted = skill.dependencies.every(dep => skill_data[dep].completed);

                if (skill.dependencies.length > 0 && !allDependenciesCompleted) {
                    if (skill.dependencies.some(dep => skill_data[dep].completed)) {
                        skillNode.classList.remove('invisible');
                        skillNode.classList.add('locked');
                    } else {
                        skillNode.classList.add('invisible');
                    }
                } else {
                    skillNode.classList.remove('invisible');
                    if (skill.unlocked && !skill.completed) {
                        skillNode.classList.add('new-unlocked');
                    } else {
                        skillNode.classList.remove('new-unlocked');
                    }
                }
            }
        }

        function drawSkillTree() {
            const gridSize = { rows: 11, cols: 11 };
            cellSize = { width: window.innerWidth / gridSize.cols, height: window.innerHeight / gridSize.rows };

            createSkillNodes();
            redrawConnectionsAndParticles();
            updateSkillVisibility();

            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
            gradient.setAttribute("id", "gradientStroke");
            gradient.setAttribute("x1", "0%");
            gradient.setAttribute("y1", "0%");
            gradient.setAttribute("x2", "100%");
            gradient.setAttribute("y2", "0%");

            ["{{ colors.cyberpunk.neon }}", "{{ colors.cyberpunk.purple }}", "{{ colors.cyberpunk.pink }}"].forEach((color, index) => {
                const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
                stop.setAttribute("offset", `${index / 2 * 100}%`);
                stop.setAttribute("stop-color", color);
                gradient.appendChild(stop);
            });

            defs.appendChild(gradient);
            document.querySelector('.skill-tree').appendChild(defs);

            // Handle window resize events to redraw the skill tree
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    cellSize.width = window.innerWidth / gridSize.cols;
                    cellSize.height = window.innerHeight / gridSize.rows;
                    redrawConnectionsAndParticles();
                }, 200);
            });
        }

        function setUserLevelBackground(level) {
            document.body.setAttribute('data-level', level);
        }

        // Tooltip setup
        let currentTooltip = null;
        const tooltipContainer = document.createElement('div');
        tooltipContainer.className = 'tooltip';
        document.body.appendChild(tooltipContainer);

        drawSkillTree();
        setUserLevelBackground("{{ user_level }}"); // Replace with actual user level

        // Function to fetch and display leaderboard data
        async function fetchLeaderboard() {
            try {
                const response = await fetch('/api/leaderboard');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                const leaderboardContent = document.getElementById('leaderboard-content');
                leaderboardContent.innerHTML = ''; // Clear previous content

                if (data.length === 0) {
                    leaderboardContent.innerHTML = '<p>Таблица лидеров пуста.</p>';
                    return;
                }

                data.forEach((entry, index) => {
                    const entryDiv = document.createElement('div');
                    entryDiv.style.marginBottom = '10px';
                    entryDiv.innerHTML = `
                        <strong>${index + 1}. ${entry.nickname} (${entry.user_id})</strong> - ${entry.total_time} секунд<br>
                        <span style="color: #8e44ad;">🏆 Достижения: ${entry.achievements.join(', ')}</span>
                    `;
                    leaderboardContent.appendChild(entryDiv);
                });

                // Show the leaderboard section
                document.getElementById('leaderboard-section').style.display = 'block';
            } catch (error) {
                console.error('Failed to fetch leaderboard:', error);
                showToast('Не удалось загрузить таблицу лидеров', 'error');
            }
        }

        const eventSource = new EventSource('/stream');

        eventSource.onmessage = function(event) {
            console.log('Received SSE:', event.data);
        };

        eventSource.addEventListener('progress', function(event) {
            const data = JSON.parse(event.data);
            const message = data.message;
            const progress = data.progress;

            if (progress === -1) {
                showToast(message, 'error');
            } else if (progress === 100) {
                showToast(message, 'success');
            } else if (progress >= 0) {
                showToast(message, 'info');
            }
        });

        eventSource.onerror = function() {
            showToast('Ошибка при получении обновлений прогресса.', 'error');
            eventSource.close();
        };

        // Ensure showToast uses cyberpunk colors
        function showToast(message, type = "info") {
            const tcolors = {
                info: colors.cyberpunk.neon,
                success: colors.cyberpunk.pink,
                error: colors.cyberpunk.purple,
                warning: colors.cyberpunk.neon
            };
            Toastify({
                text: message,
                duration: 2000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: tcolors[type] || colors.cyberpunk.neon,
            }).showToast();
        }

        function executeSkill(skillName) {
            fetch(`/execute/?skill=${encodeURIComponent(skillName)}&project=${encodeURIComponent('{{ current_project }}')}`, { method: 'GET' })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 400) {
                            return response.json().then(data => {
                                throw new Error(data.message || 'Ошибка выполнения навыка');
                            });
                        }
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    showToast(data.message || 'Навык выполнен!', 'success');
                    if (data.refresh) {
                        setTimeout(() => {
                            location.reload();
                        }, 5000); // Increased delay to ensure all progress toasts are seen
                    }
                    updateSkillVisibility();
                })
                .catch(error => {
                    let toastType = 'error';
                    if (error.message.includes('уже был освоен ранее')) {
                        toastType = 'info';
                    }
                    showToast(error.message, toastType);
                });
        }

        function handleSkill(skillBox) {
            const skillName = skillBox.dataset.skill;
            const isLocked = skillBox.classList.contains('locked');

            if (isLocked) {
                showToast('Сначала изучите необходимые навыки!', 'info');
                return;
            }

            executeSkill(skillName, "{{ current_project }}"); // Pass current_project from template
        }

        document.querySelectorAll('.skill-box').forEach(box => {
            box.addEventListener('click', () => handleSkill(box));
        });

        document.getElementById('project-select').addEventListener('change', function() {
            window.location.href = '/?project=' + this.value;
        });

        document.getElementById('reset-button').addEventListener('click', function() {
            if (confirm('Сбросить весь прогресс и начать заново?')) {
                fetch('/reset_progress')
                    .then(response => response.json())
                    .then(data => {
                        if (data.message) {
                            alert(data.message);
                        }
                        location.reload();
                    });
            }
        });
    </script>
</body>
</html>
'''
HTML_TEMPLATE_orig = '''
<!DOCTYPE html>
<html>
<head>
    <title>🎮 Cyberpunk Skillz 🤖</title>
    <style>
        body {
            background: radial-gradient(circle,  {{ colors.cyberpunk.purple }}, #000000);
            color: white;
            font-family: 'Segoe UI', sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
        .skill-tree {
            position: relative;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
        }
        .skill-node {
            position: absolute;
            width: 113px;
            height: 69px;
            cursor: pointer;
            touch-action: none;
        }
        .skill-box {
            width: 100%;
            height: 100%;
            background: linear-gradient(145deg, #ff6f61, #ff1493);
            border: 2px solid #ff1493;
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 10px rgba(255, 20, 147, 0.8);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .skill-box.unlocked {
            background: linear-gradient(145deg, #006900, #00ffff);
            border-color: #00ffff;
            box-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
        }
        .header {
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            padding: 13px;
            border-bottom: 2px solid {{ colors.cyberpunk.purple }};
            display: flex;
            align-items: center;
            gap: 20px;
            width: 100%;
            justify-content: space-around;
            z-index: 10;
        }
        .header h1 {
            text-align: center;
            font-size: 3rem;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 1rem;
            background: linear-gradient(90deg, {{ colors.cyberpunk.neon }}, {{ colors.cyberpunk.pink }});
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        #project-select, #reset-button, #close-button {
            background: rgba(0, 0, 0, 0.5);
            color: {{ colors.cyberpunk.neon }};
            border: 2px solid {{ colors.cyberpunk.neon }};
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        #reset-button {
            background: rgba(0, 0, 0, 0.5);
            color: {{ colors.cyberpunk.pink }};
            border: 2px solid {{ colors.cyberpunk.pink }};
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.3rem;
        }
        #project-select:hover, #reset-button:hover , #close-button:hover {
            box-shadow: 0 0 20px {{ colors.cyberpunk.neon }};
        }
        #reset-button:hover , #close-button:hover {
            box-shadow: 0 0 20px {{ colors.cyberpunk.pink }};
        }
        .container {
            width: 95%;
            max-width: 1200px;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        
        .skill-box.locked {
            background: linear-gradient(45deg, rgba(255, 255, 0, 0.05), rgba(0, 0, 0, 0.9));
            border: 2px solid {{ colors.btn }};
        }
        .skill-box.unlocked {
            background: linear-gradient(45deg, rgba(0, 69, 0, 0.05), rgba(148, 0, 211, 0.9));
        }
        .skill-box.completed {
            background: linear-gradient(45deg, rgba(0, 142, 0, 0.05), rgba(148, 0, 211, 0.9));
            border: 2px solid lime;
        }
        .skill-box.new-unlocked {
            transform: scale(1.13); /* Enlarge new unlocked skills */
            box-shadow: 0 0 20px {{ colors.cyberpunk.neon }};
            animation: pulse 2s infinite;
        }
        .skill-box:hover {
            transform: scale(1.1) rotate(2deg);
            box-shadow: 0 0 20px {{ colors.cyberpunk.purple }};
        }
        .skill-icon {
            font-size: 1.5em;
            margin-bottom: 5px;
        }
        .skill-label {
            font-size: 1rem;
            text-align: center;
        }
        .skill-connection {
            position: absolute;
            width: 2px;
            border-radius: 1px;
            
            z-index: -2;
        }
        .skill-connection.dimmed {
            opacity: 0.42;

        }
        .particle {
            position: absolute;
            width: 1px;
            height: 1px;
            border-radius: 50%;
            animation: moveParticle 3s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
        }
        @keyframes moveParticle {
            0% { transform: translate(0, 0); opacity: 1; }
            100% { transform: translate(var(--end-x), var(--end-y)); opacity: 1; }
        }
        .legend {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border-radius: 10px;
            display: flex;
            gap: 10px;
            align-items: center;

        }
        .legend-item {
                        
                         
            display: flex;
                                   
            align-items: center;
            gap: 5px;
        }
        .legend-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        .skill-connection.active {
            opacity: 0.9;
            animation: pulse 2s infinite;
        }

        .skill-box:hover .tooltip {
            display: block;
        }
        @media (max-width: 1024px) {
            h1 {
                font-size: 2rem;
            }

        }
        @media (max-width: 600px) {
            .header h1 {
                font-size: 1.4rem;
            }
        }
        /* Dark Mode Enhancements */
        .skill-box {
            background: linear-gradient(145deg, #4b0082, #8a2be2);
            border-color: #8a2be2;
            box-shadow: 0 0 10px rgba(138, 43, 226, 0.8);
        }

        .skill-box:hover {
            box-shadow: 0 0 15px rgba(138, 43, 226, 1);
                               
                                         
                                                          
                          
                                
                         
                         
                      
                                         
                        
        }
        .skill-box.unlocked:hover {
            box-shadow: 0 0 15px rgba(50, 205, 50, 1);
        }

        .particle {
            background: {{ colors.cyberpunk.neon }};
                                                                    
                         
             
                        
                                  
             
        }
        .tooltip {
            display: none;
            position: absolute;
            background: rgba(0, 0, 0, 1);
            border: 2px solid {{ colors.cyberpunk.neon }};
            padding: 15px;
            border-radius: 16px;
            width: 250px;
            bottom: -13%;
            left: 50%;
            transform: translateX(-100%);
            z-index: 10;
        }
    </style>
</head>
<body>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">
    <script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>

    <div id="toast-container"></div>
    <div id="notifications" style="position: fixed; bottom: 10px; right: 10px; background: #1a1a1a; color: #fff; padding: 10px; border-radius: 5px; max-width: 300px;">
        <h4>Уведомления</h4>
        <ul id="notification-list"></ul>
    </div>
    <div class="header">
        <select id="project-select">
            {% for project in projects %}
            <option value="{{ project }}" {% if project == current_project %}selected{% endif %}>
                {{ project }}
            </option>
            {% endfor %}
        </select>
        <h1>🎮 Cyberpunk Skillz 🤖</h1>
        <button id="reset-button">♻</button>
        
    </div>
    
    <!-- Leaderboard Section -->
    <div id="leaderboard-section" style="display: none; margin-top: 20px;">
        <h2 style="color: #ff0000; text-align: center;">🏆 Таблица Лидеров 🏆</h2>
        <div id="leaderboard-content" style="padding: 20px; background-color: #1a1a1a; color: #ffffff;">
            <!-- Leaderboard content will be dynamically populated here -->
        </div>
    </div>
    
    
    <div class="skill-tree" id="skillTree">
        
    </div>
    <div class="legend">
        <div class="legend-item">
            <div class="legend-dot" style="background:  white;"></div>
            <span>Настройка проекта</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: yellow;"></div>
            <span>Контроль версий</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: blue;"></div>
            <span>Управление базой данных</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: {{ colors.cyberpunk.pink }};"></div>
            <span>Развертывание</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: {{ colors.cyberpunk.purple }};"></div>
            <span>Интеграция</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: {{ colors.cyberpunk.neon }};"></div>
            <span>Продвинутые возможности</span>
        </div>
        <!-- Git Status for Intermediate and Above -->
        {% if user_level in ['Intermediate', 'Advanced', 'Badass'] %}
        <div class="legend-item">
            <div class="legend-dot" style="background: {{ git_status_color }};"></div>
            <span>Статус Git: {{ git_status }}</span>
        </div>
        {% endif %}
        <!-- Current User Level -->
        <div>
            Ваш текущий уровень: <strong>{{ user_level }}</strong>
        </div>
    </div>

    <script>
        var skill_data = {{ skill_data | tojson | safe }};
        console.log(skill_data);
        var colors = {{ colors | tojson | safe }};
        
        /**
         * Function to determine particle color based on skill type and dependencies.
         */
        function getParticleColor(skillName, colors) {
            return "cyan"; // Default to white text color
            // Define base colors for skill categories using the passed `colors` object
            const CATEGORY_COLORS = {
                "ProjectSetup": colors.cyberpunk.pink, // Pink (Project setup)
                "VersionControl": colors.cyberpunk.purple, // Purple (Git-related)
                "DatabaseManagement": colors.cyberpunk.neon, // Cyan (Supabase-related)
                "Deployment": colors.cyberpunk.pink, // Pink (Vercel-related)
                "Integration": colors.cyberpunk.purple, // Purple (Telegram/Webhook-related)
                "AdvancedFeatures": colors.cyberpunk.neon, // Cyan (Embeddings/Leaderboard)
            };

            // Map skills to their categories based on SKILL_DEPENDENCIES
            const SKILL_CATEGORIES = {
                "Создать папку проекта": "ProjectSetup",
                "Установить Git": "VersionControl",
                "Установить Node.js": "ProjectSetup",
                "Установить VS Code": "ProjectSetup",
                "Установить Notepad++": "ProjectSetup",
                "Клонировать репозиторий": "VersionControl",
                "Применить ZIP обновления": "VersionControl",
                "Создать Pull Request": "VersionControl",
                "Установить Supabase CLI": "DatabaseManagement",
                "Инициализировать Supabase": "DatabaseManagement",
                "Сбросить базу данных Supabase": "DatabaseManagement",
                "Загрузить демо данные Supabase": "DatabaseManagement",
                "Применить custom.sql": "DatabaseManagement",
                "Установить Vercel CLI": "Deployment",
                "Настроить Vercel": "Deployment",
                "Синхронизировать переменные окружения": "Deployment",
                "Настроить Telegram бот": "Integration",
                "Установить Webhook": "Integration",
                "Показать таблицу лидеров": "AdvancedFeatures",
                "Генерировать вложения": "AdvancedFeatures",
            };

            // Get the category of the skill
            const category = SKILL_CATEGORIES[skillName];

            // If the skill has dependencies, blend its color with the dependencies' colors
            const dependencies = SKILL_DEPENDENCIES[skillName] || [];
            if (dependencies.length > 0) {
                const dependencyColors = dependencies.map(dep => CATEGORY_COLORS[SKILL_CATEGORIES[dep]]);
                return blendColors([CATEGORY_COLORS[category], ...dependencyColors]);
            }

            // Default to the category color if no dependencies
            return CATEGORY_COLORS[category] || colors.fg; // Default to white text color
        }

        function blendColors(colors) {
            let r = 0, g = 0, b = 0;
            colors.forEach(color => {
                r += parseInt(color.slice(1, 3), 16);
                g += parseInt(color.slice(3, 5), 16);
                b += parseInt(color.slice(5, 7), 16);
            });
            r = Math.floor(r / colors.length);
            g = Math.floor(g / colors.length);
            b = Math.floor(b / colors.length);
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }
        
        function drawSkillTree() {
            
            const container = document.querySelector('.skill-tree');
            // Clear existing connections and particles
            //document.querySelectorAll('.skill-node, skill-box, skill-icon, skill-label').forEach(el => el.remove());
            const gridSize = { rows: 11, cols: 11 };
            const cellSize = { width: window.innerWidth / gridSize.cols, height: window.innerHeight / gridSize.rows };

            // Create nodes
            for (const [skillName, skill] of Object.entries(skill_data)) {  
                const node = document.createElement('div');
                node.className = 'skill-node';
                node.style.top = `${skill.position.row * cellSize.height}px`;
                node.style.left = `${skill.position.col * cellSize.width}px`;

                const box = document.createElement('div');
                box.className = `skill-box ${skill.unlocked ? 'unlocked' : 'locked'} ${skill.completed ? 'completed' : ''} ${skill.unlocked && !skill.completed ? 'new-unlocked' : ''} data-skill=${ skill.name }`;
                box.dataset.skill = skillName;

                // Create tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                tooltip.innerHTML = `
                    <div style="color: ${colors.cyberpunk.neon}; margin-bottom: 10px;">
                        ${skill.label} (${skill.unlocked ? '✨ ДОСТУПНО' : '🔒 ЗАБЛОКИРОВАНО'})
                    </div>
                    <div>${skill.description}</div>
                    ${skill.dependencies && skill.dependencies.length > 0 ? `
                        <div style="margin-top: 10px; color: ${colors.cyberpunk.neon};">
                            Требуется:
                            <ul style="margin: 5px 0; padding-left: 20px;">
                                ${skill.dependencies.map(dep => `<li>${dep}</li>`).join('')}
                            </ul>
                        </div>` : ''
                    }
                `;           
                                                                              
                // Create skill icon & label
                const icon = document.createElement('div');
                icon.className = 'skill-icon';
                icon.innerHTML = skill.icon;

                const label = document.createElement('div');
                label.className = 'skill-label';
                label.innerText = skill.label;

                // Assemble elements
                box.appendChild(tooltip);
                box.appendChild(icon);
                box.appendChild(label);
                node.appendChild(box);
                container.appendChild(node);
                                                  

                // Make nodes draggable
                let isDragging = false;
                let offsetX, offsetY;
                                                                                              
                      
                                             
                                          
                                                

                const startDrag = (e) => {
                    e.dataTransfer.setData('text/plain', e.target.textContent);
                    isDragging = true;
                    const rect = node.getBoundingClientRect();
                    offsetX = e.touches ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
                    offsetY = e.touches ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
                    box.classList.add('dragging');
                };

                const moveDrag = (e) => {
                    if (!isDragging) return;
                    const x = e.touches ? e.touches[0].clientX - offsetX : e.clientX - offsetX;
                    const y = e.touches ? e.touches[0].clientY - offsetY : e.clientY - offsetY;

                    // Snap to grid
                    const gridX = Math.round(x / cellSize.width) * cellSize.width;
                    const gridY = Math.round(y / cellSize.height) * cellSize.height;
                                                                                                       
                                                                                                     
                                                      
                      

                    node.style.left = `${gridX}px`;
                    node.style.top = `${gridY}px`;
                                                                                                   
                                                                                                   

                    // Update skill position
                    skill.position.col = Math.round(gridX / cellSize.width);
                    skill.position.row = Math.round(gridY / cellSize.height);

                    // Redraw connections and particles
                    redrawConnectionsAndParticles();
                };

                const endDrag = () => {
                    isDragging = false;
                    box.classList.remove('dragging');
                };

                box.addEventListener('mousedown', startDrag);
                box.addEventListener('touchstart', startDrag);
                      

                document.addEventListener('mousemove', moveDrag);
                document.addEventListener('touchmove', moveDrag);
                                                         
                      

                                                                 
                                                                  
                                                                     
                document.addEventListener('mouseup', endDrag);
                                                                  
                document.addEventListener('touchend', endDrag);

            }
            /**
             * Function to redraw connections and particles between skills.
             */
            function redrawConnectionsAndParticles() {
                // Clear existing connections and particles
                document.querySelectorAll('.skill-connection, .particle').forEach(el => el.remove());

                // Redraw connections and particles
                for (const [skillName, skill] of Object.entries(skill_data)) {
                    if (skill.dependencies.length > 0) {
                        skill.dependencies.forEach(depName => {
                            const depSkill = skill_data[depName];
                            if (!depSkill) return;

                            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                            svg.setAttribute("class", `skill-connection ${!skill.unlocked ? 'dimmed' : ''}`);
                            svg.style.position = "absolute";
                            svg.style.left = "0";
                            svg.style.top = "0";
                            svg.style.width = "100%";
                            svg.style.height = "100%";
                            svg.style.overflow = "visible";

                            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

                            // Calculate connection points
                            const x1 = (depSkill.position.col + 0.5) * cellSize.width;
                            const y1 = (depSkill.position.row + 0.5) * cellSize.height;
                            const x2 = (skill.position.col + 0.5) * cellSize.width;
                            const y2 = (skill.position.row + 0.5) * cellSize.height;

                            // Add slight randomness for curved lines
                            const cp1x = x1 + (x2 - x1) * 0.3 + Math.random() * 50 - 25;
                            const cp1y = y1 + (y2 - y1) * 0.3 + Math.random() * 50 - 25;
                            const cp2x = x2 - (x2 - x1) * 0.3 + Math.random() * 50 - 25;
                            const cp2y = y2 - (y2 - y1) * 0.3 + Math.random() * 50 - 25;

                            path.setAttribute("d", `M ${x1},${y1} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`);
                            path.setAttribute("stroke", "#ff1493"); // Default color
                            path.setAttribute("stroke-width", "1.5");
                            path.setAttribute("fill", "none");
                            path.setAttribute("stroke-linecap", "round");

                            svg.appendChild(path);
                            container.appendChild(svg);

                            // Add animated particles along the connection
                            const particleCount = 20;
                            for (let i = 0; i < particleCount; i++) {
                                const particle = document.createElement('div');
                                particle.className = 'particle';
                                particle.style.left = `${x1}px`;
                                particle.style.top = `${y1}px`;
                                particle.style.background = getParticleColor(skillName);
                                particle.style.animationDelay = `${Math.random() * 2}s`;

                                const dx = x2 - x1;
                                const dy = y2 - y1;
                                const jitterX = Math.random() * 30 - 15; // Random jitter for natural movement
                                const jitterY = Math.random() * 30 - 15;

                                particle.style.setProperty('--end-x', `${dx + jitterX}px`);
                                particle.style.setProperty('--end-y', `${dy + jitterY}px`);

                                container.appendChild(particle);
                            }
                        });
                    }
                }
            }
            
            // Initial creation of connections
            //redrawConnectionsAndParticles();
        
        
            /**
             * Function to determine particle color based on skill type.
             
            function getParticleColorOld(skillName) {
                if (skillName.includes("Git")) return "#ff1493"; // CMYK Magenta
                if (skillName.includes("Supabase")) return "#00ffff"; // CMYK Cyan
                if (skillName.includes("Vercel")) return "#ff6f61"; // CMYK Yellow
                return "#ffffff"; // Default White
            }*/

            // Initial creation of skill nodes and connections
            
            redrawConnectionsAndParticles();

            // Handle window resize events to redraw the skill tree
            window.addEventListener('resize', () => {
                // Recalculate cell size
                cellSize.width = window.innerWidth / gridSize.cols;
                cellSize.height = window.innerHeight / gridSize.rows;

                // Redraw everything
                //drawSkillTree()
                redrawConnectionsAndParticles();
            });
        }
    
    
        drawSkillTree()
        
        
        
        
        
        
        
        
        
        
        // Function to fetch and display leaderboard data
        async function fetchLeaderboard() {
            const response = await fetch('/api/leaderboard');
            const data = await response.json();
            const leaderboardContent = document.getElementById('leaderboard-content');
            leaderboardContent.innerHTML = ''; // Clear previous content

            if (data.length === 0) {
                leaderboardContent.innerHTML = '<p>Таблица лидеров пуста.</p>';
                return;
            }

            data.forEach((entry, index) => {
                const entryDiv = document.createElement('div');
                entryDiv.style.marginBottom = '10px';
                entryDiv.innerHTML = `
                    <strong>${index + 1}. ${entry.nickname} (${entry.user_id})</strong> - ${entry.total_time} секунд<br>
                    <span style="color: #8e44ad;">🏆 Достижения: ${entry.achievements.join(', ')}</span>
                `;
                leaderboardContent.appendChild(entryDiv);
            });

            // Show the leaderboard section
            document.getElementById('leaderboard-section').style.display = 'block';
        }
        
        function showToast(message, type = "info") {
            const colors = {
                info: "#007bff",
                success: "#28a745",
                error: "#dc3545",
                warning: "#ffc107"
            };
            Toastify({
                text: message,
                duration: 3000,
                close: true,
                gravity: "top",
                position: "right",
                backgroundColor: colors[type] || "#007bff",
            }).showToast();
        }
    
        function executeSkill(skillName) {
            fetch(`/execute/?skill=${encodeURIComponent(skillName)}`, { method: 'GET' })
                .then(response => response.json())
                .then(data => {
                    if (data.refresh) {
                        location.reload(); // Refresh the page if needed
                    } else {
                        alert(data.message); // Show a message to the user
                    }
                })
                .catch(error => console.error('Ошибка при выполнении навыка:', error));
        }
        
        function handleSkill(skillBox) {
            const skillName = skillBox.dataset.skill;
            const isLocked = skillBox.classList.contains('locked');

            if (isLocked) {
                alert('Сначала изучите необходимые навыки!');
                return;
            }

            executeSkill(skillName)
        }
        
        

        document.querySelectorAll('.skill-box').forEach(box => {
            box.addEventListener('click', () => handleSkill(box));
        });

        document.getElementById('project-select').addEventListener('change', function() {
            window.location.href = '/?project=' + this.value;
        });

        document.getElementById('reset-button').addEventListener('click', function() {
            if (confirm('Сбросить весь прогресс и начать заново?')) {
                fetch('/reset_progress')
                    .then(response => response.json())
                    .then(data => {
                        if (data.message) {
                            alert(data.message);
                        }
                        location.reload();
                    });
            }
        });

    
    
    
    
    
    
        
        
        
        
    </script>
</body>
</html>
'''
#{/*<button onclick="closeApp()" id="close-button">❌ Закрыть</button>*/}