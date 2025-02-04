@echo off
:: Check for administrative privileges
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Запрашиваю права администратора...
    goto :UACPrompt
) else ( goto :AdminAccess )
:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B
:AdminAccess
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

:: ASCII Art (Razor Scene Group Style with SALAVEY13)
echo.
echo     ________   ________   ________   ________   ________  
echo    /_______/  /_______/  /_______/  /_______/  /_______/  
echo    |  ___  |  |  ___  |  |  ___  |  |  ___  |  |  ___  |  
echo    | /   \ |  | /   \ |  | /   \ |  | /   \ |  | /   \ |  
echo    |/_____\|  |/_____\|  |/_____\|  |/_____\|  |/_____\|  
echo    SALAVEY13 SALAVEY13 SALAVEY13 SALAVEY13 SALAVEY13      
echo.
echo ============================================
echo       Автоматизированный Установщик by Qwen
echo ============================================

:: Configuration
set REPO_URL=https://github.com/salavey13/cartest.git
set PROJECTS_DIR=%USERPROFILE%\Documents\V0_Projects
set REPO_DIR=%PROJECTS_DIR%\cartest
set VERSION_FILE=%REPO_DIR%\VERSION
set V0_DEV_URL=https://v0.dev/chat/fork-of-rastaman-shop-KvYJosUCML9
set VERCEL_URL=https://vercel.com
set SUPABASE_URL=https://supabase.com
set GITHUB_URL=https://github.com/salavey13/cartest

:: Progress Bar Function
:ProgressBar
setlocal enabledelayedexpansion
set /a total=%1
set /a current=%2
set /a percent=current*100/total
set "bar="
for /L %%i in (1,1,50) do (
    if %%i leq !percent!/2 (
        set "bar=!bar!#"
    ) else (
        set "bar=!bar!."
    )
)
echo [%bar%] !percent!%% %TIPS[%current%]%
exit /b

:: Download Function
:DownloadFile
setlocal
set URL=%1
set FILE=%2
echo Скачивание %FILE%...
powershell -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%FILE%'"
if %ERRORLEVEL% NEQ 0 (
    echo Ошибка скачивания %FILE%. Пропускаем...
    exit /b 1
)
exit /b 0

:: Install Function
:InstallSilently
setlocal
set INSTALLER=%1
set ARGS=%2
if not exist "%INSTALLER%" (
    echo Установщик %INSTALLER% не найден. Пропускаем...
    exit /b 1
)
echo Установка %INSTALLER%...
start /wait "" "%INSTALLER%" %ARGS%
if %ERRORLEVEL% NEQ 0 (
    echo Ошибка установки %INSTALLER%. Пропускаем...
    exit /b 1
)
exit /b 0

:: Check if Everything is Already Installed
:CheckInstallation
echo Проверяем установленные компоненты...
where git >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✅ Git уже установлен.
) else (
    echo ❌ Git не установлен. Будет выполнен процесс установки.
    set NEED_INSTALL=1
)

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✅ Node.js уже установлен.
) else (
    echo ❌ Node.js не установлен. Будет выполнен процесс установки.
    set NEED_INSTALL=1
)

if exist "%REPO_DIR%" (
    echo ✅ Репозиторий уже клонирован.
) else (
    echo ❌ Репозиторий не найден. Будет выполнен процесс клонирования.
    set NEED_INSTALL=1
)

if defined NEED_INSTALL (
    echo Необходимо выполнить установку компонентов.
    pause
    goto :MainScript
) else (
    echo Всё уже установлено! Переходим к панели управления...
    goto :Dashboard
)

:: Main Script Execution
:MainScript
echo Начинаем процесс установки...

:: Step 1: Create V0_Projects Folder
if not exist "%PROJECTS_DIR%" (
    echo Создание папки V0_Projects...
    mkdir "%PROJECTS_DIR%"
)
cd /d "%PROJECTS_DIR%"

:: Step 2: Check if Project Exists
if not exist "%REPO_DIR%" (
    echo 🛠️ Репозиторий не найден. Клонируем его...
    git clone "%REPO_URL%" "%REPO_DIR%"
    cd "%REPO_DIR%"
    call :ProgressBar 15 1
) else (
    echo Репозиторий уже на месте. Всё готово!
    cd "%REPO_DIR%"
    call :ProgressBar 15 1
)

:: Step 3: Pull Latest Changes
echo 🔄 Обновляем репозиторий перед применением архива...
git pull origin main
call :ProgressBar 15 2

:: Step 4: Check for ZIP Files in Multiple Locations
echo 🔍 Ищем ZIP-архивы с обновлениями...
setlocal enabledelayedexpansion
set ZIP_COUNT=0
set LATEST_ZIP=
for %%f in ("%REPO_DIR%\*.zip" "%~dp0*.zip" "%USERPROFILE%\Desktop\*.zip") do (
    set /a ZIP_COUNT+=1
    set LATEST_ZIP=%%~nxf
    set LATEST_ZIP_PATH=%%~ff
)

if %ZIP_COUNT% equ 0 (
    echo ⚠️ ZIP-архивов не найдено. Пожалуйста, загрузите архив из бота.
    pause
    explorer "%REPO_DIR%"
    exit /b
)

echo ✅ Найден архив: %LATEST_ZIP%

:: Step 5: Extract and Apply ZIP Updates
if exist "%VERSION_FILE%" (
    for /f "tokens=1-3" %%v in ('type "%VERSION_FILE%"') do (
        set CURRENT_VERSION=%%v
        set LAST_APPLIED_ZIP=%%w
    )
    echo Текущая версия проекта: %CURRENT_VERSION%, последний ZIP: %LAST_APPLIED_ZIP%
) else (
    set CURRENT_VERSION=0
    set LAST_APPLIED_ZIP=
    echo 0 > "%VERSION_FILE%"
)

findstr /c:"%LATEST_ZIP%" "%VERSION_FILE%" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo 🔄 ZIP "%LATEST_ZIP%" уже применён. Проверяем на изменения...
    powershell -Command "Expand-Archive -Force '%LATEST_ZIP_PATH%' -DestinationPath .\temp_unzip"
    for /d %%d in (temp_unzip\*) do set ROOT_UNPACKED_DIR=%%d
    xcopy /s /y "!ROOT_UNPACKED_DIR!\*" "%REPO_DIR%\temp_git_check"
    rmdir /s /q temp_unzip
    git diff --quiet "%REPO_DIR%\temp_git_check" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo 🔄 ZIP "%LATEST_ZIP%" без изменений. Ничего не делаем!
        rmdir /s /q "%REPO_DIR%\temp_git_check"
        pause
        exit /b
    ) else (
        echo ⚠️ ZIP "%LATEST_ZIP%" изменён. Применяем обновления.
    )
    rmdir /s /q "%REPO_DIR%\temp_git_check"
)

echo 🛠️ Распаковываем "%LATEST_ZIP%"...
powershell -Command "Expand-Archive -Force '%LATEST_ZIP_PATH%' -DestinationPath .\temp_unzip"
for /d %%d in (temp_unzip\*) do set ROOT_UNPACKED_DIR=%%d
xcopy /s /y "!ROOT_UNPACKED_DIR!\*" "%REPO_DIR%"
rmdir /s /q temp_unzip

:: Update VERSION File
set /a NEXT_VERSION=%CURRENT_VERSION%+1
echo %NEXT_VERSION% %LATEST_ZIP% > "%VERSION_FILE%"
call :ProgressBar 15 8

:: Step 6: Commit and Push Changes
set COMMIT_MSG="💥 Обновления от %LATEST_ZIP% | Версия %NEXT_VERSION%"
echo ✅ Создаём коммит с сообщением: %COMMIT_MSG%

:: Create a New Branch
set BRANCH_NAME=бот_%DATE:~-4%%DATE:~-7,2%%DATE:~-10,2%_%TIME:~0,2%%TIME:~3,2%
git checkout -b %BRANCH_NAME%
git add .
git commit -m "%COMMIT_MSG%"
call :ProgressBar 15 10

echo 🚀 Отправляем изменения в GitHub...
git push origin %BRANCH_NAME%
call :ProgressBar 15 12

:: Switch Back to Main Branch
git checkout main
git pull origin main
call :ProgressBar 15 13

:: Step 7: Open Pull Request Page
echo Открываем страницу Pull Request в браузере...
start "" "https://github.com/salavey13/cartest/pulls"
call :ProgressBar 15 14

:: Cleanup
echo Очистка временных файлов...
del /q "%LATEST_ZIP_PATH%"
call :ProgressBar 15 15

:: Go to Dashboard
goto :Dashboard

:: Dashboard
:Dashboard
cls
echo.
echo     ________   ________   ________   ________   ________  
echo    /_______/  /_______/  /_______/  /_______/  /_______/  
echo    |  ___  |  |  ___  |  |  ___  |  |  ___  |  |  ___  |  
echo    | /   \ |  | /   \ |  | /   \ |  | /   \ |  | /   \ |  
echo    |/_____\|  |/_____\|  |/_____\|  |/_____\|  |/_____\|  
echo    SALAVEY13 SALAVEY13 SALAVEY13 SALAVEY13 SALAVEY13      
echo.
echo ============================================
echo          ПАНЕЛЬ УПРАВЛЕНИЯ ПРОЕКТОМ
echo ============================================
echo 1. Версия проекта: %NEXT_VERSION%
echo 2. Последний применённый ZIP: %LATEST_ZIP%
echo 3. Статус Git:
git status
echo.
echo ====================== БЫСТРЫЕ ССЫЛКИ ======================
echo [1] Vercel: %VERCEL_URL%
echo [2] Supabase: %SUPABASE_URL%
echo [3] GitHub: %GITHUB_URL%
echo [4] v0.dev Проект: %V0_DEV_URL%
echo [5] Qwen Chat: https://chat.qwenlm.ai
echo [6] Supabase SQL Console: https://app.supabase.com/project/YOUR_PROJECT_ID/sql
echo ============================================================
echo.
echo ====================== ДЕЙСТВИЯ ============================
echo [A] Запустить сборку проекта (npm run build)
echo [B] Запустить локальный сервер разработки (npm run dev)
echo [C] Создать ветку и Pull Request (если есть изменения в Git)
echo [D] Добавить случайные файлы в архив для обновления
echo [E] Открыть полезные ссылки в браузере
echo [F] Выход
echo ============================================================
set /p ACTION="Выберите действие: "

if /i "%ACTION%"=="A" (
    echo Запуск сборки проекта...
    npm run build
    pause
    goto :Dashboard
)

if /i "%ACTION%"=="B" (
    echo Запуск локального сервера разработки...
    npm run dev
    pause
    goto :Dashboard
)

if /i "%ACTION%"=="C" (
    echo Проверяем наличие изменений в Git...
    git diff --quiet
    if %ERRORLEVEL% neq 0 (
        echo ✅ Обнаружены изменения. Создаём новую ветку и Pull Request...
        set BRANCH_NAME=обновление_%DATE:~-4%%DATE:~-7,2%%DATE:~-10,2%_%TIME:~0,2%%TIME:~3,2%
        git checkout -b %BRANCH_NAME%
        git add .
        set /p COMMIT_MSG="Введите сообщение коммита: "
        git commit -m "%COMMIT_MSG%"
        git push origin %BRANCH_NAME%
        start "" "https://github.com/salavey13/cartest/pulls"
    ) else (
        echo ❌ Изменений нет. Нечего коммитить.
    )
    pause
    goto :Dashboard
)

if /i "%ACTION%"=="D" (
    echo Добавляем случайные файлы в архив...
    set /p FILES="Введите имена файлов через пробел (например, file1.txt file2.js): "
    powershell -Command "Compress-Archive -Path %FILES% -DestinationPath '%REPO_DIR%\update.zip' -Force"
    echo Архив создан: update.zip
    pause
    goto :Dashboard
)

if /i "%ACTION%"=="E" (
    echo Открываем полезные ссылки в браузере...
    start "" "%VERCEL_URL%"
    start "" "%SUPABASE_URL%"
    start "" "%GITHUB_URL%"
    start "" "%V0_DEV_URL%"
    start "" "https://chat.qwenlm.ai"
    start "" "https://app.supabase.com/project/YOUR_PROJECT_ID/sql"
    pause
    goto :Dashboard
)

if /i "%ACTION%"=="F" (
    echo До свидания!
    exit /b
)

echo Неверный выбор. Попробуйте снова.
pause
goto :Dashboard
