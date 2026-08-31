#!/usr/bin/env bash
# audio-transcribe: Deepgram Nova-3 transcription with speaker diarization
# Usage: ./transcribe.sh <file> [language=ru]
set -euo pipefail

INPUT_FILE="${1:?Usage: transcribe.sh <file> [language]}"
LANG="${2:-ru}"
API_KEY="${DEEPGRAM_API_KEY:?Set DEEPGRAM_API_KEY env var}"

# ── Проверки ────────────────────────────────────────────────────────────────
command -v ffmpeg  >/dev/null 2>&1 || { echo "ERROR: ffmpeg not found. Run: brew install ffmpeg"; exit 1; }
command -v ffprobe >/dev/null 2>&1 || { echo "ERROR: ffprobe not found. Run: brew install ffmpeg"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 not found"; exit 1; }
[[ -f "$INPUT_FILE" ]] || { echo "ERROR: File not found: $INPUT_FILE"; exit 1; }

BASENAME=$(basename "$INPUT_FILE")
DIRNAME=$(dirname "$INPUT_FILE")
STEM="${BASENAME%.*}"
EXT="${BASENAME##*.}"
EXT=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')
OUT_MD="${DIRNAME}/${STEM}-transcript.md"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== audio-transcribe ==="
echo "File   : $INPUT_FILE"
echo "Output : $OUT_MD"
echo "Lang   : $LANG"
echo ""

# ── Шаг 1: Длительность через ffprobe ───────────────────────────────────────
DURATION=$(ffprobe -v quiet -print_format json -show_format "$INPUT_FILE" 2>/dev/null \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('format',{}).get('duration','0'))")
DURATION_INT=${DURATION%.*}
DURATION_INT=${DURATION_INT:-0}
echo "Duration: ${DURATION_INT}s ($(( DURATION_INT / 60 )) min)"

# ── Шаг 2: Конвертация в MP3 если нужно ─────────────────────────────────────
# ПРАВИЛО: все видео-форматы (включая webm) сначала конвертируются в MP3,
# и только потом отправляются в Deepgram. Это стабильнее чем webm/opus напрямую
# и даёт пользователю промежуточный mp3 для прослушивания/архива.
NEEDS_CONVERT=0
case "$EXT" in
  mp4|mkv|avi|mov|wmv|flv|webm) NEEDS_CONVERT=1 ;;
esac
if [[ $DURATION_INT -gt 5400 ]]; then NEEDS_CONVERT=1; fi

AUDIO_FILE="$INPUT_FILE"
CONTENT_TYPE=""

if [[ $NEEDS_CONVERT -eq 1 ]]; then
  echo "Converting video → MP3 (моно 16kHz 64kbps)..."
  AUDIO_FILE="${DIRNAME}/${STEM}.mp3"
  ffmpeg -i "$INPUT_FILE" \
    -vn -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k \
    -y "$AUDIO_FILE" 2>/dev/null
  echo "MP3 saved: $AUDIO_FILE ($(du -sh "$AUDIO_FILE" | cut -f1))"
  CONTENT_TYPE="audio/mpeg"
else
  case "$EXT" in
    ogg|opus)   CONTENT_TYPE="audio/ogg" ;;
    mp3)        CONTENT_TYPE="audio/mpeg" ;;
    wav)        CONTENT_TYPE="audio/wav" ;;
    mp4|m4a)    CONTENT_TYPE="audio/mp4" ;;
    webm)       CONTENT_TYPE="audio/webm" ;;
    aac)        CONTENT_TYPE="audio/aac" ;;
    flac)       CONTENT_TYPE="audio/flac" ;;
    *)          CONTENT_TYPE="audio/mpeg" ;;
  esac
fi

FILE_SIZE=$(du -sm "$AUDIO_FILE" | cut -f1)
echo "Sending ${FILE_SIZE}MB to Deepgram ($CONTENT_TYPE)..."

# ── Шаг 3: Deepgram API ─────────────────────────────────────────────────────
PARAMS="model=nova-3&language=${LANG}&smart_format=true&diarize=true&paragraphs=true&punctuate=true&utterances=true"
RESPONSE_FILE="${TMP_DIR}/response.json"

HTTP_CODE=$(curl -s -w "%{http_code}" \
  -X POST "https://api.deepgram.com/v1/listen?${PARAMS}" \
  -H "Authorization: Token ${API_KEY}" \
  -H "Content-Type: ${CONTENT_TYPE}" \
  --data-binary "@${AUDIO_FILE}" \
  -o "$RESPONSE_FILE")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERROR: Deepgram returned HTTP $HTTP_CODE"
  python3 -c "
import json
with open('$RESPONSE_FILE') as f:
    d = json.load(f)
print(d.get('err_msg', d.get('message', 'unknown error')))
" 2>/dev/null || cat "$RESPONSE_FILE" | head -200
  exit 1
fi

echo "Deepgram OK. Parsing response..."

# ── Шаг 4: Парсинг и форматирование ─────────────────────────────────────────
python3 - "$RESPONSE_FILE" "$OUT_MD" "$INPUT_FILE" "$LANG" "$DURATION_INT" <<'PYEOF'
import json, sys, os
from datetime import datetime

response_file = sys.argv[1]
out_md = sys.argv[2]
source_file = sys.argv[3]
lang = sys.argv[4]
duration = int(sys.argv[5])

with open(response_file) as f:
    data = json.load(f)

meta     = data.get('metadata', {})
results  = data.get('results', {})
utt      = results.get('utterances', [])
channels = results.get('channels', [])
alt      = channels[0]['alternatives'][0] if channels else {}
plain    = alt.get('transcript', '')

def fmt_time(sec):
    s = round(float(sec))
    h, rem = divmod(s, 3600)
    m, ss = divmod(rem, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{ss:02d}"
    return f"{m:02d}:{ss:02d}"

lines = []

if utt:
    for u in utt:
        speaker = f"Спикер {int(u.get('speaker', 0)) + 1}"
        ts = fmt_time(u.get('start', 0))
        text = u.get('transcript', '').strip()
        if text:
            lines.append(f"**{speaker}** [{ts}]: {text}")
elif alt.get('paragraphs', {}).get('paragraphs'):
    for para in alt['paragraphs']['paragraphs']:
        spk = para.get('speaker')
        for sent in para.get('sentences', []):
            ts = fmt_time(sent.get('start', 0))
            text = sent.get('text', '').strip()
            if spk is not None:
                lines.append(f"**Спикер {spk + 1}** [{ts}]: {text}")
            else:
                lines.append(f"[{ts}] {text}")
else:
    lines.append(plain)

speakers = set(u.get('speaker', 0) for u in utt) if utt else set()
n_speakers = len(speakers) if speakers else 1
transcript_body = '\n'.join(lines)
created_at = datetime.now().strftime('%Y-%m-%d %H:%M')
basename = os.path.basename(source_file)
dur_min = duration // 60
word_count = len(plain.split())

md = f"""# Транскрипт: {basename}

**Дата:** {created_at}
**Файл:** `{source_file}`
**Длительность:** {dur_min} мин ({duration} сек)
**Язык:** {lang}
**Спикеров:** {n_speakers}
**Слов:** {word_count}

---

## Транскрипт

{transcript_body}

---

*Создано: audio-transcribe / Deepgram Nova-3*
"""

with open(out_md, 'w', encoding='utf-8') as f:
    f.write(md)

print(f"Speakers : {n_speakers}")
print(f"Lines    : {len(lines)}")
print(f"Words    : {word_count}")
print(f"Saved    : {out_md}")
PYEOF

echo ""
echo "=== ГОТОВО ==="
echo "Транскрипт: $OUT_MD"
