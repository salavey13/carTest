@echo off
REM setup.bat - Quick setup script for Claude Telegram Bot (Windows)

echo 🚀 Setting up Claude Telegram Bot...

REM Create virtual environment
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔌 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

REM Create .env if it doesn't exist
if not exist ".env" (
    echo 📝 Creating .env from .env.example...
    copy .env.example .env
    echo ⚠️  Please edit .env with your configuration!
)

echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Edit .env with your TELEGRAM_TOKEN and other settings
echo 2. Run: venv\Scripts\activate.bat
echo 3. Run: python app.py
pause
