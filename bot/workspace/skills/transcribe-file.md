---
name: transcribe-file
triggers: [транскрибируй, расшифруй, транскрипция, transcribe, текст из аудио, текст из видео, превратить в текст, что в записи, что на видео, что на записи]
---

# Транскрибация любого медиа-файла через Deepgram

Когда пользователь присылает аудио/видео файл (любой формат: mp3, wav, m4a, ogg, opus, mp4, mov, mkv, webm, ...) и просит расшифровать/транскрибировать — используй этот пайплайн.

## Что есть в окружении

- `ffmpeg`, `curl`, `jq`, `python3` установлены
- Один из двух ключей в env:
  - **Deepgram** (приоритет): `$DEEPGRAM_API_KEY`, `$DEEPGRAM_MODEL` (nova-3), `$DEEPGRAM_LANGUAGE` (ru)
  - **OpenAI Whisper** (fallback): `$OPENAI_API_KEY`
- Файлы юзера лежат в `workspace/uploads/<id>.<ext>` (или абсолютный путь из промпта)

## Пайплайн

```bash
INPUT="<абсолютный путь к файлу пользователя>"
OUT="/tmp/transcribe-$$.mp3"

# 1. Конвертация в mp3 (любой формат → 16kHz mono для всех бекендов)
ffmpeg -y -i "$INPUT" -vn -ac 1 -ar 16000 -b:a 32k -f mp3 "$OUT" 2>&1 | tail -3
SIZE=$(du -h "$OUT" | cut -f1)
echo "Конверт OK → $OUT ($SIZE)"

# 2. Транскрипция: Deepgram если есть ключ, иначе OpenAI Whisper
if [ -n "$DEEPGRAM_API_KEY" ]; then
  echo "Transcribing via Deepgram (${DEEPGRAM_MODEL:-nova-3} / ${DEEPGRAM_LANGUAGE:-ru})..."
  RESP=$(curl -sS -X POST "https://api.deepgram.com/v1/listen?model=${DEEPGRAM_MODEL:-nova-3}&language=${DEEPGRAM_LANGUAGE:-ru}&smart_format=true&punctuate=true&paragraphs=true" \
    -H "Authorization: Token $DEEPGRAM_API_KEY" \
    -H "Content-Type: audio/mpeg" \
    --data-binary @"$OUT")
  echo "$RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
try:
    print(d['results']['channels'][0]['alternatives'][0]['paragraphs']['transcript'])
except (KeyError, IndexError):
    try:
        print(d['results']['channels'][0]['alternatives'][0]['transcript'])
    except Exception:
        print('DEEPGRAM ERROR:', d.get('err_msg') or json.dumps(d)[:500])
"
elif [ -n "$OPENAI_API_KEY" ]; then
  echo "Transcribing via OpenAI Whisper (whisper-1 / ru)..."
  curl -sS -X POST https://api.openai.com/v1/audio/transcriptions \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -F file="@$OUT" \
    -F model="whisper-1" \
    -F language="ru" \
    -F response_format="text"
  echo
else
  echo "ERROR: ни DEEPGRAM_API_KEY, ни OPENAI_API_KEY не заданы"
fi

# 3. Подчистка
rm -f "$OUT"
```

Логика: бот выбирает бекенд автоматически по тому, какой ключ у него в env. У Олега и Кати — Deepgram. У Димы — OpenAI Whisper. Менять скилл под каждого не надо.

## Правила вывода — РЕЗУЛЬТАТ ВСЕГДА В ЧАТ

Главное: пользователь должен увидеть СОДЕРЖАНИЕ прямо в Telegram-ответе, а не «сохранил в файл».

- **Короткая запись (расшифровка до ~1500 символов)** — выведи всю расшифровку текстом в чат.
- **Длинная запись / встреча / звонок** — выведи в чат **САММАРИ**: ключевые решения, договорённости, цифры, имена, сроки (5-15 пунктов). Полную расшифровку сохрани в `workspace/second-brain/INBOX/transcripts/YYYY-MM-DD-HHMM-<slug>-FULL.md` и дай путь СНИЗУ под саммари. Файл — дополнение, НЕ замена: саммари обязано быть в самом ответе.
- Саммари сверяй с расшифровкой — каждая цифра/имя/договорённость есть в тексте. Нет подтверждения → не включать или пометить «предположительно».
- ffmpeg упал (битый файл, кодек) → код ошибки + предложи другой формат. Deepgram 401/402/429 → причина явно.

## Когда НЕ использовать

- Если файл — обычное Telegram голосовое (`voice_note`) — оно уже автоматически транскрибируется в `[Voice transcribed]: ...` через бот-роутер. Этот скилл нужен для **присланных файлов / видео / больших аудио**.

## Примеры пользовательских триггеров

- «расшифруй»
- «что там в этой записи»
- «транскрибируй интервью»
- «превратить видео в текст»
- «выгрузи текст из аудио»
