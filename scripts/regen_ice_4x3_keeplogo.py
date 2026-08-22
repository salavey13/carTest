#!/usr/bin/env python3
"""
Regenerate _4x3 images for ICE (rental) bikes with 'keep logo/watermark' instruction.
Then re-upload to Supabase, download local covers, and sync mirror.
"""
import json, os, time, urllib.request, uuid

KEY = os.environ["KIE_API_KEY"]
SUPA_URL = "https://inmctohsodgdohamhzag.supabase.co"
SUPA_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

ICE_BIKES = [
    "bmw-f800r",
    "kawasaki-ex650k",
    "suzuki-gsx-s1000f",
    "motoland-breakout",
    "nibbler-regumoto-4v",
]

PROMPT_KEEP_LOGO = (
    "Reframe this motorcycle photograph into a wider 4:3 landscape composition. "
    "CRITICAL: Preserve ALL existing text, logos, watermarks, and branding overlays "
    "exactly as they appear in the original image — do not remove, alter, or blur them. "
    "Keep the motorcycle centered with no changes to colour, pose, or details. "
    "Extend the surrounding background naturally on the left and right sides to fill "
    "the wider frame. Photorealistic, no new text, no watermark."
)


def upload_kie(img_bytes, name="frame.jpg"):
    b = "----b" + uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"uploadPath\"\r\n\r\nreference\r\n").encode()
    body += (f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\n"
             f"Content-Type: image/jpeg\r\n\r\n").encode() + img_bytes + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request("https://kieai.redpandaai.co/api/file-stream-upload", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={b}",
                 "Authorization": f"Bearer {KEY}", "User-Agent": UA})
    r = json.loads(urllib.request.urlopen(req, timeout=120).read())
    return (r.get("data") or {}).get("downloadUrl") or r.get("downloadUrl")


def create_task(prompt, image_url, aspect_ratio="4:3"):
    body = json.dumps({"model": "nano-banana-pro", "input": {
        "prompt": prompt, "image_input": [image_url], "aspect_ratio": aspect_ratio}}).encode()
    req = urllib.request.Request("https://api.kie.ai/api/v1/jobs/createTask", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "User-Agent": UA})
    r = json.loads(urllib.request.urlopen(req, timeout=60).read())
    return (r.get("data") or {}).get("taskId")


def poll(task_id, timeout=300, interval=5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        req = urllib.request.Request(f"https://api.kie.ai/api/v1/jobs/recordInfo?taskId={task_id}",
            headers={"Authorization": f"Bearer {KEY}", "User-Agent": UA})
        d = json.loads(urllib.request.urlopen(req, timeout=30).read()).get("data", {})
        st = d.get("state", "?")
        if st == "success":
            rj = d.get("resultJson")
            rj = json.loads(rj) if isinstance(rj, str) else rj
            urls = (rj or {}).get("resultUrls") or []
            if urls:
                return urls[0]
            raise RuntimeError(f"success but no URLs: {d}")
        if st in ("fail", "failed"):
            raise RuntimeError(f"failed: {d}")
        time.sleep(interval)
    raise RuntimeError(f"timeout {timeout}s")


def supa_upload(path, data):
    req = urllib.request.Request(f"{SUPA_URL}/storage/v1/object/carpix/{path}",
        data=data, method="POST",
        headers={"Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "image/jpeg", "x-upsert": "true"})
    urllib.request.urlopen(req, timeout=120).read()


def http_get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()


def main():
    total = len(ICE_BIKES)
    print(f"=== Regen _4x3 with logo preservation: {total} ICE bikes ===\n")
    ok = fail = 0

    for i, bike in enumerate(ICE_BIKES, 1):
        print(f"[{i}/{total}] {bike} …", end=" ", flush=True)
        try:
            src = f"{SUPA_URL}/storage/v1/object/public/carpix/{bike}/image_1.jpg"
            img = http_get(src)
            kie_url = upload_kie(img, f"{bike}.jpg")
            tid = create_task(PROMPT_KEEP_LOGO, kie_url)
            result_url = poll(tid)
            result = http_get(result_url)
            supa_upload(f"{bike}/image_1_4x3.jpg", result)
            print(f"OK ({len(result)//1024} KB)")
            ok += 1
        except Exception as e:
            print(f"FAIL ({e})")
            fail += 1

    print(f"\n=== DONE: {ok} ok, {fail} failed ===")


if __name__ == "__main__":
    main()
