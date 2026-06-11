# claude_telegram.py
import os
import asyncio
import requests
from fastapi import FastAPI, Request

app = FastAPI()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

# Security: Only respond to these chat IDs
ALLOWED_CHAT_IDS = [413553377, 341729406]

async def run_claude_cli(prompt: str) -> str:
    """Runs the claude CLI tool asynchronously and returns the output."""
    try:
        # Run 'claude -p "the user's message"'
        process = await asyncio.create_subprocess_exec(
            "claude.cmd", "-p", prompt,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        stdout_text = stdout.decode().strip()
        stderr_text = stderr.decode().strip()
        
        if process.returncode != 0:
            # Claude prints API errors to stdout, so we combine both to be safe
            return f"⚠️ CLI Error:\n{stdout_text}\n{stderr_text}"
            
        return stdout_text
        
    except Exception as e:
        return f"❌ Server error: {str(e)}"

@app.post("/api/telegramWebhook")
async def telegram_webhook(request: Request):
    data = await request.json()
    
    if "message" in data and "text" in data["message"]:
        chat_id = data["message"]["chat"]["id"]
        user_text = data["message"]["text"]
        
        # Security: Ignore messages from unauthorized users
        if chat_id not in ALLOWED_CHAT_IDS:
            print(f"Ignored message from unauthorized chat_id: {chat_id}")
            return {"ok": True}

        # Ignore commands like /start
        if user_text.startswith('/'):
            return {"ok": True}

        # 1. Run the Claude CLI tool locally
        claude_reply = await run_claude_cli(user_text)
        
        # Telegram has a 4096 character limit, let's truncate if Claude gets too chatty
        if len(claude_reply) > 3900:
            claude_reply = claude_reply[:3900] + "... \n\n(Message truncated)"

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