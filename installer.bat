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

:: ASCII Art (Razor Scene Group Style)
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

:: Create temp directory
set TEMP_DIR=%TEMP%\setup_temp
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

:: Download URLs
set GIT_URL=https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe
set NODE_URL=https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi
set NOTEPADPP_URL=https://github.com/notepad-plus-plus/notepad-plus-plus/releases/download/v8.7.6/npp.8.7.6.Installer.x64.exe
set VSCODE_URL=https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user

:: File names
set GIT_FILE=%TEMP_DIR%\Git-Installer.exe
set NODE_FILE=%TEMP_DIR%\Node-Installer.msi
set NOTEPADPP_FILE=%TEMP_DIR%\NotepadPP-Installer.exe
set VSCODE_FILE=%TEMP_DIR%\VSCode-Installer.exe

:: Tips Array
set TIPS[0]="git pull" - Обновить локальный репозиторий с GitHub
set TIPS[1]="git add ." - Подтвердить изменения для коммита
set TIPS[2]="git commit -m 'сообщение'" - Сохранить изменения в локальном репозитории
set TIPS[3]="git push" - Отправить изменения на GitHub
set TIPS[4]="npm install" - Установить зависимости для Node.js проекта
set TIPS[5]="npm run dev" - Запустить сервер разработки
set TIPS[6]="npm start" - Запустить приложение в продакшене
set TIPS[7]="Notepad++" - Быстрый текстовый редактор для сравнения файлов
set TIPS[8]="VS Code" - Редактор кода с поддержкой Git через интерфейс
set TIPS[9]="скачать.bat" - Скачивает обновления из GitHub (Easter Egg!)
set TIPS[10]="залить.bat" - Отправляет изменения в GitHub (Easter Egg!)

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

:: Main Script Execution
echo Начинаем процесс установки...

:: Step 1: Create V0_Projects Folder
set PROJECTS_DIR=%USERPROFILE%\Documents\V0_Projects
if not exist "%PROJECTS_DIR%" (
    echo Создание папки V0_Projects...
    mkdir "%PROJECTS_DIR%"
)
cd /d "%PROJECTS_DIR%"

:: Step 2: Download Installers
call :DownloadFile "%GIT_URL%" "%GIT_FILE%"
call :ProgressBar 12 1

call :DownloadFile "%NODE_URL%" "%NODE_FILE%"
call :ProgressBar 12 2

call :DownloadFile "%NOTEPADPP_URL%" "%NOTEPADPP_FILE%"
call :ProgressBar 12 3

call :DownloadFile "%VSCODE_URL%" "%VSCODE_FILE%"
call :ProgressBar 12 4

:: Step 3: Install Software Silently
call :InstallSilently "%GIT_FILE%" "/VERYSILENT /NORESTART /NOCANCEL"
call :ProgressBar 12 5

call :InstallSilently "%NODE_FILE%" "/quiet"
call :ProgressBar 12 6

call :InstallSilently "%NOTEPADPP_FILE%" "/S"
call :ProgressBar 12 7

call :InstallSilently "%VSCODE_FILE%" "/verysilent /suppressmsgboxes"
call :ProgressBar 12 8

:: Step 4: Clone GitHub Repository and Run Project
echo Клонирование репозитория GitHub и настройка проекта...
git clone https://github.com/salavey13/cartest.git
cd cartest
call :ProgressBar 12 9

echo Установка зависимостей npm...
npm install
call :ProgressBar 12 10

echo Сборка проекта...
npm run build
call :ProgressBar 12 11

echo Запуск проекта...
start "" cmd.exe /k "npm start"
call :ProgressBar 12 12

:: Step 5: Create Scripts (скачать.bat and залить.bat)
echo Создание скрипта скачать.bat...
echo @echo off > "%PROJECTS_DIR%\скачать.bat"
echo cd /d "%PROJECTS_DIR%\cartest" >> "%PROJECTS_DIR%\скачать.bat"
echo git pull >> "%PROJECTS_DIR%\скачать.bat"

echo Создание скрипта залить.bat...
echo @echo off > "%PROJECTS_DIR%\залить.bat"
echo cd /d "%PROJECTS_DIR%\cartest" >> "%PROJECTS_DIR%\залить.bat"
echo git add . && git commit -m "update" && git push >> "%PROJECTS_DIR%\залить.bat"

:: Easter Egg Tips
echo.
echo ====================== ПАСХАЛЬНЫЕ ЯЙЦА ======================
echo "скачать.bat" - Автоматически скачивает обновления из GitHub!
echo "залить.bat" - Автоматически отправляет изменения в GitHub!
echo ============================================================
echo.

:: Cleanup
echo Очистка временных файлов...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

echo Установка завершена успешно!
pause
