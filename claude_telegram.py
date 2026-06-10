# /claude_telegram.py
import os
import asyncio
import requests
from fastapi import FastAPI, Request

app = FastAPI()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

async def run_claude_cli(prompt: str) -> str:
    """Runs the claude CLI tool asynchronously and returns the output."""
    try:
        # Run 'claude -p "the user's message"'
        process = await asyncio.create_subprocess_exec(
            "claude", "-p", prompt,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            return f"Error running Claude CLI: {stderr.decode()}"
            
        return stdout.decode().strip()
        
    except Exception as e:
        return f"Server error: {str(e)}"

@app.post("/webhook")
async def telegram_webhook(request: Request):
    data = await request.json()
    
    if "message" in data and "text" in data["message"]:
        chat_id = data["message"]["chat"]["id"]
        user_text = data["message"]["text"]
        
        # Optional: Ignore commands like /start
        if user_text.startswith('/'):
            return {"ok": True}

        # 1. Run the Claude CLI tool locally
        claude_reply = await run_claude_cli(user_text)
        
        # 2. Send the result back to Telegram
        requests.post(f"{TELEGRAM_API_URL}/sendMessage", json={
            "chat_id": chat_id,
            "text": claude_reply
        })
        
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    # Run on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)