# services/claude.py
"""Claude CLI service with timeout and error handling."""
import asyncio
import logging
from typing import Optional

import sys
from pathlib import Path

# Add parent directory to path for direct execution
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import CLAUDE_BINARY, CLAUDE_TIMEOUT

logger = logging.getLogger(__name__)


class ClaudeService:
    """Service for running the Claude CLI."""

    def __init__(self, binary_path: str = CLAUDE_BINARY, timeout: int = CLAUDE_TIMEOUT):
        self.binary_path = binary_path
        self.timeout = timeout

    async def run(self, prompt: str) -> str:
        """
        Run Claude CLI with the given prompt.

        Returns the CLI output or an error message.
        Raises asyncio.TimeoutError if the process takes too long.
        """
        logger.debug(f"Running Claude with prompt length: {len(prompt)}")

        try:
            process = await asyncio.create_subprocess_exec(
                self.binary_path, "-p", prompt,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            try:
                # Wait with timeout
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=self.timeout
                )
            except asyncio.TimeoutError:
                # Kill the process if it times out
                try:
                    process.kill()
                    await process.wait()
                except Exception:
                    pass
                logger.error(f"Claude process timed out after {self.timeout}s")
                raise

            stdout_text = stdout.decode().strip()
            stderr_text = stderr.decode().strip()

            if process.returncode != 0:
                # Claude prints API errors to stdout, combine both
                error_msg = f"⚠️ Claude Error (exit {process.returncode}):\n{stdout_text}"
                if stderr_text:
                    error_msg += f"\n{stderr_text}"
                logger.warning(f"Claude returned non-zero: {process.returncode}")
                return error_msg

            logger.debug(f"Claude response length: {len(stdout_text)}")
            return stdout_text

        except asyncio.TimeoutError:
            return f"⏱️ Claude timed out after {self.timeout} seconds. Try a shorter prompt."
        except FileNotFoundError:
            logger.error(f"Claude binary not found: {self.binary_path}")
            return f"❌ Claude binary not found: {self.binary_path}\nSet CLAUDE_BINARY env var."
        except Exception as e:
            logger.error(f"Unexpected error running Claude: {e}")
            return f"❌ Server error: {str(e)}"


# Global service instance
_claude_service: Optional[ClaudeService] = None


def get_claude_service() -> ClaudeService:
    """Get or create the global Claude service."""
    global _claude_service
    if _claude_service is None:
        _claude_service = ClaudeService()
    return _claude_service
