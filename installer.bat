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

:: ASCII Art
echo.
echo    _|_|_|  _|        _|      _|    _|  _|_|_|    
echo  _|        _|          _|  _|    _|_|        _|  
echo    _|_|    _|            _|        _|    _|_|    
echo        _|  _|            _|        _|        _|  
echo  _|_|_|    _|_|_|_|      _|        _|  _|_|_|    
echo.
echo ============================================
echo       Автоматизированный Установщик by Qwen Bot
echo ============================================

:: Configuration
set TEMP_DIR=%TEMP%\setup_temp
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

:: Download URLs
set GIT_URL=https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe
set NODE_URL=https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi
set PYTHON_URL=https://www.python.org/ftp/python/3.13.2/python-3.13.2-amd64.exe
set NOTEPADPP_URL=https://github.com/notepad-plus-plus/notepad-plus-plus/releases/download/v8.7.6/npp.8.7.6.Installer.x64.exe
set VSCODE_URL=https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user

:: File names
set GIT_FILE=%TEMP_DIR%\Git-Installer.exe
set NODE_FILE=%TEMP_DIR%\Node-Installer.msi
set PYTHON_FILE=%TEMP_DIR%\Python-Installer.exe
set NOTEPADPP_FILE=%TEMP_DIR%\NotepadPP-Installer.exe
set VSCODE_FILE=%TEMP_DIR%\VSCode-Installer.exe

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
    echo Ошибка скачивания %FILE%. Проверьте подключение к интернету или ссылку.
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
call :ProgressBar 15 1
call :DownloadFile "%NODE_URL%" "%NODE_FILE%"
call :ProgressBar 15 2
call :DownloadFile "%PYTHON_URL%" "%PYTHON_FILE%"
call :ProgressBar 15 3

:: Optional Downloads
call :DownloadFile "%NOTEPADPP_URL%" "%NOTEPADPP_FILE%"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Не удалось скачать Notepad++. Продолжаем без него...
)
call :ProgressBar 15 4
call :DownloadFile "%VSCODE_URL%" "%VSCODE_FILE%"
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Не удалось скачать VS Code. Продолжаем без него...
)
call :ProgressBar 15 5

:: Step 3: Install Software Silently
call :InstallSilently "%GIT_FILE%" "/VERYSILENT /NORESTART /NOCANCEL"
call :ProgressBar 15 6
call :InstallSilently "%NODE_FILE%" "/quiet"
call :ProgressBar 15 7
call :InstallSilently "%PYTHON_FILE%" "/quiet InstallAllUsers=1 PrependPath=1"
call :ProgressBar 15 8

:: Optional Installations
if exist "%NOTEPADPP_FILE%" (
    call :InstallSilently "%NOTEPADPP_FILE%" "/S"
) else (
    echo ❌ Notepad++ не установлен. Продолжаем без него...
)
call :ProgressBar 15 9
if exist "%VSCODE_FILE%" (
    call :InstallSilently "%VSCODE_FILE%" "/verysilent /suppressmsgboxes"
) else (
    echo ❌ VS Code не установлен. Продолжаем без него...
)
call :ProgressBar 15 10

:: Step 4: Clone Repository
echo 🛠️ Клонируем репозиторий...
set REPO_URL=https://github.com/salavey13/cartest.git
set REPO_DIR=%PROJECTS_DIR%\cartest
if not exist "%REPO_DIR%" (
    git clone "%REPO_URL%" "%REPO_DIR%"
) else (
    echo Репозиторий уже клонирован.
)
cd "%REPO_DIR%"
call :ProgressBar 15 11

:: Step 5: Install Python Dependencies
echo Устанавливаем зависимости Python...
if exist "%REPO_DIR%\requirements.txt" (
    pip install -r "%REPO_DIR%\requirements.txt"
) else (
    echo ❌ requirements.txt не найден. Продолжаем без установки зависимостей Python.
)
call :ProgressBar 15 12

:: Step 6: Create Desktop Shortcut for Dashboard
echo Создание ярлыка для запуска Dashboard...
set DESKTOP=%USERPROFILE%\Desktop
set SHORTCUT_PATH=%DESKTOP%\Project_Dashboard.lnk
set SCRIPT_PATH=%REPO_DIR%\dashboard.py
echo Set oWS = WScript.CreateObject("WScript.Shell") > CreateShortcut.vbs
echo sLinkFile = "%SHORTCUT_PATH%" >> CreateShortcut.vbs
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> CreateShortcut.vbs
echo oLink.TargetPath = "python" >> CreateShortcut.vbs
echo oLink.Arguments = "%SCRIPT_PATH%" >> CreateShortcut.vbs
echo oLink.WorkingDirectory = "%REPO_DIR%" >> CreateShortcut.vbs
echo oLink.Save >> CreateShortcut.vbs
cscript //nologo CreateShortcut.vbs
del CreateShortcut.vbs
call :ProgressBar 15 13

:: Step 7: Cleanup Temp Files
echo Очистка временных файлов...
rmdir /s /q "%TEMP_DIR%"
call :ProgressBar 15 14

:: Completion Message
echo 🎉 Установка завершена! Используйте ярлык на рабочем столе для запуска Dashboard.
pause
exit /b
