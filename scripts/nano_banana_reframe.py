#!/usr/bin/env python3
"""
Nano Banana Pro (Kie.ai) — reframe portrait bike photo to 4:3 landscape via AI outpainting.

Flow:
  1. Download source image from Supabase public URL
  2. Upload to Kie File Upload API (Kie can't fetch external URLs reliably)
  3. Submit nano-banana-pro task with aspect_ratio "4:3"
  4. Poll /api/v1/jobs/recordInfo until state == success
  5. Download result, save to output/visuals/

Usage:
  python3 nano_banana_reframe.py <source_url> <out_path> [aspect_ratio]
"""
import json
import os
import sys
import time
import urllib.request
import uuid

KEY = os.environ.get("KIE_API_KEY")
if not KEY:
    sys.exit("ERROR: KIE_API_KEY not set in env")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
BASE = "https://api.kie.ai"


def upload_to_kie(img_bytes: bytes, filename: str = "frame.jpg") -> str:
    """Upload raw image bytes to Kie File Upload API, return hosted download URL."""
    boundary = "----b" + uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="uploadPath"\r\n\r\nreference\r\n'
    ).encode()
    body += (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + img_bytes + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        "https://kieai.redpandaai.co/api/file-stream-upload",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {KEY}",
            "User-Agent": UA,
        },
    )
    r = json.loads(urllib.request.urlopen(req, timeout=120).read())
    url = (r.get("data") or {}).get("downloadUrl") or r.get("downloadUrl")
    if not url:
        sys.exit(f"Upload failed — response: {r}")
    return url


def create_task(prompt: str, image_url: str, aspect_ratio: str) -> str:
    body = json.dumps(
        {
            "model": "nano-banana-pro",
            "input": {
                "prompt": prompt,
                "image_input": [image_url],
                "aspect_ratio": aspect_ratio,
            },
        }
    ).encode()
    req = urllib.request.Request(
        f"{BASE}/api/v1/jobs/createTask",
        data=body,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "User-Agent": UA,
        },
    )
    r = json.loads(urllib.request.urlopen(req, timeout=60).read())
    tid = (r.get("data") or {}).get("taskId")
    if not tid:
        sys.exit(f"createTask failed — response: {r}")
    return tid


def poll(task_id: str, timeout: int = 600, interval: int = 5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        req = urllib.request.Request(
            f"{BASE}/api/v1/jobs/recordInfo?taskId={task_id}",
            headers={"Authorization": f"Bearer {KEY}", "User-Agent": UA},
        )
        d = json.loads(urllib.request.urlopen(req, timeout=30).read()).get("data", {})
        state = d.get("state", "?")
        print(f"  [{time.strftime('%H:%M:%S')}] state={state}", flush=True)
        if state == "success":
            rj = d.get("resultJson")
            rj = json.loads(rj) if isinstance(rj, str) else rj
            urls = (rj or {}).get("resultUrls") or d.get("resultUrls") or []
            if urls:
                return urls[0]
            sys.exit(f"success but no resultUrls — data: {d}")
        if state in ("fail", "failed"):
            sys.exit(f"Task failed — data: {d}")
        time.sleep(interval)
    sys.exit(f"Timeout after {timeout}s — last state unknown")


def main():
    src = sys.argv[1]
    out = sys.argv[2]
    ratio = sys.argv[3] if len(sys.argv) > 3 else "4:3"

    print(f"[1/5] Downloading source: {src}")
    img = urllib.request.urlopen(
        urllib.request.Request(src, headers={"User-Agent": UA}), timeout=60
    ).read()
    print(f"      {len(img)} bytes")

    print("[2/5] Uploading to Kie File Upload API…")
    kie_url = upload_to_kie(img)
    print(f"      Kie URL: {kie_url}")

    prompt = (
        "Reframe this motorcycle photograph into a wider 4:3 landscape composition. "
        "Keep the motorcycle and any rider exactly as they appear, centered, with no "
        "changes to colour, pose, lighting, or details. Extend the surrounding background "
        "naturally on the left and right sides to fill the wider frame — same environment, "
        "same floor/ground, same lighting and atmosphere, seamless blending at the original "
        "image boundaries. Photorealistic, no text, no watermark, no distortion."
    )

    print(f"[3/5] Submitting nano-banana-pro task (aspect_ratio={ratio})…")
    tid = create_task(prompt, kie_url, ratio)
    print(f"      taskId: {tid}")

    print("[4/5] Polling for result…")
    result_url = poll(tid)
    print(f"      Result: {result_url}")

    print(f"[5/5] Downloading → {out}")
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    data = urllib.request.urlopen(
        urllib.request.Request(result_url, headers={"User-Agent": UA}), timeout=120
    ).read()
    with open(out, "wb") as f:
        f.write(data)
    print(f"      Saved {len(data)} bytes → {out}")
    print("\nDONE.")


if __name__ == "__main__":
    main()
